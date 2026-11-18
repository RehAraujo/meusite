// Order page: "Acessar meu template no Notion" depends only on the server's `paid`,
// the URL is fetched on click with the buyer token, and nothing is persisted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
import FinanceProductPage from '../src/pages/FinanceProductPage';
import { navigateTemplate } from '../src/lib/commerce-session';

vi.mock('../src/lib/commerce-session', async (original) => ({
  ...(await original()),
  navigateTemplate: vi.fn(),
}));

const DAY = 86400000;
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const token = 'ab'.repeat(32);
const TEMPLATE = 'https://fixture-workspace.notion.site/Template-fixture-0000';
const BUTTON = 'Acessar meu template no Notion';
const order = (extra = {}) => ({
  order_id: id,
  product_id: 'meu-dinheiro-minhas-regras',
  title: 'Meu Dinheiro, Minhas Regras',
  amount: '47.00',
  currency: 'BRL',
  status: 'processed',
  status_detail: 'accredited',
  paid: true,
  delivery_blocked: false,
  delivery: 'notion',
  access_expires: Date.now() + 5 * DAY,
  ...extra,
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function renderOrder(query = `pedido=${id}`) {
  return render(
    <MemoryRouter initialEntries={[`/checkout?${query}`]}>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    `commerce:${id}`,
    JSON.stringify({ id, token, product: 'meu-dinheiro-minhas-regras', created: Date.now() }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Notion access on the order page', () => {
  it('shows the access button and the ZIP alternative only when the server confirms payment', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(order())),
    );
    renderOrder();
    expect(await screen.findByRole('button', { name: BUTTON })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Baixar link e instruções (ZIP)' })).toBeTruthy();
    expect(screen.getByText('Pagamento confirmado. Seu acesso está liberado.')).toBeTruthy();
  });

  it('requests the URL with the buyer token on click and opens it without storing it', async () => {
    const fetch = vi.fn(async (url) =>
      url.endsWith('/access') ? json({ url: TEMPLATE }) : json(order()),
    );
    vi.stubGlobal('fetch', fetch);
    renderOrder();
    await userEvent.click(await screen.findByRole('button', { name: BUTTON }));
    await waitFor(() => expect(navigateTemplate).toHaveBeenCalledWith(TEMPLATE));
    const call = fetch.mock.calls.find(([url]) => url.endsWith('/access'));
    expect(call[0]).toBe(`/api/commerce/orders/${id}/access`);
    expect(call[1].headers.Authorization).toBe(`Bearer ${token}`);
    expect(call[1].cache).toBe('no-store');
    const stored = Object.keys(localStorage)
      .map((key) => localStorage.getItem(key))
      .join('');
    expect(stored + sessionStorage.length + document.body.innerHTML).not.toContain('notion.site');
  });

  it.each([
    ['pending', { paid: false, status: 'action_required', status_detail: 'waiting_payment' }],
    [
      'refunded',
      { paid: false, status: 'refunded', status_detail: 'refunded', delivery_blocked: true },
    ],
    ['blocked for review', { paid: true, delivery_blocked: true }],
  ])('hides the access button for a %s order', async (_label, state) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(order(state))),
    );
    renderOrder();
    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('ignores forged return parameters: only the server state counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(order({ paid: false, status: 'created', status_detail: 'created' }))),
    );
    renderOrder(`pedido=${id}&status=approved&collection_status=approved&payment_id=123`);
    await screen.findByText(/aguardando a confirmação do pagamento/i);
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('without the buyer session in this browser, shows recovery guidance and calls nothing', async () => {
    localStorage.clear();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderOrder();
    expect(await screen.findByText(/Não encontramos o acesso a este pedido/)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('shows a recoverable message when the server refuses access', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/access')
          ? json({ message: 'Pagamento não confirmado.' }, 403)
          : json(order()),
      ),
    );
    renderOrder();
    await userEvent.click(await screen.findByRole('button', { name: BUTTON }));
    expect(await screen.findByText(/Não foi possível abrir o template agora/)).toBeTruthy();
    expect(navigateTemplate).not.toHaveBeenCalled();
  });
});

describe('landing CTAs', () => {
  it('sends every purchase CTA to the integrated checkout, with no payment link or WhatsApp', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/meu-dinheiro-minhas-regras']}>
        <FinanceProductPage />
      </MemoryRouter>,
    );
    const ctas = [...container.querySelectorAll('a.rj-btn')];
    expect(ctas).toHaveLength(4);
    for (const cta of ctas) {
      expect(cta.getAttribute('href')).toBe('/checkout?produto=meu-dinheiro-minhas-regras');
      expect(cta.getAttribute('target')).toBeNull();
    }
    const html = container.innerHTML;
    expect(html).not.toMatch(/mpago\.la|wa\.me|whatsapp/i);
    expect(html).not.toMatch(/notion\.(so|site)/);
    expect(html).toContain('Acessar meu template no Notion');
  });
});
