// Landing CTA → integrated checkout → Mercado Pago in one click, with the summary page
// as fallback; buyer-facing messages per order state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FinanceProductPage from '../src/pages/FinanceProductPage';
import CheckoutPage from '../src/pages/CheckoutPage';
import { navigatePayment } from '../src/lib/commerce-session';
import { STATUS_TEXT, orderState, orderStatusText } from '../src/lib/commerce-status';

vi.mock('../src/lib/commerce-session', async (original) => ({
  ...(await original()),
  navigatePayment: vi.fn(),
}));

const ORDER = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function landing() {
  return render(
    <MemoryRouter initialEntries={['/meu-dinheiro-minhas-regras']}>
      <Routes>
        <Route path="/meu-dinheiro-minhas-regras" element={<FinanceProductPage />} />
        <Route path="/checkout" element={<p>Página de resumo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const cta = () => screen.getAllByRole('link', { name: /Quero organizar meu dinheiro/ })[0];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('direct checkout from the landing', () => {
  it('creates the order on the server and goes straight to the validated Mercado Pago URL', async () => {
    const fetch = vi.fn(async (_url, options) => {
      const id = options.headers['Idempotency-Key'];
      return json({
        order_id: id,
        environment: 'staging',
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
      });
    });
    vi.stubGlobal('fetch', fetch);
    landing();
    fireEvent.click(cta());
    await waitFor(() =>
      expect(navigatePayment).toHaveBeenCalledWith(
        `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
      ),
    );
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/commerce/checkout');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toMatch(/^Bearer [a-f0-9]{64}$/);
    expect(JSON.parse(options.body)).toEqual({ product_id: 'meu-dinheiro-minhas-regras' });
    // The buyer token is persisted before leaving, so the return page can authenticate.
    expect(localStorage.getItem(`commerce:${options.headers['Idempotency-Key']}`)).toContain(
      'token',
    );
    expect(screen.queryByText('Página de resumo')).toBeNull();
  });

  it('falls back to the summary page when the checkout is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ message: 'Checkout temporariamente indisponível.' }, 503)),
    );
    landing();
    fireEvent.click(cta());
    expect(await screen.findByText('Página de resumo')).toBeTruthy();
    expect(navigatePayment).not.toHaveBeenCalled();
  });

  it('refuses a forged provider redirect and falls back instead of leaving the site', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) =>
        json({
          order_id: options.headers['Idempotency-Key'],
          environment: 'staging',
          checkout_url: 'https://evil.example/pay',
        }),
      ),
    );
    landing();
    fireEvent.click(cta());
    expect(await screen.findByText('Página de resumo')).toBeTruthy();
    expect(navigatePayment).not.toHaveBeenCalled();
  });

  it('reuses the same pending order on a second click instead of creating a duplicate', async () => {
    const keys = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        keys.push(options.headers['Idempotency-Key']);
        return json({
          order_id: options.headers['Idempotency-Key'],
          environment: 'staging',
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
        });
      }),
    );
    landing();
    fireEvent.click(cta());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getAllByRole('link', { name: /Quero meu template/ })[0]);
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(2));
    expect(new Set(keys).size).toBe(1);
  });

  it('keeps the plain link for modified clicks (open in a new tab)', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    landing();
    fireEvent.click(cta(), { metaKey: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(cta().getAttribute('href')).toBe('/checkout?produto=meu-dinheiro-minhas-regras');
  });
});

describe('buyer-facing order states', () => {
  const base = {
    paid: false,
    delivery_blocked: false,
    block: null,
    can_retry: false,
    status: 'created',
    status_detail: 'created',
  };
  it.each([
    ['approved', { paid: true, status: 'processed', status_detail: 'accredited' }],
    ['pending', { status: 'processing', status_detail: 'in_process' }],
    ['pending', { status: 'action_required', status_detail: 'waiting_payment' }],
    ['retry', { status: 'action_required', status_detail: 'waiting_retry', can_retry: true }],
    ['pending', { status: 'action_required', status_detail: 'waiting_retry', can_retry: false }],
    ['failed', { status: 'failed', status_detail: 'rejected' }],
    ['failed', { status: 'canceled', status_detail: 'canceled' }],
    [
      'refunded',
      { status: 'refunded', status_detail: 'refunded', delivery_blocked: true, block: 'refund' },
    ],
    ['refunded', { paid: true, delivery_blocked: true, block: 'refund' }],
    ['blocked', { paid: true, delivery_blocked: true, block: 'security' }],
    ['blocked', { status: 'charged_back' }],
  ])('maps to %s', (expected, state) => {
    const order = { ...base, ...state };
    expect(orderState(order)).toBe(expected);
    expect(orderStatusText(order)).toBe(STATUS_TEXT[expected]);
  });

  it('uses the approved wording', () => {
    expect(STATUS_TEXT.approved).toBe('Pagamento confirmado. Seu acesso está liberado.');
    expect(STATUS_TEXT.refunded).toBe(
      'Pagamento reembolsado. O acesso a este pedido foi encerrado após o registro do reembolso.',
    );
    expect(STATUS_TEXT.blocked).toMatch(/temporariamente indisponível.*número do pedido/);
  });
});

describe('order page actions per state', () => {
  const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
  const token = 'ab'.repeat(32);
  const view = (extra) => ({
    order_id: id,
    product_id: 'meu-dinheiro-minhas-regras',
    title: 'Meu Dinheiro, Minhas Regras',
    amount: '47.00',
    currency: 'BRL',
    paid: false,
    delivery_blocked: false,
    block: null,
    can_retry: false,
    delivery: 'notion',
    access_expires: Date.now() + 86400000,
    ...extra,
  });
  const redirect = (orderId) =>
    json({
      order_id: orderId,
      environment: 'staging',
      checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
    });
  function orderPage() {
    return render(
      <MemoryRouter initialEntries={[`/checkout?pedido=${id}`]}>
        <CheckoutPage />
      </MemoryRouter>,
    );
  }
  beforeEach(() => {
    localStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({ id, token, product: 'meu-dinheiro-minhas-regras', created: Date.now() }),
    );
    localStorage.setItem('commerce:pending:meu-dinheiro-minhas-regras', id);
  });

  it('retries on the same Mercado Pago order when the provider allows it', async () => {
    const fetch = vi.fn(async (url, options) =>
      url === '/api/commerce/checkout'
        ? redirect(options.headers['Idempotency-Key'])
        : json(
            view({ status: 'action_required', status_detail: 'waiting_retry', can_retry: true }),
          ),
    );
    vi.stubGlobal('fetch', fetch);
    orderPage();
    expect(await screen.findByText(STATUS_TEXT.retry)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    await waitFor(() => expect(navigatePayment).toHaveBeenCalled());
    const post = fetch.mock.calls.find(([url]) => url === '/api/commerce/checkout');
    expect(post[1].headers['Idempotency-Key']).toBe(id);
    expect(post[1].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('creates a new order after a definitive failure instead of reopening the old one', async () => {
    const fetch = vi.fn(async (url, options) =>
      url === '/api/commerce/checkout'
        ? redirect(options.headers['Idempotency-Key'])
        : json(view({ status: 'failed', status_detail: 'rejected' })),
    );
    vi.stubGlobal('fetch', fetch);
    orderPage();
    expect(await screen.findByText(STATUS_TEXT.failed)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tentar novamente/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fazer novo pedido/ }));
    await waitFor(() => expect(navigatePayment).toHaveBeenCalled());
    const post = fetch.mock.calls.find(([url]) => url === '/api/commerce/checkout');
    expect(post[1].headers['Idempotency-Key']).not.toBe(id);
  });

  it('shows the refund message with no access, retry or saved-access actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(
          view({
            status: 'refunded',
            status_detail: 'refunded',
            delivery_blocked: true,
            block: 'refund',
          }),
        ),
      ),
    );
    orderPage();
    expect(await screen.findByText(STATUS_TEXT.refunded)).toBeTruthy();
    for (const name of [
      /Acessar meu template/,
      /Tentar novamente/,
      /Fazer novo pedido/,
      /Copiar link de acesso/,
    ])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('shows the support message for a security block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(view({ paid: true, delivery_blocked: true, block: 'security' }))),
    );
    orderPage();
    expect(await screen.findByText(STATUS_TEXT.blocked)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Acessar meu template/ })).toBeNull();
  });
});
