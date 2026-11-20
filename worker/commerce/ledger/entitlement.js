// Access right, computed from financial facts. Pure reference implementation: the SQL in
// repository.js must produce exactly the same result (checked by tests).
//
// Order of precedence (spec V3, 4.4):
//   1. latest uncleared manual override (grant -> active, revoke -> revoked)
//   2. fraud hold / unassociated risk event -> suspended (risk_hold)
//   3. at least one eligible settlement -> active (paid, or duplicate_paid when > 1)
//   4. a settled payment in an open dispute -> suspended (dispute_open)
//   5. a settled payment with a different amount -> suspended (amount_mismatch)
//   6. any settled payment lost in dispute -> revoked (charged_back)
//   7. any other settled payment (fully refunded) -> revoked (refunded)
//   8. nothing settled -> none
// No expiry is computed here: access validity remains a separate commercial rule.

// D1 (approved): a partial refund keeps access by default; it is flagged for review.
export const DEFAULT_POLICY = Object.freeze({ partialRefund: 'keep' });

export function eligible(settlement, orderAmountCents, policy = DEFAULT_POLICY) {
  if (settlement.settled !== 1) return false;
  if (settlement.amountCents !== orderAmountCents) return false;
  if (settlement.disputeStage !== 'none' && settlement.disputeStage !== 'reversed') return false;
  return policy.partialRefund === 'keep'
    ? settlement.refundedCents < settlement.amountCents
    : settlement.refundedCents === 0;
}

export function entitlementOf({
  settlements = [],
  orderAmountCents,
  riskHold = false,
  override = null,
  policy = DEFAULT_POLICY,
}) {
  const settled = settlements.filter((s) => s.settled === 1);
  const ok = settled.filter((s) => eligible(s, orderAmountCents, policy));
  const grantedAt = ok.length ? Math.min(...ok.map((s) => s.settledAt ?? Infinity)) : null;
  const result = (state, reason) => ({
    state,
    reason,
    eligibleCount: ok.length,
    grantedAt: Number.isFinite(grantedAt) ? grantedAt : null,
  });
  if (override === 'grant') return result('active', 'manual');
  if (override === 'revoke') return result('revoked', 'manual');
  if (riskHold) return result('suspended', 'risk_hold');
  if (ok.length > 1) return result('active', 'duplicate_paid');
  if (ok.length === 1) return result('active', 'paid');
  const live = settled.filter((s) => s.refundedCents < s.amountCents);
  if (live.some((s) => s.disputeStage === 'open')) return result('suspended', 'dispute_open');
  if (live.some((s) => s.amountCents !== orderAmountCents && s.disputeStage !== 'lost'))
    return result('suspended', 'amount_mismatch');
  if (settled.some((s) => s.disputeStage === 'lost')) return result('revoked', 'charged_back');
  if (settled.length) return result('revoked', 'refunded');
  return result('none', 'unpaid');
}
