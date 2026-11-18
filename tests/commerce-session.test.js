import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  paymentTarget,
  prepareDownloadAttempt,
  completeDownloadAttempt,
  prepareCommerceSession,
  readCommerceSession,
} from '../src/lib/commerce-session';
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const mp = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const valid = () => ({
  id,
  token: 'ab'.repeat(32),
  product: 'planner-treino',
  created: Date.now(),
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it.each([
  { id: 'other' },
  { token: 'invalid' },
  { created: Date.now() + 86400000 },
  { created: 0 },
])('rejects invalid stored authorization: %j', (override) => {
  localStorage.setItem(`commerce:${id}`, JSON.stringify({ ...valid(), ...override }));
  expect(readCommerceSession(id)).toBeNull();
});
it('blocks storage silently dropping the session before any checkout', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  expect(() => prepareCommerceSession('planner-treino')).toThrow('commerce-session-unavailable');
});
it('refuses to reuse a session from another product', () => {
  localStorage.setItem('commerce:pending:planner-treino', id);
  localStorage.setItem(
    `commerce:${id}`,
    JSON.stringify({ ...valid(), product: 'planner-alimentar' }),
  );
  expect(() => prepareCommerceSession('planner-treino')).toThrow('commerce-session-unavailable');
});
it.each([
  `https://user@www.mercadopago.com.br/checkout/v1/redirect?order_id=${mp}`,
  `https://www.mercadopago.com.br.evil.invalid/checkout/v1/redirect?order_id=${mp}`,
  `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mp}&order_id=${mp}`,
  'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDREAL12345678901234567890',
])('denies unsafe handoff: %s', (checkout_url) => {
  expect(() => paymentTarget({ order_id: id, checkout_url }, valid())).toThrow('redirect');
});
it('binds provider response to the session that actually created this order', () => {
  expect(() =>
    paymentTarget(
      {
        order_id: 'another-order',
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mp}`,
      },
      valid(),
    ),
  ).toThrow('redirect');
});

it('allows a new explicit purchase after an expired pending session without reopening old access', () => {
  localStorage.setItem('commerce:pending:planner-treino', id);
  localStorage.setItem(
    `commerce:${id}`,
    JSON.stringify({ ...valid(), created: Date.now() - 8 * 86400000 }),
  );
  expect(readCommerceSession(id)).toBeNull();
  const next = prepareCommerceSession('planner-treino');
  expect(next.id).not.toBe(id);
  expect(next.product).toBe('planner-treino');
});

it('reuses an interrupted download attempt and creates a new attempt after receipt', () => {
  localStorage.setItem(`commerce:${id}`, JSON.stringify(valid()));
  const attempt = prepareDownloadAttempt(id);
  expect(prepareDownloadAttempt(id)).toBe(attempt);
  completeDownloadAttempt(id);
  expect(prepareDownloadAttempt(id)).not.toBe(attempt);
});
it('does not prepare downloads without a valid buyer session', () => {
  expect(() => prepareDownloadAttempt(id)).toThrow('session');
});
it('accepts production redirects only when explicitly identified and rejects mixed Orders', () => {
  const real = 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
  const result = { order_id: id, environment: 'production', checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${real}` };
  expect(paymentTarget(result, valid())).toContain(real);
  expect(() => paymentTarget({ ...result, environment: 'staging' }, valid())).toThrow('redirect');
  expect(() => paymentTarget({ ...result, checkout_url: result.checkout_url.replace(real, mp) }, valid())).toThrow('redirect');
});
