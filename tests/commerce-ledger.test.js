// @vitest-environment node
// R1a payment ledger (spec V3): financial facts, access right, shared charge lock,
// creation recovery and concurrency. Runs against real SQLite with the versioned
// migrations, including 0004 (never applied to any remote database by these tests).
import { describe, expect, it, vi } from 'vitest';
import { createD1 } from './helpers/d1-sqlite.js';
import { cents, interpretOrder } from '../worker/commerce/ledger/interpret.js';
import { entitlementOf } from '../worker/commerce/ledger/entitlement.js';
import {
  abortCancel,
  adoptProviderOrder,
  applySnapshot,
  beginCancel,
  classifyCreateResponse,
  closeNotCreated,
  entitlementStatement,
  getEntitlement,
  legacyAttemptStatement,
  markUncertain,
  MAX_CREATE_SENDS,
  nextCreationAction,
  recordSend,
  reserveAttempt,
} from '../worker/commerce/ledger/repository.js';
import { runLedgerShadow } from '../worker/commerce/ledger/shadow.js';

const T0 = Date.parse('2026-11-20T12:00:00Z');
const at = (minutes) => new Date(T0 + minutes * 60000).toISOString();

function setup() {
  const { db, binding } = createD1();
  return { db, env: { COMMERCE_DB: binding } };
}
function addOrder(
  db,
  id,
  { amount = 4700, status = 'created', detail = 'created', mpId = null, email = null } = {},
) {
  db.prepare(
    `INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,mp_id,status,status_detail,created_at,access_expires)
     VALUES (?,?,'meu-dinheiro-minhas-regras','Meu Dinheiro, Minhas Regras',?,'BRL','k','f.zip',?,?,?,?,?)`,
  ).run(id, `hash-${id}-${email ?? ''}`, amount, mpId, status, detail, T0, T0 + 7 * 86400000);
}
async function addAttempt(env, { id, orderId, flow = 'pix', amount = 4700 }) {
  const result = await reserveAttempt(env, {
    id,
    orderId,
    flow,
    requestBody: '{}',
    requestHash: `h-${id}`,
    amountCents: amount,
    watchUntil: T0 + 86400000,
    now: T0,
  });
  expect(result.reserved).toBe(true);
  return result.attempt;
}
async function linked(env, attemptId, mpId) {
  expect(await adoptProviderOrder(env, { id: attemptId, mpId, now: T0 })).toBe(true);
}
// Provider Order snapshot with one payment.
function order(
  mpId,
  {
    minute = 1,
    status = 'action_required',
    detail = 'waiting_transfer',
    pay = 'PAY-' + mpId,
    payStatus,
    payDetail,
    amount = '47.00',
    refunds = [],
    chargebacks = [],
  } = {},
) {
  return {
    id: mpId,
    status,
    status_detail: detail,
    total_amount: amount,
    last_updated_date: at(minute),
    transactions: {
      payments: [
        { id: pay, amount, status: payStatus ?? status, status_detail: payDetail ?? detail },
      ],
      refunds,
      chargebacks,
    },
  };
}
const paid = (mpId, minute, extra = {}) =>
  order(mpId, { minute, status: 'processed', detail: 'accredited', ...extra });
const ent = (env, id) => getEntitlement(env, id);
const reviews = (db) =>
  db
    .prepare('SELECT reason, subject_id FROM commerce_payment_reviews ORDER BY reason, subject_id')
    .all();
const attempt = (db, id) =>
  db.prepare('SELECT * FROM commerce_payment_attempts WHERE id=?').get(id);
const settlement = (db, id) =>
  db.prepare('SELECT * FROM commerce_settlements WHERE provider_payment_id=?').get(id);

describe('interpretOrder', () => {
  it('parses money strictly', () => {
    expect(cents('47.00')).toBe(4700);
    expect(cents('47.5')).toBe(4750);
    expect(cents(47)).toBe(4700);
    for (const bad of ['-1', '1e3', '47.001', '', null, 'abc']) expect(cents(bad)).toBeNull();
  });
  it('rejects a snapshot without a valid update time', () => {
    expect(() => interpretOrder({ status: 'processed' })).toThrow('version');
  });
  it('maps paid, refunded and disputed payments to facts', () => {
    expect(interpretOrder(paid('ORD1', 1)).settlements[0]).toMatchObject({
      settled: 1,
      refundedCents: 0,
      disputeStage: 'none',
    });
    const partial = interpretOrder(
      paid('ORD1', 2, {
        detail: 'partially_refunded',
        payDetail: 'partially_refunded',
        refunds: [{ id: 'R1', transaction_id: 'PAY-ORD1', amount: '10.00', status: 'processed' }],
      }),
    );
    expect(partial.settlements[0]).toMatchObject({ settled: 1, refundedCents: 1000 });
    expect(
      interpretOrder(order('ORD1', { status: 'refunded', detail: 'refunded' })).settlements[0],
    ).toMatchObject({ settled: 1, refundedCents: 4700 });
    for (const [detail, stage] of [
      ['in_process', 'open'],
      ['settled', 'lost'],
      ['reimbursed', 'reversed'],
    ])
      expect(
        interpretOrder(order('ORD1', { status: 'charged_back', detail })).settlements[0]
          .disputeStage,
      ).toBe(stage);
  });
  it('fails closed on unknown or incomplete data', () => {
    const unknown = interpretOrder(
      order('ORD1', { status: 'charged_back', detail: 'something_new' }),
    );
    expect(unknown.settlements[0].disputeStage).toBe('open');
    expect(unknown.anomalies).toContain('unknown_remote_state');
    const noId = paid('ORD1', 1);
    noId.transactions.payments[0].id = undefined;
    expect(interpretOrder(noId)).toMatchObject({
      settlements: [],
      anomalies: ['unknown_remote_state'],
    });
    const failedRefund = interpretOrder(
      paid('ORD1', 2, {
        refunds: [{ transaction_id: 'PAY-ORD1', amount: '47.00', status: 'rejected' }],
      }),
    );
    expect(failedRefund.settlements[0].refundedCents).toBe(0);
  });
  it('treats a refunded payment as paid-then-refunded when the order has several payments', () => {
    const snapshot = paid('ORD1', 1);
    snapshot.transactions.payments.push({
      id: 'PAY-2',
      amount: '47.00',
      status: 'refunded',
      status_detail: 'refunded',
    });
    const [first, second] = interpretOrder(snapshot).settlements;
    expect(first).toMatchObject({ settled: 1, refundedCents: 0 });
    expect(second).toMatchObject({ providerPaymentId: 'PAY-2', settled: 1, refundedCents: 4700 });
  });
  it('uses the order-level status for a single payment without its own detail', () => {
    const snapshot = paid('ORD1', 1);
    delete snapshot.transactions.payments[0].status_detail;
    delete snapshot.transactions.payments[0].amount;
    snapshot.transactions.payments[0].status = 'processed';
    snapshot.total_paid_amount = '47.00';
    expect(interpretOrder(snapshot).settlements[0]).toMatchObject({
      settled: 1,
      amountCents: 4700,
    });
  });
});

describe('entitlementOf (spec V3, 8.2)', () => {
  const s = (o) => ({
    settled: 1,
    amountCents: 4700,
    refundedCents: 0,
    disputeStage: 'none',
    settledAt: T0,
    ...o,
  });
  const of = (settlements, extra = {}) =>
    entitlementOf({ settlements, orderAmountCents: 4700, ...extra });
  it.each([
    ['confirmed', [s()], 'active', 'paid'],
    ['duplicate', [s(), s()], 'active', 'duplicate_paid'],
    ['duplicate with one refunded', [s(), s({ refundedCents: 4700 })], 'active', 'paid'],
    ['full refund', [s({ refundedCents: 4700 })], 'revoked', 'refunded'],
    ['partial refund keeps access (D1)', [s({ refundedCents: 1000 })], 'active', 'paid'],
    ['dispute open', [s({ disputeStage: 'open' })], 'suspended', 'dispute_open'],
    ['dispute open with another eligible', [s({ disputeStage: 'open' }), s()], 'active', 'paid'],
    ['dispute lost', [s({ disputeStage: 'lost' })], 'revoked', 'charged_back'],
    ['dispute reversed', [s({ disputeStage: 'reversed' })], 'active', 'paid'],
    ['amount mismatch', [s({ amountCents: 100 })], 'suspended', 'amount_mismatch'],
    ['nothing settled', [s({ settled: 0 })], 'none', 'unpaid'],
  ])('%s', (_, settlements, state, reason) => {
    expect(of(settlements)).toMatchObject({ state, reason });
  });
  it('risk holds and manual overrides take precedence', () => {
    expect(of([s()], { riskHold: true })).toMatchObject({
      state: 'suspended',
      reason: 'risk_hold',
    });
    expect(of([s({ refundedCents: 4700 })], { override: 'grant' })).toMatchObject({
      state: 'active',
      reason: 'manual',
    });
    expect(of([s()], { override: 'revoke' })).toMatchObject({ state: 'revoked', reason: 'manual' });
  });
  it('defines no expiry: validity stays a separate commercial rule', () => {
    expect(Object.keys(of([s()]))).not.toContain('validUntil');
  });
});

describe('entitlement SQL matches the reference implementation', () => {
  it('agrees on 400 random fact sets', async () => {
    let seed = 7;
    const rand = (n) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
    const { db, env } = setup();
    for (let i = 0; i < 400; i += 1) {
      const id = `order-${i}`;
      addOrder(db, id);
      const a = await addAttempt(env, { id: `att-${i}`, orderId: id });
      const facts = [];
      for (let k = 0; k < rand(4); k += 1) {
        const f = {
          settled: rand(5) ? 1 : 0,
          amountCents: rand(8) ? 4700 : 4600,
          refundedCents: [0, 0, 1000, 4700][rand(4)],
          disputeStage: ['none', 'none', 'open', 'lost', 'reversed'][rand(5)],
          settledAt: T0 + rand(1000),
        };
        facts.push(f);
        db.prepare(
          `INSERT INTO commerce_settlements (provider_payment_id,attempt_id,order_id,amount_cents,settled,settled_at,refunded_cents,dispute_stage)
          VALUES (?,?,?,?,?,?,?,?)`,
        ).run(
          `p-${i}-${k}`,
          a.id,
          id,
          f.amountCents,
          f.settled,
          f.settled ? f.settledAt : null,
          Math.min(f.refundedCents, f.amountCents),
          f.disputeStage,
        );
        f.refundedCents = Math.min(f.refundedCents, f.amountCents);
      }
      const riskHold = rand(10) === 0;
      if (riskHold)
        db.prepare(
          `INSERT INTO commerce_delivery_holds (order_id,reason,created_at) VALUES (?, 'fraud', ?)`,
        ).run(id, T0);
      const override = [null, null, null, null, null, 'grant', 'revoke'][rand(7)];
      if (override)
        db.prepare(
          `INSERT INTO commerce_entitlement_overrides (id,order_id,action,reason,actor,created_at) VALUES (?,?,?,?,?,?)`,
        ).run(`ov-${i}`, id, override, 'test', 'test', T0);
      await entitlementStatement(env, id, T0).run();
      const expected = entitlementOf({
        settlements: facts,
        orderAmountCents: 4700,
        riskHold,
        override,
      });
      const actual = await ent(env, id);
      expect({
        state: actual.state,
        reason: actual.reason,
        eligibleCount: actual.eligible_count,
        grantedAt: actual.granted_at,
      }).toEqual({
        state: expected.state,
        reason: expected.reason,
        eligibleCount: expected.eligibleCount,
        grantedAt: expected.grantedAt,
      });
    }
  });
});

describe('shared charge lock (blocker 1)', () => {
  it('lets exactly one of 20 concurrent reservations across flows hold the lock', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        reserveAttempt(env, {
          id: `a${i}`,
          orderId: 'o1',
          flow: ['pix', 'checkout_pro', 'card'][i % 3],
          requestBody: '{}',
          requestHash: 'h',
          amountCents: 4700,
          watchUntil: T0,
          now: T0,
        }),
      ),
    );
    expect(results.filter((r) => r.reserved)).toHaveLength(1);
    const winner = results.find((r) => r.reserved).attempt.id;
    expect(
      results
        .filter((r) => !r.reserved)
        .every((r) => r.reason === 'locked' && r.holder.id === winner),
    ).toBe(true);
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_payment_attempts').get().n).toBe(1);
  });
  it('treats a retry with the same attempt id as the same reservation', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    expect(
      await reserveAttempt(env, {
        id: 'a1',
        orderId: 'o1',
        flow: 'pix',
        requestBody: '{}',
        requestHash: 'h-a1',
        amountCents: 4700,
        watchUntil: T0,
        now: T0,
      }),
    ).toMatchObject({ reserved: true });
  });
  it('refuses a new charge on a paid order (current rule or computed right)', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1', { status: 'processed', detail: 'accredited' });
    expect(
      await reserveAttempt(env, {
        id: 'a1',
        orderId: 'o1',
        flow: 'pix',
        requestBody: '{}',
        requestHash: 'h',
        amountCents: 4700,
        watchUntil: T0,
      }),
    ).toMatchObject({ reserved: false, reason: 'paid' });
    addOrder(db, 'o2');
    const first = await addAttempt(env, { id: 'b1', orderId: 'o2' });
    await linked(env, first.id, 'ORDB1');
    await applySnapshot(env, { orderId: 'o2', attemptId: 'b1', remote: paid('ORDB1', 1) });
    expect(
      await reserveAttempt(env, {
        id: 'b2',
        orderId: 'o2',
        flow: 'checkout_pro',
        requestBody: '{}',
        requestHash: 'h',
        amountCents: 4700,
        watchUntil: T0,
      }),
    ).toMatchObject({ reserved: false, reason: 'paid' });
  });
  it('releases the lock only on an authoritative close, never by time or uncertainty', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await recordSend(env, { id: 'a1', requestHash: 'h-a1', now: T0 });
    await markUncertain(env, { id: 'a1', orderId: 'o1', now: T0 + 86400000 * 30 });
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'uncertain', holds_lock: 1 });
    expect(
      (
        await reserveAttempt(env, {
          id: 'a2',
          orderId: 'o1',
          flow: 'checkout_pro',
          requestBody: '{}',
          requestHash: 'h',
          amountCents: 4700,
          watchUntil: T0,
        })
      ).reason,
    ).toBe('locked');
    expect(reviews(db)).toEqual([{ reason: 'creation_uncertain', subject_id: 'a1' }]);
  });
  it('switches method only after the provider confirms the cancellation', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await linked(env, 'a1', 'ORDA1');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDA1', { minute: 1 }),
    });
    expect(await beginCancel(env, { id: 'a1' })).toBe(true);
    // A newer snapshot still open does not reopen a cancel in flight, nor free the lock.
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDA1', { minute: 2 }),
    });
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'canceling', holds_lock: 1 });
    expect(
      (
        await reserveAttempt(env, {
          id: 'a2',
          orderId: 'o1',
          flow: 'card',
          requestBody: '{}',
          requestHash: 'h',
          amountCents: 4700,
          watchUntil: T0,
        })
      ).reason,
    ).toBe('locked');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDA1', { minute: 3, status: 'canceled', detail: 'canceled' }),
    });
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'closed_unpaid', holds_lock: 0 });
    expect(
      (
        await reserveAttempt(env, {
          id: 'a2',
          orderId: 'o1',
          flow: 'card',
          requestBody: '{}',
          requestHash: 'h',
          amountCents: 4700,
          watchUntil: T0,
        })
      ).reserved,
    ).toBe(true);
  });
  it('returns to open when the provider refuses the cancellation', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await linked(env, 'a1', 'ORDA1');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDA1', { minute: 1 }),
    });
    await beginCancel(env, { id: 'a1' });
    expect(await abortCancel(env, { id: 'a1' })).toBe(true);
    expect(attempt(db, 'a1').phase).toBe('open');
  });
  it('records money received after cancellation and keeps the old code watched', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await linked(env, 'a1', 'ORDA1');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDA1', { minute: 1, status: 'canceled', detail: 'canceled' }),
    });
    await applySnapshot(env, { orderId: 'o1', attemptId: 'a1', remote: paid('ORDA1', 9) });
    expect(attempt(db, 'a1').phase).toBe('settled');
    expect(reviews(db)).toEqual([{ reason: 'settled_after_cancel', subject_id: 'a1' }]);
    expect(await ent(env, 'o1')).toMatchObject({ state: 'active', reason: 'paid' });
  });
  it('detects two settlements on the same order across flows', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'cp', orderId: 'o1', flow: 'checkout_pro' });
    await linked(env, 'cp', 'ORDCP');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'cp',
      remote: order('ORDCP', { minute: 1, status: 'canceled', detail: 'canceled' }),
    });
    await addAttempt(env, { id: 'px', orderId: 'o1' });
    await linked(env, 'px', 'ORDPX');
    await Promise.all([
      applySnapshot(env, { orderId: 'o1', attemptId: 'px', remote: paid('ORDPX', 5) }),
      applySnapshot(env, { orderId: 'o1', attemptId: 'cp', remote: paid('ORDCP', 5) }),
    ]);
    expect(reviews(db).map((r) => r.reason)).toEqual([
      'duplicate_settlement',
      'settled_after_cancel',
    ]);
    expect(await ent(env, 'o1')).toMatchObject({
      state: 'active',
      reason: 'duplicate_paid',
      eligible_count: 2,
    });
    // Refunding the extra payment never removes access while another payment is valid.
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'cp',
      remote: order('ORDCP', { minute: 9, status: 'refunded', detail: 'refunded' }),
    });
    expect(await ent(env, 'o1')).toMatchObject({
      state: 'active',
      reason: 'paid',
      eligible_count: 1,
    });
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'px',
      remote: order('ORDPX', { minute: 10, status: 'refunded', detail: 'refunded' }),
    });
    expect(await ent(env, 'o1')).toMatchObject({ state: 'revoked', reason: 'refunded' });
  });
  it('never classifies different orders with the same e-mail as duplicates', async () => {
    const { db, env } = setup();
    for (const id of ['o1', 'o2']) {
      addOrder(db, id, { email: 'same@example.com' });
      await addAttempt(env, { id: `a-${id}`, orderId: id });
      await linked(env, `a-${id}`, `ORD${id}`);
      await applySnapshot(env, { orderId: id, attemptId: `a-${id}`, remote: paid(`ORD${id}`, 1) });
      expect(await ent(env, id)).toMatchObject({ state: 'active', reason: 'paid' });
    }
    expect(reviews(db)).toEqual([]);
  });
  it('never moves a provider payment to another order', async () => {
    const { db, env } = setup();
    for (const id of ['o1', 'o2']) {
      addOrder(db, id);
      await addAttempt(env, { id: `a-${id}`, orderId: id });
    }
    await linked(env, 'a-o1', 'ORD1');
    await linked(env, 'a-o2', 'ORD2');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a-o1',
      remote: paid('ORD1', 1, { pay: 'SAMEPAY' }),
    });
    // Another order's snapshot claiming the same payment as refunded must not touch o1.
    await applySnapshot(env, {
      orderId: 'o2',
      attemptId: 'a-o2',
      remote: order('ORD2', { minute: 2, status: 'refunded', detail: 'refunded', pay: 'SAMEPAY' }),
    });
    expect(settlement(db, 'SAMEPAY')).toMatchObject({
      order_id: 'o1',
      refunded_cents: 0,
      remote_updated: T0 + 60000,
    });
    expect((await ent(env, 'o1')).state).toBe('active');
    expect(reviews(db)).toEqual([{ reason: 'identity_mismatch', subject_id: 'SAMEPAY' }]);
    expect((await ent(env, 'o2')).state).toBe('none');
  });
});

describe('creation without a response (blocker 2)', () => {
  it('classifies provider answers conservatively', () => {
    expect(classifyCreateResponse(201, { id: 'ORD1' })).toBe('created');
    expect(
      classifyCreateResponse(409, { errors: [{ code: 'idempotency_key_already_used' }] }),
    ).toBe('already_used');
    expect(classifyCreateResponse(423, {})).toBe('locked');
    expect(classifyCreateResponse(400, { errors: [{ code: 'invalid_total_amount' }] })).toBe(
      'rejected_not_created',
    );
    for (const status of [500, 502, 503, 504, 0, 409, 401])
      expect(classifyCreateResponse(status, {})).toBe('uncertain');
    expect(classifyCreateResponse(200, {})).toBe('uncertain');
  });
  it('follows the retry schedule, limit and deadline', () => {
    const base = { phase: 'sending', mp_id: null, pix_expires_at: T0 + 30 * 60000 };
    expect(nextCreationAction({ ...base, phase: 'reserved', send_count: 0 }, T0)).toEqual({
      action: 'send',
    });
    expect(nextCreationAction({ ...base, send_count: 1, last_sent_at: T0 }, T0 + 10000)).toEqual({
      action: 'wait',
      at: T0 + 30000,
    });
    expect(nextCreationAction({ ...base, send_count: 1, last_sent_at: T0 }, T0 + 30000)).toEqual({
      action: 'send',
    });
    expect(
      nextCreationAction({ ...base, send_count: MAX_CREATE_SENDS, last_sent_at: T0 }, T0 + 60000),
    ).toEqual({ action: 'uncertain' });
    expect(
      nextCreationAction({ ...base, send_count: 2, last_sent_at: T0 }, T0 + 31 * 60000),
    ).toEqual({ action: 'uncertain' });
    expect(nextCreationAction({ ...base, mp_id: 'ORD1', send_count: 1 }, T0)).toEqual({
      action: 'adopted',
    });
  });
  it('only resends the identical body, at most five times', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    expect(await recordSend(env, { id: 'a1', requestHash: 'different' })).toBe(false);
    for (let i = 0; i < MAX_CREATE_SENDS; i += 1)
      expect(await recordSend(env, { id: 'a1', requestHash: 'h-a1', now: T0 + i })).toBe(true);
    expect(await recordSend(env, { id: 'a1', requestHash: 'h-a1' })).toBe(false);
    expect(attempt(db, 'a1')).toMatchObject({
      phase: 'sending',
      send_count: 5,
      first_sent_at: T0,
      holds_lock: 1,
    });
  });
  it('adopts the provider order once, also from the uncertain phase (webhook adoption)', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await recordSend(env, { id: 'a1', requestHash: 'h-a1', now: T0 });
    await markUncertain(env, { id: 'a1', orderId: 'o1', now: T0 });
    expect(await adoptProviderOrder(env, { id: 'a1', mpId: 'ORDLATE' })).toBe(true);
    expect(await adoptProviderOrder(env, { id: 'a1', mpId: 'ORDOTHER' })).toBe(false);
    await applySnapshot(env, { orderId: 'o1', attemptId: 'a1', remote: paid('ORDLATE', 3) });
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'settled', holds_lock: 0, mp_id: 'ORDLATE' });
  });
  it('releases the lock for a validation refusal only on the first send', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await recordSend(env, { id: 'a1', requestHash: 'h-a1' });
    expect(await closeNotCreated(env, { id: 'a1' })).toBe(true);
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'closed_unpaid', holds_lock: 0 });
    addOrder(db, 'o2');
    await addAttempt(env, { id: 'b1', orderId: 'o2' });
    await recordSend(env, { id: 'b1', requestHash: 'h-b1' });
    await recordSend(env, { id: 'b1', requestHash: 'h-b1' });
    // An earlier send may have created the order: a later 400 proves nothing.
    expect(await closeNotCreated(env, { id: 'b1' })).toBe(false);
    expect(attempt(db, 'b1').holds_lock).toBe(1);
  });
});

describe('states and concurrency (blocker 3)', () => {
  const history = (mpId) => [
    order(mpId, { minute: 1 }),
    paid(mpId, 2),
    paid(mpId, 3, {
      detail: 'partially_refunded',
      payDetail: 'partially_refunded',
      refunds: [{ id: 'R1', transaction_id: `PAY-${mpId}`, amount: '10.00', status: 'processed' }],
    }),
    order(mpId, {
      minute: 4,
      status: 'charged_back',
      detail: 'in_process',
      refunds: [{ id: 'R1', transaction_id: `PAY-${mpId}`, amount: '10.00', status: 'processed' }],
    }),
    order(mpId, {
      minute: 5,
      status: 'charged_back',
      detail: 'reimbursed',
      refunds: [{ id: 'R1', transaction_id: `PAY-${mpId}`, amount: '10.00', status: 'processed' }],
    }),
  ];
  const permutations = (items) =>
    items.length <= 1
      ? [items]
      : items.flatMap((x, i) =>
          permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]),
        );
  async function finalState(sequence, { parallel = false } = {}) {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await linked(env, 'a1', 'ORDP');
    const apply = (remote) =>
      applySnapshot(env, { orderId: 'o1', attemptId: 'a1', remote, now: T0 });
    if (parallel) await Promise.all(sequence.map(apply));
    else for (const remote of sequence) await apply(remote);
    const s = settlement(db, 'PAY-ORDP');
    const a = attempt(db, 'a1');
    const e = await ent(env, 'o1');
    return {
      settled: s.settled,
      settledAt: s.settled_at,
      refunded: s.refunded_cents,
      dispute: s.dispute_stage,
      phase: a.phase,
      lock: a.holds_lock,
      state: e.state,
      reason: e.reason,
    };
  }
  it('reaches the same final state for all 120 arrival orders and in parallel', async () => {
    const events = history('ORDP');
    const expected = await finalState(events);
    expect(expected).toMatchObject({
      settled: 1,
      refunded: 1000,
      dispute: 'reversed',
      phase: 'settled',
      lock: 0,
      state: 'active',
    });
    for (const sequence of permutations(events))
      expect(await finalState(sequence)).toEqual(expected);
    expect(await finalState(events, { parallel: true })).toEqual(expected);
    expect(await finalState([...events, ...events].reverse())).toEqual(expected);
  });
  it('never lets a stale snapshot undo a payment', async () => {
    const result = await finalState([
      paid('ORDP', 5),
      order('ORDP', { minute: 1 }),
      order('ORDP', { minute: 9, status: 'canceled', detail: 'canceled' }),
    ]);
    expect(result).toMatchObject({ settled: 1, phase: 'settled', state: 'active' });
  });
  it.each([
    [
      'refunded',
      order('ORDP', { minute: 1, status: 'refunded', detail: 'refunded' }),
      { settled: 1, refunded: 4700, state: 'revoked', reason: 'refunded' },
    ],
    [
      'chargeback lost',
      order('ORDP', { minute: 1, status: 'charged_back', detail: 'settled' }),
      { dispute: 'lost', state: 'revoked', reason: 'charged_back' },
    ],
    [
      'chargeback open',
      order('ORDP', { minute: 1, status: 'charged_back', detail: 'in_process' }),
      { dispute: 'open', state: 'suspended', reason: 'dispute_open' },
    ],
  ])('accepts an initial terminal snapshot: %s', async (_, remote, expected) => {
    expect(await finalState([remote])).toMatchObject({ phase: 'settled', lock: 0, ...expected });
  });
  it('closes an attempt whose first snapshot is already expired', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    await addAttempt(env, { id: 'a1', orderId: 'o1' });
    await linked(env, 'a1', 'ORDX');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a1',
      remote: order('ORDX', { minute: 1, status: 'canceled', detail: 'expired' }),
    });
    expect(attempt(db, 'a1')).toMatchObject({ phase: 'closed_unpaid', holds_lock: 0 });
    expect(await ent(env, 'o1')).toMatchObject({ state: 'none' });
  });
  it('allows a newer dispute after a reversal, but not an older one', async () => {
    const reopened = await finalState([
      paid('ORDP', 1),
      order('ORDP', { minute: 5, status: 'charged_back', detail: 'reimbursed' }),
      order('ORDP', { minute: 8, status: 'charged_back', detail: 'in_process' }),
    ]);
    expect(reopened).toMatchObject({ dispute: 'open', state: 'suspended' });
    const stale = await finalState([
      paid('ORDP', 1),
      order('ORDP', { minute: 8, status: 'charged_back', detail: 'reimbursed' }),
      order('ORDP', { minute: 5, status: 'charged_back', detail: 'in_process' }),
    ]);
    expect(stale).toMatchObject({ dispute: 'reversed', state: 'active' });
  });
  it('rolls back the whole batch when one statement fails', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    // No attempt row: the settlement's foreign key fails, nothing is written.
    await expect(
      applySnapshot(env, { orderId: 'o1', attemptId: 'missing', remote: paid('ORDM', 1) }),
    ).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_settlements').get().n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_entitlements').get().n).toBe(0);
  });
});

describe('access right (blocker 4)', () => {
  async function paidOrder(db, env, id = 'o1') {
    addOrder(db, id);
    await addAttempt(env, { id: `a-${id}`, orderId: id });
    await linked(env, `a-${id}`, `ORD${id}`);
    await applySnapshot(env, { orderId: id, attemptId: `a-${id}`, remote: paid(`ORD${id}`, 1) });
  }
  it('keeps access on a partial refund and queues it for review (D1)', async () => {
    const { db, env } = setup();
    await paidOrder(db, env);
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a-o1',
      remote: paid('ORDo1', 2, {
        detail: 'partially_refunded',
        refunds: [{ id: 'R', transaction_id: 'PAY-ORDo1', amount: '5.00', status: 'processed' }],
      }),
    });
    expect(await ent(env, 'o1')).toMatchObject({ state: 'active', reason: 'paid' });
    expect(reviews(db)).toEqual([{ reason: 'partial_refund', subject_id: 'PAY-ORDo1' }]);
    expect(settlement(db, 'PAY-ORDo1').refunded_cents).toBe(500);
  });
  it('suspends during a dispute and restores on reversal', async () => {
    const { db, env } = setup();
    await paidOrder(db, env);
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a-o1',
      remote: order('ORDo1', { minute: 3, status: 'charged_back', detail: 'in_process' }),
    });
    expect((await ent(env, 'o1')).state).toBe('suspended');
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a-o1',
      remote: order('ORDo1', { minute: 4, status: 'charged_back', detail: 'reimbursed' }),
    });
    expect(await ent(env, 'o1')).toMatchObject({
      state: 'active',
      reason: 'paid',
      granted_at: T0 + 60000,
    });
  });
  it('restores or revokes by manual override, and clearing it returns to the facts', async () => {
    const { db, env } = setup();
    await paidOrder(db, env);
    await applySnapshot(env, {
      orderId: 'o1',
      attemptId: 'a-o1',
      remote: order('ORDo1', { minute: 3, status: 'refunded', detail: 'refunded' }),
    });
    expect((await ent(env, 'o1')).state).toBe('revoked');
    db.prepare(
      `INSERT INTO commerce_entitlement_overrides (id,order_id,action,reason,actor,created_at) VALUES ('ov1','o1','grant','goodwill','owner',?)`,
    ).run(T0);
    await entitlementStatement(env, 'o1').run();
    expect(await ent(env, 'o1')).toMatchObject({ state: 'active', reason: 'manual' });
    db.prepare(`UPDATE commerce_entitlement_overrides SET cleared_at=? WHERE id='ov1'`).run(T0);
    await entitlementStatement(env, 'o1').run();
    expect((await ent(env, 'o1')).state).toBe('revoked');
  });
  it('keeps the current fraud and risk-event blocks', async () => {
    const { db, env } = setup();
    await paidOrder(db, env);
    db.prepare(
      `INSERT INTO commerce_risk_events (topic,resource_id,task,received_at) VALUES ('fraud','UNLINKED','refund_review',?)`,
    ).run(T0);
    await entitlementStatement(env, 'o1').run();
    expect(await ent(env, 'o1')).toMatchObject({ state: 'suspended', reason: 'risk_hold' });
  });
  it('honors refund holds written before the ledger, until facts exist', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1');
    db.prepare(
      `INSERT INTO commerce_delivery_holds (order_id,reason,created_at) VALUES ('o1','refund',?)`,
    ).run(T0);
    await entitlementStatement(env, 'o1').run();
    expect(await ent(env, 'o1')).toMatchObject({ state: 'suspended', reason: 'risk_hold' });
  });
});

describe('Checkout Pro compatibility and shadow mode', () => {
  it('migration adopts existing Checkout Pro orders without touching them', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { readFileSync } = await import('node:fs');
    const db = new DatabaseSync(':memory:');
    const load = (f) =>
      db.exec(
        readFileSync(
          new URL(
            `../migrations/commerce/${f}`,
            import.meta.url,
          ),
          'utf8',
        ),
      );
    ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'].forEach(load);
    addOrder(db, 'paid', { mpId: 'ORDPAID', status: 'processed', detail: 'accredited' });
    addOrder(db, 'gone', { mpId: 'ORDGONE', status: 'canceled', detail: 'expired' });
    addOrder(db, 'nomp');
    const before = db.prepare('SELECT * FROM commerce_orders ORDER BY id').all();
    load('0004_payment_ledger.sql');
    load('0004_payment_ledger.sql'); // re-running is harmless
    expect(db.prepare('SELECT * FROM commerce_orders ORDER BY id').all()).toEqual(before);
    expect(
      db
        .prepare('SELECT id, phase, holds_lock, mp_id FROM commerce_payment_attempts ORDER BY id')
        .all(),
    ).toEqual([
      { id: 'legacy:gone', phase: 'closed_unpaid', holds_lock: 0, mp_id: 'ORDGONE' },
      { id: 'legacy:paid', phase: 'open', holds_lock: 1, mp_id: 'ORDPAID' },
    ]);
    expect(db.prepare('SELECT COUNT(*) n FROM commerce_settlements').get().n).toBe(0);
    expect(
      db.prepare("SELECT value FROM commerce_settings WHERE key='pix_creation'").get().value,
    ).toBe('off');
  });
  it('adopts a Checkout Pro order created after the migration, idempotently', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1', { mpId: 'ORDNEW' });
    const row = db.prepare('SELECT * FROM commerce_orders').get();
    await legacyAttemptStatement(env, row).run();
    await legacyAttemptStatement(env, row).run();
    expect(db.prepare('SELECT id, holds_lock FROM commerce_payment_attempts').all()).toEqual([
      { id: 'legacy:o1', holds_lock: 1 },
    ]);
  });
  it('records the snapshot and logs the comparison without changing anything else', async () => {
    const { db, env } = setup();
    addOrder(db, 'o1', { mpId: 'ORDo1', status: 'processed', detail: 'accredited' });
    const row = db.prepare('SELECT * FROM commerce_orders').get();
    const before = JSON.stringify(row);
    const log = vi.fn();
    const result = await runLedgerShadow(env, {
      row,
      remote: paid('ORDo1', 1),
      currentDeliverable: true,
      log,
    });
    expect(result).toMatchObject({ state: 'active', match: true });
    expect(log).toHaveBeenCalledWith('ledger_shadow', {
      order: 'o1',
      detail: 'match_active_deliverable',
    });
    expect(JSON.stringify(db.prepare('SELECT * FROM commerce_orders').get())).toBe(before);
    const mismatch = await runLedgerShadow(env, {
      row,
      remote: paid('ORDo1', 2),
      currentDeliverable: false,
      log,
    });
    expect(mismatch.match).toBe(false);
    expect(log).toHaveBeenLastCalledWith('ledger_shadow', {
      order: 'o1',
      detail: 'mismatch_active_withheld',
    });
  });
  it('swallows every shadow failure (e.g. migration not applied)', async () => {
    const { binding } = createD1({
      migrations: ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'],
    });
    const log = vi.fn();
    const result = await runLedgerShadow(
      { COMMERCE_DB: binding },
      {
        row: { id: 'o1', mp_id: 'ORD1', amount_cents: 4700, created_at: T0 },
        remote: paid('ORD1', 1),
        currentDeliverable: true,
        log,
      },
    );
    expect(result).toBeNull();
    expect(log).toHaveBeenCalledWith(
      'ledger_shadow_failed',
      expect.objectContaining({ order: 'o1' }),
    );
  });
});
