// @vitest-environment node
// Pix (staging only): shared lock with Checkout Pro, creation recovery, confirmation by
// pull, webhook and reconciler, delivery only from the ledger access right, refunds,
// cancellation (D2) and production isolation. Real handler, real SQLite with the
// versioned migrations; only Mercado Pago (fake below), R2 and console are stubbed.
import { createHmac, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createD1 } from './helpers/d1-sqlite.js';
import { handleCommerce, hash } from '../worker/commerce/handler.js';
import { pixEnabled, runReconciler, reconcilerHealth } from '../worker/commerce/ledger/pix.js';
import staging from '../worker/commerce/staging.js';

const origin = 'https://homologacao.renatajoin.com';
const SECRET = 'synthetic-webhook-secret';
const NOTION = 'https://fixture-workspace.notion.site/Template-fixture-0000';
const EMAIL = 'comprador.teste@example.com';
let logs;

// Minimal Mercado Pago Orders API following the documented behaviour.
function fakeProvider() {
  const orders = new Map();
  const keys = new Map();
  const calls = [];
  let seq = 0;
  let clock = 0;
  const stamp = () => new Date(Date.now() - 30000 + ++clock).toISOString();
  const state = { failCreate: null, failGet: false, mutate: null };
  const order = (id) => orders.get(id);
  const touch = (o) => (o.last_updated_date = stamp());
  const api = {
    orders,
    calls,
    state,
    creates: () => calls.filter((c) => c.method === 'POST' && c.path === '/v1/orders').length,
    approve(id) {
      const o = order(id);
      Object.assign(o, {
        status: 'processed',
        status_detail: 'accredited',
        total_paid_amount: o.total_amount,
      });
      Object.assign(o.transactions.payments[0], {
        status: 'processed',
        status_detail: 'accredited',
        paid_amount: o.total_amount,
      });
      touch(o);
    },
    only: () =>
      [...orders.values()].filter((o) => o.transactions.payments[0].payment_method.id === 'pix'),
  };
  async function handle(url, init = {}) {
    const { pathname } = new URL(url);
    const method = init.method || 'GET';
    calls.push({ method, path: pathname, key: init.headers?.['X-Idempotency-Key'] });
    if (url === 'https://api.mercadolibre.com/users/me')
      return Response.json({ id: 3792015931, site_id: 'MLB', tags: ['test_user', 'normal'] });
    if (pathname === '/v1/orders' && method === 'POST') {
      if (state.failCreate === 'network') throw new TypeError('network');
      if (state.failCreate === 400)
        return Response.json({ errors: [{ code: 'invalid_email' }] }, { status: 400 });
      if (state.failCreate === 500)
        return Response.json({ errors: [{ code: 'internal' }] }, { status: 500 });
      const key = init.headers['X-Idempotency-Key'];
      if (keys.has(key)) {
        const previous = keys.get(key);
        if (previous.body !== init.body)
          return Response.json(
            { errors: [{ code: 'idempotency_key_already_used' }] },
            { status: 409 },
          );
        return Response.json(order(previous.id), { status: 201 });
      }
      const input = JSON.parse(init.body);
      const id = `ORDTST${String(++seq).padStart(12, '0')}A`;
      const pix = input.transactions?.payments?.[0]?.payment_method?.id === 'pix';
      const o = {
        id,
        type: 'online',
        external_reference: input.external_reference,
        total_amount: input.total_amount,
        processing_mode: input.processing_mode,
        status: pix ? 'action_required' : 'created',
        status_detail: pix ? 'waiting_transfer' : 'created',
        transactions: {
          payments: pix
            ? [
                {
                  id: `PAY${id.slice(6)}`,
                  amount: input.total_amount,
                  status: 'action_required',
                  status_detail: 'waiting_transfer',
                  date_of_expiration: new Date(Date.now() + 30 * 60000).toISOString(),
                  payment_method: {
                    id: 'pix',
                    type: 'bank_transfer',
                    qr_code: `00020126580014br.gov.bcb.pix${id}`,
                    qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
                    ticket_url: `https://www.mercadopago.com.br/payments/${id}/ticket`,
                  },
                },
              ]
            : [],
          refunds: [],
          chargebacks: [],
        },
        ...(pix
          ? {}
          : { checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${id}` }),
      };
      touch(o);
      orders.set(id, o);
      keys.set(key, { id, body: init.body });
      return Response.json(o, { status: 201 });
    }
    const match = pathname.match(/^\/v1\/orders\/(ORDTST\w+)(\/cancel|\/refund)?$/);
    const o = match && order(match[1]);
    if (!o) return Response.json({ errors: [{ code: 'not_found' }] }, { status: 404 });
    if (!match[2]) {
      if (state.failGet) return Response.json({}, { status: 500 });
      return Response.json(state.mutate ? state.mutate(structuredClone(o)) : o);
    }
    if (match[2] === '/cancel') {
      if (o.status !== 'action_required' && o.status !== 'created')
        return Response.json({ errors: [{ code: 'cannot_cancel_order' }] }, { status: 409 });
      Object.assign(o, { status: 'canceled', status_detail: 'canceled' });
      for (const p of o.transactions.payments)
        Object.assign(p, { status: 'canceled', status_detail: 'canceled' });
      touch(o);
      return Response.json(o, { status: 201 });
    }
    // refund
    const payment = o.transactions.payments[0];
    const partial = init.body ? JSON.parse(init.body).transactions[0].amount : null;
    if (o.transactions.refunds.some((r) => r.key === init.headers['X-Idempotency-Key']))
      return Response.json(o, { status: 201 });
    const amount = partial ?? o.total_amount;
    o.transactions.refunds.push({
      id: `REF${o.transactions.refunds.length + 1}`,
      transaction_id: payment.id,
      amount,
      status: 'processed',
      key: init.headers['X-Idempotency-Key'],
    });
    const refunded = o.transactions.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const full = refunded >= Number(o.total_amount);
    Object.assign(o, {
      status: full ? 'refunded' : 'processed',
      status_detail: full ? 'refunded' : 'partially_refunded',
    });
    Object.assign(payment, {
      status: full ? 'refunded' : 'processed',
      status_detail: full ? 'refunded' : 'partially_refunded',
    });
    touch(o);
    return Response.json(o, { status: 201 });
  }
  vi.stubGlobal('fetch', vi.fn(handle));
  return api;
}

function setup({ vars = {}, pixSwitch = 'on' } = {}) {
  const { db, binding } = createD1();
  db.prepare("UPDATE commerce_settings SET value=? WHERE key='pix_creation'").run(pixSwitch);
  const env = {
    COMMERCE_ENVIRONMENT: 'staging',
    COMMERCE_MODE: 'test',
    COMMERCE_ORIGIN: origin,
    COMMERCE_LEDGER: 'on',
    COMMERCE_PIX: 'on',
    COMMERCE_TEST_REFUNDS: 'on',
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-synthetic-test',
    MERCADOPAGO_WEBHOOK_SECRET: SECRET,
    NOTION_TEMPLATE_URL_MEU_DINHEIRO: NOTION,
    COMMERCE_DB: binding,
    DIGITAL_PRODUCTS: {
      head: vi.fn(async () => ({ size: 3 })),
      get: vi.fn(async () => ({ body: 'zip-test' })),
    },
    ...vars,
  };
  const mp = fakeProvider();
  return { db, env, mp, binding };
}

const buyer = () => ({
  id: webcrypto.randomUUID(),
  bearer: webcrypto.randomUUID().replaceAll('-', '') + webcrypto.randomUUID().replaceAll('-', ''),
});
const call = (env, path, { method = 'GET', session, body, headers = {}, key } = {}) =>
  handleCommerce(
    new Request(`${origin}/api/commerce${path}`, {
      method,
      headers: {
        ...(session ? { Authorization: `Bearer ${session.bearer}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method === 'POST' ? { Origin: origin } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
const createPix = (env, session, extra = {}) =>
  call(env, '/pix', {
    method: 'POST',
    session,
    key: session.id,
    body: { product_id: 'meu-dinheiro-minhas-regras', email: EMAIL, test_approve: true, ...extra },
  });
const checkoutPro = (env, session) =>
  call(env, '/checkout', {
    method: 'POST',
    session,
    key: session.id,
    body: { product_id: 'meu-dinheiro-minhas-regras' },
  });
const status = async (env, session) =>
  (await call(env, `/orders/${session.id}`, { session })).json();
const access = (env, session) => call(env, `/orders/${session.id}/access`, { session });
const download = (env, session) =>
  call(env, `/orders/${session.id}/download`, {
    session,
    headers: { 'X-Download-Attempt': webcrypto.randomUUID() },
  });
const refund = (env, session, amount) =>
  call(env, `/orders/${session.id}/test-refund`, {
    method: 'POST',
    session,
    body: amount ? { amount } : {},
  });
function webhook(env, mpId) {
  const ts = String(Math.floor(Date.now() / 1000));
  const requestId = `req-${mpId}`;
  const v1 = createHmac('sha256', SECRET)
    .update(`id:${mpId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return handleCommerce(
    new Request(`${origin}/api/commerce/webhook?data.id=${mpId}&type=order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${v1}`,
      },
      body: JSON.stringify({ type: 'order', data: { id: mpId }, live_mode: false }),
    }),
    env,
  );
}
const attempts = (db, orderId) =>
  db
    .prepare('SELECT * FROM commerce_payment_attempts WHERE order_id=? ORDER BY created_at')
    .all(orderId);
const entitlement = (db, orderId) =>
  db.prepare('SELECT state, reason FROM commerce_entitlements WHERE order_id=?').get(orderId);
const reviews = (db, orderId) =>
  db
    .prepare('SELECT reason FROM commerce_payment_reviews WHERE order_id=?')
    .all(orderId)
    .map((r) => r.reason);
const makeDue = (db) =>
  db
    .prepare('UPDATE commerce_payment_attempts SET next_check_at=? WHERE next_check_at IS NOT NULL')
    .run(Date.now() - 1);

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((line) => logs.push(JSON.parse(line)));
});
afterEach(() => vi.unstubAllGlobals());

describe('availability and isolation', () => {
  it('is never available in production, even with every switch on', () => {
    const vars = {
      COMMERCE_LEDGER: 'on',
      COMMERCE_PIX: 'on',
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-x',
      COMMERCE_MODE: 'production',
    };
    expect(pixEnabled({ ...vars, COMMERCE_ENVIRONMENT: 'production' })).toBe(false);
    expect(pixEnabled({ ...vars, COMMERCE_ENVIRONMENT: 'staging', COMMERCE_MODE: 'test' })).toBe(
      true,
    );
  });

  it('answers 404 and hides Pix in the catalog unless env and database switches are on', async () => {
    for (const config of [
      { vars: { COMMERCE_PIX: undefined } },
      { vars: { COMMERCE_LEDGER: undefined } },
      { pixSwitch: 'off' },
    ]) {
      const { env, mp } = setup(config);
      const session = buyer();
      expect((await createPix(env, session)).status).toBe(404);
      expect((await (await call(env, '/catalog')).json()).pix).toBe(false);
      expect(mp.creates()).toBe(0);
    }
    const { env } = setup();
    expect((await (await call(env, '/catalog')).json()).pix).toBe(true);
  });

  it('keeps Checkout Pro unchanged when the ledger is off (no attempt rows)', async () => {
    const { env, db } = setup({ vars: { COMMERCE_LEDGER: undefined, COMMERCE_PIX: undefined } });
    const session = buyer();
    const response = await checkoutPro(env, session);
    expect(response.status).toBe(200);
    expect((await response.json()).checkout_url).toMatch(
      /^https:\/\/www\.mercadopago\.com\.br\/checkout\/v1\/redirect/,
    );
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_payment_attempts').get().n).toBe(0);
  });
});

describe('Pix creation', () => {
  it('returns QR code and copy-paste code, takes the lock and never stores the e-mail', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    const response = await createPix(env, session);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ payment_method: 'pix', paid: false, status: 'action_required' });
    expect(body.pix.qr_code).toMatch(/^00020126/);
    expect(body.pix.qr_code_base64).toMatch(/^iVBOR/);
    expect(body.pix.expires_at).toBeGreaterThan(Date.now());
    const [attempt] = attempts(db, session.id);
    expect(attempt).toMatchObject({ flow: 'pix', phase: 'open', holds_lock: 1, send_count: 1 });
    expect(mp.calls.find((c) => c.path === '/v1/orders').key).toBe(attempt.id);
    const dump = JSON.stringify(
      db
        .prepare("SELECT * FROM sqlite_master WHERE type='table'")
        .all()
        .flatMap((t) => db.prepare(`SELECT * FROM ${t.name}`).all()),
    );
    expect(dump).not.toContain(EMAIL);
    const sent = JSON.parse(
      vi
        .mocked(fetch)
        .mock.calls.find(([u, i]) => u.endsWith('/v1/orders') && i.method === 'POST')[1].body,
    );
    expect(sent).toMatchObject({
      processing_mode: 'automatic',
      external_reference: session.id,
      total_amount: '47.00',
      expiration_time: 'PT30M',
      payer: { email: EMAIL, first_name: 'APRO' },
    });
    expect(sent.transactions.payments[0].payment_method).toEqual({
      id: 'pix',
      type: 'bank_transfer',
    });
  });

  it('only sends the APRO test name when asked, and validates e-mail and fields', async () => {
    const { env } = setup();
    const a = buyer();
    await createPix(env, a, { test_approve: false });
    const sent = JSON.parse(
      vi
        .mocked(fetch)
        .mock.calls.find(([u, i]) => u.endsWith('/v1/orders') && i.method === 'POST')[1].body,
    );
    expect(sent.payer).toEqual({ email: EMAIL });
    expect((await createPix(env, buyer(), { email: 'not-an-email' })).status).toBe(400);
    expect((await createPix(env, buyer(), { extra: 1 })).status).toBe(400);
    expect((await createPix(env, buyer(), { test_approve: 'yes' })).status).toBe(400);
  });

  it('reuses the open Pix on retries and under 8 concurrent requests: one provider order', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    const answers = await Promise.all(Array.from({ length: 8 }, () => createPix(env, session)));
    const codes = new Set();
    for (const r of answers) {
      expect([200, 201, 409]).toContain(r.status);
      const body = await r.json();
      if (r.status !== 409) codes.add(body.pix.qr_code);
    }
    expect(codes.size).toBe(1);
    expect(new Set(mp.calls.filter((c) => c.path === '/v1/orders').map((c) => c.key)).size).toBe(1);
    expect(mp.only()).toHaveLength(1);
    expect(attempts(db, session.id).filter((a) => a.holds_lock)).toHaveLength(1);
    const again = await createPix(env, session);
    expect(again.status).toBe(200);
    expect((await again.json()).pix.qr_code).toBe([...codes][0]);
  });

  it('keeps the lock after an unknown result and resends the SAME body and key on retry', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    mp.state.failCreate = 'network';
    expect((await createPix(env, session)).status).toBe(503);
    const [first] = attempts(db, session.id);
    expect(first).toMatchObject({ phase: 'sending', holds_lock: 1, mp_id: null, send_count: 1 });
    // A different body cannot reuse the pending creation.
    expect((await createPix(env, session, { email: 'outra@example.com' })).status).toBe(409);
    mp.state.failCreate = null;
    const retry = await createPix(env, session);
    expect(retry.status).toBe(201);
    const keys = mp.calls
      .filter((c) => c.path === '/v1/orders' && c.method === 'POST')
      .map((c) => c.key);
    expect(new Set(keys)).toEqual(new Set([first.id]));
    expect(attempts(db, session.id)).toHaveLength(1);
  });

  it('closes a creation the provider rejected before processing, so a corrected retry works', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    mp.state.failCreate = 400;
    expect((await createPix(env, session)).status).toBe(422);
    expect(attempts(db, session.id)[0]).toMatchObject({ phase: 'closed_unpaid', holds_lock: 0 });
    mp.state.failCreate = null;
    expect((await createPix(env, session)).status).toBe(201);
    expect(attempts(db, session.id).filter((a) => a.holds_lock)).toHaveLength(1);
  });

  it('stops after 5 sends of an uncertain creation and flags it for review, keeping the lock', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    mp.state.failCreate = 500;
    for (let i = 0; i < 6; i += 1) expect((await createPix(env, session)).status).toBe(503);
    expect(attempts(db, session.id)[0]).toMatchObject({
      phase: 'uncertain',
      holds_lock: 1,
      send_count: 5,
    });
    expect(reviews(db, session.id)).toContain('creation_uncertain');
    expect(mp.creates()).toBe(5);
  });
});

describe('shared lock with Checkout Pro', () => {
  it('refuses Checkout Pro on a Pix order and Pix on a Checkout Pro order', async () => {
    const { env } = setup();
    const a = buyer();
    await createPix(env, a);
    const cp = await checkoutPro(env, a);
    expect(cp.status).toBe(409);
    expect((await cp.json()).code).toBe('pix_order');
    const b = buyer();
    expect((await checkoutPro(env, b)).status).toBe(200);
    const p = await createPix(env, b);
    expect(p.status).toBe(409);
    expect((await p.json()).code).toBe('checkout_pro_order');
  });

  it('lets exactly one flow create a provider order when both race on a fresh order', async () => {
    for (let round = 0; round < 10; round += 1) {
      const { env, db, mp } = setup();
      const session = buyer();
      await Promise.all([
        createPix(env, session),
        checkoutPro(env, session),
        createPix(env, session),
        checkoutPro(env, session),
      ]);
      expect(mp.orders.size).toBe(1);
      expect(attempts(db, session.id).filter((a) => a.holds_lock)).toHaveLength(1);
    }
  });

  it('records new Checkout Pro orders as attempt cp-<order> holding the lock', async () => {
    const { env, db } = setup();
    const session = buyer();
    await checkoutPro(env, session);
    expect(attempts(db, session.id)).toEqual([
      expect.objectContaining({
        id: `cp-${session.id}`,
        flow: 'checkout_pro',
        phase: 'open',
        holds_lock: 1,
      }),
    ]);
    // A retry reuses the stored checkout URL and does not create another attempt.
    expect((await checkoutPro(env, session)).status).toBe(200);
    expect(attempts(db, session.id)).toHaveLength(1);
  });
});

describe('confirmation and delivery', () => {
  async function paidByWebhook() {
    const ctx = setup();
    const session = buyer();
    await createPix(ctx.env, session);
    const mpId = attempts(ctx.db, session.id)[0].mp_id;
    expect((await access(ctx.env, session)).status).toBe(403);
    ctx.mp.approve(mpId);
    expect((await webhook(ctx.env, mpId)).status).toBe(200);
    return { ...ctx, session, mpId };
  }

  it('delivers Notion and the ZIP only after a verified webhook confirmation', async () => {
    const { env, db, session } = await paidByWebhook();
    expect(entitlement(db, session.id)).toEqual({ state: 'active', reason: 'paid' });
    const view = await status(env, session);
    expect(view).toMatchObject({
      paid: true,
      status: 'processed',
      status_detail: 'accredited',
      pix: null,
    });
    expect(view.access_expires).toBeGreaterThan(Date.now() + 300 * 86400000);
    const open = await access(env, session);
    expect(open.status).toBe(200);
    expect((await open.json()).url).toBe(NOTION);
    const zip = await download(env, session);
    expect(zip.status).toBe(200);
    expect(await zip.text()).toBe('zip-test');
    expect(attempts(db, session.id)[0]).toMatchObject({ phase: 'settled', holds_lock: 0 });
    expect(logs.some((l) => l.event === 'webhook_processed' && l.detail === 'pix_paid')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(NOTION);
  });

  it('confirms by status pull when no webhook arrives', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session);
    mp.approve(attempts(db, session.id)[0].mp_id);
    expect(await status(env, session)).toMatchObject({ paid: true });
  });

  it('confirms through the reconciler alone (cron entry point, no webhook, no pull)', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session);
    mp.approve(attempts(db, session.id)[0].mp_id);
    makeDue(db);
    const pending = [];
    await staging.scheduled({}, env, { waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    expect(entitlement(db, session.id).state).toBe('active');
    expect(logs.some((l) => l.event === 'reconciler_run')).toBe(true);
    expect(await reconcilerHealth(env)).toMatchObject({
      enabled: true,
      overdue: 0,
      healthy: true,
      last_run_failures: 0,
    });
  });

  it('never delivers when the provider order does not match the local order', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session);
    mp.approve(attempts(db, session.id)[0].mp_id);
    mp.state.mutate = (o) => ({ ...o, total_amount: '4.70' });
    expect((await access(env, session)).status).toBe(503);
    expect(entitlement(db, session.id)?.state ?? 'none').not.toBe('active');
    mp.state.mutate = (o) => ({ ...o, external_reference: 'other' });
    expect((await webhook(env, attempts(db, session.id)[0].mp_id)).status).toBe(503);
    expect(entitlement(db, session.id)?.state ?? 'none').not.toBe('active');
  });

  it('keeps access after a partial refund (D1) and opens a review', async () => {
    const { env, db, session } = await paidByWebhook();
    const r = await refund(env, session, '10.00');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ entitlement: 'active', reason: 'paid' });
    expect(reviews(db, session.id)).toContain('partial_refund');
    expect((await access(env, session)).status).toBe(200);
    expect(await status(env, session)).toMatchObject({
      paid: true,
      status_detail: 'partially_refunded',
    });
  });

  it('revokes access after a full refund', async () => {
    const { env, db, session } = await paidByWebhook();
    const r = await refund(env, session);
    expect(await r.json()).toEqual({ entitlement: 'revoked', reason: 'refunded' });
    expect((await access(env, session)).status).toBe(403);
    expect((await download(env, session)).status).toBe(403);
    expect(await status(env, session)).toMatchObject({ paid: false, status: 'refunded' });
    expect(entitlement(db, session.id)).toEqual({ state: 'revoked', reason: 'refunded' });
  });

  it('exposes the test refund only with COMMERCE_TEST_REFUNDS=on and only to the buyer', async () => {
    const { env, db, mp } = setup({ vars: { COMMERCE_TEST_REFUNDS: undefined } });
    const session = buyer();
    await createPix(env, session);
    mp.approve(attempts(db, session.id)[0].mp_id);
    await status(env, session);
    expect((await refund(env, session)).status).toBe(404);
    env.COMMERCE_TEST_REFUNDS = 'on';
    expect((await refund(env, { ...session, bearer: 'f'.repeat(64) })).status).toBe(404);
    expect((await refund(env, session)).status).toBe(200);
  });
});

describe('cancellation (D2) and late payments', () => {
  it('releases the lock only after the provider confirms the cancellation', async () => {
    const { env, db } = setup();
    const session = buyer();
    await createPix(env, session, { test_approve: false });
    const r = await call(env, `/orders/${session.id}/pix/cancel`, { method: 'POST', session });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ canceled: true, paid: false });
    const [attempt] = attempts(db, session.id);
    expect(attempt).toMatchObject({ phase: 'closed_unpaid', holds_lock: 0 });
    expect(attempt.next_check_at).not.toBeNull(); // still watched
    expect(await status(env, session)).toMatchObject({ pix: null, status: 'canceled' });
  });

  it('a payment that lands after the cancel is detected, granted and flagged', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session, { test_approve: false });
    const mpId = attempts(db, session.id)[0].mp_id;
    await call(env, `/orders/${session.id}/pix/cancel`, { method: 'POST', session });
    mp.approve(mpId); // the bank settled a code that was already shown
    makeDue(db);
    await runReconciler(env);
    expect(entitlement(db, session.id).state).toBe('active');
    expect(reviews(db, session.id)).toContain('settled_after_cancel');
  });

  it('cannot cancel a paid Pix: it stays settled and delivered', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session);
    mp.approve(attempts(db, session.id)[0].mp_id);
    const r = await call(env, `/orders/${session.id}/pix/cancel`, { method: 'POST', session });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ canceled: false, paid: true });
    expect((await access(env, session)).status).toBe(200);
  });
});

describe('reconciler', () => {
  it('runs one instance at a time (lease) and records each run', async () => {
    const { env, db } = setup();
    for (let i = 0; i < 3; i += 1) await createPix(env, buyer());
    makeDue(db);
    const results = await Promise.all([runReconciler(env), runReconciler(env), runReconciler(env)]);
    expect(results.filter((r) => r.skipped === 'leased').length).toBeGreaterThanOrEqual(1);
    const done = results.filter((r) => !r.skipped);
    expect(done.reduce((n, r) => n + r.processed, 0)).toBe(3);
    expect(
      db.prepare('SELECT COUNT(*) n FROM commerce_job_runs WHERE finished_at IS NOT NULL').get().n,
    ).toBe(done.length);
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_job_leases').get().n).toBe(0);
  });

  it('takes over an expired lease from a crashed run', async () => {
    const { env, db } = setup();
    db.prepare(
      "INSERT INTO commerce_job_leases (job,holder,expires_at) VALUES ('reconciler','crashed',?)",
    ).run(Date.now() - 1);
    expect((await runReconciler(env)).skipped).toBeUndefined();
  });

  it('backs off on provider failures, reports overdue work and flags stalled attempts', async () => {
    const { env, db, mp } = setup();
    const session = buyer();
    await createPix(env, session);
    mp.state.failGet = true;
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      db.prepare('UPDATE commerce_payment_attempts SET next_check_at=?').run(now - 600000);
      const r = await runReconciler(env, { now, log: (event) => logs.push({ event }) });
      expect(r.failures).toBe(1);
    }
    const [attempt] = attempts(db, session.id);
    expect(attempt.check_failures).toBe(10);
    expect(attempt.next_check_at).toBe(now + 3600000);
    expect(reviews(db, session.id)).toContain('reconciler_stalled');
    db.prepare('UPDATE commerce_payment_attempts SET next_check_at=?').run(now - 600000);
    expect(await reconcilerHealth(env, now)).toMatchObject({ healthy: false, overdue: 1 });
    expect(logs.some((l) => l.event === 'reconciler_attempt_failed')).toBe(true);
  });

  it('does nothing when the ledger is off', async () => {
    const { env } = setup({ vars: { COMMERCE_LEDGER: undefined } });
    expect(await runReconciler(env)).toEqual({ skipped: 'disabled' });
    expect(await reconcilerHealth(env)).toEqual({ enabled: false });
  });
});

it('hash helper stays the one used for bearer tokens', async () => {
  expect(await hash('x')).toMatch(/^[a-f0-9]{64}$/);
});
