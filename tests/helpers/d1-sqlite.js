// Minimal Cloudflare D1 binding over node:sqlite for tests: prepare/bind/first/run/all and
// batch() as one transaction (all or nothing), with foreign keys enforced like D1.
// Every call yields to the event loop first, so Promise.all interleaves operations the
// way concurrent Worker requests would.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const MIGRATIONS = [
  '0001_orders.sql',
  '0002_delivery_safety.sql',
  '0003_download_attempts.sql',
  '0004_payment_ledger.sql',
];

export function createD1({ migrations = MIGRATIONS } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of migrations) {
    db.exec(readFileSync(new URL(`../../migrations/commerce/${file}`, import.meta.url), 'utf8'));
  }
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const execute = (sql, args, mode) => {
    const statement = db.prepare(sql);
    if (mode === 'first') return statement.get(...args) || null;
    if (mode === 'all') return { results: statement.all(...args) };
    const info = statement.run(...args);
    return { meta: { changes: Number(info.changes) } };
  };
  const bound = (sql, args) => ({
    sql,
    args,
    first: async () => (await tick(), execute(sql, args, 'first')),
    run: async () => (await tick(), execute(sql, args, 'run')),
    all: async () => (await tick(), execute(sql, args, 'all')),
  });
  const binding = {
    prepare(sql) {
      return { ...bound(sql, []), bind: (...args) => bound(sql, args) };
    },
    async batch(statements) {
      await tick();
      db.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((s) => {
          const mode = /^\s*(SELECT|WITH)/i.test(s.sql) ? 'all' : 'run';
          return execute(s.sql, s.args, mode);
        });
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { db, binding };
}
