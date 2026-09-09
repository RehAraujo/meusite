import { describe, expect, it, vi } from 'vitest';
import { handleDiagnostics } from '../worker/diagnostics/handler.js';

// In-memory D1 sufficient for the /process and QA POST paths.
function memoryEnv({ status = 'CREATED', send } = {}) {
  const order = {
    order_id: 'order.11112222', customer_id: 'customer.1', product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
    selected_channels: JSON.stringify(['INSTAGRAM', 'SITE']), desired_perceptions: JSON.stringify(['confiável']),
    status, access_token: 'tok', created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:00.000Z',
  };
  const artifacts = [];
  const audits = [];
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...v) { args = v; return this; },
        async first() {
          if (sql.includes('FROM orders WHERE order_id')) return args[0] === order.order_id ? { ...order } : null;
          if (sql.includes('FROM customers WHERE customer_id')) return { name: 'Cliente', email: 'c@example.com' };
          if (sql.includes('SELECT event_hash')) return audits.length ? { event_hash: audits.at(-1).event_hash } : null;
          if (sql.includes('SELECT payload_json FROM artifacts')) {
            const rows = artifacts.filter((r) => r.order_id === args[0] && r.type === args[1]);
            return rows.length ? { payload_json: rows.at(-1).payload_json } : null;
          }
          return null;
        },
        async all() {
          if (sql.includes('SELECT payload_json FROM artifacts')) {
            return { results: artifacts.filter((r) => r.order_id === args[0] && r.type === args[1]).map((r) => ({ payload_json: r.payload_json })) };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT OR REPLACE INTO artifacts')) artifacts.push({ artifact_id: args[0], order_id: args[1], type: args[2], payload_json: args[3], created_at: args[4] });
          if (sql.includes('INSERT INTO audit_events')) audits.push({ action: args[4], event_hash: args[9] });
          if (sql.startsWith('UPDATE orders SET status')) { if (order.status === args[3]) order.status = args[0]; }
          return { success: true };
        },
      };
    },
  };
  return {
    _order: order, _audits: audits, _artifacts: artifacts,
    QA_SECRET: 'qa-secret',
    DIAGNOSTICS_DB: db,
    CONTROLLED_MVP_QUEUE: { send },
  };
}

const req = (method, headers, body) => ({
  method,
  headers: new Headers(headers),
  json: async () => body ?? {},
});
const url = (path) => new URL(`https://x/api/diagnostics${path}`);

describe('enqueue is awaited before the response', () => {
  it('/process: the queue send completes before 202 QUEUED is returned', async () => {
    const events = [];
    const send = vi.fn(async () => { await new Promise((r) => setTimeout(r, 15)); events.push('sent'); });
    const env = memoryEnv({ status: 'CREATED', send });

    const res = await handleDiagnostics(req('POST', { Authorization: 'Bearer tok' }), env, url('/orders/order.11112222/process'));
    const body = await res.json();

    // If the send were fire-and-forget, handleDiagnostics would resolve before the 15ms timer,
    // so `events` would still be empty here. Awaited => 'sent' is already recorded.
    expect(events).toEqual(['sent']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ order_id: 'order.11112222' });
    expect(res.status).toBe(202);
    expect(body).toEqual({ status: 'QUEUED' });
  });

  it('REQUEST_REPROCESSING: the queue send completes before the response is returned', async () => {
    const events = [];
    const send = vi.fn(async () => { await new Promise((r) => setTimeout(r, 15)); events.push('sent'); });
    const env = memoryEnv({ status: 'PENDING_HUMAN_REVIEW', send });

    const res = await handleDiagnostics(
      req('POST', { 'X-QA-Secret': 'qa-secret' }, { action: 'REQUEST_REPROCESSING', note: 'reprocessar' }),
      env, url('/qa/order.11112222'),
    );
    const body = await res.json();

    expect(events).toEqual(['sent']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ order_id: 'order.11112222' });
    expect(body.status).toBe('REPROCESSING');
    expect(env._audits.some((a) => a.action === 'STATE_CHANGED')).toBe(true);
  });

  it('a failing Queue.send() never yields a false QUEUED response', async () => {
    const send = vi.fn(async () => { throw new Error('queue unavailable'); });
    const env = memoryEnv({ status: 'CREATED', send });

    await expect(
      handleDiagnostics(req('POST', { Authorization: 'Bearer tok' }), env, url('/orders/order.11112222/process')),
    ).rejects.toThrow('queue unavailable');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('happy path unchanged: working enqueue still returns 202 QUEUED with the order id', async () => {
    const send = vi.fn(async () => {});
    const env = memoryEnv({ status: 'CREATED', send });

    const res = await handleDiagnostics(req('POST', { Authorization: 'Bearer tok' }), env, url('/orders/order.11112222/process'));
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toEqual({ status: 'QUEUED' });
    expect(send).toHaveBeenCalledExactlyOnceWith({ order_id: 'order.11112222' });
    // /process only enqueues — it must not itself transition the order.
    expect(env._order.status).toBe('CREATED');
    expect(env._audits).toHaveLength(0);
  });

  it('unauthorised /process never reaches the queue', async () => {
    const send = vi.fn(async () => {});
    const env = memoryEnv({ status: 'CREATED', send });
    const res = await handleDiagnostics(req('POST', { Authorization: 'Bearer wrong' }), env, url('/orders/order.11112222/process'));
    expect(res.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
});
