import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
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
    sessionStorage.setItem(`commerce:${id}`, JSON.stringify({ id, token }));
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
    sessionStorage.setItem(`commerce:${id}`, JSON.stringify({ id, token }));
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
    sessionStorage.setItem(`commerce:${id}`, JSON.stringify({ id, token }));
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
