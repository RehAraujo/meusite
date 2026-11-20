// Pure translation of an authoritative Mercado Pago Order snapshot into ledger facts.
// No I/O. The caller has already verified seller, application, environment and order
// identity; this module only reads payments, refunds and chargebacks.

export const PHASE_RANK = Object.freeze({
  reserved: 0,
  sending: 0,
  uncertain: 0,
  open: 1,
  canceling: 2,
  closed_unpaid: 3,
  review: 3,
  settled: 4,
});
// Phases that keep the per-order charge lock.
export const LOCKING_PHASES = Object.freeze([
  'reserved',
  'sending',
  'open',
  'canceling',
  'uncertain',
]);

// Chargeback status_detail -> dispute stage. Names are documented; their exact meaning
// is hypothesis H12 (spec V3, section 13). Unknown details fail closed as 'open'.
const DISPUTE_STAGE = Object.freeze({
  in_process: 'open',
  settled: 'lost',
  reimbursed: 'reversed',
});
const CLOSED_UNPAID = new Set(['canceled', 'expired', 'failed']);
const FAILED_REFUND = new Set(['failed', 'rejected', 'canceled', 'cancelled']);
const PROVIDER_ID = /^[A-Za-z0-9_-]{1,128}$/;

// "47.00" -> 4700. Anything that is not a plain non-negative decimal is rejected.
export function cents(value) {
  const text = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const list = (value) => (Array.isArray(value) ? value : []);
const providerId = (value) => {
  const id = value === undefined || value === null ? '' : String(value);
  return PROVIDER_ID.test(id) ? id : null;
};

function settledPayment(payment) {
  if (payment.status === 'processed')
    return payment.status_detail === 'accredited' || payment.status_detail === 'partially_refunded';
  // A refunded or charged-back payment was paid first.
  return payment.status === 'refunded' || payment.status === 'charged_back';
}

/**
 * @returns {{ remoteUpdated: number, phase: string, mpStatus: string, mpStatusDetail: string,
 *   settlements: Array<object>, anomalies: string[] }}
 */
export function interpretOrder(remote) {
  const remoteUpdated = Date.parse(remote?.last_updated_date);
  if (!Number.isFinite(remoteUpdated)) throw new Error('version');
  const status = typeof remote.status === 'string' ? remote.status : 'unknown';
  const detail = typeof remote.status_detail === 'string' ? remote.status_detail : '';
  const transactions = remote.transactions || {};
  const payments = list(transactions.payments);
  const refunds = list(transactions.refunds);
  const chargebacks = list(transactions.chargebacks);
  const anomalies = [];
  const orderCharged = status === 'charged_back';

  // With a single payment, the Order-level status also describes that payment (some
  // payloads omit the payment's own status_detail or amount).
  const single = payments.length === 1;
  const orderPaid =
    single &&
    ((status === 'processed' && (detail === 'accredited' || detail === 'partially_refunded')) ||
      status === 'refunded' ||
      orderCharged);
  const settlements = [];
  for (const payment of payments) {
    const id = providerId(payment?.id);
    const settled = settledPayment(payment || {}) || orderPaid;
    if (!id) {
      if (settled) anomalies.push('unknown_remote_state');
      continue;
    }
    const amount = cents(
      payment.paid_amount ??
        payment.amount ??
        (single ? (remote.total_paid_amount ?? remote.total_amount) : undefined),
    );
    if (amount === null) {
      anomalies.push('unknown_remote_state');
      continue;
    }
    let refunded = 0;
    for (const refund of refunds) {
      const target = providerId(refund?.transaction_id ?? refund?.payment_id);
      if (target !== id || FAILED_REFUND.has(refund?.status)) continue;
      const value = cents(refund.amount);
      if (value === null) anomalies.push('unknown_remote_state');
      else refunded += value;
    }
    if (payment.status === 'refunded' || (status === 'refunded' && payments.length === 1))
      refunded = amount;
    const partial =
      payment.status_detail === 'partially_refunded' || (single && detail === 'partially_refunded');
    if (partial && refunded === 0) anomalies.push('unknown_remote_state');
    refunded = Math.min(refunded, amount);

    let dispute = 'none';
    const own = chargebacks.filter((c) => providerId(c?.transaction_id ?? c?.payment_id) === id);
    const charged =
      payment.status === 'charged_back' ||
      own.length > 0 ||
      (orderCharged && payments.length === 1);
    if (charged) {
      const source =
        payment.status === 'charged_back'
          ? payment.status_detail
          : orderCharged
            ? detail
            : (own.at(-1)?.status_detail ?? own.at(-1)?.status);
      dispute = DISPUTE_STAGE[source] || 'open';
      if (!DISPUTE_STAGE[source]) anomalies.push('unknown_remote_state');
    }
    settlements.push({
      providerPaymentId: id,
      amountCents: amount,
      settled: settled || charged ? 1 : 0,
      refundedCents: refunded,
      disputeStage: dispute,
    });
  }
  if (orderCharged && payments.length !== 1 && chargebacks.length === 0)
    anomalies.push('unknown_remote_state');

  const anySettled = settlements.some((s) => s.settled === 1);
  const phase = anySettled
    ? 'settled'
    : CLOSED_UNPAID.has(status) || status === 'refunded'
      ? 'closed_unpaid'
      : 'open';
  return {
    remoteUpdated,
    phase,
    mpStatus: status,
    mpStatusDetail: detail,
    settlements,
    anomalies: [...new Set(anomalies)],
  };
}
