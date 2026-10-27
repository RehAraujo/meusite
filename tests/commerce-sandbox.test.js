// @vitest-environment node
// Offline integration exercise: no environment files, sockets, Cloudflare or provider calls.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { log } from 'node:console';
import { randomBytes, randomUUID, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.js';
import { it } from 'vitest';

it('exercises the Worker offline with disposable storage and synthetic credentials', async () => {
  const config = JSON.parse(
    readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(
      /^\s*\/\/.*$/gm,
      '',
    ),
  );
  assert.equal(config.vars.COMMERCE_MODE, 'disabled');
  assert.equal(config.env.staging.vars.COMMERCE_MODE, 'disabled');
  const productionDb = config.d1_databases.find((db) => db.binding === 'DIAGNOSTICS_DB');
  const commerceDb = config.env.staging.d1_databases.find((db) => db.binding === 'COMMERCE_DB');
  assert.notEqual(commerceDb.database_id, productionDb.database_id);
  assert.equal(commerceDb.migrations_dir, 'migrations/commerce');
  assert.equal(commerceDb.remote, false);
  assert.ok(
    config.env.staging.routes.every(
      (route) => route.pattern === 'homologacao.renatajoin.com' && route.custom_domain === true,
    ),
  );
  assert.equal(
    config.env.staging.r2_buckets.find((b) => b.binding === 'DIGITAL_PRODUCTS').bucket_name,
    'meusite-digital-products-staging',
  );
  assert.ok(!config.r2_buckets?.some((b) => b.binding === 'DIGITAL_PRODUCTS'));
  assert.ok(config.assets.run_worker_first.includes('/api/commerce/*'));
  log('OK: configuração local distingue D1 de produção/staging e mantém checkout desativado.');

  const db = new DatabaseSync(':memory:');
  const diagnosticsDb = new DatabaseSync(':memory:');
  const originalFetch = globalThis.fetch;
  const origin = 'https://commerce.local.invalid';
  const id = randomUUID();
  const access = randomBytes(32).toString('hex');
  const providerId = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
  let providerCalls = 0;
  let remoteUpdated = Date.now() - 60000;
  let state = { status: 'created', status_detail: 'created', total_paid_amount: '0.00' };
  // Valid empty ZIP fixture. It deliberately contains no product and no Notion links.
  const fixture = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
  const objects = new Map([
    ['products/planner-alimentar/v1.zip', fixture],
    ['products/planner-treino/v1.zip', fixture],
  ]);
  const env = {
    COMMERCE_ENVIRONMENT: 'staging',
    COMMERCE_MODE: 'test',
    COMMERCE_ORIGIN: origin,
    MERCADOPAGO_ACCESS_TOKEN: `TEST-${randomBytes(32).toString('hex')}`,
    MERCADOPAGO_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
    DIAGNOSTICS_DB: {
      prepare() {
        throw new Error('Commerce must not access diagnostic storage');
      },
    },
    COMMERCE_DB: {
      prepare(sql) {
        const statement = db.prepare(sql);
        return {
          bind(...args) {
            return {
              first: async () => statement.get(...args) || null,
              run: async () => statement.run(...args),
            };
          },
        };
      },
    },
    DIGITAL_PRODUCTS: {
      head: async (key) => (objects.has(key) ? { size: objects.get(key).length } : null),
      get: async (key) => (objects.has(key) ? { body: new Uint8Array(objects.get(key)) } : null),
    },
    ASSETS: { fetch: async () => new Response('isolated-static-fixture') },
  };
  function request(path, options = {}) {
    return new Request(`${origin}${path}`, {
      ...options,
      headers: {
        Origin: origin,
        Authorization: `Bearer ${access}`,
        'Idempotency-Key': id,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }
  const run = (path, options) => worker.fetch(request(path, options), env);
  async function webhook() {
    const ts = String(Date.now()),
      requestId = randomUUID();
    const key = await webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.MERCADOPAGO_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await webcrypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`id:${providerId.toLowerCase()};request-id:${requestId};ts:${ts};`),
    );
    return run(`/api/commerce/webhook?data.id=${providerId}&type=order`, {
      method: 'POST',
      headers: {
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${Buffer.from(signature).toString('hex')}`,
      },
      body: JSON.stringify({ type: 'order', data: { id: providerId }, live_mode: false }),
    });
  }
  try {
    diagnosticsDb.exec(
      readFileSync(new URL('../migrations/0001_controlled_mvp.sql', import.meta.url), 'utf8'),
    );
    for (const migration of ['commerce/0001_orders.sql', 'commerce/0002_delivery_safety.sql']) {
      const sql = readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8');
      db.exec(sql);
      db.exec(sql);
    }
    assert.equal(db.prepare('PRAGMA database_list').get().file, '');
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    log('OK: migrações compatíveis e repetíveis em SQLite somente em memória; nada remoto.');
    // Every provider request terminates HERE. There is intentionally no real-fetch fallback.
    globalThis.fetch = async (url, options = {}) => {
      assert.equal(options.headers.Authorization, `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`);
      assert.equal(options.redirect, 'error');
      providerCalls++;
      if (url === 'https://api.mercadopago.com/v1/orders' && options.method === 'POST') {
        const input = JSON.parse(options.body);
        assert.equal(options.headers['X-Idempotency-Key'], id);
        assert.equal(input.total_amount, '25.00');
        assert.equal(input.external_reference, id);
        return Response.json({
          id: providerId,
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${providerId}`,
        });
      }
      assert.equal(url, `https://api.mercadopago.com/v1/orders/${providerId}`);
      assert.ok(!options.method || options.method === 'GET');
      return Response.json({
        id: providerId,
        type: 'online',
        external_reference: id,
        currency: 'BRL',
        total_amount: '25.00',
        last_updated_date: new Date(++remoteUpdated).toISOString(),
        ...state,
      });
    };
    assert.equal((await run('/')).status, 200);
    assert.equal(await (await run('/')).text(), 'isolated-static-fixture');
    assert.equal((await run('/wrangler.jsonc')).status, 404);
    assert.equal((await run('/api/commerce/catalog')).status, 200);
    for (const credential of ['', 'APP_USR-unverified']) {
      const original = env.MERCADOPAGO_ACCESS_TOKEN;
      env.MERCADOPAGO_ACCESS_TOKEN = credential;
      assert.equal(
        (await run('/api/commerce/checkout', { method: 'POST', body: '{}' })).status,
        503,
      );
      env.MERCADOPAGO_ACCESS_TOKEN = original;
    }
    assert.equal(providerCalls, 0);
    const create = () =>
      run('/api/commerce/checkout', {
        method: 'POST',
        body: JSON.stringify({ product_id: 'planner-treino' }),
      });
    assert.equal((await create()).status, 200);
    assert.equal((await create()).status, 200);
    assert.equal(providerCalls, 1);
    assert.equal((await run(`/api/commerce/orders/${id}/download`)).status, 403);
    state = { status: 'processed', status_detail: 'accredited', total_paid_amount: '25.00' };
    assert.equal((await webhook()).status, 200);
    const download = await run(`/api/commerce/orders/${id}/download`);
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), fixture);
    assert.match(download.headers.get('Cache-Control'), /no-store/);
    assert.equal(
      (
        await run(`/api/commerce/orders/${id}/download`, {
          headers: { Authorization: 'Bearer invalid' },
        })
      ).status,
      404,
    );
    state = { status: 'refunded', status_detail: 'refunded', total_paid_amount: '0.00' };
    assert.equal((await webhook()).status, 200);
    assert.equal((await run(`/api/commerce/orders/${id}/download`)).status, 403);
    assert.equal(diagnosticsDb.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM commerce_orders').get().n, 1);
    assert.equal(db.prepare('SELECT downloads FROM commerce_orders').get().downloads, 1);
    log('OK: Worker → pedido → webhook HMAC → ZIP privado → estorno; diagnóstico intacto.');
    log(
      'OK: recursos locais descartáveis, segredos sintéticos não exibidos e zero chamadas externas.',
    );
    log(
      'Limite: adaptadores locais de D1/R2 não equivalem à homologação no runtime da Cloudflare.',
    );
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
    diagnosticsDb.close();
  }
});
