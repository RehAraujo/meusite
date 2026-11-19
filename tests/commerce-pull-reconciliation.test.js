// @vitest-environment node
// Acceptance: an approved real payment must be recognized and release the template even if
// the webhook notification fails. Production-mode identity checks stay in force.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCommerce, hash, orderMismatches } from '../worker/commerce/handler.js';

const origin = 'https://shopping.renatajoin.com';
const id = '81128689-2759-4ca1-a1be-c808c34921d1';
const mpId = 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const bearer = 'ab'.repeat(32);
const SELLER = '1234567890';
const APP = '9876543210';
const TEMPLATE = 'https://fixture-workspace.notion.site/Template-fixture-0000';
let env, db, provider, logs;

const paidOrder = (overrides = {}) => ({
  id: mpId,
  type: 'online',
  external_reference: id,
  currency: 'BRL',
  total_amount: '47.00',
  total_paid_amount: '47.00',
  status: 'processed',
  status_detail: 'accredited',
  processing_mode: 'manual',
  user_id: Number(SELLER),
  integration_data: { application_id: APP },
  items: [{ title: 'Meu Dinheiro, Minhas Regras', quantity: 1, unit_price: '47.00' }],
  live_mode: true,
  transactions: {
    payments: [{ id: 'PAY01KS5AJ6HTK2HRQ3XJ3C2JCKP9', status: 'processed' }],
    refunds: [],
    chargebacks: [],
  },
  last_updated_date: new Date(Date.now() - 1000).toISOString(),
  ...overrides,
});
const request = (path, { token = bearer, headers = {} } = {}) =>
  new Request(`${origin}/api/commerce${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Download-Attempt': webcrypto.randomUUID(),
      ...headers,
    },
  });
const run = (path, options) => handleCommerce(request(path, options), env);
const orderReads = () =>
  provider.mock.calls.filter(([url]) => url === `https://api.mercadopago.com/v1/orders/${mpId}`)
    .length;
const row = () =>
  db.prepare('SELECT status, status_detail, access_expires, created_at FROM commerce_orders').get();

beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((line) => logs.push(line));
  db = new DatabaseSync(':memory:');
  for (const file of ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'])
    db.exec(readFileSync(new URL(`../migrations/commerce/${file}`, import.meta.url), 'utf8'));
  // An order created at checkout whose payment notification never arrived.
  db.prepare(
    `INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,mp_id,checkout_url,status,status_detail,created_at,access_expires)
     VALUES (?,?,'meu-dinheiro-minhas-regras','Meu Dinheiro, Minhas Regras',4700,'BRL','products/meu-dinheiro-minhas-regras/v1.zip','meu-dinheiro-minhas-regras.zip',?,?, 'created','created',?,?)`,
  ).run(
    id,
    await hash(bearer),
    mpId,
    `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
    Date.now() - 3600000,
    Date.now() + 6 * 86400000,
  );
  env = {
    COMMERCE_ENVIRONMENT: 'production',
    COMMERCE_MODE: 'production',
    COMMERCE_ORIGIN: origin,
    COMMERCE_PRODUCTION_ORIGIN: origin,
    COMMERCE_SELLER_ID: SELLER,
    COMMERCE_APPLICATION_ID: APP,
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-synthetic-production',
    MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-webhook-secret',
    NOTION_TEMPLATE_URL_MEU_DINHEIRO: TEMPLATE,
    COMMERCE_DB: {
      prepare(sql) {
        const statement = db.prepare(sql);
        return {
          bind(...args) {
            return {
              first: async () => statement.get(...args) || null,
              run: async () => statement.run(...args),
            };
          },
        };
      },
    },
    DIGITAL_PRODUCTS: {
      head: vi.fn(async () => ({ size: 3 })),
      get: vi.fn(async () => ({ body: 'zip-test' })),
    },
  };
  provider = vi.fn(async () => Response.json(paidOrder()));
  vi.stubGlobal('fetch', (url, options) =>
    url === 'https://api.mercadolibre.com/users/me'
      ? Promise.resolve(Response.json({ id: Number(SELLER), site_id: 'MLB', tags: ['normal'] }))
      : provider(url, options),
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('webhook fallback: authoritative check when the buyer opens the order', () => {
  it('recognizes an approved payment without any webhook and releases the template', async () => {
    const view = await (await run(`/orders/${id}`)).json();
    expect(view).toMatchObject({ paid: true, status: 'processed', status_detail: 'accredited' });
    expect(row().access_expires - row().created_at).toBe(365 * 86400000);
    const access = await run(`/orders/${id}/access`);
    expect(access.status).toBe(200);
    expect(await access.json()).toEqual({ url: TEMPLATE });
    expect(logs.map((l) => JSON.parse(l).event)).toContain('order_confirmed_by_pull');
  });

  it('never creates an order or a charge: only the read of the existing Order', async () => {
    await run(`/orders/${id}`);
    for (const [url, options] of provider.mock.calls) {
      expect(url).toBe(`https://api.mercadopago.com/v1/orders/${mpId}`);
      expect(options?.method ?? 'GET').toBe('GET');
    }
    expect(db.prepare('SELECT count(*) n FROM commerce_orders').get().n).toBe(1);
  });

  it.each([
    ['another seller', { user_id: 1111111111 }, 'seller'],
    ['another application', { integration_data: { application_id: '2222' } }, 'application'],
    [
      'another external reference',
      { external_reference: '00000000-0000-4000-8000-000000000000' },
      'external_reference',
    ],
    ['another amount', { total_amount: '4.70' }, 'total_amount'],
    ['another currency', { currency: 'USD' }, 'currency'],
    [
      'another item',
      { items: [{ title: 'Outro', quantity: 1, unit_price: '47.00' }] },
      'item_title',
    ],
  ])(
    'keeps the order unpaid for %s and logs only the failed check name',
    async (_label, override, field) => {
      provider.mockImplementation(async () => Response.json(paidOrder(override)));
      const view = await (await run(`/orders/${id}`)).json();
      expect(view.paid).toBe(false);
      expect(row().status).toBe('created');
      expect((await run(`/orders/${id}/access`)).status).toBe(503);
      const entry = logs.map((l) => JSON.parse(l)).find((e) => e.event === 'pull_reconcile_failed');
      expect(entry).toMatchObject({ reason: 'mismatch', order: '81128689' });
      expect(entry.fields).toContain(field);
    },
  );

  it('does not release access when the paid amount differs from the price', async () => {
    provider.mockImplementation(async () =>
      Response.json(paidOrder({ total_paid_amount: '1.00' })),
    );
    expect((await (await run(`/orders/${id}`)).json()).paid).toBe(false);
    expect(row().status).toBe('created');
  });

  it('keeps pending and rejected payments without access', async () => {
    provider.mockImplementation(async () =>
      Response.json(
        paidOrder({
          status: 'action_required',
          status_detail: 'waiting_retry',
          total_paid_amount: '0.00',
        }),
      ),
    );
    const view = await (await run(`/orders/${id}`)).json();
    expect(view).toMatchObject({ paid: false, can_retry: true });
    expect((await run(`/orders/${id}/access`)).status).toBe(403);
  });

  it('applies refunds found by the check: blocks access permanently', async () => {
    provider.mockImplementation(async () =>
      Response.json(
        paidOrder({
          status: 'refunded',
          status_detail: 'refunded',
          transactions: { payments: [], refunds: [{ id: 'REF1' }], chargebacks: [] },
        }),
      ),
    );
    const view = await (await run(`/orders/${id}`)).json();
    expect(view).toMatchObject({ paid: false, delivery_blocked: true, block: 'refund' });
  });

  it('on provider failure keeps the stored state (200, not paid) and logs the HTTP status', async () => {
    provider.mockImplementation(async () => new Response('upstream secret body', { status: 500 }));
    const response = await run(`/orders/${id}`);
    expect(response.status).toBe(200);
    expect((await response.json()).paid).toBe(false);
    const entry = logs.map((l) => JSON.parse(l)).find((e) => e.event === 'pull_reconcile_failed');
    expect(entry).toMatchObject({ reason: 'provider', provider_status: 500 });
  });

  it('throttles provider checks per order (at most 2 per minute)', async () => {
    provider.mockImplementation(async () =>
      Response.json(
        paidOrder({
          status: 'action_required',
          status_detail: 'waiting_payment',
          total_paid_amount: '0.00',
        }),
      ),
    );
    for (let i = 0; i < 5; i += 1) await run(`/orders/${id}`);
    expect(orderReads()).toBe(2);
  });

  it('stops asking the provider once the payment is confirmed', async () => {
    await run(`/orders/${id}`);
    provider.mockClear();
    await run(`/orders/${id}`);
    expect(orderReads()).toBe(0);
  });

  it('never queries the provider for a missing or wrong token', async () => {
    expect((await run(`/orders/${id}`, { token: null })).status).toBe(404);
    expect((await run(`/orders/${id}`, { token: 'cd'.repeat(32) })).status).toBe(404);
    expect(orderReads()).toBe(0);
  });

  it('ignores browser return parameters: only the provider state counts', async () => {
    provider.mockImplementation(async () =>
      Response.json(
        paidOrder({
          status: 'action_required',
          status_detail: 'waiting_payment',
          total_paid_amount: '0.00',
        }),
      ),
    );
    const view = await (
      await run(`/orders/${id}?status=approved&collection_status=approved`)
    ).json();
    expect(view.paid).toBe(false);
  });

  it('keeps refunds and access working while new sales are closed', async () => {
    env.COMMERCE_SALES = 'closed';
    expect((await (await run(`/orders/${id}`)).json()).paid).toBe(true);
    expect((await run(`/orders/${id}/access`)).status).toBe(200);
  });
});

describe('safe logging', () => {
  it('never logs tokens, URLs, provider bodies or payer data', async () => {
    provider.mockImplementation(async () =>
      Response.json(paidOrder({ payer: { email: 'buyer@example.com' }, user_id: 1 })),
    );
    await run(`/orders/${id}`);
    provider.mockImplementation(
      async () =>
        new Response(JSON.stringify({ token: bearer, email: 'buyer@example.com' }), {
          status: 401,
        }),
    );
    db.prepare("UPDATE commerce_orders SET status='created'").run();
    await run(`/orders/${id}`, { headers: {} });
    const text = logs.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const secret of [bearer, 'APP_USR', 'buyer@example.com', 'notion.site', 'http', mpId, id])
      expect(text).not.toContain(secret);
  });

  it('names only the failed checks', () => {
    expect(
      orderMismatches(
        paidOrder({ currency: 'USD', user_id: 2 }),
        {
          mp_id: mpId,
          id,
          currency: 'BRL',
          amount_cents: 4700,
          product_title: 'Meu Dinheiro, Minhas Regras',
        },
        env,
      ),
    ).toEqual(['currency', 'seller']);
  });
});

describe('production observability', () => {
  it('records only the sanitized console events, not per-request invocation logs', () => {
    const config = JSON.parse(
      readFileSync(new URL('../config/commerce-production.prepared.json', import.meta.url), 'utf8'),
    );
    expect(config.observability).toEqual({
      enabled: true,
      logs: { enabled: true, invocation_logs: false },
    });
  });
});
