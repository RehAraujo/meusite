// Starts (or resumes) the integrated checkout and leaves for Mercado Pago in one step.
// The order is still created on the server with the buyer's session token and the
// same Idempotency-Key on every retry; the redirect is validated by paymentTarget().
//
// One shared state for every purchase button on the page:
//   idle → loading (request in flight) → redirecting (navigation handed to the browser)
// While loading or redirecting, further clicks are ignored, so a burst of taps never
// sends a second request. The page can stay alive after the redirect (the Mercado Pago
// app takes over the link on Android, or the buyer comes back with Back and the page is
// restored from the back/forward cache), so "redirecting" is released when the page is
// shown again, when it becomes visible again, or after REDIRECT_GRACE_MS.
import {
  navigatePayment,
  paymentTarget,
  prepareCommerceSession,
  readCommerceSession,
  settleCommerceSession,
} from './commerce-session';

// The server bounds each provider call to 8 s; past this the buyer gets the fallback.
export const CHECKOUT_TIMEOUT_MS = 15000;
// A normal redirect unloads the page well before this.
export const REDIRECT_GRACE_MS = 10000;

const IDLE = Object.freeze({ phase: 'idle', returned: false });
let state = IDLE;
let graceTimer = null;
let lifecycleInstalled = false;
const listeners = new Set();

function setState(next) {
  state = Object.freeze({ ...state, ...next });
  for (const listener of listeners) listener();
}
export function subscribeCheckout(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const getCheckoutState = () => state;

function clearGrace() {
  if (graceTimer !== null) clearTimeout(graceTimer);
  graceTimer = null;
}
// The buyer is back on this page after a redirect: make the buttons usable again.
function recover() {
  if (state.phase !== 'redirecting') return;
  clearGrace();
  setState({ phase: 'idle', returned: true });
}
function installLifecycle() {
  if (lifecycleInstalled || typeof window === 'undefined') return;
  lifecycleInstalled = true;
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) recover();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recover();
  });
}

async function createOrder(session, productId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch('/api/commerce/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': session.id,
      },
      body: JSON.stringify({ product_id: productId }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    // A retry uses the same Idempotency-Key, so an order the server finishes later is
    // reused, never duplicated.
    throw new Error(error?.name === 'AbortError' ? 'checkout-timeout' : 'checkout-unavailable');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error('checkout-unavailable');
  return response.json();
}

async function go(session, productId) {
  const result = await createOrder(session, productId);
  const target = paymentTarget(result, session);
  setState({ phase: 'redirecting' });
  graceTimer = setTimeout(() => {
    graceTimer = null;
    recover();
  }, REDIRECT_GRACE_MS);
  navigatePayment(target);
}

// Runs one purchase action at a time. Returns false when ignored (another one is in
// progress). Errors reset the state and are rethrown for the caller's fallback.
async function run(action) {
  if (state.phase !== 'idle') return false;
  installLifecycle();
  clearGrace();
  setState({ phase: 'loading', returned: false });
  try {
    await action();
    return true;
  } catch (error) {
    clearGrace();
    setState({ phase: 'idle' });
    throw error;
  }
}

// New purchase, or the pending one of this browser (same order, no duplicate).
// Throws 'commerce-session-unavailable', 'checkout-unavailable' or 'checkout-timeout'.
export function startCheckout(productId) {
  return run(() => go(prepareCommerceSession(productId), productId));
}

// Retry on the same Mercado Pago Order, only when the provider allows it.
export function retryCheckout(orderId, productId) {
  return run(() => {
    const session = readCommerceSession(orderId);
    if (!session) throw new Error('commerce-session-unavailable');
    return go(session, productId);
  });
}

// A definitively failed order is released so the next click creates a new one.
export function restartCheckout(orderId, productId) {
  return run(() => {
    settleCommerceSession(orderId);
    return go(prepareCommerceSession(productId), productId);
  });
}

// Tests only: back to the initial state between cases.
export function resetCheckoutState() {
  clearGrace();
  state = IDLE;
  for (const listener of listeners) listener();
}
