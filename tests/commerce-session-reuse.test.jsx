// A pending purchase is resumed only within 30 minutes: repeated clicks never duplicate an
// order, and an old or expired pending order is never reopened.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
import {
  PENDING_REUSE_MS,
  navigatePayment,
  prepareCommerceSession,
} from '../src/lib/commerce-session';
import { startCheckout } from '../src/lib/commerce-checkout';
import { STATUS_TEXT, orderState } from '../src/lib/commerce-status';
import { createJsonStream, safeSummary } from '../scripts/commerce-safe-tail.mjs';

vi.mock('../src/lib/commerce-session', async (original) => ({
  ...(await original()),
  navigatePayment: vi.fn(),
}));

const PRODUCT = 'meu-dinheiro-minhas-regras';
const ORDER = 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const age = (session, ms) => {
  localStorage.setItem(
    `commerce:${session.id}`,
    JSON.stringify({ ...session, created: Date.now() - ms }),
  );
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('pending order reuse window', () => {
  it('is 30 minutes', () => {
    expect(PENDING_REUSE_MS).toBe(30 * 60000);
  });

  it('reuses the same order for repeated clicks within 30 minutes', () => {
    const first = prepareCommerceSession(PRODUCT);
    age(first, 29 * 60000);
    expect(prepareCommerceSession(PRODUCT).id).toBe(first.id);
  });

  it('creates a new order instead of reopening a pending one older than 30 minutes', () => {
    const first = prepareCommerceSession(PRODUCT);
    age(first, 31 * 60000);
    const next = prepareCommerceSession(PRODUCT);
    expect(next.id).not.toBe(first.id);
    expect(localStorage.getItem(`commerce:pending:${PRODUCT}`)).toBe(next.id);
  });

  it('never reopens the 18-hour-old test order that caused the production incident', () => {
    const stale = prepareCommerceSession(PRODUCT);
    age(stale, 18 * 3600000);
    expect(prepareCommerceSession(PRODUCT).id).not.toBe(stale.id);
  });

  it('sends one order per burst of clicks (in-flight guard + same idempotency key)', async () => {
    const keys = [];
    let release;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((resolve) => {
            keys.push(options.headers['Idempotency-Key']);
            release = () =>
              resolve(
                json({
                  order_id: options.headers['Idempotency-Key'],
                  environment: 'production',
                  checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
                }),
              );
          }),
      ),
    );
    const clicks = [startCheckout(PRODUCT), startCheckout(PRODUCT), startCheckout(PRODUCT)];
    await waitFor(() => expect(keys).toHaveLength(1));
    release();
    await Promise.all(clicks);
    expect(navigatePayment).toHaveBeenCalledTimes(1);
    const later = startCheckout(PRODUCT);
    await waitFor(() => expect(keys).toHaveLength(2));
    release();
    await later; // a later click within 30 minutes: same order
    expect(new Set(keys).size).toBe(1);
  });
});

describe('expired order', () => {
  const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
  const view = {
    order_id: id,
    product_id: PRODUCT,
    title: 'Meu Dinheiro, Minhas Regras',
    amount: '47.00',
    currency: 'BRL',
    status: 'canceled',
    status_detail: 'expired',
    paid: false,
    delivery_blocked: false,
    block: null,
    can_retry: false,
    delivery: 'notion',
    access_expires: Date.now() + 86400000,
  };

  it('is classified as expired, not as a declined payment', () => {
    expect(orderState(view)).toBe('expired');
    expect(orderState({ ...view, status: 'expired', status_detail: 'expired' })).toBe('expired');
    expect(orderState({ ...view, status_detail: 'canceled' })).toBe('failed');
    expect(STATUS_TEXT.expired).toBe('Este pedido expirou sem pagamento. Faça um novo pedido.');
  });

  it('offers a new order (never the expired checkout) and hides saved access', async () => {
    localStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({
        id,
        token: 'ab'.repeat(32),
        product: PRODUCT,
        created: Date.now() - 600000,
      }),
    );
    localStorage.setItem(`commerce:pending:${PRODUCT}`, id);
    const fetch = vi.fn(async (url, options) =>
      url === '/api/commerce/checkout'
        ? json({
            order_id: options.headers['Idempotency-Key'],
            environment: 'production',
            checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
          })
        : json(view),
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <MemoryRouter initialEntries={[`/checkout?pedido=${id}`]}>
        <CheckoutPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(STATUS_TEXT.expired)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Copiar link de acesso/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fazer novo pedido/ }));
    await waitFor(() => expect(navigatePayment).toHaveBeenCalled());
    const post = fetch.mock.calls.find(([url]) => url === '/api/commerce/checkout');
    expect(post[1].headers['Idempotency-Key']).not.toBe(id);
  });
});

describe('safe log filter', () => {
  const tailEvent = {
    outcome: 'ok',
    event: {
      request: {
        url: 'https://shopping.renatajoin.com/api/commerce/orders/32a6f0a0-2759-4ca1-a1be-c808c34921d1?data.id=ORD1',
        method: 'GET',
        headers: { authorization: `Bearer ${'ab'.repeat(32)}`, 'cf-connecting-ip': '203.0.113.9' },
      },
      response: { status: 200 },
    },
    logs: [
      {
        message: [
          JSON.stringify({ event: 'order_confirmed_by_pull', order: '32a6f0a0', secret: 'x' }),
        ],
      },
      { message: ['free text with buyer@example.com'] },
    ],
  };

  it('parses pretty multi-line JSON and keeps only safe fields', () => {
    const out = [];
    const push = createJsonStream((value) => out.push(safeSummary(value)));
    const pretty = JSON.stringify(tailEvent, null, 2);
    push(pretty.slice(0, 40));
    push(
      `${pretty.slice(40)}\n${JSON.stringify({ event: { request: { url: 'https://x.invalid/' } } }, null, 2)}`,
    );
    expect(out[0]).toEqual({
      method: 'GET',
      path: '/api/commerce/orders/<id>',
      status: 200,
      outcome: 'ok',
      events: [{ event: 'order_confirmed_by_pull', order: '32a6f0a0' }],
    });
    expect(out[1]).toBeNull();
    const text = JSON.stringify(out);
    for (const secret of [
      'Bearer',
      'abab',
      '203.0.113.9',
      'buyer@example.com',
      'data.id',
      '32a6f0a0-2759',
    ])
      expect(text).not.toContain(secret);
  });

  it('handles braces inside strings', () => {
    const out = [];
    const push = createJsonStream((value) => out.push(value));
    push('{"a":"} { \\" }","b":{"c":1}}{"d":2}');
    expect(out).toEqual([{ a: '} { " }', b: { c: 1 } }, { d: 2 }]);
  });
});
