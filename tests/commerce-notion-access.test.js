// @vitest-environment node
// Notion template delivery: the private URL is released only by /access, only to the
// buyer's token, only after an authoritative paid Order, and never in any other response.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCommerce, templateUrl } from '../worker/commerce/handler.js';
import { CATALOG } from '../worker/commerce/catalog.js';
import { SECRET_NAMES, findNotionLeaks, releasePlan } from '../scripts/commerce-release-plan.mjs';

const origin = 'https://staging.example.com';
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const mpId = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const bearer = 'ab'.repeat(32);
const TEMPLATE = 'https://fixture-workspace.notion.site/Template-fixture-0000';
const PRODUCT = 'meu-dinheiro-minhas-regras';
let env, db, provider;

function request(path, { method = 'GET', payload, headers = {}, token = bearer } = {}) {
  return new Request(`${origin}/api/commerce${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
      'X-Download-Attempt': webcrypto.randomUUID(),
      ...headers,
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
}
const run = (path, options) => handleCommerce(request(path, options), env);
const access = (options) => run(`/orders/${id}/access`, options);
const snapshot = (overrides = {}) => ({
  id: mpId,
  type: 'online',
  external_reference: id,
  currency: 'BRL',
  total_amount: '47.00',
  total_paid_amount: '47.00',
  status: 'processed',
  status_detail: 'accredited',
  last_updated_date: new Date(Date.now() - 1000).toISOString(),
  ...overrides,
});
async function checkout(product = PRODUCT) {
  provider.mockResolvedValue(
    Response.json({
      id: mpId,
      status: 'created',
      status_detail: 'created',
      checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
    }),
  );
  return run('/checkout', { method: 'POST', payload: { product_id: product } });
}
async function signedWebhook() {
  const requestId = 'request-test';
  const timestamp = String(Date.now());
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.MERCADOPAGO_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await webcrypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`id:${mpId.toLowerCase()};request-id:${requestId};ts:${timestamp};`),
  );
  return request(`/webhook?data.id=${mpId}&type=order`, {
    method: 'POST',
    headers: {
      'x-request-id': requestId,
      'x-signature': `ts=${timestamp},v1=${Buffer.from(digest).toString('hex')}`,
    },
    payload: { type: 'order', data: { id: mpId }, live_mode: false },
  });
}
// The provider answers every authoritative GET with this Order state.
function provide(remote) {
  provider.mockImplementation(async () => Response.json(remote));
}
async function notify(remote = snapshot()) {
  provide(remote);
  return handleCommerce(await signedWebhook(), env);
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  db = new DatabaseSync(':memory:');
  for (const file of ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'])
    db.exec(readFileSync(new URL(`../migrations/commerce/${file}`, import.meta.url), 'utf8'));
  env = {
    COMMERCE_ENVIRONMENT: 'staging',
    COMMERCE_MODE: 'test',
    COMMERCE_ORIGIN: origin,
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-fixture-only',
    MERCADOPAGO_WEBHOOK_SECRET: 'fixture-webhook-secret',
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
  provider = vi.fn(() => {
    throw new Error('Unexpected outbound call');
  });
  vi.stubGlobal('fetch', (url, options) =>
    url === 'https://api.mercadolibre.com/users/me'
      ? Promise.resolve(Response.json({ id: 3792015931, site_id: 'MLB', tags: ['test_user'] }))
      : provider(url, options),
  );
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('Notion template access after payment', () => {
  it('releases the template URL only after an authoritative paid Order, with no-store headers', async () => {
    expect((await checkout()).status).toBe(200);
    expect((await notify()).status).toBe(200);
    const response = await access();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: TEMPLATE });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('re-checks the Order with Mercado Pago on every access instead of trusting stored state', async () => {
    await checkout();
    await notify();
    provider.mockClear();
    await access();
    await access();
    const orderReads = provider.mock.calls.filter(([url]) => url.endsWith(`/v1/orders/${mpId}`));
    expect(orderReads).toHaveLength(2);
  });

  it.each([
    ['created (checkout opened, never paid)', { status: 'created', status_detail: 'created' }],
    ['pending payment', { status: 'action_required', status_detail: 'waiting_payment' }],
    ['rejected payment', { status: 'failed', status_detail: 'rejected' }],
    ['processed but not accredited', { status: 'processed', status_detail: 'in_review' }],
    ['canceled', { status: 'canceled', status_detail: 'canceled' }],
  ])('denies access for a %s Order', async (_label, state) => {
    await checkout();
    await notify(snapshot({ ...state, total_paid_amount: '0.00' }));
    provide(snapshot({ ...state, total_paid_amount: '0.00' }));
    const response = await access();
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('notion');
  });

  it('denies access before any webhook when the order has no provider id yet', async () => {
    provider.mockRejectedValue(new Error('provider down'));
    await checkout().catch(() => null);
    db.prepare('UPDATE commerce_orders SET mp_id=NULL').run();
    const response = await access();
    expect(response.status).toBe(403);
  });

  it('revokes access after a refund, even though the order was paid before', async () => {
    await checkout();
    await notify();
    expect((await access()).status).toBe(200);
    const refunded = snapshot({
      status: 'refunded',
      status_detail: 'refunded',
      last_updated_date: new Date().toISOString(),
    });
    await notify(refunded);
    provide(refunded);
    const response = await access();
    expect(response.status).toBe(403);
    const view = await (await run(`/orders/${id}`)).json();
    expect(view.paid).toBe(false);
    expect(view.delivery_blocked).toBe(true);
  });

  it('revokes access after a chargeback reported in the Order transactions', async () => {
    await checkout();
    await notify();
    const disputed = snapshot({
      transactions: {
        payments: [{ id: '555', status: 'charged_back' }],
        chargebacks: [],
        refunds: [],
      },
      last_updated_date: new Date().toISOString(),
    });
    await notify(disputed);
    provide(disputed);
    expect((await access()).status).toBe(403);
  });

  it('blocks access while an unassociated fraud or chargeback alert exists (fail closed)', async () => {
    await checkout();
    await notify();
    db.prepare(
      "INSERT INTO commerce_risk_events (topic,resource_id,task,received_at) VALUES ('fraud','999','refund_review',?)",
    ).run(Date.now());
    expect((await access()).status).toBe(403);
  });

  it('rejects requests without a token, with another token, or after the access window', async () => {
    await checkout();
    await notify();
    expect((await access({ token: null })).status).toBe(404);
    expect((await access({ token: 'cd'.repeat(32) })).status).toBe(404);
    db.prepare('UPDATE commerce_orders SET access_expires=?').run(Date.now() - 1);
    expect((await access()).status).toBe(404);
  });

  it('never exposes the URL in the catalog or the order view; the view only names the channel', async () => {
    await checkout();
    await notify();
    const catalog = await (await run('/catalog')).text();
    const view = await (await run(`/orders/${id}`)).text();
    for (const text of [catalog, view]) {
      expect(text).not.toContain(TEMPLATE);
      expect(text).not.toMatch(/notion\.(so|site)/);
      expect(text).not.toContain('NOTION_TEMPLATE_URL');
    }
    expect(JSON.parse(view).delivery).toBe('notion');
  });

  it('does not consume the 10 ZIP downloads; the ZIP stays available as an alternative', async () => {
    await checkout();
    await notify();
    for (let i = 0; i < 15; i += 1) expect((await access()).status).toBe(200);
    expect(db.prepare('SELECT downloads FROM commerce_orders').get().downloads).toBe(0);
    const zip = await run(`/orders/${id}/download`);
    expect(zip.status).toBe(200);
    expect(await zip.text()).toBe('zip-test');
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['plain http', 'http://fixture.notion.site/Template'],
    ['another host', 'https://evil.example/notion.site/Template'],
    ['look-alike host', 'https://notion.site.evil.example/Template'],
    ['embedded credentials', 'https://user:pass@fixture.notion.site/Template'],
    ['explicit port', 'https://fixture.notion.site:8443/Template'],
  ])('fails closed with 503 and no details when the secret is %s', async (_label, value) => {
    await checkout();
    await notify();
    env.NOTION_TEMPLATE_URL_MEU_DINHEIRO = value;
    const response = await access();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain('evil');
    expect(text).not.toContain('NOTION_TEMPLATE_URL');
  });

  it('returns 404 for products delivered only as a file', async () => {
    await checkout('planner-treino');
    await notify(snapshot({ total_amount: '25.00', total_paid_amount: '25.00' }));
    provide(snapshot({ total_amount: '25.00', total_paid_amount: '25.00' }));
    expect((await access()).status).toBe(404);
  });

  it('stays unavailable while commerce is disabled', async () => {
    await checkout();
    await notify();
    env.COMMERCE_MODE = 'disabled';
    expect((await access()).status).toBe(503);
  });
});

describe('private template URL handling', () => {
  it('keeps only the secret name in the catalog', () => {
    expect(CATALOG[PRODUCT].access).toEqual({
      type: 'notion',
      secret: 'NOTION_TEMPLATE_URL_MEU_DINHEIRO',
    });
    expect(JSON.stringify(CATALOG)).not.toMatch(/notion\.(so|site)/);
  });

  it('accepts only https Notion hosts', () => {
    const product = CATALOG[PRODUCT];
    const at = (value) => templateUrl({ NOTION_TEMPLATE_URL_MEU_DINHEIRO: value }, product);
    expect(at('https://www.notion.so/Template-abc')).toBe('https://www.notion.so/Template-abc');
    expect(at(TEMPLATE)).toBe(TEMPLATE);
    expect(at('javascript:alert(1)')).toBeNull();
    expect(
      templateUrl({ NOTION_TEMPLATE_URL_MEU_DINHEIRO: TEMPLATE }, CATALOG['planner-treino']),
    ).toBeNull();
  });

  it('treats the template URL as a Worker secret in the release plan', () => {
    expect(SECRET_NAMES).toContain('NOTION_TEMPLATE_URL_MEU_DINHEIRO');
    const config = {
      vars: { COMMERCE_MODE: 'disabled', NOTION_TEMPLATE_URL_MEU_DINHEIRO: TEMPLATE },
    };
    expect(() => releasePlan({ sha: 'a'.repeat(40), config })).toThrow(/NOTION_TEMPLATE_URL/);
  });

  it('refuses to publish when a versioned file contains a Notion URL', () => {
    const files = [
      { path: 'src/ok.js', text: 'Template para Notion' },
      { path: 'public/leak.txt', text: `link: ${TEMPLATE}` },
    ];
    expect(findNotionLeaks(files)).toEqual(['public/leak.txt']);
    const config = { vars: { COMMERCE_MODE: 'disabled' } };
    expect(() => releasePlan({ sha: 'a'.repeat(40), config, leaks: ['public/leak.txt'] })).toThrow(
      /Link do Notion/,
    );
  });
});
