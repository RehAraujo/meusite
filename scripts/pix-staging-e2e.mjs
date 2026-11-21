#!/usr/bin/env node
/* global console, process, crypto, fetch, setTimeout, URL */
// Functional Pix test against STAGING only, with Mercado Pago TEST credentials (the
// staging Worker's own secrets) and the official APRO test payer. No real money, no
// personal account, no card. Prints only statuses and booleans: never tokens, Notion
// URLs, QR codes or provider bodies.
//
//   node scripts/pix-staging-e2e.mjs
const BASE = 'https://homologacao.renatajoin.com';
const PRODUCT = 'meu-dinheiro-minhas-regras';
const EMAIL = 'test_payer@example.com'; // documented test e-mail, not a person
if (new URL(BASE).hostname !== 'homologacao.renatajoin.com') throw new Error('staging only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const session = () => ({
  id: crypto.randomUUID(),
  bearer: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join(''),
});
async function api(path, s, { method = 'GET', body, key, headers = {} } = {}) {
  const started = Date.now();
  const response = await fetch(`${BASE}/api/commerce${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.bearer}`,
      ...(method === 'POST' ? { Origin: BASE, 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - started;
  const type = response.headers.get('Content-Type') || '';
  const data = type.includes('json')
    ? await response.json()
    : { bytes: (await response.arrayBuffer()).byteLength };
  return { status: response.status, data, ms };
}
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const createPix = (s, approve) =>
  api('/pix', s, {
    method: 'POST',
    key: s.id,
    body: { product_id: PRODUCT, email: EMAIL, ...(approve ? { test_approve: true } : {}) },
  });
async function waitPaid(s, timeoutMs = 120000) {
  const until = Date.now() + timeoutMs;
  const started = Date.now();
  while (Date.now() < until) {
    const r = await api(`/orders/${s.id}`, s);
    if (r.data.paid) return { order: r.data, seconds: Math.round((Date.now() - started) / 1000) };
    await sleep(5000);
  }
  return { order: null, seconds: null };
}
async function access(s) {
  const r = await api(`/orders/${s.id}/access`, s);
  let notion = false;
  try {
    const host = new URL(r.data.url).hostname;
    notion = host === 'notion.so' || host === 'www.notion.so' || host.endsWith('.notion.site');
  } catch {
    notion = false;
  }
  return { status: r.status, notion, ms: r.ms };
}
const download = (s) =>
  api(`/orders/${s.id}/download`, s, { headers: { 'X-Download-Attempt': crypto.randomUUID() } });
const refund = (s, amount) =>
  api(`/orders/${s.id}/test-refund`, s, { method: 'POST', body: amount ? { amount } : {} });

async function paidOrder(label) {
  const s = session();
  const created = await createPix(s, true);
  check(
    `${label}: Pix created with QR and copy-paste`,
    created.status === 201 && !!created.data.pix?.qr_code,
    `HTTP ${created.status}, ${created.ms} ms, QR image ${created.data.pix?.qr_code_base64 ? 'yes' : 'no'}`,
  );
  const again = await createPix(s, true);
  check(
    `${label}: retry reuses the same Pix`,
    again.status === 200 ||
      (again.status === 201 && again.data.pix?.qr_code === created.data.pix?.qr_code) ||
      again.data.paid === true,
    `HTTP ${again.status}`,
  );
  const { order, seconds } = await waitPaid(s);
  check(
    `${label}: payment confirmed automatically`,
    !!order,
    seconds !== null ? `${seconds} s` : 'timeout',
  );
  return { s, order };
}

async function main() {
  const health = await (await fetch(`${BASE}/api/commerce/health`)).json();
  check(
    'staging in test mode',
    health.environment === 'staging' && health.mode === 'test',
    `build ${health.build}`,
  );
  const catalog = await (await fetch(`${BASE}/api/commerce/catalog`)).json();
  check('Pix offered in staging catalog', catalog.pix === true);

  // A: approved, Notion + ZIP delivered
  const a = await paidOrder('A approved');
  if (a.order) {
    const open = await access(a.s);
    check(
      'A: Notion access released',
      open.status === 200 && open.notion,
      `HTTP ${open.status}, ${open.ms} ms`,
    );
    const zip = await download(a.s);
    check('A: ZIP delivered', zip.status === 200 && zip.data.bytes > 0, `HTTP ${zip.status}`);
    check('A: 12-month recovery window', a.order.access_expires > Date.now() + 300 * 86400000);
  }

  // B: full refund revokes
  const b = await paidOrder('B full refund');
  if (b.order) {
    const r = await refund(b.s);
    check(
      'B: full refund accepted by Mercado Pago (test)',
      r.status === 200,
      `HTTP ${r.status} ${JSON.stringify(r.data)}`,
    );
    const open = await access(b.s);
    check('B: Notion access refused after full refund', open.status === 403, `HTTP ${open.status}`);
    const view = await api(`/orders/${b.s.id}`, b.s);
    check(
      'B: order shows refunded',
      view.data.paid === false && view.data.status === 'refunded',
      `${view.data.status}/${view.data.status_detail}`,
    );
  }

  // C: partial refund keeps access (D1)
  const c = await paidOrder('C partial refund');
  if (c.order) {
    const r = await refund(c.s, '10.00');
    check(
      'C: partial refund accepted by Mercado Pago (test)',
      r.status === 200,
      `HTTP ${r.status} ${JSON.stringify(r.data)}`,
    );
    const open = await access(c.s);
    check(
      'C: Notion access kept after partial refund (D1)',
      open.status === 200 && open.notion,
      `HTTP ${open.status}`,
    );
    const view = await api(`/orders/${c.s.id}`, c.s);
    check(
      'C: order still approved, detail recorded',
      view.data.paid === true,
      `${view.data.status}/${view.data.status_detail}`,
    );
  }

  // D: pending Pix (no APRO) -> cancel releases the lock, nothing delivered
  const d = session();
  const pending = await createPix(d, false);
  check(
    'D: pending Pix shows QR',
    pending.status === 201 && !!pending.data.pix?.qr_code,
    `HTTP ${pending.status}, ${pending.data.status}/${pending.data.status_detail}`,
  );
  const blocked = await access(d);
  check('D: no access before payment', blocked.status === 403, `HTTP ${blocked.status}`);
  const cp = await api('/checkout', d, {
    method: 'POST',
    key: d.id,
    body: { product_id: PRODUCT },
  });
  check(
    'D: Checkout Pro refused on a Pix order (shared lock)',
    cp.status === 409,
    `HTTP ${cp.status}`,
  );
  const cancel = await api(`/orders/${d.id}/pix/cancel`, d, { method: 'POST', body: {} });
  check(
    'D: cancel confirmed by Mercado Pago',
    cancel.status === 200 && cancel.data.canceled === true,
    `HTTP ${cancel.status} ${JSON.stringify(cancel.data)}`,
  );

  // E: Checkout Pro still works (regression) and holds the lock
  const e = session();
  const pro = await api('/checkout', e, {
    method: 'POST',
    key: e.id,
    body: { product_id: PRODUCT },
  });
  check(
    'E: Checkout Pro unchanged (redirect URL)',
    pro.status === 200 &&
      /^https:\/\/www\.mercadopago\.com\.br\/checkout\/v1\/redirect/.test(
        pro.data.checkout_url || '',
      ),
    `HTTP ${pro.status}, ${pro.ms} ms`,
  );
  const pixOnPro = await createPix(e, true);
  check(
    'E: Pix refused on a Checkout Pro order (shared lock)',
    pixOnPro.status === 409,
    `HTTP ${pixOnPro.status}`,
  );

  const reconciler = await (await fetch(`${BASE}/api/commerce/health/reconciler`)).json();
  check(
    'reconciler ran recently',
    reconciler.enabled && reconciler.last_run_age_s !== null && reconciler.last_run_age_s <= 180,
    JSON.stringify(reconciler),
  );

  console.log(
    `\nOrders (prefixes): A ${a.s.id.slice(0, 8)} B ${b.s.id.slice(0, 8)} C ${c.s.id.slice(0, 8)} D ${d.id.slice(0, 8)} E ${e.id.slice(0, 8)}`,
  );
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
}
main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
