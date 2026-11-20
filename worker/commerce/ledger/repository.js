// D1 operations of the payment ledger (spec V3). Every multi-statement change runs in
// one D1 batch, which executes sequentially as a single transaction: either every
// statement applies or none does. All merges are conditional and commutative, so
// snapshots applied twice, late or in parallel converge to the same state.
import { DEFAULT_POLICY } from './entitlement.js';
import { interpretOrder, LOCKING_PHASES, PHASE_RANK } from './interpret.js';

export const MAX_CREATE_SENDS = 5;
// Delay before send n+1 (ms): immediate, 30 s, 2 min, 5 min, 15 min.
export const CREATE_RETRY_DELAYS = Object.freeze([0, 30000, 120000, 300000, 900000]);
const LEGACY_WATCH_MS = 48 * 3600000;

const rankSql = (column) =>
  `CASE ${column} ${Object.entries(PHASE_RANK)
    .map(([phase, rank]) => `WHEN '${phase}' THEN ${rank}`)
    .join(' ')} ELSE 0 END`;
const LOCKING_SQL = LOCKING_PHASES.map((p) => `'${p}'`).join(',');

// Fraud holds and unassociated risk events always suspend access (current rule).
// Refund/chargeback holds written by the current flow only count while the order has
// no recorded settlement: once facts exist, the facts decide (duplicate refunds).
const RISK_SQL = `(
  EXISTS (SELECT 1 FROM commerce_delivery_holds h WHERE h.order_id=commerce_orders.id AND
    (h.reason='fraud' OR NOT EXISTS (SELECT 1 FROM commerce_settlements s0 WHERE s0.order_id=commerce_orders.id AND s0.settled=1)))
  OR EXISTS (SELECT 1 FROM commerce_risk_events e WHERE
    NOT EXISTS (SELECT 1 FROM commerce_resources r WHERE r.resource_id=e.resource_id)
    OR EXISTS (SELECT 1 FROM commerce_resources r WHERE r.resource_id=e.resource_id AND r.order_id=commerce_orders.id))
)`;
const SETTLED = `FROM commerce_settlements s WHERE s.order_id=commerce_orders.id AND s.settled=1`;
const ELIGIBLE = `${SETTLED} AND s.amount_cents=commerce_orders.amount_cents AND s.dispute_stage IN ('none','reversed')
  AND (CASE WHEN ?2 THEN s.refunded_cents < s.amount_cents ELSE s.refunded_cents = 0 END)`;
const LIVE = `${SETTLED} AND s.refunded_cents < s.amount_cents`;

// Mirrors entitlementOf() in entitlement.js exactly (verified by tests).
const ENTITLEMENT_SQL = `
INSERT INTO commerce_entitlements (order_id,product_id,state,reason,granted_at,eligible_count,computed_at,version)
SELECT id, product_id,
  CASE WHEN ovr='grant' THEN 'active' WHEN ovr='revoke' THEN 'revoked' WHEN risk THEN 'suspended'
    WHEN ok>0 THEN 'active' WHEN disp>0 THEN 'suspended' WHEN mism>0 THEN 'suspended'
    WHEN lost>0 THEN 'revoked' WHEN anyset>0 THEN 'revoked' ELSE 'none' END,
  CASE WHEN ovr IS NOT NULL THEN 'manual' WHEN risk THEN 'risk_hold' WHEN ok>1 THEN 'duplicate_paid'
    WHEN ok=1 THEN 'paid' WHEN disp>0 THEN 'dispute_open' WHEN mism>0 THEN 'amount_mismatch'
    WHEN lost>0 THEN 'charged_back' WHEN anyset>0 THEN 'refunded' ELSE 'unpaid' END,
  granted, ok, ?3, 1
FROM (SELECT commerce_orders.id, commerce_orders.product_id,
  (SELECT v.action FROM commerce_entitlement_overrides v WHERE v.order_id=commerce_orders.id AND v.cleared_at IS NULL
    ORDER BY v.created_at DESC, v.id DESC LIMIT 1) AS ovr,
  ${RISK_SQL} AS risk,
  (SELECT COUNT(*) ${ELIGIBLE}) AS ok,
  (SELECT MIN(s.settled_at) ${ELIGIBLE}) AS granted,
  (SELECT COUNT(*) ${LIVE} AND s.dispute_stage='open') AS disp,
  (SELECT COUNT(*) ${LIVE} AND s.amount_cents<>commerce_orders.amount_cents AND s.dispute_stage<>'lost') AS mism,
  (SELECT COUNT(*) ${SETTLED} AND s.dispute_stage='lost') AS lost,
  (SELECT COUNT(*) ${SETTLED}) AS anyset
  FROM commerce_orders WHERE commerce_orders.id=?1) AS facts
WHERE true
ON CONFLICT(order_id) DO UPDATE SET state=excluded.state, reason=excluded.reason, granted_at=excluded.granted_at,
  eligible_count=excluded.eligible_count, computed_at=excluded.computed_at, version=commerce_entitlements.version+1`;

export function entitlementStatement(env, orderId, now = Date.now(), policy = DEFAULT_POLICY) {
  return env.COMMERCE_DB.prepare(ENTITLEMENT_SQL).bind(
    orderId,
    policy.partialRefund === 'keep' ? 1 : 0,
    now,
  );
}

const SETTLEMENT_SQL = `
INSERT INTO commerce_settlements (provider_payment_id,attempt_id,order_id,amount_cents,settled,settled_at,refunded_cents,dispute_stage,dispute_updated,remote_updated)
VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
ON CONFLICT(provider_payment_id) DO UPDATE SET
  settled = MAX(settled, excluded.settled),
  settled_at = CASE WHEN excluded.settled_at IS NULL THEN settled_at WHEN settled_at IS NULL THEN excluded.settled_at
    ELSE MIN(settled_at, excluded.settled_at) END,
  refunded_cents = MIN(amount_cents, MAX(refunded_cents, excluded.refunded_cents)),
  dispute_stage = CASE WHEN excluded.dispute_stage<>'none' AND excluded.dispute_updated > dispute_updated
    THEN excluded.dispute_stage ELSE dispute_stage END,
  dispute_updated = CASE WHEN excluded.dispute_stage<>'none' AND excluded.dispute_updated > dispute_updated
    THEN excluded.dispute_updated ELSE dispute_updated END,
  remote_updated = MAX(remote_updated, excluded.remote_updated)
WHERE commerce_settlements.order_id = excluded.order_id`;

const review = (env, subject, reason, orderId, now) =>
  env.COMMERCE_DB.prepare(
    'INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at) VALUES (?,?,?,?)',
  ).bind(subject, reason, orderId, now);

/**
 * Applies one authoritative Order snapshot to an attempt, in a single transaction.
 * The caller must have verified the Order's identity (seller, application, amount,
 * external reference) before calling, exactly as reconcile() does today.
 */
export async function applySnapshot(
  env,
  {
    orderId,
    attemptId,
    remote,
    now = Date.now(),
    policy = DEFAULT_POLICY,
    before = [],
    after = [],
  },
) {
  // `before` / `after`: extra statements run in the SAME transaction (one round trip),
  // e.g. adopting a legacy attempt first and reading the result back at the end.
  const facts = interpretOrder(remote);
  const db = env.COMMERCE_DB;
  const ts = facts.remoteUpdated;
  const statements = [];
  for (const s of facts.settlements) {
    statements.push(
      // A provider payment already linked to another order is never moved: flag it.
      db
        .prepare(
          `INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at)
         SELECT ?1,'identity_mismatch',?2,?3 FROM commerce_settlements WHERE provider_payment_id=?1 AND order_id<>?2`,
        )
        .bind(s.providerPaymentId, orderId, now),
      db
        .prepare(SETTLEMENT_SQL)
        .bind(
          s.providerPaymentId,
          attemptId,
          orderId,
          s.amountCents,
          s.settled,
          s.settled ? ts : null,
          s.refundedCents,
          s.disputeStage,
          s.disputeStage === 'none' ? 0 : ts,
          ts,
        ),
    );
  }
  statements.push(
    // Money received on an attempt that was already closed (e.g. a cancelled Pix code).
    db
      .prepare(
        `INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at)
       SELECT a.id,'settled_after_cancel',a.order_id,?2 FROM commerce_payment_attempts a
       WHERE a.id=?1 AND a.phase='closed_unpaid'
       AND EXISTS (SELECT 1 FROM commerce_settlements s WHERE s.attempt_id=a.id AND s.settled=1)`,
      )
      .bind(attemptId, now),
    // Non-financial phase change: only from a newer snapshot (or same instant, higher
    // rank); never leaves settled/closed/review; a cancel in flight is not reopened.
    db
      .prepare(
        `UPDATE commerce_payment_attempts SET phase=?2, holds_lock=?3, mp_status=?4, mp_status_detail=?5,
         remote_updated=?6, updated_at=?7
       WHERE id=?1 AND ?2<>'settled' AND phase IN (${LOCKING_SQL})
         AND (remote_updated < ?6 OR (remote_updated = ?6 AND ${rankSql('phase')} < ?8))
         AND NOT (phase='canceling' AND ?2='open')`,
      )
      .bind(
        attemptId,
        facts.phase,
        LOCKING_PHASES.includes(facts.phase) ? 1 : 0,
        facts.mpStatus,
        facts.mpStatusDetail,
        ts,
        now,
        PHASE_RANK[facts.phase] ?? 0,
      ),
    // Settled is decided by facts, not by timestamps, and is absorbing.
    db
      .prepare(
        `UPDATE commerce_payment_attempts SET phase='settled', holds_lock=0, updated_at=?2,
         mp_status=CASE WHEN remote_updated <= ?3 THEN ?4 ELSE mp_status END,
         mp_status_detail=CASE WHEN remote_updated <= ?3 THEN ?5 ELSE mp_status_detail END,
         remote_updated=MAX(remote_updated, ?3)
       WHERE id=?1 AND EXISTS (SELECT 1 FROM commerce_settlements s WHERE s.attempt_id=?1 AND s.settled=1)`,
      )
      .bind(attemptId, now, ts, facts.mpStatus, facts.mpStatusDetail),
    // More than one settled payment on the same order. Different orders, even with
    // the same buyer e-mail, are never classified as duplicates.
    db
      .prepare(
        `INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at)
       SELECT ?1,'duplicate_settlement',?1,?2 WHERE
       (SELECT COUNT(*) FROM commerce_settlements WHERE order_id=?1 AND settled=1) > 1`,
      )
      .bind(orderId, now),
    db
      .prepare(
        `INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at)
       SELECT s.provider_payment_id,'amount_mismatch',s.order_id,?2 FROM commerce_settlements s
       JOIN commerce_orders o ON o.id=s.order_id WHERE s.order_id=?1 AND s.settled=1 AND s.amount_cents<>o.amount_cents`,
      )
      .bind(orderId, now),
    // D1: partial refunds keep access by default and are queued for manual review.
    db
      .prepare(
        `INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at)
       SELECT s.provider_payment_id,'partial_refund',s.order_id,?2 FROM commerce_settlements s
       WHERE s.order_id=?1 AND s.settled=1 AND s.refunded_cents>0 AND s.refunded_cents<s.amount_cents`,
      )
      .bind(orderId, now),
  );
  for (const reason of facts.anomalies)
    statements.push(review(env, attemptId, reason, orderId, now));
  statements.push(entitlementStatement(env, orderId, now, policy));
  const results = await db.batch([...before, ...statements, ...after]);
  return { ...facts, readBack: after.length ? results.slice(-after.length) : [] };
}

/** Adopts an existing Checkout Pro order as attempt `legacy:<id>` (idempotent). */
export function legacyAttemptStatement(env, order, now = Date.now()) {
  return env.COMMERCE_DB.prepare(
    `INSERT OR IGNORE INTO commerce_payment_attempts
       (id,order_id,flow,phase,holds_lock,mp_id,request_body,request_hash,amount_cents,watch_until,created_at,updated_at)
     SELECT ?1,?2,'checkout_pro','open',
       CASE WHEN EXISTS (SELECT 1 FROM commerce_payment_attempts WHERE order_id=?2 AND holds_lock=1) THEN 0 ELSE 1 END,
       ?3,'{}','legacy',?4,?5,?6,?7
     WHERE NOT EXISTS (SELECT 1 FROM commerce_payment_attempts WHERE mp_id=?3)`,
  ).bind(
    `legacy:${order.id}`,
    order.id,
    order.mp_id,
    order.amount_cents,
    order.created_at + LEGACY_WATCH_MS,
    order.created_at,
    now,
  );
}

export async function attemptForProviderOrder(env, mpId) {
  return env.COMMERCE_DB.prepare('SELECT * FROM commerce_payment_attempts WHERE mp_id=?')
    .bind(mpId)
    .first();
}

export async function getEntitlement(env, orderId) {
  return env.COMMERCE_DB.prepare('SELECT * FROM commerce_entitlements WHERE order_id=?')
    .bind(orderId)
    .first();
}

const UNIQUE = /UNIQUE constraint failed/i;

/**
 * Reserves the shared per-order charge lock before ANY provider call (all flows).
 * Returns { reserved: true, attempt } or { reserved: false, reason, holder }.
 * Refused when the order is already paid (current rule or computed access right).
 */
export async function reserveAttempt(
  env,
  { id, orderId, flow, requestBody, requestHash, amountCents, watchUntil, now = Date.now() },
) {
  let result;
  try {
    result = await env.COMMERCE_DB.prepare(
      `INSERT INTO commerce_payment_attempts
         (id,order_id,flow,phase,holds_lock,request_body,request_hash,amount_cents,watch_until,created_at,updated_at)
       SELECT ?1,?2,?3,'reserved',1,?4,?5,?6,?7,?8,?8
       WHERE NOT EXISTS (SELECT 1 FROM commerce_orders o WHERE o.id=?2 AND o.status='processed' AND o.status_detail='accredited')
         AND NOT EXISTS (SELECT 1 FROM commerce_entitlements e WHERE e.order_id=?2 AND e.state='active')`,
    )
      .bind(id, orderId, flow, requestBody, requestHash, amountCents, watchUntil, now)
      .run();
  } catch (error) {
    if (!UNIQUE.test(String(error?.message))) throw error;
    const holder = await env.COMMERCE_DB.prepare(
      'SELECT * FROM commerce_payment_attempts WHERE order_id=? AND holds_lock=1',
    )
      .bind(orderId)
      .first();
    // Same id retried (e.g. client retry): it is our own reservation.
    if (holder?.id === id) return { reserved: true, attempt: holder };
    return { reserved: false, reason: 'locked', holder };
  }
  if (!result?.meta?.changes) return { reserved: false, reason: 'paid', holder: null };
  const attempt = await env.COMMERCE_DB.prepare(
    'SELECT * FROM commerce_payment_attempts WHERE id=?',
  )
    .bind(id)
    .first();
  return { reserved: true, attempt };
}

/** Decides what to do with an attempt whose creation has no confirmed answer yet. */
export function nextCreationAction(attempt, now = Date.now()) {
  if (attempt.mp_id) return { action: 'adopted' };
  if (!['reserved', 'sending'].includes(attempt.phase)) return { action: 'none' };
  const deadline = attempt.pix_expires_at ?? attempt.exposure_until ?? Infinity;
  if (attempt.send_count >= MAX_CREATE_SENDS || now >= deadline) return { action: 'uncertain' };
  const due =
    (attempt.last_sent_at ?? 0) +
    CREATE_RETRY_DELAYS[Math.min(attempt.send_count, CREATE_RETRY_DELAYS.length - 1)];
  return attempt.send_count === 0 || now >= due ? { action: 'send' } : { action: 'wait', at: due };
}

/**
 * Classifies the answer to POST /v1/orders. Only a validation error BEFORE processing
 * proves that nothing was created; everything else keeps the attempt (and its lock).
 */
export function classifyCreateResponse(status, body) {
  if (status >= 200 && status < 300 && body?.id) return 'created';
  const code = typeof body?.errors?.[0]?.code === 'string' ? body.errors[0].code : body?.code;
  if (status === 409 && code === 'idempotency_key_already_used') return 'already_used';
  if (status === 423) return 'locked';
  if ((status === 400 || status === 422) && code !== 'idempotency_key_already_used')
    return 'rejected_not_created';
  return 'uncertain';
}

/** Records one more send of the SAME body with the SAME key. False when not allowed. */
export async function recordSend(env, { id, requestHash, now = Date.now() }) {
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET phase='sending', send_count=send_count+1,
       first_sent_at=COALESCE(first_sent_at, ?3), last_sent_at=?3, updated_at=?3
     WHERE id=?1 AND request_hash=?2 AND mp_id IS NULL AND phase IN ('reserved','sending') AND send_count < ?4`,
  )
    .bind(id, requestHash, now, MAX_CREATE_SENDS)
    .run();
  return result?.meta?.changes === 1;
}

/** Links the provider Order to the attempt (response, search or webhook adoption). */
export async function adoptProviderOrder(env, { id, mpId, now = Date.now() }) {
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET mp_id=?2, updated_at=?3
     WHERE id=?1 AND mp_id IS NULL AND phase IN ('reserved','sending','uncertain')
       AND NOT EXISTS (SELECT 1 FROM commerce_payment_attempts WHERE mp_id=?2)`,
  )
    .bind(id, mpId, now)
    .run();
  return result?.meta?.changes === 1;
}

/** Recovery exhausted: keep the lock, open a review. Never releases the lock. */
export async function markUncertain(env, { id, orderId, now = Date.now() }) {
  await env.COMMERCE_DB.batch([
    env.COMMERCE_DB.prepare(
      `UPDATE commerce_payment_attempts SET phase='uncertain', updated_at=?2
       WHERE id=?1 AND mp_id IS NULL AND phase IN ('reserved','sending')`,
    ).bind(id, now),
    review(env, id, 'creation_uncertain', orderId, now),
  ]);
}

/** Provider proved nothing was created (validation error before processing). */
export async function closeNotCreated(env, { id, now = Date.now() }) {
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET phase='closed_unpaid', holds_lock=0, updated_at=?2
     WHERE id=?1 AND mp_id IS NULL AND phase IN ('reserved','sending') AND send_count <= 1`,
  )
    .bind(id, now)
    .run();
  return result?.meta?.changes === 1;
}

/** Buyer asked to switch method: open -> canceling. The lock stays until a snapshot. */
export async function beginCancel(env, { id, now = Date.now() }) {
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET phase='canceling', updated_at=?2 WHERE id=?1 AND phase='open'`,
  )
    .bind(id, now)
    .run();
  return result?.meta?.changes === 1;
}

/** Provider answered 409 cannot_cancel and the order is still open: back to open. */
export async function abortCancel(env, { id, now = Date.now() }) {
  const result = await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET phase='open', updated_at=?2 WHERE id=?1 AND phase='canceling'`,
  )
    .bind(id, now)
    .run();
  return result?.meta?.changes === 1;
}
