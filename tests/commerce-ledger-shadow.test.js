// @vitest-environment node
// R1a: the shadow ledger never changes what the store answers or delivers.
import { createHmac, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createD1 } from './helpers/d1-sqlite.js';
import { handleCommerce, hash } from '../worker/commerce/handler.js';

const origin = 'https://shopping.renatajoin.com';
const id = '81128689-2759-4ca1-a1be-c808c34921d1';
const mpId = 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const bearer = 'ab'.repeat(32);
const SELLER = '1234567890';
const APP = '9876543210';
let logs;

const providerOrder = (overrides = {}) => ({
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

async function store({ shadow, migrations, remote = providerOrder() }) {
  const { db, binding } = createD1(migrations ? { migrations } : undefined);
  db.prepare(
    `INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,mp_id,checkout_url,status,status_detail,created_at,access_expires)
     VALUES (?,?,'meu-dinheiro-minhas-regras','Meu Dinheiro, Minhas Regras',4700,'BRL','products/meu-dinheiro-minhas-regras/v1.zip','meu-dinheiro-minhas-regras.zip',?,?,'created','created',?,?)`,
  ).run(
    id,
    await hash(bearer),
    mpId,
    `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
    Date.now() - 3600000,
    Date.now() + 6 * 86400000,
  );
  const env = {
    COMMERCE_ENVIRONMENT: 'production',
    COMMERCE_MODE: 'production',
    COMMERCE_ORIGIN: origin,
    COMMERCE_PRODUCTION_ORIGIN: origin,
    COMMERCE_SELLER_ID: SELLER,
    COMMERCE_APPLICATION_ID: APP,
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-synthetic-production',
    MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-webhook-secret',
    NOTION_TEMPLATE_URL_MEU_DINHEIRO: 'https://fixture-workspace.notion.site/Template-fixture-0000',
    COMMERCE_DB: binding,
    DIGITAL_PRODUCTS: {
      head: vi.fn(async () => ({ size: 3 })),
      get: vi.fn(async () => ({ body: 'zip-test' })),
    },
    ...(shadow ? { COMMERCE_LEDGER_SHADOW: 'on' } : {}),
  };
  vi.stubGlobal('fetch', async (url) =>
    url === 'https://api.mercadolibre.com/users/me'
      ? Response.json({ id: Number(SELLER), site_id: 'MLB', tags: ['normal'] })
      : Response.json(remote),
  );
  const get = async (path, ctx) => {
    const response = await handleCommerce(
      new Request(`${origin}/api/commerce/orders/${id}${path}`, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          'X-Download-Attempt': webcrypto.randomUUID(),
        },
      }),
      env,
      undefined,
      ctx,
    );
    return {
      status: response.status,
      body: path === '/download' ? await response.text() : await response.json(),
    };
  };
  return { db, get, env, binding };
}
const stable = ({ status, body }) => ({
  status,
  body: { ...body, access_expires: typeof body.access_expires },
});

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((line) => logs.push(JSON.parse(line)));
});
afterEach(() => vi.unstubAllGlobals());

it('is off by default: no ledger writes, same answers', async () => {
  const { db, get } = await store({ shadow: false });
  expect((await get('')).body.paid).toBe(true);
  expect(db.prepare('SELECT COUNT(*) n FROM commerce_payment_attempts').get().n).toBe(0);
  expect(logs.some((l) => l.event.startsWith('ledger_shadow'))).toBe(false);
});

it('answers status, access and download exactly as without shadow', async () => {
  const off = await store({ shadow: false });
  const answersOff = [
    stable(await off.get('')),
    await off.get('/access'),
    await off.get('/download'),
  ];
  const on = await store({ shadow: true });
  const answersOn = [stable(await on.get('')), await on.get('/access'), await on.get('/download')];
  expect(answersOn).toEqual(answersOff);
  expect(on.db.prepare('SELECT settled, amount_cents FROM commerce_settlements').all()).toEqual([
    { settled: 1, amount_cents: 4700 },
  ]);
  expect(on.db.prepare('SELECT state FROM commerce_entitlements').get().state).toBe('active');
  expect(
    logs
      .filter((l) => l.event === 'ledger_shadow')
      .every((l) => l.detail === 'match_active_deliverable'),
  ).toBe(true);
});

it('keeps refusing a refunded order and agrees in shadow', async () => {
  const remote = providerOrder({
    status: 'refunded',
    status_detail: 'refunded',
    transactions: {
      payments: [{ id: 'PAY01KS5AJ6HTK2HRQ3XJ3C2JCKP9', status: 'refunded' }],
      refunds: [{ id: 'R1', transaction_id: 'PAY01KS5AJ6HTK2HRQ3XJ3C2JCKP9', amount: '47.00' }],
      chargebacks: [],
    },
  });
  const off = await store({ shadow: false, remote });
  const on = await store({ shadow: true, remote });
  expect(await on.get('/access')).toEqual(await off.get('/access'));
  expect((await on.get('/access')).status).toBe(403);
  expect(on.db.prepare('SELECT state, reason FROM commerce_entitlements').get()).toEqual({
    state: 'revoked',
    reason: 'refunded',
  });
});

it('still answers normally when shadow is on but the migration is missing', async () => {
  const { get } = await store({
    shadow: true,
    migrations: ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'],
  });
  const answer = await get('');
  expect(answer).toMatchObject({ status: 200, body: { paid: true } });
  expect(logs.some((l) => l.event === 'ledger_shadow_failed')).toBe(true);
});

const call = (env, request, ctx) => handleCommerce(request, env, undefined, ctx);
function signedWebhook() {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = 'shadow-test-request';
  const v1 = createHmac('sha256', 'synthetic-webhook-secret')
    .update(`id:${mpId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return new Request(`${origin}/api/commerce/webhook?data.id=${mpId}&type=order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${v1}`,
    },
    body: JSON.stringify({ type: 'order', data: { id: mpId }, live_mode: true }),
  });
}
const checkoutRequest = () =>
  new Request(`${origin}/api/commerce/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
    },
    body: JSON.stringify({ product_id: 'meu-dinheiro-minhas-regras' }),
  });

it('webhook answers the same with shadow on, and the ledger records the payment', async () => {
  const off = await store({ shadow: false });
  const on = await store({ shadow: true });
  const a = await call(off.env, signedWebhook());
  const b = await call(on.env, signedWebhook());
  expect([b.status, await b.json()]).toEqual([a.status, await a.json()]);
  expect(b.status).toBe(200);
  expect(on.db.prepare('SELECT status FROM commerce_orders').get()).toEqual(
    off.db.prepare('SELECT status FROM commerce_orders').get(),
  );
  expect(on.db.prepare('SELECT COUNT(*) n FROM commerce_settlements').get().n).toBe(1);
});

it('checkout never runs the shadow and answers the same', async () => {
  const off = await store({ shadow: false });
  const on = await store({ shadow: true });
  const a = await call(off.env, checkoutRequest());
  const b = await call(on.env, checkoutRequest());
  expect(stable({ status: b.status, body: await b.json() })).toEqual(
    stable({ status: a.status, body: await a.json() }),
  );
  expect(on.db.prepare('SELECT COUNT(*) n FROM commerce_payment_attempts').get().n).toBe(0);
});

it('answers before the shadow finishes (waitUntil) and uses one D1 round trip', async () => {
  const { db, get, binding } = await store({ shadow: true });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const batch = binding.batch.bind(binding);
  let batches = 0;
  binding.batch = async (statements) => {
    batches += 1;
    await gate;
    return batch(statements);
  };
  const pending = [];
  const ctx = { waitUntil: (promise) => pending.push(promise) };
  // The current flow itself uses one batch (writeThenRead) only on checkout, not here.
  const answer = await get('', ctx);
  expect(answer).toMatchObject({ status: 200, body: { paid: true } });
  // pending also holds the existing rate-limit cleanup; the shadow is one more task.
  expect(pending.length).toBeGreaterThanOrEqual(1);
  expect(db.prepare('SELECT COUNT(*) n FROM commerce_settlements').get().n).toBe(0);
  release();
  await Promise.all(pending);
  expect(batches).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM commerce_settlements').get().n).toBe(1);
});

it('a failing shadow inside waitUntil never rejects', async () => {
  const { get, binding } = await store({ shadow: true });
  binding.batch = async () => {
    throw new Error('D1_ERROR');
  };
  const pending = [];
  const answer = await get('', { waitUntil: (promise) => pending.push(promise) });
  expect(answer.status).toBe(200);
  const settled = await Promise.allSettled(pending);
  expect(settled.every((r) => r.status === 'fulfilled')).toBe(true);
  expect(settled.map((r) => r.value)).toContain(null);
  expect(logs.some((l) => l.event === 'ledger_shadow_failed')).toBe(true);
});
