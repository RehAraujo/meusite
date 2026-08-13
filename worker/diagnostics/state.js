import { TRANSITIONS } from './constants.js';
import { hash, id, now } from './utils.js';

export async function audit(env, orderId, actorType, action, entityType, reason, change = null) {
  const previous = await env.DIAGNOSTICS_DB.prepare(
    'SELECT event_hash FROM audit_events WHERE order_id = ? ORDER BY occurred_at DESC LIMIT 1',
  )
    .bind(orderId)
    .first();
  const eventId = id('audit'),
    occurredAt = now(),
    previousHash = previous?.event_hash || null;
  const eventHash = await hash(
    JSON.stringify({
      eventId,
      occurredAt,
      orderId,
      actorType,
      action,
      entityType,
      reason,
      change,
      previousHash,
    }),
  );
  await env.DIAGNOSTICS_DB.prepare(
    'INSERT INTO audit_events (event_id, order_id, occurred_at, actor_type, action, entity_type, reason, change_json, previous_event_hash, event_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      eventId,
      orderId,
      occurredAt,
      actorType,
      action,
      entityType,
      reason,
      change ? JSON.stringify(change) : null,
      previousHash,
      eventHash,
    )
    .run();
}

export async function transition(env, order, next, reason, actor = 'SYSTEM') {
  if (!TRANSITIONS[order.status]?.includes(next))
    throw new Error(`Transição inválida: ${order.status} → ${next}`);
  await env.DIAGNOSTICS_DB.prepare(
    'UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ? AND status = ?',
  )
    .bind(next, now(), order.order_id, order.status)
    .run();
  await audit(env, order.order_id, actor, 'STATE_CHANGED', 'ORDER', reason, {
    before: order.status,
    after: next,
  });
  order.status = next;
}
