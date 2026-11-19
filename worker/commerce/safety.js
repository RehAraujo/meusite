// Only provider-verified resources are associated with local orders. Webhook body
// references are never used to select a customer's order or to grant access.
const resourceId = (value) => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  return /^[A-Za-z0-9]{1,128}$/.test(String(value ?? '')) ? String(value) : null;
};
export const RISK_TOPICS = Object.freeze({
  stop_delivery_op_wh: 'fraud',
  topic_chargebacks_wh: 'chargeback',
  chargebacks: 'chargeback',
});
// Unknown signed resource => fail closed globally until verified association.
// Re-evaluated atomically in the download reservation as well as on status reads.
export const BLOCKED_SQL = `(
  EXISTS (SELECT 1 FROM commerce_delivery_holds h WHERE h.order_id=commerce_orders.id)
  OR EXISTS (SELECT 1 FROM commerce_risk_events e WHERE
    NOT EXISTS (SELECT 1 FROM commerce_resources r WHERE r.resource_id=e.resource_id)
    OR EXISTS (SELECT 1 FROM commerce_resources r WHERE r.resource_id=e.resource_id AND r.order_id=commerce_orders.id))
)`;
export async function persistRisk(env, topic, signedId) {
  const kind = RISK_TOPICS[topic];
  if (!kind || !resourceId(signedId)) throw new Error('risk');
  // Persist BEFORE acknowledging: fraud alerts may not be retried by the provider.
  // No provider call, refund or external side effect is performed here.
  await env.COMMERCE_DB.prepare(
    'INSERT OR IGNORE INTO commerce_risk_events (topic,resource_id,task,received_at) VALUES (?,?,?,?)',
  )
    .bind(kind, signedId, kind === 'fraud' ? 'refund_review' : 'dispute_review', Date.now())
    .run();
}
export async function captureSafety(env, row, remote) {
  const payments = remote.transactions?.payments || [];
  const chargebacks = remote.transactions?.chargebacks || [];
  const refunds = remote.transactions?.refunds || [];
  if (!Array.isArray(payments) || !Array.isArray(chargebacks) || !Array.isArray(refunds))
    throw new Error('transactions');
  const ids = new Set([remote.id]);
  for (const payment of payments) {
    for (const value of [payment.id, payment.reference?.id]) {
      const id = resourceId(value);
      if (id) ids.add(id);
    }
  }
  for (const item of chargebacks) {
    for (const value of [item.id, item.case_id, item.transaction_id]) {
      const id = resourceId(value);
      if (id) ids.add(id);
    }
  }
  if (ids.size > 100) throw new Error('resources');
  // Persist a terminal hold before updating mappings: learning an association must
  // never clear a temporary global block while the corresponding order is unsafe.
  const isChargeback =
    remote.status === 'charged_back' ||
    chargebacks.length > 0 ||
    payments.some((p) => p.status === 'charged_back');
  const isRefund =
    remote.status === 'refunded' ||
    remote.status_detail === 'partially_refunded' ||
    refunds.length > 0 ||
    payments.some((p) => p.status === 'refunded' || p.status_detail === 'partially_refunded');
  if (isChargeback || isRefund) {
    await env.COMMERCE_DB.prepare(
      'INSERT OR IGNORE INTO commerce_delivery_holds (order_id,reason,created_at) VALUES (?,?,?)',
    )
      .bind(row.id, isChargeback ? 'chargeback' : 'refund', Date.now())
      .run();
  }
  for (const id of ids) {
    await env.COMMERCE_DB.prepare(
      'INSERT OR IGNORE INTO commerce_resources (resource_id,order_id) VALUES (?,?)',
    )
      .bind(id, row.id)
      .run();
  }
}
export function riskResource(input, topic) {
  return resourceId(
    input?.data?.id ?? (topic === 'stop_delivery_op_wh' ? input?.data?.payment_id : null),
  );
}
