// Starts (or resumes) the integrated checkout and leaves for Mercado Pago in one step.
// The order is still created on the server with the buyer's session token and the
// same Idempotency-Key on every retry; the redirect is validated by paymentTarget().
import {
  navigatePayment,
  paymentTarget,
  prepareCommerceSession,
  readCommerceSession,
  settleCommerceSession,
} from './commerce-session';

let inFlight = false;

async function createOrder(session, productId) {
  const response = await fetch('/api/commerce/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': session.id,
    },
    body: JSON.stringify({ product_id: productId }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('checkout-unavailable');
  return response.json();
}

async function go(session, productId) {
  const result = await createOrder(session, productId);
  navigatePayment(paymentTarget(result, session));
}

// New purchase, or the pending one of this browser (same order, no duplicate).
// Throws 'commerce-session-unavailable' or 'checkout-unavailable' for the fallback.
export async function startCheckout(productId) {
  if (inFlight) return;
  inFlight = true;
  try {
    await go(prepareCommerceSession(productId), productId);
  } finally {
    inFlight = false;
  }
}

// Retry on the same Mercado Pago Order, only when the provider allows it.
export async function retryCheckout(orderId, productId) {
  const session = readCommerceSession(orderId);
  if (!session) throw new Error('commerce-session-unavailable');
  await go(session, productId);
}

// A definitively failed order is released so the next click creates a new one.
export async function restartCheckout(orderId, productId) {
  settleCommerceSession(orderId);
  await startCheckout(productId);
}
