const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DAY = 86400000;
const key = (id) => `commerce:${id}`;
function readStoredSession(id) {
  try {
    if (!UUID.test(id || '')) return null;
    const session = JSON.parse(sessionStorage.getItem(key(id)));
    return session?.id === id &&
      /^[a-f0-9]{64}$/.test(session.token || '') &&
      typeof session.product === 'string' &&
      Number.isFinite(session.created) &&
      session.created <= Date.now() &&
      session.created > 0
      ? session
      : null;
  } catch {
    return null;
  }
}
export function readCommerceSession(id) {
  const session = readStoredSession(id);
  return session && session.created > Date.now() - 7 * DAY ? session : null;
}
export function prepareCommerceSession(product) {
  try {
    const previous = sessionStorage.getItem(`commerce:pending:${product}`);
    const pending = previous ? readStoredSession(previous) : null;
    // Never silently replace an unrecognizable in-flight order and risk a duplicate.
    if (previous && (!pending || pending.product !== product)) throw new Error('storage');
    if (pending && pending.created > Date.now() - DAY) return pending;
    const session = {
      id: crypto.randomUUID(),
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
      product,
      created: Date.now(),
    };
    sessionStorage.setItem(key(session.id), JSON.stringify(session));
    sessionStorage.setItem(`commerce:pending:${product}`, session.id);
    const saved = readCommerceSession(session.id);
    if (
      !saved ||
      saved.token !== session.token ||
      sessionStorage.getItem(`commerce:pending:${product}`) !== session.id
    )
      throw new Error('storage');
    return saved;
  } catch {
    throw new Error('commerce-session-unavailable');
  }
}
export function paymentTarget(result, session) {
  const url = new URL(result.checkout_url);
  if (
    result.order_id !== session.id ||
    url.protocol !== 'https:' ||
    url.hostname !== 'www.mercadopago.com.br' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/checkout/v1/redirect' ||
    url.searchParams.getAll('order_id').length !== 1 ||
    !(result.environment === 'production' ? /^ORD(?!TST)[A-Z0-9]{10,64}$/ : /^ORDTST[A-Z0-9]{10,64}$/).test(url.searchParams.get('order_id') || '')
  )
    throw new Error('redirect');
  return url.href;
}
export function navigatePayment(url) {
  // Top-level navigation in this tab preserves its same-origin sessionStorage on return.
  window.location.assign(url);
}

// Persist a failed/interrupted attempt across reloads; clear only after receiving the ZIP.
export function prepareDownloadAttempt(orderId) {
  if (!readCommerceSession(orderId)) throw new Error('session');
  const storageKey = `commerce:download:${orderId}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing && !UUID.test(existing)) throw new Error('attempt');
  const attempt = existing || crypto.randomUUID();
  sessionStorage.setItem(storageKey, attempt);
  if (sessionStorage.getItem(storageKey) !== attempt) throw new Error('storage');
  return attempt;
}
export function completeDownloadAttempt(orderId) {
  sessionStorage.removeItem(`commerce:download:${orderId}`);
}
