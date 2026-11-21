// Pix on the checkout and order pages (staging): hidden unless the catalog enables it,
// QR + copy-paste while open, automatic refresh until paid, D1 partial refund keeps access.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
import { orderState } from '../src/lib/commerce-status';

const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const token = 'ab'.repeat(32);
const product = {
  id: 'meu-dinheiro-minhas-regras',
  title: 'Meu Dinheiro, Minhas Regras',
  amount: '47.00',
  currency: 'BRL',
  available: true,
  coming_soon: false,
};
const pixOrder = (extra = {}) => ({
  order_id: id,
  product_id: product.id,
  title: product.title,
  amount: '47.00',
  currency: 'BRL',
  status: 'action_required',
  status_detail: 'waiting_transfer',
  paid: false,
  delivery_blocked: false,
  delivery: 'notion',
  payment_method: 'pix',
  access_expires: Date.now() + 86400000,
  pix: {
    qr_code: '00020126580014br.gov.bcb.pix-test',
    qr_code_base64: 'iVBORw0KGgo=',
    expires_at: Date.now() + 1800000,
  },
  ...extra,
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const renderAt = (query) =>
  render(
    <MemoryRouter initialEntries={[`/checkout?${query}`]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Pix UI', () => {
  it('is not offered when the catalog does not enable Pix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ mode: 'production', products: [product] })),
    );
    renderAt(`produto=${product.id}`);
    await screen.findByText('Continuar para o pagamento');
    expect(screen.queryByText('Pagar com Pix')).toBeNull();
  });

  it('creates the Pix with the e-mail and opens the order page with the QR code', async () => {
    const fetch = vi.fn(async (url) => {
      if (url === '/api/commerce/catalog')
        return json({ mode: 'test', pix: true, products: [product] });
      if (url === '/api/commerce/pix') return json(pixOrder(), 201);
      return json(pixOrder());
    });
    vi.stubGlobal('fetch', fetch);
    renderAt(`produto=${product.id}`);
    await userEvent.type(
      await screen.findByLabelText('E-mail para o comprovante'),
      'teste@example.com',
    );
    await userEvent.click(screen.getByText('Pagar com Pix'));
    expect(await screen.findByAltText('QR Code do Pix deste pedido')).toBeTruthy();
    expect(screen.getByLabelText('Pix Copia e Cola').value).toBe(
      '00020126580014br.gov.bcb.pix-test',
    );
    const [, init] = fetch.mock.calls.find(([url]) => url === '/api/commerce/pix');
    expect(JSON.parse(init.body)).toEqual({
      product_id: product.id,
      email: 'teste@example.com',
      test_approve: true,
    });
    expect(init.headers.Authorization).toMatch(/^Bearer [a-f0-9]{64}$/);
    expect(init.headers['Idempotency-Key']).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(localStorage)).not.toContain('teste@example.com');
  });

  it('refreshes the open Pix and shows the Notion access once the server confirms it', async () => {
    localStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({ id, token, product: product.id, created: Date.now() }),
    );
    let paid = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(
          paid
            ? pixOrder({ paid: true, status: 'processed', status_detail: 'accredited', pix: null })
            : pixOrder(),
        ),
      ),
    );
    renderAt(`pedido=${id}`);
    await screen.findByText('Copiar código');
    paid = true;
    await waitFor(() => expect(screen.getByText('Acessar meu template no Notion')).toBeTruthy(), {
      timeout: 7000,
    });
  }, 10000);

  it('keeps a partially refunded Pix order approved (D1) but not a Checkout Pro one', () => {
    const partial = {
      paid: true,
      status: 'processed',
      status_detail: 'partially_refunded',
      delivery_blocked: false,
    };
    expect(orderState({ ...partial, payment_method: 'pix' })).toBe('approved');
    expect(orderState(partial)).toBe('refunded');
    expect(orderState({ ...partial, payment_method: 'pix', paid: false, status: 'refunded' })).toBe(
      'refunded',
    );
  });
});
