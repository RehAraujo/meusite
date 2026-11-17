import { BLOCKED_SQL } from './safety.js';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const validDownloadAttempt = (id) => typeof id === 'string' && UUID.test(id);

// INSERT + trigger are one atomic SQLite operation. Concurrent retries cannot count twice.
// Authorization, payment reconciliation and R2 existence must be checked BEFORE calling.
export async function reserveDownload(env, orderId, attemptId, now = Date.now()) {
  if (!validDownloadAttempt(attemptId)) return false;
  await env.COMMERCE_DB.prepare(
    `INSERT OR IGNORE INTO commerce_download_attempts (order_id,attempt_id,authorized_at)
     SELECT id,?,? FROM commerce_orders
     WHERE id=? AND status='processed' AND status_detail='accredited'
       AND access_expires>? AND NOT ${BLOCKED_SQL}
       AND (downloads<10 OR EXISTS (SELECT 1 FROM commerce_download_attempts a WHERE a.order_id=commerce_orders.id AND a.attempt_id=?))`,
  ).bind(attemptId, now, orderId, now, attemptId).run();
  return !!(await env.COMMERCE_DB.prepare(
    `SELECT a.attempt_id FROM commerce_download_attempts a JOIN commerce_orders ON commerce_orders.id=a.order_id
     WHERE a.order_id=? AND a.attempt_id=? AND status='processed' AND status_detail='accredited'
       AND access_expires>? AND NOT ${BLOCKED_SQL}`,
  ).bind(orderId, attemptId, now).first());
}
