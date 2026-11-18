// Buyer access lives only in this browser (localStorage), never in cookies, URLs sent
// to servers, the Mercado Pago return address or logs. It works for any catalog product.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
const PRODUCT = /^[a-z0-9-]{1,64}$/;
const DAY = 86400000;
export const ACCESS_DAYS = 7;
export const PAID_ACCESS_MONTHS = 12;
const ACCESS = ACCESS_DAYS * DAY;
// Mirrors the server: a confirmed order may be kept for up to 365 days from its creation.
const PAID_ACCESS = 365 * DAY;
const key = (id) => `commerce:${id}`;
const downloadKey = (id) => `commerce:download:${id}`;
const PENDING = 'commerce:pending:';
const storage = () => window.localStorage;

const expiresAt = (session) => (Number.isFinite(session.expires) ? session.expires : session.created + ACCESS);
function readStoredSession(id) {
  try {
    if (!UUID.test(id || '')) return null;
    const session = JSON.parse(storage().getItem(key(id)));
    return session?.id === id &&
      TOKEN.test(session.token || '') &&
      PRODUCT.test(session.product || '') &&
      Number.isFinite(session.created) &&
      session.created <= Date.now() &&
      session.created > 0 &&
      // Never trust a stored expiry beyond the server's own access window.
      expiresAt(session) <= session.created + PAID_ACCESS
      ? session
      : null;
  } catch {
    return null;
  }
}
export function readCommerceSession(id) {
  const session = readStoredSession(id);
  return session && expiresAt(session) > Date.now() ? session : null;
}
export function prepareCommerceSession(product) {
  try {
    const previous = storage().getItem(`${PENDING}${product}`);
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
    storage().setItem(key(session.id), JSON.stringify(session));
    storage().setItem(`${PENDING}${product}`, session.id);
    const saved = readCommerceSession(session.id);
    if (
      !saved ||
      saved.token !== session.token ||
      storage().getItem(`${PENDING}${product}`) !== session.id
    )
      throw new Error('storage');
    return saved;
  } catch {
    throw new Error('commerce-session-unavailable');
  }
}

function pendingKeysFor(id) {
  const keys = [];
  for (let i = 0; i < storage().length; i += 1) {
    const name = storage().key(i);
    if (name?.startsWith(PENDING) && storage().getItem(name) === id) keys.push(name);
  }
  return keys;
}
// Adopts the longer expiry the server reports for a confirmed order (never shortens it,
// never beyond 12 months from the purchase).
export function extendCommerceSession(id, expires) {
  try {
    const session = readCommerceSession(id);
    if (!session || !Number.isFinite(expires)) return;
    const next = Math.min(expires, session.created + PAID_ACCESS);
    if (next > expiresAt(session)) storage().setItem(key(id), JSON.stringify({ ...session, expires: next }));
  } catch {
    /* storage unavailable: keep the current expiry */
  }
}
// A confirmed order is never reused for a new purchase of the same product.
export function settleCommerceSession(id) {
  try {
    for (const name of pendingKeysFor(id)) storage().removeItem(name);
  } catch {
    /* storage unavailable: nothing to settle */
  }
}
export function forgetCommerceSession(id) {
  try {
    for (const name of [key(id), downloadKey(id), ...pendingKeysFor(id)]) storage().removeItem(name);
  } catch {
    /* storage unavailable: nothing stored */
  }
}
// Every valid purchase stored in this browser, newest first; expired ones are removed.
export function listCommerceSessions() {
  try {
    const ids = [];
    for (let i = 0; i < storage().length; i += 1) {
      const match = /^commerce:([a-f0-9-]{36})$/i.exec(storage().key(i) || '');
      if (match && UUID.test(match[1])) ids.push(match[1]);
    }
    const sessions = [];
    for (const id of ids) {
      const session = readCommerceSession(id);
      if (session) sessions.push(session);
      else forgetCommerceSession(id);
    }
    return sessions.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

// Personal access link: the token travels only in the fragment, which browsers never
// send to servers, proxies, Referer headers or the payment provider.
export function personalAccessLink(session, origin = window.location.origin) {
  if (!readCommerceSession(session?.id) || session.token !== readCommerceSession(session.id).token)
    throw new Error('session');
  return `${origin}/checkout?pedido=${session.id}#acesso=${session.token}`;
}
export function parseAccessFragment(hash) {
  const match = /^#acesso=([a-f0-9]{64})$/.exec(hash || '');
  return match ? match[1] : null;
}
// Removes the credential from the address bar and the current history entry.
export function stripAccessFragment() {
  const { pathname, search, hash } = window.location;
  if (hash) window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}
// Called only after the server accepted the token for this order.
export function importCommerceSession({ id, token, product, expires }) {
  const now = Date.now();
  if (!UUID.test(id || '') || !TOKEN.test(token || '') || !PRODUCT.test(product || '') ||
      !Number.isFinite(expires) || expires <= now)
    throw new Error('session');
  const session = { id, token, product, created: now, expires: Math.min(expires, now + PAID_ACCESS) };
  storage().setItem(key(id), JSON.stringify(session));
  const saved = readCommerceSession(id);
  if (!saved || saved.token !== token) throw new Error('storage');
  return saved;
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
  // Access is already persisted in localStorage before leaving for the provider.
  window.location.assign(url);
}

// Opens the private template URL returned by the server. Only https is followed.
export function navigateTemplate(url) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('template-url');
  window.location.assign(target.href);
}

// Persist a failed/interrupted attempt across reloads; clear only after receiving the ZIP.
export function prepareDownloadAttempt(orderId) {
  if (!readCommerceSession(orderId)) throw new Error('session');
  const storageKey = downloadKey(orderId);
  const existing = storage().getItem(storageKey);
  if (existing && !UUID.test(existing)) throw new Error('attempt');
  const attempt = existing || crypto.randomUUID();
  storage().setItem(storageKey, attempt);
  if (storage().getItem(storageKey) !== attempt) throw new Error('storage');
  return attempt;
}
export function completeDownloadAttempt(orderId) {
  storage().removeItem(downloadKey(orderId));
}
