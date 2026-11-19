// @vitest-environment node
// Phase 1 latency work on the checkout endpoint: fewer sequential database round trips and
// the seller identity check overlapped with them, never cached and always awaited before
// any Mercado Pago call. Real SQLite, mocked network, no external calls.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCommerce } from '../worker/commerce/handler.js';

const origin = 'https://staging.example.com';
const id = '5b0c6f3e-8d1a-4f2b-9c7e-1a2b3c4d5e6f';
const mpId = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const bearer = 'cd'.repeat(32);
const USERS_ME = 'https://api.mercadolibre.com/users/me';
const ORDERS = 'https://api.mercadopago.com/v1/orders';
let db, log, env, network, identityOk;

const migration = (name) =>
  readFileSync(new URL(`../migrations/commerce/${name}`, import.meta.url), 'utf8');
// D1-like fake that records every round trip. `batch` runs its statements in order inside
// one transaction, like D1.
function fakeD1({ batch = true } = {}) {
  const statement = (sql, args = []) => ({
    sql,
    args,
    bind: (...values) => statement(sql, values),
    first: async () => {
      log.push(`db:first:${sql.trim().split(/\s+/)[0]}`);
      return db.prepare(sql).get(...args) || null;
    },
    run: async () => {
      log.push(`db:run:${sql.trim().split(/\s+/)[0]}`);
      return db.prepare(sql).run(...args);
    },
  });
  const d1 = { prepare: (sql) => statement(sql) };
  if (batch)
    d1.batch = async (list) => {
      log.push(`db:batch:${list.length}`);
      db.exec('BEGIN');
      try {
        const out = list.map((s) =>
          /^\s*SELECT/i.test(s.sql)
            ? { results: db.prepare(s.sql).all(...s.args) }
            : { results: [], meta: db.prepare(s.sql).run(...s.args) },
        );
        db.exec('COMMIT');
        return out;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
  return d1;
}
function post() {
  return new Request(`${origin}/api/commerce/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      Origin: origin,
      'Content-Type': 'application/json',
      'Idempotency-Key': id,
    },
    body: JSON.stringify({ product_id: 'planner-treino' }),
  });
}
function context() {
  const pending = [];
  return { pending, waitUntil: vi.fn((promise) => pending.push(promise)) };
}
// Round trips on the buyer's critical path (housekeeping deletes excluded).
const trips = () => log.filter((entry) => entry.startsWith('db:') && entry !== 'db:run:DELETE');

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  db = new DatabaseSync(':memory:');
  for (const name of ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'])
    db.exec(migration(name));
  log = [];
  identityOk = true;
  env = {
    COMMERCE_ENVIRONMENT: 'staging',
    COMMERCE_MODE: 'test',
    COMMERCE_ORIGIN: origin,
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-fixture-only',
    MERCADOPAGO_WEBHOOK_SECRET: 'fixture-webhook-secret',
    COMMERCE_DB: fakeD1(),
    DIGITAL_PRODUCTS: { head: vi.fn(async () => ({ size: 3 })), get: vi.fn() },
  };
  network = vi.fn(async (url) => {
    log.push(url === USERS_ME ? 'net:identity' : `net:${url}`);
    if (url === USERS_ME)
      return identityOk
        ? Response.json({ id: 3792015931, site_id: 'MLB', tags: ['test_user'] })
        : new Response(null, { status: 401 });
    if (url === ORDERS)
      return Response.json({
        id: mpId,
        status: 'created',
        status_detail: 'created',
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
      });
    throw new Error('Unexpected outbound call');
  });
  vi.stubGlobal('fetch', network);
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('checkout endpoint latency (phase 1)', () => {
  it('creates a new order with 4 database round trips instead of 7', async () => {
    const ctx = context();
    const response = await handleCommerce(post(), env, undefined, ctx);
    expect(response.status).toBe(200);
    expect((await response.json()).checkout_url).toContain(mpId);
    // rate limit, order read (parallel with file check), insert+read, update+read
    expect(trips()).toEqual(['db:first:INSERT', 'db:first:SELECT', 'db:batch:2', 'db:batch:2']);
    // Rate-limit housekeeping moved off the critical path, still executed.
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    await Promise.all(ctx.pending);
    expect(log).toContain('db:run:DELETE');
  });

  it('stores exactly the same order as the sequential path', async () => {
    expect((await handleCommerce(post(), env, undefined, context())).status).toBe(200);
    const batched = db.prepare('SELECT * FROM commerce_orders').get();
    db.close();
    db = new DatabaseSync(':memory:');
    for (const name of [
      '0001_orders.sql',
      '0002_delivery_safety.sql',
      '0003_download_attempts.sql',
    ])
      db.exec(migration(name));
    env.COMMERCE_DB = fakeD1({ batch: false });
    expect((await handleCommerce(post(), env)).status).toBe(200);
    const sequential = db.prepare('SELECT * FROM commerce_orders').get();
    const stable = ({ created_at, access_expires, ...row }) => ({
      ...row,
      window: access_expires - created_at,
    });
    expect(stable(batched)).toEqual(stable(sequential));
    expect(batched).toMatchObject({ mp_id: mpId, status: 'created', product_id: 'planner-treino' });
  });

  it('keeps awaiting housekeeping when the caller passes no execution context', async () => {
    expect((await handleCommerce(post(), env)).status).toBe(200);
    expect(log).toContain('db:run:DELETE');
  });

  it('starts the identity check before the order is written, and finishes it before Mercado Pago', async () => {
    expect((await handleCommerce(post(), env, undefined, context())).status).toBe(200);
    const identity = log.indexOf('net:identity');
    expect(identity).toBeGreaterThan(-1);
    expect(identity).toBeLessThan(log.indexOf('db:batch:2'));
    expect(identity).toBeLessThan(log.indexOf(`net:${ORDERS}`));
  });

  it('verifies the seller identity on every request (no cache), including resumed orders', async () => {
    await handleCommerce(post(), env, undefined, context());
    await handleCommerce(post(), env, undefined, context());
    await handleCommerce(post(), env, undefined, context());
    expect(network.mock.calls.filter(([url]) => url === USERS_ME)).toHaveLength(3);
    // Idempotency: one Mercado Pago order for the three requests.
    expect(network.mock.calls.filter(([url]) => url === ORDERS)).toHaveLength(1);
  });

  it('never calls Mercado Pago or returns a checkout URL when the identity check fails', async () => {
    identityOk = false;
    const response = await handleCommerce(post(), env, undefined, context());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('checkout_url');
    expect(network.mock.calls.some(([url]) => url === ORDERS)).toBe(false);
    expect(
      db.prepare('SELECT checkout_url FROM commerce_orders').get()?.checkout_url ?? null,
    ).toBeNull();
  });

  it('does not reuse a stored checkout URL when the identity check later fails', async () => {
    expect((await handleCommerce(post(), env, undefined, context())).status).toBe(200);
    identityOk = false;
    const response = await handleCommerce(post(), env, undefined, context());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('mercadopago.com.br');
  });

  it('refuses a new order when the product file is missing, without calling Mercado Pago', async () => {
    env.DIGITAL_PRODUCTS.head.mockResolvedValue(null);
    const response = await handleCommerce(post(), env, undefined, context());
    expect(response.status).toBe(503);
    expect(network.mock.calls.some(([url]) => url === ORDERS)).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM commerce_orders').get().n).toBe(0);
  });

  it('resumes an existing order even if the file check fails transiently', async () => {
    expect((await handleCommerce(post(), env, undefined, context())).status).toBe(200);
    env.DIGITAL_PRODUCTS.head.mockRejectedValue(new Error('storage hiccup'));
    const response = await handleCommerce(post(), env, undefined, context());
    expect(response.status).toBe(200);
    expect((await response.json()).checkout_url).toContain(mpId);
  });
});
