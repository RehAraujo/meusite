// R1a shadow mode: after the CURRENT reconciliation has run and decided delivery, the
// same verified snapshot is also recorded in the ledger and the computed access right
// is compared with the current decision. Nothing here changes a response, a delivery or
// the current tables; any failure is logged and swallowed (the promise never rejects).
//
// Off unless the Worker version sets COMMERCE_LEDGER_SHADOW=on, which also requires
// migration 0004 to be applied. Neither is done in R1a.
import { applySnapshot, legacyAttemptStatement } from './repository.js';

export const ledgerShadowEnabled = (env) => env?.COMMERCE_LEDGER_SHADOW === 'on';

/**
 * @param {object} row the order as returned by the current reconcile()
 * @param {object} remote the verified provider Order
 * @param {boolean} currentDeliverable the current rule's decision (paid and not blocked)
 * @param {(event: string, data: object) => void} log the handler's sanitized logger
 */
export async function runLedgerShadow(env, { row, remote, currentDeliverable, log }) {
  try {
    if (!row?.mp_id) return null;
    // One D1 round trip: adopt the Checkout Pro order, apply the snapshot, read back.
    // In R1a every Checkout Pro order maps to attempt `legacy:<order id>`. If the
    // provider order were linked to any other attempt, the settlement's foreign key
    // fails, the whole batch rolls back and the failure is only logged.
    const db = env.COMMERCE_DB;
    // With the shared lock on, a new Checkout Pro order already has attempt `cp-<id>`.
    const owner = await db
      .prepare('SELECT id FROM commerce_payment_attempts WHERE mp_id=? AND order_id=?')
      .bind(row.mp_id, row.id)
      .first();
    const attemptId = owner?.id ?? `legacy:${row.id}`;
    const { readBack } = await applySnapshot(env, {
      orderId: row.id,
      attemptId,
      remote,
      before: [legacyAttemptStatement(env, row)],
      after: [
        db
          .prepare('SELECT id, order_id FROM commerce_payment_attempts WHERE mp_id=?')
          .bind(row.mp_id),
        db.prepare('SELECT state, reason FROM commerce_entitlements WHERE order_id=?').bind(row.id),
      ],
    });
    const attempt = readBack[0]?.results?.[0];
    if (attempt?.id !== attemptId || attempt.order_id !== row.id) {
      log('ledger_shadow', { order: row.id, detail: 'attempt_missing' });
      return null;
    }
    const entitlement = readBack[1]?.results?.[0];
    const state = entitlement?.state ?? 'none';
    const match = (state === 'active') === !!currentDeliverable;
    log('ledger_shadow', {
      order: row.id,
      detail: `${match ? 'match' : 'mismatch'}_${state}_${currentDeliverable ? 'deliverable' : 'withheld'}`,
    });
    return { state, reason: entitlement?.reason ?? null, match };
  } catch (error) {
    log('ledger_shadow_failed', { order: row?.id, error });
    return null;
  }
}
