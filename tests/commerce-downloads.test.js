// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { reserveDownload } from '../worker/commerce/downloads.js';
let db, env, id;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const file of ['0001_orders', '0002_delivery_safety', '0003_download_attempts'])
    db.exec(readFileSync(new URL(`../migrations/commerce/${file}.sql`, import.meta.url), 'utf8'));
  id = randomUUID();
  db.prepare(`INSERT INTO commerce_orders (id,token_hash,product_id,product_title,amount_cents,currency,asset_key,filename,created_at,access_expires,status,status_detail,downloads) VALUES (?,'synthetic','product','Product',4700,'BRL','key','file.zip',1,?,'processed','accredited',2)`).run(id, Date.now()+60000);
  env = { COMMERCE_DB: { prepare(sql) { return { bind(...args) { return { run: async()=>db.prepare(sql).run(...args), first: async()=>db.prepare(sql).get(...args) }; } }; } } };
});
afterEach(()=>db.close());
const count=()=>db.prepare('SELECT downloads FROM commerce_orders WHERE id=?').get(id).downloads;
it('preserves history; concurrent same-key requests count once and a new attempt counts again', async()=>{
  const key=randomUUID();
  expect(await Promise.all([reserveDownload(env,id,key),reserveDownload(env,id,key)])).toEqual([true,true]);
  expect(count()).toBe(3);
  expect(await reserveDownload(env,id,randomUUID())).toBe(true);
  expect(count()).toBe(4);
  expect(db.prepare('SELECT count(*) AS n FROM commerce_download_attempts').get().n).toBe(2);
});
it('allows retry at limit but rejects a new attempt', async()=>{
  db.prepare('UPDATE commerce_orders SET downloads=9').run();
  const key=randomUUID();
  expect(await reserveDownload(env,id,key)).toBe(true);
  expect(await reserveDownload(env,id,key)).toBe(true);
  expect(await reserveDownload(env,id,randomUUID())).toBe(false);
  expect(count()).toBe(10);
});
it('does not allow replay after refund, expiration or a delivery hold', async()=>{
  const key=randomUUID(); await reserveDownload(env,id,key);
  db.prepare("UPDATE commerce_orders SET status='refunded'").run();
  expect(await reserveDownload(env,id,key)).toBe(false);
  db.prepare("UPDATE commerce_orders SET status='processed',access_expires=1").run();
  expect(await reserveDownload(env,id,key)).toBe(false);
  db.prepare('UPDATE commerce_orders SET access_expires=?').run(Date.now()+60000);
  db.prepare("INSERT INTO commerce_delivery_holds VALUES (?,'refund',?)").run(id,Date.now());
  expect(await reserveDownload(env,id,key)).toBe(false);
  expect(count()).toBe(3);
});
it('rejects invalid keys and missing orders without changing counts', async()=>{
  expect(await reserveDownload(env,id,'bad')).toBe(false);
  expect(await reserveDownload(env,randomUUID(),randomUUID())).toBe(false);
  expect(count()).toBe(2);
});
