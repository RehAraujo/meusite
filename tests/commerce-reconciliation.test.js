// @vitest-environment node
// Isolated, in-memory integration tests: no network, accounts or environment files.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleCommerce, hash } from '../worker/commerce/handler.js';
let db, env, id, remote, fetchMock, assetGet;
const bearer = 'a'.repeat(64);
const provider = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const origin = 'https://reconciliation.local.invalid';
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  for (const file of ['commerce/0001_orders', 'commerce/0002_delivery_safety', 'commerce/0003_download_attempts', 'commerce-prototypes/0004_webhook_confirmations'])
    db.exec(readFileSync(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
  id = randomUUID();
  db.prepare(`INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,mp_id,created_at,access_expires) VALUES (?,?,'product','Template',4700,'BRL','private/key','test.zip',?, ?,?)`).run(id, await hash(bearer), provider, Date.now(), Date.now()+60000);
  remote = { id: provider, type: 'online', external_reference: id, currency: 'BRL', total_amount: '47.00', total_paid_amount: '47.00', live_mode: false, status: 'processed', status_detail: 'accredited', last_updated_date: new Date(Date.now()-10000).toISOString() };
  assetGet = vi.fn(async () => ({ body: new Uint8Array([1,2,3]) }));
  env = { COMMERCE_ENVIRONMENT: 'staging', COMMERCE_MODE: 'test', COMMERCE_RECONCILIATION: 'test', COMMERCE_ORIGIN: origin, MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-synthetic', MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-signature-secret', DIGITAL_PRODUCTS: { get: assetGet }, COMMERCE_DB: { prepare(sql) { return { bind(...args) { return { first: async () => db.prepare(sql).get(...args) || null, run: async () => db.prepare(sql).run(...args) }; } }; } } };
  fetchMock = vi.fn(async (url) => {
    if (url === 'https://api.mercadolibre.com/users/me') return Response.json({ id: 3792015931, site_id: 'MLB', tags: ['test_user'] });
    if (url === `https://api.mercadopago.com/v1/orders/${provider}`) return Response.json(remote);
    throw new Error('Unexpected network destination');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); db.close(); });
function request(suffix = '', { token = bearer, ...options } = {}) {
  return new Request(`${origin}/api/commerce/orders/${id}${suffix}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'X-Download-Attempt': randomUUID(), ...options.headers } });
}
const run = (suffix = '', options) => handleCommerce(request(suffix, options), env);
async function notify(valid = true) {
  const ts = String(Date.now()), requestId = randomUUID();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.MERCADOPAGO_WEBHOOK_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`id:${provider.toLowerCase()};request-id:${requestId};ts:${ts};`))).toString('hex');
  return handleCommerce(new Request(`${origin}/api/commerce/webhook?data.id=${provider}&type=order`, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-request-id':requestId, 'x-signature':`ts=${ts},v1=${valid?signature:'0'.repeat(64)}` }, body:JSON.stringify({ type:'order', data:{id:provider}, live_mode:false }) }), env);
}
it('consults the official API but does not grant access until a valid signed webhook; duplicate notifications do not duplicate delivery', async () => {
  const response = await run(); expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({status:'processed',paid:false});
  expect((await run('/download')).status).toBe(403); expect(assetGet).not.toHaveBeenCalled();
  expect((await notify(false)).status).toBe(401);
  expect((await run('/download')).status).toBe(403);
  expect((await notify()).status).toBe(200); expect((await notify()).status).toBe(200);
  expect(db.prepare('SELECT count(*) n FROM commerce_webhook_confirmations').get().n).toBe(1);
  expect((await (await run()).json()).paid).toBe(true);
  expect((await run('/download')).status).toBe(200);
  expect(db.prepare('SELECT downloads FROM commerce_orders').get().downloads).toBe(1);
  remote.status='refunded'; remote.status_detail='refunded'; remote.last_updated_date=new Date().toISOString();
  expect((await run('/download')).status).toBe(403); expect(assetGet).toHaveBeenCalledTimes(1);
});
it('rejects unauthorized or expired sessions before provider calls and refuses production/disabled execution', async () => {
  expect((await run('', { token:'b'.repeat(64) })).status).toBe(404);
  // Beyond the 12-month paid window: refused before any provider call.
  db.prepare('UPDATE commerce_orders SET access_expires=1, created_at=1').run();
  expect((await run()).status).toBe(404); expect(fetchMock).not.toHaveBeenCalled();
  env.COMMERCE_MODE='disabled'; expect((await run()).status).toBe(503);
  env.COMMERCE_MODE='test'; env.COMMERCE_ENVIRONMENT='production'; expect((await run()).status).toBe(503);
});
it('fails closed on mismatched value, reference, environment, invalid provider timestamp or API outage', async () => {
  const original = {...remote};
  for (const patch of [{ total_amount:'0.01' }, { total_paid_amount:'0.01' }, { external_reference:randomUUID() }, { live_mode:true }, {last_updated_date:'invalid'}]) {
    remote={...original,...patch}; expect((await run()).status).toBeGreaterThanOrEqual(500);
    expect(db.prepare('SELECT count(*) n FROM commerce_webhook_confirmations').get().n).toBe(0);
  }
  fetchMock.mockRejectedValue(new Error('Synthetic unavailable'));
  expect((await run()).status).toBeGreaterThanOrEqual(500); expect(assetGet).not.toHaveBeenCalled();
});
it('does not reuse an older signed approval for a newer provider version', async () => {
  expect((await notify()).status).toBe(200);
  remote.last_updated_date = new Date().toISOString();
  expect((await (await run()).json()).paid).toBe(false);
  expect((await run('/download')).status).toBe(403);
  expect(assetGet).not.toHaveBeenCalled();
});
it('without the isolated opt-in, a status read confirms an awaiting order with the provider (webhook fallback), throttled per order', async () => {
  delete env.COMMERCE_RECONCILIATION;
  expect(await (await run()).json()).toMatchObject({ status: 'processed', status_detail: 'accredited', paid: true });
  const orderReads = () => fetchMock.mock.calls.filter(([url]) => url.endsWith(`/v1/orders/${provider}`)).length;
  expect(orderReads()).toBe(1);
  await run(); // already confirmed: no further provider call
  expect(orderReads()).toBe(1);
});
