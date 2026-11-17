import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
import { navigatePayment } from '../src/lib/commerce-session';
vi.mock('../src/lib/commerce-session', async (original) => ({
  ...(await original()),
  navigatePayment: vi.fn(),
}));
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const token = 'ab'.repeat(32);
const product = {
  id: 'planner-treino',
  title: 'Planner de Treino',
  amount: '25.00',
  available: true,
};
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
function page(query) {
  return render(
    <MemoryRouter initialEntries={[`/checkout?${query}`]}>
      <CheckoutPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('checkout experience', () => {
  it('disables purchase when checkout is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ products: [{ ...product, available: false }] })),
    );
    page('produto=planner-treino');
    expect(
      await screen.findByRole('button', { name: 'Checkout temporariamente indisponível' }),
    ).toBeDisabled();
  });
  it('persists a secure retry before a failing checkout request and reuses it', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (url) =>
      url.endsWith('/catalog') ? response({ products: [product] }) : response({}, 503),
    );
    vi.stubGlobal('fetch', fetch);
    page('produto=planner-treino');
    await user.click(await screen.findByRole('button', { name: 'Continuar no Mercado Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('tentativa será reutilizada');
    await user.click(screen.getByRole('button', { name: 'Continuar no Mercado Pago' }));
    const attempts = fetch.mock.calls.filter(([url]) => url.endsWith('/checkout'));
    expect(attempts).toHaveLength(2);
    expect(attempts[0][1]).toEqual(attempts[1][1]);
    const key = attempts[0][1].headers['Idempotency-Key'];
    const session = JSON.parse(sessionStorage.getItem(`commerce:${key}`));
    expect(session.token).toMatch(/^[a-f0-9]{64}$/);
    expect(attempts[0][0]).not.toContain(session.token);
    expect(attempts[0][1].body).toBe('{"product_id":"planner-treino"}');
  });
  it('ignores forged redirect approval and shows the authenticated server state', async () => {
    sessionStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({ id, token, product: product.id, created: Date.now() }),
    );
    const fetch = vi.fn(async () =>
      response({ ...product, product_id: product.id, paid: false, status: 'created' }),
    );
    vi.stubGlobal('fetch', fetch);
    page(`pedido=${id}&status=approved&collection_status=approved`);
    expect(await screen.findByRole('status')).toHaveTextContent('Aguardando confirmação');
    expect(screen.queryByRole('button', { name: 'Baixar produto' })).not.toBeInTheDocument();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(fetch.mock.calls[0][0]).not.toContain(token);
  });
  it('does not query an order without its session and explains recovery', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    page(`pedido=${id}&status=approved`);
    expect(await screen.findByRole('alert')).toHaveTextContent('mesmo navegador e aba');
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow, noarchive',
    );
  });
  it('shows delivery only for the confirmed order', async () => {
    sessionStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({ id, token, product: product.id, created: Date.now() }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({ ...product, product_id: product.id, paid: true, status: 'processed' }),
      ),
    );
    page(`pedido=${id}`);
    expect(await screen.findByRole('button', { name: 'Baixar produto' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Pagamento confirmado');
  });
  it('shows suspended delivery without a download button even if stale paid=true arrives', async () => {
    sessionStorage.setItem(
      `commerce:${id}`,
      JSON.stringify({ id, token, product: product.id, created: Date.now() }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          ...product,
          product_id: product.id,
          paid: true,
          delivery_blocked: true,
          status: 'processed',
        }),
      ),
    );
    page(`pedido=${id}`);
    expect(await screen.findByRole('status')).toHaveTextContent('Entrega suspensa');
    expect(screen.queryByRole('button', { name: 'Baixar produto' })).not.toBeInTheDocument();
  });
});

describe('normal same-tab checkout lifecycle, entirely offline', () => {
  it('retains authorization through creation, redirect, return, refresh and ZIP download', async () => {
    const user = userEvent.setup();
    let saved,
      paid = false;
    const mpId = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
    const fetch = vi.fn(async (url, options) => {
      if (url.endsWith('/catalog')) return response({ products: [product] });
      if (url.endsWith('/checkout')) {
        const orderId = options.headers['Idempotency-Key'];
        saved = JSON.parse(sessionStorage.getItem(`commerce:${orderId}`));
        expect(saved).toMatchObject({ id: orderId, product: product.id });
        expect(options.headers.Authorization).toBe(`Bearer ${saved.token}`);
        return response({
          order_id: orderId,
          checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
        });
      }
      expect(options.headers.Authorization).toBe(`Bearer ${saved.token}`);
      expect(url).not.toContain(saved.token);
      if (url.endsWith('/download')) {
        expect(paid).toBe(true);
        return new Response('synthetic-zip', { headers: { 'Content-Type': 'application/zip' } });
      }
      expect(url).toBe(`/api/commerce/orders/${saved.id}`);
      return response({
        ...product,
        product_id: product.id,
        paid,
        status: paid ? 'processed' : 'created',
      });
    });
    vi.stubGlobal('fetch', fetch);
    const objectURL = vi.fn(() => 'blob:synthetic-zip');
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = objectURL;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    page('produto=planner-treino');
    await user.click(await screen.findByRole('button', { name: 'Continuar no Mercado Pago' }));
    await waitFor(() =>
      expect(navigatePayment).toHaveBeenCalledWith(
        `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${mpId}`,
      ),
    );
    const sessionBeforeReturn = sessionStorage.getItem(`commerce:${saved.id}`);
    cleanup(); // Recreate the page as after top-level navigation; preserve this tab's storage.
    page(`pedido=${saved.id}&status=approved`);
    expect(await screen.findByRole('status')).toHaveTextContent('Aguardando confirmação');
    expect(sessionStorage.getItem(`commerce:${saved.id}`)).toBe(sessionBeforeReturn);
    expect(screen.queryByRole('button', { name: 'Baixar produto' })).not.toBeInTheDocument();
    paid = true; // Simulated signed/provider-verified backend confirmation, not a payment call.
    await user.click(screen.getByRole('button', { name: 'Atualizar status' }));
    await user.click(await screen.findByRole('button', { name: 'Baixar produto' }));
    await waitFor(() => expect(objectURL).toHaveBeenCalledOnce());
    expect(click).toHaveBeenCalledOnce();
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/checkout'))).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/download'))).toHaveLength(1);
  });
  it('does not create an order when storage is unavailable', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async () => response({ products: [product] }));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('synthetic');
    });
    page('produto=planner-treino');
    await user.click(await screen.findByRole('button', { name: 'Continuar no Mercado Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('preservar o acesso');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('fails closed rather than replacing a corrupt pending order', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(`commerce:pending:${product.id}`, id);
    sessionStorage.setItem(`commerce:${id}`, '{broken');
    const fetch = vi.fn(async () => response({ products: [product] }));
    vi.stubGlobal('fetch', fetch);
    page('produto=planner-treino');
    await user.click(await screen.findByRole('button', { name: 'Continuar no Mercado Pago' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não iniciamos outro pagamento');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
