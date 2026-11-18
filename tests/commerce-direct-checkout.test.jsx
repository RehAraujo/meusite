// Landing CTA → integrated checkout → Mercado Pago in one click, with the summary page
// as fallback; buyer-facing messages per order state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FinanceProductPage from '../src/pages/FinanceProductPage';
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
