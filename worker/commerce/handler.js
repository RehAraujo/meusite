import { commerceMode, verifiedCredential, validProviderOrder, productionMode } from './credentials.js';
import { reserveDownload, reserveLedgerDownload, validDownloadAttempt } from './downloads.js';
export { testMode } from './credentials.js';
import { BLOCKED_SQL, RISK_TOPICS, persistRisk, captureSafety, riskResource } from './safety.js';
import { CATALOG, money } from './catalog.js';
import { ledgerShadowEnabled, runLedgerShadow } from './ledger/shadow.js';
import { reserveAttempt } from './ledger/repository.js';
import {
  attemptsOf,
  cancelPix,
  createPix,
  isPixOrder,
  ledgerEnabled,
  pixEnabled,
  pixSwitchOn,
  pixView,
  reconcileAttempt,
  reconcilerHealth,
  testRefund,
  validEmail,
} from './ledger/pix.js';
import { isLaunchProduct } from '../../src/data/commerce-launch.js';

const encoder = new TextEncoder();
// Unpaid orders keep the original 7-day window; a confirmed payment extends it.
export const PAID_ACCESS_MS = 365 * 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const security = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...security, 'Content-Type': 'application/json; charset=utf-8' },
  });
export async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
function token(request) {
  const value = request.headers.get('Authorization') || '';
  return /^Bearer [a-f0-9]{64}$/.test(value) ? value.slice(7) : null;
}
function configured(env) {
  try {
    const origin = new URL(env.COMMERCE_ORIGIN);
    return (
      commerceMode(env) &&
      env.COMMERCE_DB &&
      env.DIGITAL_PRODUCTS &&
      !!env.MERCADOPAGO_WEBHOOK_SECRET &&
      origin.protocol === 'https:' &&
      origin.origin === env.COMMERCE_ORIGIN
    );
  } catch {
    return false;
  }
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('body');
  // Bound the streamed body too, even when Content-Length is absent or forged.
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new Error('body');
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function limited(request, env, scope, maximum, ctx) {
  const now = Date.now(),
    bucket = Math.floor(now / 60000);
  const ip = await hash(`${request.headers.get('CF-Connecting-IP') || 'local'}:${bucket}`);
  const row = await env.COMMERCE_DB.prepare(
    'INSERT INTO commerce_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(`${scope}:${ip}`, (bucket + 2) * 60000)
    .first();
  // Housekeeping only (the count above is per-minute bucket): off the buyer's critical path
  // when the runtime allows it, otherwise awaited as before.
  const cleanup = env.COMMERCE_DB.prepare('DELETE FROM commerce_limits WHERE expires < ?').bind(now).run();
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(cleanup.catch(() => {}));
  else await cleanup;
  return row.count > maximum;
}
// Safe operational log: fixed event and reason codes, an 8-character order prefix, HTTP
// status and failed check names. Never tokens, URLs, provider bodies or payer data.
const REASONS = new Set([
  'provider', 'mismatch', 'version', 'amount', 'transactions', 'resources', 'identity',
  'environment-disabled', 'test-order', 'risk', 'body', 'order', 'test-only',
]);
export function logEvent(event, { order, error, status, detail } = {}) {
  const entry = { event };
  if (typeof order === 'string') entry.order = order.slice(0, 8);
  if (error) {
    entry.reason = REASONS.has(error.message) ? error.message : 'unexpected';
    if (Number.isInteger(error.status)) entry.provider_status = error.status;
    if (Array.isArray(error.fields)) entry.fields = error.fields.filter((f) => /^[a-z_]+$/.test(f));
  }
  if (Number.isInteger(status)) entry.status = status;
  if (typeof detail === 'string' && /^[a-z_]+$/.test(detail)) entry.detail = detail;
  console.log(JSON.stringify(entry));
}
// Per-order throttle for provider checks, independent of the caller's IP.
async function throttled(env, key, maximum, windowMs = 60000) {
  const now = Date.now(),
    bucket = Math.floor(now / windowMs);
  const row = await env.COMMERCE_DB.prepare(
    'INSERT INTO commerce_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(`${key}:${bucket}`, (bucket + 2) * windowMs)
    .first();
  return row.count > maximum;
}
// States worth asking the provider about when the buyer opens the order.
const FINAL = new Set(['refunded', 'charged_back', 'canceled', 'failed', 'expired']);
const awaitingConfirmation = (row) =>
  !!row.mp_id &&
  !row.delivery_blocked &&
  !(row.status === 'processed' && row.status_detail === 'accredited') &&
  !FINAL.has(row.status);
// `verified` is an identity check already started by the caller for this same request;
// it is always awaited before any provider call, and is never shared across requests.
async function mp(env, path, options = {}, verified = verifiedCredential(env)) {
  const credential = await verified;
  const response = await fetch(`https://api.mercadopago.com/v1/orders${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: AbortSignal.timeout(8000),
    redirect: 'manual',
  });
  // Never log or return provider bodies, headers, tokens or payer data.
  if (!response.ok || (response.status >= 300 && response.status < 400)) {
    await response.body?.cancel();
    const error = new Error('provider');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
export function checkoutUrl(value, orderId) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'www.mercadopago.com.br' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/checkout/v1/redirect' &&
      url.searchParams.getAll('order_id').length === 1 &&
      url.searchParams.get('order_id') === orderId
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export async function verifySignature(request, url, secret) {
  const signature = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const dataId = url.searchParams.get('data.id');
  if (
    !secret ||
    !dataId ||
    !/^[a-zA-Z0-9]+$/.test(dataId) ||
    !/^[\w-]{1,128}$/.test(requestId) ||
    url.searchParams.getAll('data.id').length !== 1
  )
    return false;
  const fields = signature.split(',').map((part) => part.trim().split('='));
  if (fields.length !== 2 || fields.some((part) => part.length !== 2)) return false;
  const ts = fields.find(([key]) => key === 'ts')?.[1];
  const hex = fields.find(([key]) => key === 'v1')?.[1];
  if (!/^\d{10,13}$/.test(ts || '') || !/^[a-f0-9]{64}$/.test(hex || '')) return false;
  const milliseconds = Number(ts) * (ts.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - milliseconds) > 5 * 60000) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16)),
    encoder.encode(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`),
  );
}
const byIdStatement = (env, id) =>
  env.COMMERCE_DB.prepare(
    `SELECT commerce_orders.*, ${BLOCKED_SQL} AS delivery_blocked,
      (SELECT reason FROM commerce_delivery_holds h WHERE h.order_id=commerce_orders.id ORDER BY created_at LIMIT 1) AS hold_reason
      FROM commerce_orders WHERE id=?`,
  ).bind(id);
const byId = (env, id) => byIdStatement(env, id).first();
// Runs a write and then reads the order back. On D1 both go in one batch: one round trip,
// executed in order inside a single transaction, so the read sees exactly what the write
// left (the same result as running them one after the other).
async function writeThenRead(env, write, id) {
  const read = byIdStatement(env, id);
  if (typeof env.COMMERCE_DB.batch === 'function') {
    const [, result] = await env.COMMERCE_DB.batch([write, read]);
    return result?.results?.[0] ?? null;
  }
  await write.run();
  return read.first();
}
async function owned(request, env, id, ctx) {
  const bearer = token(request);
  if (!bearer) return null;
  const row = await byId(env, id);
  if (!row || row.token_hash !== (await hash(bearer))) return null;
  if (row.access_expires > Date.now()) return row;
  // Past the 7-day window a paid order keeps its 12-month right even if no webhook was
  // processed: ask the provider once. reconcile() extends only verified paid orders.
  if (!row.mp_id || row.created_at + PAID_ACCESS_MS <= Date.now()) return null;
  const checked = await reconcile(env, row, ctx);
  return checked.access_expires > Date.now() ? checked : null;
}
// Closing sales stops new orders only; buyers keep status, access and downloads.
const salesClosed = (env) => env.COMMERCE_SALES === 'closed';
// Opt-in prototype: never active in production or disabled environments.
const complementaryReconciliation = (env) =>
  env.COMMERCE_ENVIRONMENT === 'staging' && env.COMMERCE_MODE === 'test' &&
  env.COMMERCE_RECONCILIATION === 'test';
async function confirmedWebhook(env, row) {
  return !!(await env.COMMERCE_DB.prepare(
    'SELECT order_id FROM commerce_webhook_confirmations WHERE order_id=? AND remote_updated=?',
  ).bind(row.id, row.remote_updated).first());
}
// Validates the private template URL read from a Worker secret. Returns null when the
// product has no Notion access, the secret is missing, or it is not an https Notion URL.
export function templateUrl(env, product) {
  const name = product?.access?.type === 'notion' ? product.access.secret : null;
  const value = name ? env[name] : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const notion = host === 'notion.so' || host === 'www.notion.so' || host.endsWith('.notion.site');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && notion
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function view(row) {
  const product = Object.hasOwn(CATALOG, row.product_id) ? CATALOG[row.product_id] : null;
  return {
    order_id: row.id,
    product_id: row.product_id,
    title: row.product_title,
    amount: money(row.amount_cents),
    currency: row.currency,
    status: row.status,
    status_detail: row.status_detail,
    paid: row.status === 'processed' && row.status_detail === 'accredited' && !row.delivery_blocked && row.webhook_confirmed !== false,
    delivery_blocked: !!row.delivery_blocked,
    access_expires: row.access_expires,
    // Delivery channel only; the URL itself is returned exclusively by /access.
    delivery: product?.access?.type === 'notion' ? 'notion' : 'download',
    // Why delivery is blocked, without details: a refund, or any security hold
    // (chargeback, fraud alert, unassociated risk event).
    block: row.delivery_blocked ? (row.hold_reason === 'refund' ? 'refund' : 'security') : null,
    // Mercado Pago lets the buyer retry on the same Order only while it waits for a retry
    // and the Order has not expired (created with expiration_time P1D).
    can_retry:
      row.status === 'action_required' &&
      row.status_detail === 'waiting_retry' &&
      !!row.checkout_url &&
      !row.delivery_blocked &&
      row.created_at + 86400000 > Date.now(),
  };
}
// Names of the identity checks an Order fails. Only these names are ever logged.
export function orderMismatches(remote, row, env = { COMMERCE_ENVIRONMENT: 'staging' }) {
  const checks = {
    id: remote.id === row.mp_id,
    environment: validProviderOrder(remote, env),
    type: remote.type === 'online',
    external_reference: remote.external_reference === row.id,
    currency: remote.currency === row.currency,
    total_amount: remote.total_amount === money(row.amount_cents),
  };
  if (productionMode(env)) {
    const item = Array.isArray(remote.items) && remote.items.length === 1 ? remote.items[0] : null;
    Object.assign(checks, {
      seller: String(remote.user_id) === env.COMMERCE_SELLER_ID,
      application: String(remote.integration_data?.application_id) === env.COMMERCE_APPLICATION_ID,
      processing_mode: remote.processing_mode === 'manual',
      items: !!item,
      item_title: item?.title === row.product_title,
      item_quantity: item?.quantity === 1,
      item_unit_price: item?.unit_price === money(row.amount_cents),
    });
  }
  return Object.keys(checks).filter((name) => !checks[name]);
}
export function matchesOrder(remote, row, env = { COMMERCE_ENVIRONMENT: 'staging' }) {
  return orderMismatches(remote, row, env).length === 0;
}
async function reconcile(env, row, ctx) {
  const remote = await mp(env, `/${encodeURIComponent(row.mp_id)}`);
  const mismatches = orderMismatches(remote, row, env);
  if (mismatches.length) {
    const error = new Error('mismatch');
    error.fields = mismatches;
    throw error;
  }
  await captureSafety(env, row, remote);
  const updated = Date.parse(remote.last_updated_date);
  if (!Number.isFinite(updated) || updated > Date.now() + 60000) throw new Error('version');
  const status = typeof remote.status === 'string' ? remote.status : 'unknown';
  const detail = typeof remote.status_detail === 'string' ? remote.status_detail : '';
  if (
    status === 'processed' &&
    detail === 'accredited' &&
    remote.total_paid_amount !== money(row.amount_cents)
  )
    throw new Error('amount');
  const verifiedPaid = status === 'processed' && detail === 'accredited';
  // Atomic monotonic snapshots prevent out-of-order webhooks from restoring stale access.
  await env.COMMERCE_DB.prepare(
    'UPDATE commerce_orders SET status=?,status_detail=?,remote_updated=? WHERE id=? AND (remote_updated < ? OR (remote_updated = ? AND ? = 0))',
  )
    .bind(status, detail, updated, row.id, updated, updated, verifiedPaid ? 1 : 0)
    .run();
  // Confirmed buyers keep access for 12 months from the purchase. Only ever extends, and
  // only while the stored state is processed/accredited; holds still block every access.
  if (verifiedPaid)
    await env.COMMERCE_DB.prepare(
      "UPDATE commerce_orders SET access_expires=MAX(access_expires, created_at + ?) WHERE id=? AND status='processed' AND status_detail='accredited'",
    )
      .bind(PAID_ACCESS_MS, row.id)
      .run();
  const result = { ...(await byId(env, row.id)), verified_paid: verifiedPaid };
  // R1a shadow (off by default): records the same verified snapshot in the payment
  // ledger and compares access rules. Never changes this result or the delivery, and
  // runs after the response (waitUntil) so it adds no latency; it never rejects.
  if (ledgerShadowEnabled(env)) {
    const shadow = runLedgerShadow(env, {
      row: { ...result },
      remote,
      currentDeliverable: view(result).paid,
      log: logEvent,
    });
    if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(shadow);
    else await shadow;
  }
  return result;
}
// Shared by Checkout Pro and Pix: request checks and the local order (created once per
// Idempotency-Key, owned by the bearer). Returns { error } or { id, product, row, identity }.
async function startOrder(request, env, ctx, allowed) {
  if (request.headers.get('Origin') !== env.COMMERCE_ORIGIN)
    return { error: json({ message: 'Origem inválida.' }, 403) };
  if (await limited(request, env, 'checkout', 10, ctx))
    return { error: json({ message: 'Aguarde um minuto.' }, 429) };
  const bearer = token(request),
    id = request.headers.get('Idempotency-Key');
  if (!bearer || !UUID.test(id || '')) return { error: json({ message: 'Sessão inválida.' }, 400) };
  let input;
  try {
    input = await body(request);
  } catch {
    return { error: json({ message: 'Requisição inválida.' }, 400) };
  }
  const product = Object.hasOwn(CATALOG, input?.product_id) ? CATALOG[input.product_id] : null;
  if (!product || !input || Object.keys(input).some((key) => !allowed.includes(key)))
    return { error: json({ message: 'Produto inválido.' }, 400) };
  if (productionMode(env) && !isLaunchProduct(product.id))
    return { error: json({ message: 'Produto ainda não disponível para compra.' }, 403) };
  // Seller identity check for THIS request, started now (after the rate limit and input
  // validation) so it overlaps with the database work below. It is still awaited before
  // any Mercado Pago call and before returning a stored checkout URL; nothing is cached.
  const identity = verifiedCredential(env);
  identity.catch(() => {}); // observed below; early returns must not leave it unhandled
  const digest = await hash(bearer);
  const row = await ensureOrder(env, id, digest, product);
  if (row?.error) return row;
  if (
    row.token_hash !== digest ||
    row.product_id !== product.id ||
    row.access_expires <= Date.now() ||
    row.created_at + 86400000 <= Date.now()
  )
    return { error: json({ message: 'Sessão incompatível.' }, 409) };
  return { id, product, row, identity, input };
}
async function ensureOrder(env, id, digest, product) {
  // Read the order and check the product file at the same time (both read-only). The file
  // only matters for a new order: a storage hiccup never blocks resuming an existing one.
  let [row, asset] = await Promise.all([
    byId(env, id),
    env.DIGITAL_PRODUCTS.head(product.key).catch(() => null),
  ]);
  if (!row) {
    if (!asset) return { error: json({ message: 'Produto indisponível.' }, 503) };
    const now = Date.now();
    row = await writeThenRead(
      env,
      env.COMMERCE_DB.prepare(
        'INSERT OR IGNORE INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,created_at,access_expires) VALUES (?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        id,
        digest,
        product.id,
        product.title,
        product.cents,
        product.currency,
        product.key,
        product.filename,
        now,
        now + 7 * 86400000,
      ),
      id,
    );
  }
  return row;
}
async function checkout(request, env, ctx) {
  const started = await startOrder(request, env, ctx, ['product_id']);
  if (started.error) return started.error;
  const { id, identity } = started;
  let { row } = started;
  if (row.checkout_url) {
    await identity;
    return json({ ...view(row), checkout_url: row.checkout_url, environment: env.COMMERCE_ENVIRONMENT });
  }
  // Shared charge lock (staging, COMMERCE_LEDGER=on): no Checkout Pro Order while a Pix
  // holds this order, and a Pix order never switches to Checkout Pro (new order instead).
  if (ledgerEnabled(env)) {
    const attempts = await attemptsOf(env, id);
    if (attempts.some((a) => a.flow === 'pix'))
      return json({ code: 'pix_order', message: 'Este pedido usa Pix. Faça um novo pedido para pagar de outra forma.' }, 409);
    const now = Date.now();
    const lock = await reserveAttempt(env, {
      id: `cp-${id}`,
      orderId: id,
      flow: 'checkout_pro',
      requestBody: '{}',
      requestHash: 'checkout_pro',
      amountCents: row.amount_cents,
      watchUntil: now + 86400000 + 48 * 3600000,
      now,
    });
    if (!lock.reserved)
      return json({ code: lock.reason, message: 'Há outro pagamento em andamento para este pedido.' }, 409);
  }
  // Identical payload and key for all retries, including timeouts and concurrent requests.
  const returnUrl = `${env.COMMERCE_ORIGIN}/checkout?pedido=${id}`;
  const remote = await mp(env, '', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': id },
    body: JSON.stringify({
      type: 'online',
      processing_mode: 'manual',
      total_amount: money(row.amount_cents),
      external_reference: id,
      expiration_time: 'P1D',
      items: [{ title: row.product_title, quantity: 1, unit_price: money(row.amount_cents) }],
      config: {
        online: {
          success_url: returnUrl,
          failure_url: returnUrl,
          pending_url: returnUrl,
          auto_return: 'all',
        },
      },
    }),
  }, identity);
  const redirect = checkoutUrl(remote.checkout_url, remote.id);
  if (!validProviderOrder(remote, env) || !redirect || (productionMode(env) && !matchesOrder(remote, { ...row, mp_id: remote.id }, env)))
    throw new Error('test-order');
  row = await writeThenRead(
    env,
    env.COMMERCE_DB.prepare(
      `UPDATE commerce_orders SET mp_id=?,checkout_url=?,
        status=CASE WHEN status='creating' AND ? THEN 'created' ELSE status END,
        status_detail=CASE WHEN status='creating' AND ? THEN 'created' ELSE status_detail END
        WHERE id=? AND mp_id IS NULL`,
    )
      // Creation is not payment approval. Preserve any newer webhook state.
      .bind(
        remote.id,
        redirect,
        remote.status === 'created' ? 1 : 0,
        remote.status === 'created' ? 1 : 0,
        id,
      ),
    id,
  );
  if (ledgerEnabled(env))
    await env.COMMERCE_DB.prepare(
      `UPDATE commerce_payment_attempts SET mp_id=?2, phase='open', updated_at=?3
       WHERE id=?1 AND mp_id IS NULL AND NOT EXISTS (SELECT 1 FROM commerce_payment_attempts WHERE mp_id=?2)`,
    )
      .bind(`cp-${id}`, remote.id, Date.now())
      .run();
  return json({ ...view(row), checkout_url: row.checkout_url, environment: env.COMMERCE_ENVIRONMENT });
}
// ---- Pix (staging only, see ledger/pix.js) ----
const latestPix = (attempts) => attempts.find((a) => a.flow === 'pix' && a.mp_id) || null;
async function entitlementOf(env, orderId) {
  return env.COMMERCE_DB.prepare('SELECT state, reason FROM commerce_entitlements WHERE order_id=?').bind(orderId).first();
}
function pixOrderView(row, attempts, entitlement) {
  const state = entitlement?.state ?? 'none';
  const open = attempts.find((a) => pixView(a));
  return {
    ...view({ ...row, delivery_blocked: state === 'suspended' ? 1 : 0, hold_reason: null }),
    paid: state === 'active',
    can_retry: false,
    payment_method: 'pix',
    pix: open ? pixView(open) : null,
  };
}
// Fresh provider check of the order's latest Pix, then its access right.
async function refreshPix(env, row, attempts) {
  const attempt = latestPix(attempts);
  if (!attempt) return { row, attempts, entitlement: await entitlementOf(env, row.id) };
  const result = await reconcileAttempt(env, attempt, row);
  return {
    row: { ...row, ...result.order },
    attempts: await attemptsOf(env, row.id),
    entitlement: result.entitlement,
  };
}
async function pix(request, env, ctx) {
  if (!(await pixSwitchOn(env))) return json({ message: 'Não encontrado.' }, 404);
  const started = await startOrder(request, env, ctx, ['product_id', 'email', 'test_approve']);
  if (started.error) return started.error;
  const { row, input, identity } = started;
  if (!validEmail(input.email)) return json({ message: 'Informe um e-mail válido.' }, 400);
  if (input.test_approve !== undefined && typeof input.test_approve !== 'boolean')
    return json({ message: 'Requisição inválida.' }, 400);
  const result = await createPix(env, row, { email: input.email, approve: input.test_approve === true, identity });
  if (result.status >= 400) {
    logEvent('pix_create_refused', { order: row.id, status: result.status, detail: result.body.code });
    return json(result.body, result.status);
  }
  logEvent('pix_created', { order: row.id, status: result.status });
  const attempts = await attemptsOf(env, row.id);
  return json(
    { ...pixOrderView(await byId(env, row.id), attempts, await entitlementOf(env, row.id)), environment: env.COMMERCE_ENVIRONMENT },
    result.status === 201 ? 201 : 200,
  );
}
async function webhook(request, env, url, ctx) {
  if (!(await verifySignature(request, url, env.MERCADOPAGO_WEBHOOK_SECRET))) {
    logEvent('webhook_rejected', { status: 401, detail: 'signature' });
    return json({ message: 'Assinatura inválida.' }, 401);
  }
  let input;
  try {
    input = await body(request);
  } catch {
    logEvent('webhook_rejected', { status: 400, detail: 'body' });
    return json({ message: 'Notificação inválida.' }, 400);
  }
  const id = url.searchParams.get('data.id');
  const topic = input?.type;
  const queryType = url.searchParams.get('type');
  if (
    input?.live_mode !== productionMode(env) ||
    (queryType && queryType !== topic) ||
    url.searchParams.getAll('type').length > 1
  ) {
    logEvent('webhook_rejected', {
      status: 400,
      detail: input?.live_mode !== productionMode(env) ? 'live_mode' : 'type',
    });
    return json({ message: 'Evento incompatível.' }, 400);
  }
  if (Object.hasOwn(RISK_TOPICS, topic)) {
    if (riskResource(input, topic) !== id) return json({ message: 'Recurso incompatível.' }, 400);
    await persistRisk(env, topic, id);
    return json({ received: true });
  }
  if (topic !== 'order' || input.data?.id !== id || !validProviderOrder({ id, live_mode: input.live_mode }, env)) {
    logEvent('webhook_rejected', {
      status: 400,
      detail: topic !== 'order' ? 'topic' : input.data?.id !== id ? 'data_id' : 'order_format',
    });
    return json({ message: 'Evento incompatível.' }, 400);
  }
  const row = await env.COMMERCE_DB.prepare('SELECT * FROM commerce_orders WHERE mp_id=?')
    .bind(id)
    .first();
  if (!row && ledgerEnabled(env)) {
    const attempt = await env.COMMERCE_DB.prepare(
      "SELECT * FROM commerce_payment_attempts WHERE mp_id=? AND flow='pix'",
    )
      .bind(id)
      .first();
    const order = attempt ? await byId(env, attempt.order_id) : null;
    if (order) {
      try {
        const result = await reconcileAttempt(env, attempt, order);
        logEvent('webhook_processed', {
          order: order.id,
          detail: result.entitlement?.state === 'active' ? 'pix_paid' : 'pix_not_paid',
        });
      } catch (error) {
        logEvent('webhook_reconcile_failed', { order: order.id, error });
        throw error;
      }
      return json({ received: true });
    }
  }
  // A notification can precede persistence of the provider ID: ask for a retry.
  if (!row) {
    logEvent('webhook_retry', { status: 503, detail: 'order_unknown' });
    return json({ message: 'Pedido ainda não disponível.' }, 503);
  }
  let verified;
  try {
    verified = await reconcile(env, row, ctx);
  } catch (error) {
    logEvent('webhook_reconcile_failed', { order: row.id, error });
    throw error;
  }
  logEvent('webhook_processed', { order: row.id, detail: verified.verified_paid ? 'paid' : 'not_paid' });
  if (complementaryReconciliation(env) && verified.verified_paid && view(verified).paid) {
    await env.COMMERCE_DB.prepare(
      'INSERT INTO commerce_webhook_confirmations (order_id,remote_updated) VALUES (?,?) ON CONFLICT(order_id) DO UPDATE SET remote_updated=MAX(remote_updated,excluded.remote_updated)',
    ).bind(verified.id, verified.remote_updated).run();
  }
  return json({ received: true });
}
const MODES = ['disabled', 'test', 'production'];
export function health(env) {
  const build = typeof env.COMMERCE_BUILD === 'string' && /^[0-9a-f]{7,40}$/.test(env.COMMERCE_BUILD) ? env.COMMERCE_BUILD : 'unknown';
  return {
    build,
    environment: ['staging', 'production'].includes(env.COMMERCE_ENVIRONMENT) ? env.COMMERCE_ENVIRONMENT : 'unknown',
    mode: MODES.includes(env.COMMERCE_MODE) ? env.COMMERCE_MODE : 'unknown',
  };
}
export async function handleCommerce(request, env, url = new URL(request.url), ctx) {
  try {
    const path = url.pathname.replace(/^\/api\/commerce/, '');
    // Build stamp only: never secrets, bindings, counters or customer data.
    if (path === '/health' && request.method === 'GET') return json(health(env));
    if (path === '/health/reconciler' && request.method === 'GET')
      return json(await reconcilerHealth(env));
    if (path === '/catalog' && request.method === 'GET') {
      const available = configured(env);
      return json({
        mode: productionMode(env) ? 'production' : 'test',
        pix: available && !salesClosed(env) && pixEnabled(env) && (await pixSwitchOn(env)),
        products: Object.values(CATALOG).map(({ id, title, cents, currency, format, description }) => ({
          id,
          title,
          amount: money(cents),
          ...(format ? { format, description } : {}),
          currency,
          coming_soon: productionMode(env) && !isLaunchProduct(id),
          available: available && !salesClosed(env) && (!productionMode(env) || isLaunchProduct(id)),
        })),
      });
    }
    // Disabled production may acknowledge authenticity, never process the event.
    // Keep this before configuration checks and independent of all commercial bindings.
    if (path === '/webhook' && request.method === 'POST' &&
        env.COMMERCE_ENVIRONMENT === 'production' && env.COMMERCE_MODE === 'disabled') {
      if (!(await verifySignature(request, url, env.MERCADOPAGO_WEBHOOK_SECRET)))
        return json({ message: 'Assinatura inválida.' }, 401);
      return json({ received: true, signature_verified: true, commerce_processed: false, mode: 'disabled' });
    }
    if (!configured(env)) return json({ message: 'Checkout temporariamente indisponível.' }, 503);
    if (path === '/checkout' && request.method === 'POST')
      return salesClosed(env)
        ? json({ message: 'Vendas temporariamente encerradas.' }, 503)
        : await checkout(request, env, ctx);
    if (path === '/webhook' && request.method === 'POST') return await webhook(request, env, url, ctx);
    if (path === '/pix' && request.method === 'POST')
      return salesClosed(env)
        ? json({ message: 'Vendas temporariamente encerradas.' }, 503)
        : await pix(request, env, ctx);
    const match = path.match(/^\/orders\/([a-f0-9-]{36})(\/download|\/access|\/pix\/cancel|\/test-refund)?$/i);
    if (!match || !UUID.test(match[1])) return json({ message: 'Não encontrado.' }, 404);
    const action = match[2]?.toLowerCase();
    const post = action === '/pix/cancel' || action === '/test-refund';
    if (post && !pixEnabled(env)) return json({ message: 'Não encontrado.' }, 404);
    if (request.method !== (post ? 'POST' : 'GET')) return json({ message: 'Método não permitido.' }, 405);
    if (post && request.headers.get('Origin') !== env.COMMERCE_ORIGIN)
      return json({ message: 'Origem inválida.' }, 403);
    if (await limited(request, env, 'access', 30, ctx))
      return json({ message: 'Aguarde um minuto.' }, 429);
    let row = await owned(request, env, match[1], ctx);
    if (!row) return json({ message: 'Acesso inválido ou expirado.' }, 404);
    const attempts = ledgerEnabled(env) ? await attemptsOf(env, row.id) : [];
    if (isPixOrder(row, attempts)) return await pixOrder(request, env, row, attempts, action);
    if (post) return json({ message: 'Não encontrado.' }, 404);
    if (!match[2]) {
      if (complementaryReconciliation(env) && row.mp_id) {
        row = await reconcile(env, row, ctx);
        row.webhook_confirmed = await confirmedWebhook(env, row);
      } else if (awaitingConfirmation(row) && !(await throttled(env, `reconcile:${row.id}`, 2))) {
        // Webhook fallback: the same authoritative Order check the webhook runs. A failure
        // keeps the stored state (never paid on error) and is logged with safe codes.
        try {
          const before = row.status;
          row = await reconcile(env, row, ctx);
          if (row.verified_paid) logEvent('order_confirmed_by_pull', { order: row.id, detail: before });
        } catch (error) {
          logEvent('pull_reconcile_failed', { order: row.id, error });
        }
      }
      return json(view(row));
    }
    if (match[2].toLowerCase() === '/access') {
      // Same guards as the download, in the same order. Opening the Notion link does not
      // consume the 10 ZIP downloads: access is bounded by the token, its 7-day validity,
      // the per-IP rate limit and an authoritative payment check on every call.
      if (row.delivery_blocked)
        return json(
          { message: 'Entrega suspensa para revisão. Entre em contato com o suporte.' },
          403,
        );
      if (!row.mp_id) return json({ message: 'Pagamento não confirmado.' }, 403);
      const product = Object.hasOwn(CATALOG, row.product_id) ? CATALOG[row.product_id] : null;
      if (product?.access?.type !== 'notion') return json({ message: 'Não encontrado.' }, 404);
      row = await reconcile(env, row, ctx);
      if (!view(row).paid || !row.verified_paid)
        return json({ message: 'Pagamento não confirmado.' }, 403);
      if (complementaryReconciliation(env) && !(await confirmedWebhook(env, row)))
        return json({ message: 'Aguardando confirmação do pagamento por notificação.' }, 403);
      const url = templateUrl(env, product);
      if (!url) return json({ message: 'Acesso temporariamente indisponível.' }, 503);
      return json({ url });
    }
    if (!validDownloadAttempt(request.headers.get('X-Download-Attempt')))
      return json({ message: 'Tentativa de download inválida. Atualize a página.' }, 400);
    if (row.delivery_blocked)
      return json(
        { message: 'Entrega suspensa para revisão. Entre em contato com o suporte.' },
        403,
      );
    if (!row.mp_id) return json({ message: 'Pagamento não confirmado.' }, 403);
    // Recheck authoritative status on EVERY download, including refunds/chargebacks.
    row = await reconcile(env, row, ctx);
    if (!view(row).paid || !row.verified_paid)
      return json({ message: 'Pagamento não confirmado.' }, 403);
    if (complementaryReconciliation(env) && !(await confirmedWebhook(env, row)))
      return json({ message: 'Aguardando confirmação do pagamento por notificação.' }, 403);
    const asset = await env.DIGITAL_PRODUCTS.get(row.asset_key);
    if (!asset) return json({ message: 'Arquivo temporariamente indisponível.' }, 503);
    const updated = await reserveDownload(env, row.id, request.headers.get('X-Download-Attempt'));
    if (!updated) return json({ message: 'Limite de acesso atingido.' }, 403);
    return new Response(asset.body, {
      headers: {
        ...security,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${row.filename}"`,
      },
    });
  } catch (error) {
    // Only a fixed reason code is logged: fetch errors can include credentials or PII.
    logEvent('request_failed', { error });
    return json({ message: 'Serviço temporariamente indisponível. Tente novamente.' }, 503);
  }
}

// Pix orders: status, Notion access, ZIP download, cancel and the staging test refund.
// Access is decided only by the ledger entitlement after a fresh provider check.
async function pixOrder(request, env, row, attempts, action) {
  if (!action) {
    const open = attempts.find((a) => a.flow === 'pix' && a.mp_id && ['open', 'canceling'].includes(a.phase));
    let state = { row, attempts, entitlement: await entitlementOf(env, row.id) };
    if (open && !(await throttled(env, `reconcile:${row.id}`, 6))) {
      try {
        state = await refreshPix(env, row, attempts);
      } catch (error) {
        logEvent('pull_reconcile_failed', { order: row.id, error });
      }
    }
    return json(pixOrderView(state.row, state.attempts, state.entitlement));
  }
  if (action === '/pix/cancel') {
    const result = await cancelPix(env, row);
    logEvent('pix_cancel', { order: row.id, status: result.status });
    return json(result.body, result.status);
  }
  if (action === '/test-refund') {
    let input;
    try {
      input = await body(request);
    } catch {
      return json({ message: 'Requisição inválida.' }, 400);
    }
    if (!input || Object.keys(input).some((key) => key !== 'amount')) return json({ message: 'Requisição inválida.' }, 400);
    const result = await testRefund(env, row, { amount: input.amount });
    logEvent('pix_test_refund', { order: row.id, status: result.status, detail: result.body.reason ?? undefined });
    return json(result.body, result.status);
  }
  const product = Object.hasOwn(CATALOG, row.product_id) ? CATALOG[row.product_id] : null;
  if (action === '/access' && product?.access?.type !== 'notion') return json({ message: 'Não encontrado.' }, 404);
  if (action === '/download' && !validDownloadAttempt(request.headers.get('X-Download-Attempt')))
    return json({ message: 'Tentativa de download inválida. Atualize a página.' }, 400);
  // Authoritative check on EVERY delivery, including refunds and disputes.
  const state = await refreshPix(env, row, attempts);
  if (state.entitlement?.state !== 'active') {
    const suspended = state.entitlement?.state === 'suspended';
    return json(
      { message: suspended ? 'Entrega suspensa para revisão. Entre em contato com o suporte.' : 'Pagamento não confirmado.' },
      403,
    );
  }
  if (action === '/access') {
    const url = templateUrl(env, product);
    if (!url) return json({ message: 'Acesso temporariamente indisponível.' }, 503);
    return json({ url });
  }
  const asset = await env.DIGITAL_PRODUCTS.get(row.asset_key);
  if (!asset) return json({ message: 'Arquivo temporariamente indisponível.' }, 503);
  if (!(await reserveLedgerDownload(env, row.id, request.headers.get('X-Download-Attempt'))))
    return json({ message: 'Limite de acesso atingido.' }, 403);
  return new Response(asset.body, {
    headers: {
      ...security,
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${row.filename}"`,
    },
  });
}
