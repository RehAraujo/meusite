// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCommerce, verifySignature, checkoutUrl, hash } from '../worker/commerce/handler.js';

const origin = 'https://staging.example.com';
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const mpId = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const bearer = 'ab'.repeat(32);
let env, db, provider;
function request(path, { method = 'GET', payload, headers = {} } = {}) {
  return new Request(`${origin}/api/commerce${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
      ...headers,
    },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
}
const run = (path, options) => handleCommerce(request(path, options), env);
function snapshot(overrides = {}) {
  return {
    id: mpId,
    type: 'online',
    external_reference: id,
    currency: 'BRL',
    total_amount: '25.00',
    total_paid_amount: '25.00',
    status: 'processed',
    status_detail: 'accredited',
    last_updated_date: new Date(Date.now() - 1000).toISOString(),
    ...overrides,
  };
}
async function checkout() {
  provider.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: mpId,
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
      }),
    ),
  );
  return run('/checkout', { method: 'POST', payload: { product_id: 'planner-treino' } });
}
async function signed({
  dataId = mpId,
  timestamp = String(Date.now()),
  bodyId = dataId,
  type = 'order',
  ...payload
} = {}) {
  const requestId = 'request-test';
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
    new TextEncoder().encode(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`),
  );
  const hex = Buffer.from(digest).toString('hex');
  return request(`/webhook?data.id=${dataId}&type=${type}`, {
    method: 'POST',
    headers: { 'x-request-id': requestId, 'x-signature': `ts=${timestamp},v1=${hex}` },
    payload: { type, data: { id: bodyId }, live_mode: false, ...payload },
  });
}
async function notify(remote = snapshot()) {
  provider.mockImplementation(async () => new Response(JSON.stringify(remote)));
  return handleCommerce(await signed(), env);
}
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/commerce/0001_orders.sql', import.meta.url), 'utf8'));
  db.exec(
    readFileSync(
      new URL('../migrations/commerce/0002_delivery_safety.sql', import.meta.url),
      'utf8',
    ),
  );
  env = {
    COMMERCE_ENVIRONMENT: 'staging',
    COMMERCE_MODE: 'test',
    COMMERCE_ORIGIN: origin,
    MERCADOPAGO_ACCESS_TOKEN: 'TEST-fixture-only',
    MERCADOPAGO_WEBHOOK_SECRET: 'fixture-webhook-secret',
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
  vi.stubGlobal('fetch', provider);
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('commerce integration with real SQLite persistence and mocked network', () => {
  it('migration is additive and repeatable; catalogue omits private keys and secrets', async () => {
    db.exec(
      readFileSync(new URL('../migrations/commerce/0001_orders.sql', import.meta.url), 'utf8'),
    );
    const response = await run('/catalog');
    const text = await response.text();
    expect(text).toContain('67.00');
    expect(text).toContain('25.00');
    expect(text).not.toMatch(/TEST-fixture|products\/|token_hash/);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(provider).not.toHaveBeenCalled();
  });
  it.each(['APP_USR-real', 'USR-unverified', '', undefined])(
    'blocks unverified credentials before any calls: %s',
    async (key) => {
      env.MERCADOPAGO_ACCESS_TOKEN = key;
      expect((await checkout()).status).toBe(503);
      expect(provider).not.toHaveBeenCalled();
    },
  );
  it('blocks disabled mode, missing secret, missing bucket, invalid origin configuration', async () => {
    for (const [key, value] of [
      ['COMMERCE_MODE', 'disabled'],
      ['MERCADOPAGO_WEBHOOK_SECRET', ''],
      ['DIGITAL_PRODUCTS', null],
      ['COMMERCE_ORIGIN', 'http://staging.example.com'],
    ]) {
      const original = env[key];
      env[key] = value;
      expect((await checkout()).status).toBe(503);
      env[key] = original;
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it('creates a server-priced order once and persists only a hash of access token', async () => {
    expect((await checkout()).status).toBe(200);
    const [url, options] = provider.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/orders');
    expect(JSON.parse(options.body)).toMatchObject({
      type: 'online',
      processing_mode: 'manual',
      total_amount: '25.00',
      external_reference: id,
    });
    expect(options.headers['X-Idempotency-Key']).toBe(id);
    expect(JSON.stringify(options)).not.toContain(bearer);
    const row = db.prepare('SELECT * FROM commerce_orders').get();
    expect(row.token_hash).toBe(await hash(bearer));
    expect(JSON.stringify(row)).not.toContain(bearer);
    expect((await checkout()).status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(
      (await run('/checkout', { method: 'POST', payload: { product_id: 'planner-alimentar' } }))
        .status,
    ).toBe(409);
  });
  it('retries a timed-out creation using the identical key and payload', async () => {
    provider.mockRejectedValueOnce(new Error('timeout'));
    const options = { method: 'POST', payload: { product_id: 'planner-treino' } };
    expect((await run('/checkout', options)).status).toBe(503);
    provider.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: mpId,
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
        }),
      ),
    );
    expect((await run('/checkout', options)).status).toBe(200);
    expect(provider.mock.calls[0][1].body).toBe(provider.mock.calls[1][1].body);
    expect(provider.mock.calls[0][1].headers['X-Idempotency-Key']).toBe(
      provider.mock.calls[1][1].headers['X-Idempotency-Key'],
    );
    expect(db.prepare('SELECT count(*) AS count FROM commerce_orders').get().count).toBe(1);
  });
  it('rejects client prices, prototype product IDs, cross-origin requests and oversized input', async () => {
    for (const payload of [
      { product_id: 'planner-treino', price: 1 },
      { product_id: '__proto__' },
      { product_id: 'missing' },
      { product_id: 'x'.repeat(20000) },
    ]) {
      expect((await run('/checkout', { method: 'POST', payload })).status).toBe(400);
    }
    expect(
      (
        await run('/checkout', {
          method: 'POST',
          payload: {},
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });
  it('never sells a product without its delivery asset', async () => {
    env.DIGITAL_PRODUCTS.head.mockResolvedValue(null);
    expect((await checkout()).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it('rate limits persist in D1 across requests', async () => {
    for (let i = 0; i < 10; i++) await run('/checkout', { method: 'POST', payload: {} });
    expect((await checkout()).status).toBe(429);
    expect(provider).not.toHaveBeenCalled();
  });
  it('rejects unsafe provider redirects and real order IDs', async () => {
    expect(
      checkoutUrl(
        `https://www.mercadopago.com.br.evil.test/checkout/v1/redirect?order_id=${mpId}`,
        mpId,
      ),
    ).toBeNull();
    expect(
      checkoutUrl(
        `https://user@www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
        mpId,
      ),
    ).toBeNull();
    provider.mockResolvedValue(
      new Response(JSON.stringify({ id: 'ORDREAL123', checkout_url: 'https://evil.test' })),
    );
    expect(
      (await run('/checkout', { method: 'POST', payload: { product_id: 'planner-treino' } }))
        .status,
    ).toBe(503);
    expect(db.prepare('SELECT mp_id FROM commerce_orders').get().mp_id).toBeNull();
  });
  it('authenticates signatures, rejecting forged, expired, duplicated and mismatching IDs', async () => {
    const valid = await signed();
    expect(await verifySignature(valid, new URL(valid.url), env.MERCADOPAGO_WEBHOOK_SECRET)).toBe(
      true,
    );
    const expired = await signed({ timestamp: String(Date.now() - 600000) });
    expect((await handleCommerce(expired, env)).status).toBe(401);
    const forged = await signed();
    forged.headers.set('x-signature', `ts=${Date.now()},v1=${'0'.repeat(64)}`);
    expect((await handleCommerce(forged, env)).status).toBe(401);
    const mismatch = await signed({ bodyId: 'ORDOTHER' });
    expect((await handleCommerce(mismatch, env)).status).toBe(400);
    const duplicate = await signed();
    expect(
      await verifySignature(
        duplicate,
        new URL(`${duplicate.url}&data.id=${mpId}`),
        env.MERCADOPAGO_WEBHOOK_SECRET,
      ),
    ).toBe(false);
    expect((await handleCommerce(await signed({ live_mode: true }), env)).status).toBe(400);
    expect(provider).not.toHaveBeenCalled();
  });
  it('requests a webhook retry when provider ID has not been persisted yet', async () => {
    expect((await handleCommerce(await signed(), env)).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
  it('ignores claimed payment status and verifies amount, currency, reference and live mode with the provider', async () => {
    await checkout();
    for (const overrides of [
      { total_amount: '1.00' },
      { total_paid_amount: '0.00' },
      { currency: 'USD' },
      { external_reference: 'other' },
      { live_mode: true },
    ]) {
      expect((await notify(snapshot(overrides))).status).toBe(503);
      expect((await (await run(`/orders/${id}`)).json()).paid).toBe(false);
    }
    expect((await notify()).status).toBe(200);
    expect((await notify()).status).toBe(200);
    expect((await (await run(`/orders/${id}`)).json()).paid).toBe(true);
  });
  it('blocks guessed IDs, forged redirects, wrong tokens and expired access', async () => {
    await checkout();
    provider.mockClear();
    expect((await run(`/orders/${id}/download?status=approved`)).status).toBe(503);
    expect(env.DIGITAL_PRODUCTS.get).not.toHaveBeenCalled();
    expect(
      (await run(`/orders/${id}`, { headers: { Authorization: 'Bearer wrong' } })).status,
    ).toBe(404);
    expect(
      (await run(`/orders/${id}`, { headers: { Authorization: `Bearer ${'cd'.repeat(32)}` } }))
        .status,
    ).toBe(404);
    db.prepare('UPDATE commerce_orders SET access_expires=1').run();
    expect((await run(`/orders/${id}`)).status).toBe(404);
  });
  it('delivers private files only after authoritative payment, with atomic download limits', async () => {
    await checkout();
    await notify();
    const response = await run(`/orders/${id}/download`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('zip-test');
    expect(response.headers.get('Content-Disposition')).toContain('planner-treino.zip');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    db.prepare('UPDATE commerce_orders SET downloads=10').run();
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
  });
  it.each([
    { status: 'created', status_detail: 'created' },
    { status: 'processing', status_detail: 'in_process' },
    { status: 'action_required', status_detail: 'waiting_capture' },
    { status: 'refunded', status_detail: 'refunded' },
    { status: 'processed', status_detail: 'partially_refunded' },
    { status: 'canceled', status_detail: 'canceled' },
    { status: 'charged_back', status_detail: 'charged_back' },
  ])('denies delivery for status $status / $status_detail', async (state) => {
    await checkout();
    await notify(snapshot(state));
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
    expect(env.DIGITAL_PRODUCTS.get).not.toHaveBeenCalled();
  });
  it('does not restore refunded access with an old approved snapshot', async () => {
    await checkout();
    const old = snapshot();
    await notify(old);
    await notify(
      snapshot({
        status: 'refunded',
        status_detail: 'refunded',
        last_updated_date: new Date().toISOString(),
      }),
    );
    await notify(old);
    expect((await (await run(`/orders/${id}`)).json()).paid).toBe(false);
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
  });
  it('fails closed on provider outage without leaking errors or credentials', async () => {
    await checkout();
    await notify();
    provider.mockRejectedValue(new Error('secret=TEST-sensitive'));
    const response = await run(`/orders/${id}/download`);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('TEST-sensitive');
    expect(env.DIGITAL_PRODUCTS.get).not.toHaveBeenCalled();
  });
});

describe('durable delivery safety for fraud, chargebacks and refunds', () => {
  const paymentId = '58980959081';
  const linked = () =>
    snapshot({
      transactions: { payments: [{ id: 'PAY01EXAMPLE123', reference: { id: paymentId } }] },
    });
  const risk = (type, dataId = paymentId, overrides = {}) => signed({ type, dataId, ...overrides });

  it.each(['stop_delivery_op_wh', 'topic_chargebacks_wh', 'chargebacks'])(
    'persists and acknowledges %s without any provider or money call',
    async (type) => {
      await checkout();
      await notify(linked());
      provider.mockClear();
      const event = await risk(type);
      expect((await handleCommerce(event, env)).status).toBe(200);
      expect(provider).not.toHaveBeenCalled();
      expect((await handleCommerce(await risk(type), env)).status).toBe(200);
      expect(db.prepare('SELECT count(*) AS n FROM commerce_risk_events').get().n).toBe(1);
      const state = await (await run(`/orders/${id}`)).json();
      expect(state.delivery_blocked).toBe(true);
      expect(state.paid).toBe(false);
      expect((await run(`/orders/${id}/download`)).status).toBe(403);
      expect(env.DIGITAL_PRODUCTS.get).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    },
  );
  it('does not trust a body reference or allow a forged/live risk event to suspend delivery', async () => {
    await checkout();
    await notify(linked());
    provider.mockClear();
    const forged = await risk('stop_delivery_op_wh');
    forged.headers.set('x-signature', 'invalid');
    expect((await handleCommerce(forged, env)).status).toBe(401);
    expect(
      (await handleCommerce(await risk('stop_delivery_op_wh', paymentId, { live_mode: true }), env))
        .status,
    ).toBe(400);
    expect(
      (await handleCommerce(await risk('stop_delivery_op_wh', paymentId, { bodyId: 'other' }), env))
        .status,
    ).toBe(400);
    expect((await (await run(`/orders/${id}`)).json()).delivery_blocked).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM commerce_risk_events').get().n).toBe(0);
    expect(provider).not.toHaveBeenCalled();
  });
  it('accepts the documented legacy fraud payment_id only when it matches the signed ID', async () => {
    const event = await risk('stop_delivery_op_wh', paymentId, {
      data: { payment_id: Number(paymentId), external_reference: 'untrusted' },
    });
    expect((await handleCommerce(event, env)).status).toBe(200);
    expect(db.prepare('SELECT resource_id,task FROM commerce_risk_events').get()).toMatchObject({
      resource_id: paymentId,
      task: 'refund_review',
    });
    expect(
      (
        await handleCommerce(
          await risk('stop_delivery_op_wh', paymentId, { data: { payment_id: 'other' } }),
          env,
        )
      ).status,
    ).toBe(400);
  });
  it('keeps unknown risk durable and globally blocks downloads until a provider-verified association', async () => {
    await checkout();
    await notify();
    const otherId = '32a6f0a0-2759-4ca1-a1be-c808c34921d2';
    db.prepare(
      `INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,created_at,access_expires)
      SELECT ?,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,created_at,access_expires FROM commerce_orders WHERE id=?`,
    ).run(otherId, id);
    expect(
      (
        await handleCommerce(
          await risk('stop_delivery_op_wh', paymentId, { external_reference: otherId }),
          env,
        )
      ).status,
    ).toBe(200);
    expect((await (await run(`/orders/${otherId}`)).json()).delivery_blocked).toBe(true);
    expect((await (await run(`/orders/${id}`)).json()).delivery_blocked).toBe(true);
    await notify(linked());
    expect((await (await run(`/orders/${otherId}`)).json()).delivery_blocked).toBe(false);
    expect((await (await run(`/orders/${id}`)).json()).delivery_blocked).toBe(true);
    // Approved/newer notifications cannot release the linked safety block.
    await notify(linked());
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
  });
  it('maps chargeback case IDs from verified Orders transactions, without trusting coverage', async () => {
    await checkout();
    await handleCommerce(await risk('topic_chargebacks_wh', '123456789'), env);
    await notify(
      snapshot({
        transactions: {
          chargebacks: [{ id: 'CBK123', case_id: '123456789', coverage_applied: true }],
        },
      }),
    );
    expect((await (await run(`/orders/${id}`)).json()).delivery_blocked).toBe(true);
    expect(
      db.prepare('SELECT reason FROM commerce_delivery_holds WHERE order_id=?').get(id).reason,
    ).toBe('chargeback');
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
  });
  it.each([
    { status: 'refunded', status_detail: 'refunded', total_paid_amount: '0.00' },
    { status: 'processed', status_detail: 'partially_refunded' },
    { transactions: { refunds: [{ id: 'REF123' }] } },
    { transactions: { payments: [{ status: 'refunded' }] } },
    { transactions: { payments: [{ status: 'charged_back' }] } },
  ])(
    'persists a safety hold for refund/chargeback even after a later approved snapshot: %j',
    async (adverse) => {
      await checkout();
      await notify(snapshot(adverse));
      await notify(snapshot({ last_updated_date: new Date().toISOString() }));
      expect((await (await run(`/orders/${id}`)).json()).delivery_blocked).toBe(true);
      expect((await run(`/orders/${id}/download`)).status).toBe(403);
      expect(env.DIGITAL_PRODUCTS.get).not.toHaveBeenCalled();
    },
  );
  it('rechecks safety atomically if a fraud alert arrives during download preparation', async () => {
    await checkout();
    await notify(linked());
    env.DIGITAL_PRODUCTS.get.mockImplementation(async () => {
      expect((await handleCommerce(await risk('stop_delivery_op_wh'), env)).status).toBe(200);
      return { body: 'zip-test' };
    });
    expect((await run(`/orders/${id}/download`)).status).toBe(403);
    expect(db.prepare('SELECT downloads FROM commerce_orders WHERE id=?').get(id).downloads).toBe(
      0,
    );
  });
  it('does not acknowledge a non-retryable fraud alert if durable persistence fails', async () => {
    db.exec('DROP TABLE commerce_risk_events');
    expect((await handleCommerce(await risk('stop_delivery_op_wh'), env)).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
  });
});
