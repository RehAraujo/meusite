// Pix through the Orders API, on top of the payment ledger (spec V3).
//
// Availability: ONLY staging in test mode with COMMERCE_LEDGER=on and COMMERCE_PIX=on,
// plus the database switch commerce_settings.pix_creation='on'. testMode() itself is
// false in production, so this code cannot create a Pix for real buyers.
//
// Every charge first reserves the per-order lock (partial unique index): a Pix and a
// Checkout Pro payment can never be open on the same order at the same time. Access is
// decided only by the ledger entitlement, computed from verified provider facts.
import {
  productionMode,
  testMode,
  validProviderOrder,
  verifiedCredential,
  verifiedTestCredential,
} from '../credentials.js';
import { CATALOG, money } from '../catalog.js';
import {
  abortCancel,
  adoptProviderOrder,
  applySnapshot,
  beginCancel,
  classifyCreateResponse,
  closeNotCreated,
  markUncertain,
  recordSend,
  reserveAttempt,
} from './repository.js';

export const PIX_TTL_MS = 30 * 60000;
// A cancelled or expired Pix is still watched this long after it stops being payable (D2).
export const WATCH_AFTER_MS = 48 * 3600000;
export const PAID_ACCESS_MS = 365 * 86400000;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export const ledgerEnabled = (env) =>
  env?.COMMERCE_ENVIRONMENT === 'staging' && env?.COMMERCE_LEDGER === 'on';
export const pixEnabled = (env) => ledgerEnabled(env) && testMode(env) && env.COMMERCE_PIX === 'on';
export const testRefundsEnabled = (env) => pixEnabled(env) && env.COMMERCE_TEST_REFUNDS === 'on';

export async function pixSwitchOn(env) {
  if (!pixEnabled(env)) return false;
  const row = await env.COMMERCE_DB.prepare(
    "SELECT value FROM commerce_settings WHERE key='pix_creation'",
  ).first();
  return row?.value === 'on';
}

export const validEmail = (value) =>
  typeof value === 'string' && value.length <= 254 && EMAIL.test(value);

export async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Raw provider call that keeps the HTTP status and the error code (needed to tell "not
// created" from "uncertain"). Bodies are never logged or returned to the buyer.
async function provider(env, path, { method = 'GET', key, payload, credential } = {}) {
  const token = await (credential ?? verifiedCredential(env));
  let response;
  try {
    response = await fetch(`https://api.mercadopago.com/v1/orders${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(key ? { 'X-Idempotency-Key': key } : {}),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });
  } catch {
    return { status: 0, body: null };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function getRemote(env, mpId) {
  const { status, body } = await provider(env, `/${encodeURIComponent(mpId)}`);
  if (status !== 200 || !body) {
    const error = new Error('provider');
    error.status = status;
    throw error;
  }
  return body;
}

const payments = (remote) =>
  Array.isArray(remote?.transactions?.payments) ? remote.transactions.payments : [];

/** Names of the identity checks a Pix Order fails (only names are ever logged). */
export function pixMismatches(remote, attempt, order, env) {
  const product = Object.hasOwn(CATALOG, order.product_id) ? CATALOG[order.product_id] : null;
  const checks = {
    id: remote?.id === attempt.mp_id,
    environment: validProviderOrder(remote, env),
    type: remote?.type === 'online',
    external_reference: remote?.external_reference === order.id,
    total_amount:
      remote?.total_amount === money(order.amount_cents) &&
      attempt.amount_cents === order.amount_cents,
    currency: remote?.currency === undefined || remote.currency === order.currency,
    method:
      payments(remote).length > 0 && payments(remote).every((p) => p?.payment_method?.id === 'pix'),
    product: !!product,
  };
  if (productionMode(env)) {
    checks.seller = String(remote?.user_id) === env.COMMERCE_SELLER_ID;
    checks.application =
      String(remote?.integration_data?.application_id) === env.COMMERCE_APPLICATION_ID;
  }
  return Object.keys(checks).filter((name) => !checks[name]);
}

const orderStatement = (env, id) =>
  env.COMMERCE_DB.prepare('SELECT * FROM commerce_orders WHERE id=?').bind(id);

/**
 * Verifies the Pix Order and applies it to the ledger in ONE transaction, together with
 * the display mirror on commerce_orders (Pix orders only: mp_id IS NULL there) and the
 * 12-month recovery window when the entitlement is active.
 */
export async function reconcileAttempt(env, attempt, order, { now = Date.now(), remote } = {}) {
  const snapshot = remote ?? (await getRemote(env, attempt.mp_id));
  const mismatches = pixMismatches(snapshot, attempt, order, env);
  if (mismatches.length) {
    const error = new Error('mismatch');
    error.fields = mismatches;
    throw error;
  }
  const db = env.COMMERCE_DB;
  const updated = Date.parse(snapshot.last_updated_date);
  if (!Number.isFinite(updated) || updated > now + 60000) throw new Error('version');
  const status = typeof snapshot.status === 'string' ? snapshot.status : 'unknown';
  const detail = typeof snapshot.status_detail === 'string' ? snapshot.status_detail : '';
  const resources = [snapshot.id, ...payments(snapshot).map((p) => p?.id)]
    .map((v) => String(v ?? ''))
    .filter((v) => /^[A-Za-z0-9]{1,128}$/.test(v))
    .slice(0, 50);
  const { phase, readBack } = await applySnapshot(env, {
    orderId: order.id,
    attemptId: attempt.id,
    remote: snapshot,
    now,
    before: resources.map((id) =>
      db
        .prepare('INSERT OR IGNORE INTO commerce_resources (resource_id,order_id) VALUES (?,?)')
        .bind(id, order.id),
    ),
    after: [
      db
        .prepare(
          `UPDATE commerce_orders SET status=?2,status_detail=?3,remote_updated=?4
           WHERE id=?1 AND mp_id IS NULL AND remote_updated < ?4`,
        )
        .bind(order.id, status, detail, updated),
      db
        .prepare(
          `UPDATE commerce_orders SET access_expires=MAX(access_expires, created_at + ?2)
           WHERE id=?1 AND EXISTS (SELECT 1 FROM commerce_entitlements e WHERE e.order_id=?1 AND e.state='active')`,
        )
        .bind(order.id, PAID_ACCESS_MS),
      db
        .prepare(
          `UPDATE commerce_payment_attempts SET check_failures=0, next_check_at=?2 WHERE id=?1`,
        )
        .bind(
          attempt.id,
          nextCheck({ ...attempt, mp_status: status }, phaseAfter(attempt, snapshot), now),
        ),
      orderStatement(env, order.id),
      db.prepare('SELECT * FROM commerce_entitlements WHERE order_id=?').bind(order.id),
      db.prepare('SELECT * FROM commerce_payment_attempts WHERE id=?').bind(attempt.id),
    ],
  });
  return {
    phase,
    order: readBack[3]?.results?.[0] ?? null,
    entitlement: readBack[4]?.results?.[0] ?? null,
    attempt: readBack[5]?.results?.[0] ?? null,
  };
}

// Best guess of the phase after this snapshot, only for scheduling the next check.
function phaseAfter(attempt, remote) {
  const paid = payments(remote).some((p) =>
    ['processed', 'refunded', 'charged_back'].includes(p?.status),
  );
  if (paid) return 'settled';
  if (['canceled', 'expired', 'failed', 'refunded'].includes(remote?.status))
    return 'closed_unpaid';
  return attempt.phase === 'canceling' ? 'canceling' : 'open';
}

/** When the reconciler looks at an attempt again (null: no more checks). */
export function nextCheck(attempt, phase, now = Date.now()) {
  if (now >= attempt.watch_until) return null;
  if (
    phase === 'open' ||
    phase === 'canceling' ||
    phase === 'reserved' ||
    phase === 'sending' ||
    phase === 'uncertain'
  ) {
    const payable = attempt.pix_expires_at && now < attempt.pix_expires_at;
    return now + (payable ? 20000 : 120000);
  }
  // Closed or settled: watch for late payments, refunds and disputes, less often.
  return now + 3600000;
}

const backoff = (failures) => Math.min(30000 * 2 ** Math.min(failures, 7), 3600000);

/** One deterministic body per attempt: retries send exactly the same bytes and key. */
export function pixRequestBody(order, email, { approve = false } = {}) {
  const amount = money(order.amount_cents);
  return {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: order.id,
    total_amount: amount,
    expiration_time: 'PT30M',
    items: [{ title: order.product_title, quantity: 1, unit_price: amount }],
    payer: { email, ...(approve ? { first_name: 'APRO' } : {}) },
    transactions: {
      payments: [{ amount, payment_method: { id: 'pix', type: 'bank_transfer' } }],
    },
  };
}

function pixData(remote) {
  const method = payments(remote)[0]?.payment_method || {};
  const code =
    typeof method.qr_code === 'string' && method.qr_code.length <= 1024 ? method.qr_code : null;
  const image =
    typeof method.qr_code_base64 === 'string' &&
    /^[A-Za-z0-9+/=]{16,40000}$/.test(method.qr_code_base64)
      ? method.qr_code_base64
      : null;
  const expires = Date.parse(
    payments(remote)[0]?.date_of_expiration ?? remote?.expiration_time ?? '',
  );
  return { code, image, expires: Number.isFinite(expires) ? expires : null };
}

export const attemptsOf = (env, orderId) =>
  env.COMMERCE_DB.prepare(
    'SELECT * FROM commerce_payment_attempts WHERE order_id=? ORDER BY created_at DESC',
  )
    .bind(orderId)
    .all()
    .then((r) => r.results || []);

export const isPixOrder = (order, attempts) =>
  !order.mp_id && attempts.some((a) => a.flow === 'pix');

/** Buyer-facing Pix data: only while the code can still be paid. */
export function pixView(attempt, now = Date.now()) {
  if (!attempt || attempt.flow !== 'pix' || attempt.phase !== 'open' || !attempt.pix_qr_code)
    return null;
  if (!attempt.pix_expires_at || attempt.pix_expires_at <= now) return null;
  return {
    qr_code: attempt.pix_qr_code,
    qr_code_base64: attempt.pix_qr_base64 || null,
    expires_at: attempt.pix_expires_at,
  };
}

/**
 * Creates (or resumes) the Pix of an order. Returns { status, body } for the handler.
 * `order` must already be owned by the caller (bearer checked) and unpaid.
 */
export async function createPix(
  env,
  order,
  { email, approve = false, now = Date.now(), identity } = {},
) {
  if (order.mp_id)
    return {
      status: 409,
      body: { code: 'checkout_pro_order', message: 'Este pedido já usa outro meio de pagamento.' },
    };
  const payload = pixRequestBody(order, email, { approve });
  const text = JSON.stringify(payload);
  const requestHash = await sha256(text);
  const stored = JSON.stringify({ ...payload, payer: { ...payload.payer, email: '' } });

  for (let round = 0; round < 2; round += 1) {
    const id = `pix-${crypto.randomUUID()}`;
    const reservation = await reserveAttempt(env, {
      id,
      orderId: order.id,
      flow: 'pix',
      requestBody: stored,
      requestHash,
      amountCents: order.amount_cents,
      watchUntil: now + PIX_TTL_MS + WATCH_AFTER_MS,
      now,
    });
    if (reservation.reserved)
      return send(env, reservation.attempt, order, text, requestHash, now, identity);
    if (reservation.reason === 'paid')
      return { status: 409, body: { code: 'paid', message: 'Este pedido já está pago.' } };
    const holder = reservation.holder;
    if (!holder) continue; // released meanwhile: try once more
    if (holder.flow !== 'pix')
      return {
        status: 409,
        body: { code: 'locked', message: 'Há outro pagamento em andamento para este pedido.' },
      };
    if (holder.mp_id && pixView(holder, now)) return { status: 200, body: { attempt: holder } };
    if (!holder.mp_id && ['reserved', 'sending'].includes(holder.phase)) {
      if (holder.request_hash !== requestHash)
        return {
          status: 409,
          body: {
            code: 'pending_creation',
            message: 'Um Pix com outros dados está sendo gerado. Aguarde e atualize.',
          },
        };
      return send(env, holder, order, text, requestHash, now, identity);
    }
    if (holder.mp_id && holder.phase === 'open') {
      // Expired but not yet closed by the provider: ask once, then retry the reservation.
      try {
        await reconcileAttempt(env, holder, order, { now });
      } catch {
        return {
          status: 503,
          body: { message: 'Não foi possível verificar o Pix anterior. Tente novamente.' },
        };
      }
      continue;
    }
    return {
      status: 409,
      body: { code: 'locked', message: 'Há um pagamento em verificação para este pedido.' },
    };
  }
  return {
    status: 409,
    body: { code: 'locked', message: 'Há um pagamento em verificação para este pedido.' },
  };
}

async function send(env, attempt, order, text, requestHash, now, identity) {
  if (!(await recordSend(env, { id: attempt.id, requestHash, now }))) {
    const current = await env.COMMERCE_DB.prepare(
      'SELECT * FROM commerce_payment_attempts WHERE id=?',
    )
      .bind(attempt.id)
      .first();
    // A concurrent request already linked the provider order: resume it.
    if (current?.mp_id)
      return pixView(current, now)
        ? { status: 200, body: { attempt: current } }
        : {
            status: 409,
            body: { code: 'locked', message: 'O Pix está sendo gerado. Atualize em instantes.' },
          };
    if (current && current.send_count >= 5)
      await markUncertain(env, { id: attempt.id, orderId: order.id, now });
    return {
      status: 503,
      body: { message: 'Não foi possível gerar o Pix agora. Tente novamente.' },
    };
  }
  const { status, body } = await provider(env, '', {
    method: 'POST',
    key: attempt.id,
    payload: JSON.parse(text),
    credential: identity,
  });
  const outcome = classifyCreateResponse(status, body);
  if (outcome === 'rejected_not_created') {
    await closeNotCreated(env, { id: attempt.id, now });
    return {
      status: 422,
      body: {
        code: 'rejected',
        message: 'O Mercado Pago recusou os dados. Confira o e-mail e tente novamente.',
      },
    };
  }
  if (outcome !== 'created') {
    // Unknown result: the lock stays. The buyer's retry resends the same body and key.
    await env.COMMERCE_DB.prepare('UPDATE commerce_payment_attempts SET next_check_at=? WHERE id=?')
      .bind(now + 30000, attempt.id)
      .run();
    return {
      status: 503,
      body: { message: 'O Mercado Pago não confirmou o Pix. Tente novamente com o mesmo e-mail.' },
    };
  }
  if (!validProviderOrder(body, env) || body.external_reference !== order.id) {
    await markUncertain(env, { id: attempt.id, orderId: order.id, now });
    return { status: 503, body: { message: 'Resposta inesperada do Mercado Pago.' } };
  }
  const adopted = await adoptProviderOrder(env, { id: attempt.id, mpId: body.id, now });
  const current = await env.COMMERCE_DB.prepare(
    'SELECT * FROM commerce_payment_attempts WHERE id=?',
  )
    .bind(attempt.id)
    .first();
  if (!adopted && current?.mp_id !== body.id) {
    await markUncertain(env, { id: attempt.id, orderId: order.id, now });
    return { status: 503, body: { message: 'Resposta inesperada do Mercado Pago.' } };
  }
  const pix = pixData(body);
  const expires = Math.min(pix.expires ?? now + PIX_TTL_MS, now + PIX_TTL_MS);
  await env.COMMERCE_DB.prepare(
    `UPDATE commerce_payment_attempts SET phase=CASE WHEN phase IN ('reserved','sending','uncertain') THEN 'open' ELSE phase END,
       pix_qr_code=COALESCE(pix_qr_code, ?2), pix_qr_base64=COALESCE(pix_qr_base64, ?3),
       pix_expires_at=COALESCE(pix_expires_at, ?4), exposure_until=COALESCE(exposure_until, ?4),
       watch_until=MAX(watch_until, ?4 + ?5), next_check_at=?6, updated_at=?7
     WHERE id=?1`,
  )
    .bind(attempt.id, pix.code, pix.image, expires, WATCH_AFTER_MS, now + 20000, now)
    .run();
  let fresh = await env.COMMERCE_DB.prepare('SELECT * FROM commerce_payment_attempts WHERE id=?')
    .bind(attempt.id)
    .first();
  try {
    // The creation answer is also a verified snapshot (an APRO test may already be paid).
    fresh = (await reconcileAttempt(env, fresh, order, { now, remote: body })).attempt ?? fresh;
  } catch {
    // The reconciler and the webhook will apply it.
  }
  return { status: 201, body: { attempt: fresh } };
}

/** D2: switching away from a Pix only after the provider confirms the cancellation. */
export async function cancelPix(env, order, { now = Date.now() } = {}) {
  const holder = await env.COMMERCE_DB.prepare(
    "SELECT * FROM commerce_payment_attempts WHERE order_id=? AND holds_lock=1 AND flow='pix'",
  )
    .bind(order.id)
    .first();
  if (!holder?.mp_id)
    return { status: 409, body: { message: 'Não há Pix em aberto para cancelar.' } };
  if (holder.phase === 'open' && !(await beginCancel(env, { id: holder.id, now })))
    return { status: 409, body: { message: 'O Pix mudou de estado. Atualize a página.' } };
  const { status } = await provider(env, `/${encodeURIComponent(holder.mp_id)}/cancel`, {
    method: 'POST',
    key: `cancel-${holder.mp_id}`,
  });
  let result;
  try {
    result = await reconcileAttempt(env, { ...holder, phase: 'canceling' }, order, { now });
  } catch {
    return {
      status: 503,
      body: { message: 'Cancelamento ainda não confirmado. Tente atualizar.' },
    };
  }
  if (result.attempt?.phase === 'canceling' && status === 409)
    await abortCancel(env, { id: holder.id, now });
  const released = result.attempt && !result.attempt.holds_lock;
  return {
    status: released ? 200 : 409,
    body: released
      ? {
          canceled: result.attempt.phase === 'closed_unpaid',
          paid: result.entitlement?.state === 'active',
        }
      : { message: 'O Mercado Pago ainda não confirmou o cancelamento.' },
  };
}

/** Staging-only: refunds a TEST Pix through the official Orders refund endpoint. */
export async function testRefund(env, order, { amount, now = Date.now() } = {}) {
  if (!testRefundsEnabled(env)) return { status: 404, body: { message: 'Não encontrado.' } };
  const credential = verifiedTestCredential(env);
  const attempt = await env.COMMERCE_DB.prepare(
    "SELECT * FROM commerce_payment_attempts WHERE order_id=? AND flow='pix' AND phase='settled' AND mp_id LIKE 'ORDTST%' ORDER BY created_at DESC",
  )
    .bind(order.id)
    .first();
  if (!attempt) return { status: 409, body: { message: 'Não há Pix de teste pago neste pedido.' } };
  const remote = await getRemote(env, attempt.mp_id);
  if (pixMismatches(remote, attempt, order, env).length)
    return { status: 409, body: { message: 'Pedido de teste divergente.' } };
  let payload;
  if (amount !== undefined) {
    if (typeof amount !== 'string' || !/^\d{1,6}\.\d{2}$/.test(amount) || amount === '0.00')
      return { status: 400, body: { message: 'Valor inválido.' } };
    const payment = payments(remote)[0];
    if (!payment?.id) return { status: 409, body: { message: 'Pagamento não encontrado.' } };
    payload = { transactions: [{ id: payment.id, amount }] };
  }
  const { status } = await provider(env, `/${encodeURIComponent(attempt.mp_id)}/refund`, {
    method: 'POST',
    key: `refund-${attempt.mp_id}-${amount ?? 'full'}`,
    payload,
    credential,
  });
  if (status < 200 || status >= 300)
    return {
      status: 502,
      body: { message: 'Reembolso de teste recusado.', provider_status: status },
    };
  const result = await reconcileAttempt(env, attempt, order, { now });
  return {
    status: 200,
    body: {
      entitlement: result.entitlement?.state ?? 'none',
      reason: result.entitlement?.reason ?? null,
    },
  };
}

/**
 * Reconciler: claims due attempts under a lease, checks each one with the provider and
 * applies the snapshot. Concurrent runs are excluded by the lease; a crashed run's lease
 * expires. Every run is recorded for the health check.
 */
export async function runReconciler(
  env,
  { now = Date.now(), runner = 'cron', limit = 25, log = () => {} } = {},
) {
  if (!ledgerEnabled(env)) return { skipped: 'disabled' };
  const db = env.COMMERCE_DB;
  const holder = `${runner}-${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO commerce_job_leases (job,holder,expires_at) VALUES ('reconciler',?1,?2)
       ON CONFLICT(job) DO UPDATE SET holder=excluded.holder, expires_at=excluded.expires_at
       WHERE commerce_job_leases.expires_at < ?3`,
    )
    .bind(holder, now + 50000, now)
    .run();
  const lease = await db
    .prepare("SELECT holder FROM commerce_job_leases WHERE job='reconciler'")
    .first();
  if (lease?.holder !== holder) return { skipped: 'leased' };
  const runId = holder;
  const overdue = await db
    .prepare(
      'SELECT COUNT(*) n FROM commerce_payment_attempts WHERE next_check_at IS NOT NULL AND next_check_at < ?',
    )
    .bind(now - 300000)
    .first();
  await db
    .prepare(
      "INSERT INTO commerce_job_runs (run_id,job,runner,started_at,overdue_at_start) VALUES (?,'reconciler',?,?,?)",
    )
    .bind(runId, runner, now, overdue?.n ?? 0)
    .run();
  const due =
    (
      await db
        .prepare(
          `SELECT * FROM commerce_payment_attempts WHERE next_check_at IS NOT NULL AND next_check_at <= ?
         ORDER BY next_check_at LIMIT ?`,
        )
        .bind(now, limit)
        .all()
    ).results || [];
  let processed = 0,
    failures = 0;
  for (const attempt of due) {
    try {
      const order = await orderStatement(env, attempt.order_id).first();
      if (!order) throw new Error('order');
      if (!attempt.mp_id) {
        // Creation without a confirmed answer: the buyer's retry resends the same body.
        // Past the exposure window nobody can have the code: keep the lock, open a review.
        const deadline = (attempt.first_sent_at ?? attempt.created_at) + PIX_TTL_MS;
        if (now >= deadline) await markUncertain(env, { id: attempt.id, orderId: order.id, now });
        await db
          .prepare('UPDATE commerce_payment_attempts SET next_check_at=? WHERE id=?')
          .bind(now >= attempt.watch_until ? null : now + 600000, attempt.id)
          .run();
      } else if (attempt.flow === 'pix') {
        await reconcileAttempt(env, attempt, order, { now });
      } else {
        // Checkout Pro attempts are reconciled by the existing flow; stop scheduling here.
        await db
          .prepare('UPDATE commerce_payment_attempts SET next_check_at=NULL WHERE id=?')
          .bind(attempt.id)
          .run();
      }
      processed += 1;
    } catch (error) {
      failures += 1;
      log('reconciler_attempt_failed', { order: attempt.order_id, error });
      await db
        .prepare(
          `UPDATE commerce_payment_attempts SET check_failures=check_failures+1,
             next_check_at=?2 + CASE WHEN check_failures>=7 THEN 3600000 ELSE 30000 * (1 << (check_failures+1)) END
           WHERE id=?1`,
        )
        .bind(attempt.id, now)
        .run();
      if (attempt.check_failures + 1 >= 10)
        await db
          .prepare(
            "INSERT OR IGNORE INTO commerce_payment_reviews (subject_id,reason,order_id,created_at) VALUES (?,'reconciler_stalled',?,?)",
          )
          .bind(attempt.id, attempt.order_id, now)
          .run();
    }
  }
  await db.batch([
    db
      .prepare(
        'UPDATE commerce_job_runs SET finished_at=?2, claimed=?3, processed=?4, failures=?5 WHERE run_id=?1',
      )
      .bind(runId, Date.now(), due.length, processed, failures),
    db.prepare("DELETE FROM commerce_job_leases WHERE job='reconciler' AND holder=?").bind(holder),
    db
      .prepare("DELETE FROM commerce_job_runs WHERE job='reconciler' AND started_at < ?")
      .bind(now - 7 * 86400000),
  ]);
  return { claimed: due.length, processed, failures };
}

/** Reconciler health: freshness and backlog only, never customer data. */
export async function reconcilerHealth(env, now = Date.now()) {
  if (!ledgerEnabled(env)) return { enabled: false };
  const db = env.COMMERCE_DB;
  const last = await db
    .prepare(
      "SELECT finished_at, failures FROM commerce_job_runs WHERE job='reconciler' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1",
    )
    .first();
  const overdue = await db
    .prepare(
      'SELECT COUNT(*) n FROM commerce_payment_attempts WHERE next_check_at IS NOT NULL AND next_check_at < ?',
    )
    .bind(now - 300000)
    .first();
  const age = last ? Math.max(0, Math.round((now - last.finished_at) / 1000)) : null;
  return {
    enabled: true,
    last_run_age_s: age,
    last_run_failures: last?.failures ?? null,
    overdue: overdue?.n ?? 0,
    healthy: age !== null && age <= 180 && (overdue?.n ?? 0) === 0,
  };
}

export { backoff };
