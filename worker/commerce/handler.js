import { commerceMode, verifiedCredential, validProviderOrder, productionMode } from './credentials.js';
import { reserveDownload, validDownloadAttempt } from './downloads.js';
export { testMode } from './credentials.js';
import { BLOCKED_SQL, RISK_TOPICS, persistRisk, captureSafety, riskResource } from './safety.js';
import { CATALOG, money } from './catalog.js';
import { isLaunchProduct } from '../../src/data/commerce-launch.js';

const encoder = new TextEncoder();
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
async function limited(request, env, scope, maximum) {
  const now = Date.now(),
    bucket = Math.floor(now / 60000);
  const ip = await hash(`${request.headers.get('CF-Connecting-IP') || 'local'}:${bucket}`);
  const row = await env.COMMERCE_DB.prepare(
    'INSERT INTO commerce_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(`${scope}:${ip}`, (bucket + 2) * 60000)
    .first();
  await env.COMMERCE_DB.prepare('DELETE FROM commerce_limits WHERE expires < ?').bind(now).run();
  return row.count > maximum;
}
async function mp(env, path, options = {}) {
  const credential = await verifiedCredential(env);
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
    throw new Error('provider');
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
const byId = (env, id) =>
  env.COMMERCE_DB.prepare(
    `SELECT commerce_orders.*, ${BLOCKED_SQL} AS delivery_blocked FROM commerce_orders WHERE id=?`,
  )
    .bind(id)
    .first();
async function owned(request, env, id) {
  const bearer = token(request);
  if (!bearer) return null;
  const row = await byId(env, id);
  return row && row.token_hash === (await hash(bearer)) && row.access_expires > Date.now()
    ? row
    : null;
}
// Opt-in prototype: never active in production or disabled environments.
const complementaryReconciliation = (env) =>
  env.COMMERCE_ENVIRONMENT === 'staging' && env.COMMERCE_MODE === 'test' &&
  env.COMMERCE_RECONCILIATION === 'test';
async function confirmedWebhook(env, row) {
  return !!(await env.COMMERCE_DB.prepare(
    'SELECT order_id FROM commerce_webhook_confirmations WHERE order_id=? AND remote_updated=?',
  ).bind(row.id, row.remote_updated).first());
}
function view(row) {
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
  };
}
export function matchesOrder(remote, row, env = { COMMERCE_ENVIRONMENT: 'staging' }) {
  return (
    remote.id === row.mp_id &&
    validProviderOrder(remote, env) &&
    remote.type === 'online' &&
    remote.external_reference === row.id &&
    remote.currency === row.currency &&
    remote.total_amount === money(row.amount_cents) &&
    (!productionMode(env) || (
      String(remote.user_id) === env.COMMERCE_SELLER_ID &&
      String(remote.integration_data?.application_id) === env.COMMERCE_APPLICATION_ID &&
      remote.processing_mode === 'manual' &&
      Array.isArray(remote.items) && remote.items.length === 1 &&
      remote.items[0].title === row.product_title &&
      remote.items[0].quantity === 1 &&
      remote.items[0].unit_price === money(row.amount_cents)
    ))
  );
}
async function reconcile(env, row) {
  const remote = await mp(env, `/${encodeURIComponent(row.mp_id)}`);
  if (!matchesOrder(remote, row, env)) throw new Error('mismatch');
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
  return { ...(await byId(env, row.id)), verified_paid: verifiedPaid };
}
async function checkout(request, env) {
  if (request.headers.get('Origin') !== env.COMMERCE_ORIGIN)
    return json({ message: 'Origem inválida.' }, 403);
  if (await limited(request, env, 'checkout', 10))
    return json({ message: 'Aguarde um minuto.' }, 429);
  const bearer = token(request),
    id = request.headers.get('Idempotency-Key');
  if (!bearer || !UUID.test(id || '')) return json({ message: 'Sessão inválida.' }, 400);
  let input;
  try {
    input = await body(request);
  } catch {
    return json({ message: 'Requisição inválida.' }, 400);
  }
  const product = Object.hasOwn(CATALOG, input?.product_id) ? CATALOG[input.product_id] : null;
  if (!product || Object.keys(input).some((key) => key !== 'product_id'))
    return json({ message: 'Produto inválido.' }, 400);
  if (productionMode(env) && !isLaunchProduct(product.id))
    return json({ message: 'Produto ainda não disponível para compra.' }, 403);
  const digest = await hash(bearer);
  let row = await byId(env, id);
  if (!row) {
    if (!(await env.DIGITAL_PRODUCTS.head(product.key)))
      return json({ message: 'Produto indisponível.' }, 503);
    const now = Date.now();
    await env.COMMERCE_DB.prepare(
      'INSERT OR IGNORE INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,created_at,access_expires) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(
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
      )
      .run();
    row = await byId(env, id);
  }
  if (
    row.token_hash !== digest ||
    row.product_id !== product.id ||
    row.access_expires <= Date.now() ||
    row.created_at + 86400000 <= Date.now()
  )
    return json({ message: 'Sessão incompatível.' }, 409);
  if (row.checkout_url) {
    await verifiedCredential(env);
    return json({ ...view(row), checkout_url: row.checkout_url, environment: env.COMMERCE_ENVIRONMENT });
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
  });
  const redirect = checkoutUrl(remote.checkout_url, remote.id);
  if (!validProviderOrder(remote, env) || !redirect || (productionMode(env) && !matchesOrder(remote, { ...row, mp_id: remote.id }, env)))
    throw new Error('test-order');
  await env.COMMERCE_DB.prepare(
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
    )
    .run();
  row = await byId(env, id);
  return json({ ...view(row), checkout_url: row.checkout_url, environment: env.COMMERCE_ENVIRONMENT });
}
async function webhook(request, env, url) {
  if (!(await verifySignature(request, url, env.MERCADOPAGO_WEBHOOK_SECRET)))
    return json({ message: 'Assinatura inválida.' }, 401);
  let input;
  try {
    input = await body(request);
  } catch {
    return json({ message: 'Notificação inválida.' }, 400);
  }
  const id = url.searchParams.get('data.id');
  const topic = input?.type;
  const queryType = url.searchParams.get('type');
  if (
    input?.live_mode !== productionMode(env) ||
    (queryType && queryType !== topic) ||
    url.searchParams.getAll('type').length > 1
  )
    return json({ message: 'Evento incompatível.' }, 400);
  if (Object.hasOwn(RISK_TOPICS, topic)) {
    if (riskResource(input, topic) !== id) return json({ message: 'Recurso incompatível.' }, 400);
    await persistRisk(env, topic, id);
    return json({ received: true });
  }
  if (topic !== 'order' || input.data?.id !== id || !validProviderOrder({ id, live_mode: input.live_mode }, env))
    return json({ message: 'Evento incompatível.' }, 400);
  const row = await env.COMMERCE_DB.prepare('SELECT * FROM commerce_orders WHERE mp_id=?')
    .bind(id)
    .first();
  // A notification can precede persistence of the provider ID: ask for a retry.
  if (!row) return json({ message: 'Pedido ainda não disponível.' }, 503);
  const verified = await reconcile(env, row);
  if (complementaryReconciliation(env) && verified.verified_paid && view(verified).paid) {
    await env.COMMERCE_DB.prepare(
      'INSERT INTO commerce_webhook_confirmations (order_id,remote_updated) VALUES (?,?) ON CONFLICT(order_id) DO UPDATE SET remote_updated=MAX(remote_updated,excluded.remote_updated)',
    ).bind(verified.id, verified.remote_updated).run();
  }
  return json({ received: true });
}
export async function handleCommerce(request, env, url = new URL(request.url)) {
  try {
    const path = url.pathname.replace(/^\/api\/commerce/, '');
    if (path === '/catalog' && request.method === 'GET') {
      const available = configured(env);
      return json({
        mode: productionMode(env) ? 'production' : 'test',
        products: Object.values(CATALOG).map(({ id, title, cents, currency, format, description }) => ({
          id,
          title,
          amount: money(cents),
          ...(format ? { format, description } : {}),
          currency,
          coming_soon: productionMode(env) && !isLaunchProduct(id),
          available: available && (!productionMode(env) || isLaunchProduct(id)),
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
    if (path === '/checkout' && request.method === 'POST') return await checkout(request, env);
    if (path === '/webhook' && request.method === 'POST') return await webhook(request, env, url);
    const match = path.match(/^\/orders\/([a-f0-9-]{36})(\/download)?$/i);
    if (!match || !UUID.test(match[1])) return json({ message: 'Não encontrado.' }, 404);
    if (request.method !== 'GET') return json({ message: 'Método não permitido.' }, 405);
    if (await limited(request, env, 'access', 30))
      return json({ message: 'Aguarde um minuto.' }, 429);
    let row = await owned(request, env, match[1]);
    if (!row) return json({ message: 'Acesso inválido ou expirado.' }, 404);
    if (!match[2]) {
      if (complementaryReconciliation(env) && row.mp_id) {
        row = await reconcile(env, row);
        row.webhook_confirmed = await confirmedWebhook(env, row);
      }
      return json(view(row));
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
    row = await reconcile(env, row);
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
  } catch {
    // Deliberately no exception logging: fetch errors can include credentials or PII.
    return json({ message: 'Serviço temporariamente indisponível. Tente novamente.' }, 503);
  }
}
