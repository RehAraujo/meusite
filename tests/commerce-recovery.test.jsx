import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
import PurchasesPage from '../src/pages/PurchasesPage';
import {
  forgetCommerceSession,
  importCommerceSession,
  listCommerceSessions,
  parseAccessFragment,
  personalAccessLink,
  prepareCommerceSession,
  extendCommerceSession,
  readCommerceSession,
  settleCommerceSession,
  stripAccessFragment,
} from '../src/lib/commerce-session';

const DAY = 86400000;
const id = '32a6f0a0-2759-4ca1-a1be-c808c34921d1';
const other = '5b1e8a9c-3d7f-4e21-9a6b-0c2d4e6f8a1b';
const token = 'ab'.repeat(32);
const otherToken = 'cd'.repeat(32);
const store = (sessionId, extra = {}) =>
  localStorage.setItem(`commerce:${sessionId}`, JSON.stringify({ id: sessionId, token, product: 'meu-dinheiro-minhas-regras', created: Date.now(), ...extra }));
const order = (extra = {}) => ({
  order_id: id, product_id: 'meu-dinheiro-minhas-regras', title: 'Meu Dinheiro, Minhas Regras',
  amount: '47.00', currency: 'BRL', status: 'processed', status_detail: 'accredited',
  paid: true, delivery_blocked: false, access_expires: Date.now() + 5 * DAY, ...extra,
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const renderAt = (path, element) => render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('browser-persistent buyer access', () => {
  it('keeps access in localStorage, never in sessionStorage, so closing the tab does not lose it', () => {
    const session = prepareCommerceSession('meu-dinheiro-minhas-regras');
    sessionStorage.clear(); // Closing the tab discards only per-tab storage.
    expect(readCommerceSession(session.id)).toEqual(session);
    expect(sessionStorage.length).toBe(0);
  });

  it('lists purchases of any product newest first and removes expired ones with their pointers', () => {
    store(id, { product: 'planner-treino', created: Date.now() - DAY });
    store(other, { token: otherToken, created: Date.now() });
    const expired = '7c9d1e2f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
    store(expired, { created: Date.now() - 400 * DAY });
    localStorage.setItem('commerce:pending:meu-dinheiro-minhas-regras', expired);
    localStorage.setItem(`commerce:download:${expired}`, other);
    expect(listCommerceSessions().map((s) => s.id)).toEqual([other, id]);
    expect(localStorage.getItem(`commerce:${expired}`)).toBeNull();
    expect(localStorage.getItem('commerce:pending:meu-dinheiro-minhas-regras')).toBeNull();
    expect(localStorage.getItem(`commerce:download:${expired}`)).toBeNull();
  });

  it('settles a confirmed order so a later purchase of the same product starts a new order', () => {
    const first = prepareCommerceSession('meu-dinheiro-minhas-regras');
    settleCommerceSession(first.id);
    expect(readCommerceSession(first.id)).not.toBeNull();
    expect(prepareCommerceSession('meu-dinheiro-minhas-regras').id).not.toBe(first.id);
  });

  it('forgets one purchase completely on request', () => {
    store(id);
    localStorage.setItem('commerce:pending:meu-dinheiro-minhas-regras', id);
    forgetCommerceSession(id);
    expect(localStorage.length).toBe(0);
  });

  it('never trusts a stored expiry beyond the 12-month paid access window', () => {
    store(id, { expires: Date.now() + 400 * DAY });
    expect(readCommerceSession(id)).toBeNull();
    store(id, { expires: Date.now() + 30 * DAY });
    expect(readCommerceSession(id)).not.toBeNull();
  });

  it('keeps a purchase in this browser for up to 12 months and lets the server decide', () => {
    store(id, { created: Date.now() - 10 * DAY });
    expect(readCommerceSession(id)).not.toBeNull();
    store(id, { created: Date.now() - 366 * DAY });
    expect(readCommerceSession(id)).toBeNull();
  });

  it('adopts a longer server expiry for an imported session, never shortening it', () => {
    const base = { id, token, product: 'meu-dinheiro-minhas-regras' };
    importCommerceSession({ ...base, expires: Date.now() + 5 * DAY });
    extendCommerceSession(id, Date.now() + 200 * DAY);
    const extended = readCommerceSession(id).expires;
    expect(extended).toBeGreaterThan(Date.now() + 199 * DAY);
    extendCommerceSession(id, Date.now() + DAY);
    expect(readCommerceSession(id).expires).toBe(extended);
  });

  it('Minhas compras forgets an order the server refuses after 7 days, and keeps paid ones', async () => {
    store(id, { created: Date.now() - 10 * DAY });
    store(other, { token: otherToken, created: Date.now() - 10 * DAY });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => (url.includes(id) ? json({ message: 'x' }, 404) : json(order({ order_id: other })))),
    );
    renderAt('/minhas-compras', <PurchasesPage />);
    await waitFor(() => expect(localStorage.getItem(`commerce:${id}`)).toBeNull());
    expect(localStorage.getItem(`commerce:${other}`)).not.toBeNull();
  });
});

describe('personal access link', () => {
  it('carries the credential only in the fragment and accepts only the exact format', () => {
    store(id);
    const link = personalAccessLink(readCommerceSession(id), 'https://shopping.renatajoin.com');
    const url = new URL(link);
    expect(url.search).toBe(`?pedido=${id}`);
    expect(url.hash).toBe(`#acesso=${token}`);
    expect(parseAccessFragment(url.hash)).toBe(token);
    for (const hash of ['', '#acesso=xyz', `#acesso=${token}&x=1`, `#token=${token}`, `#acesso=${token.toUpperCase()}`])
      expect(parseAccessFragment(hash)).toBeNull();
    expect(() => personalAccessLink({ id, token: otherToken })).toThrow('session');
  });

  it('removes the credential from the address bar and current history entry', () => {
    window.history.replaceState(null, '', `/checkout?pedido=${id}#acesso=${token}`);
    stripAccessFragment();
    expect(window.location.href).not.toContain(token);
    expect(window.location.search).toBe(`?pedido=${id}`);
  });

  it('imports only valid, unexpired sessions and caps their expiry', () => {
    const base = { id, token, product: 'meu-dinheiro-minhas-regras' };
    for (const bad of [{ expires: Date.now() - 1 }, { token: 'x' }, { id: 'nope' }, { product: '../x' }])
      expect(() => importCommerceSession({ ...base, expires: Date.now() + DAY, ...bad })).toThrow();
    const saved = importCommerceSession({ ...base, expires: Date.now() + 90 * DAY });
    expect(saved.expires).toBeGreaterThan(Date.now() + 89 * DAY);
    const capped = importCommerceSession({ ...base, expires: Date.now() + 500 * DAY });
    expect(capped.expires).toBeLessThanOrEqual(Date.now() + 365 * DAY);
  });

  it('opens the order in another browser, verifying the link with the server before storing it', async () => {
    window.history.replaceState(null, '', `/checkout?pedido=${id}#acesso=${token}`);
    const fetch = vi.fn(async (url, options) => {
      expect(window.location.hash).toBe(''); // Stripped before any request.
      expect(url).not.toContain(token);
      expect(options.headers.Authorization).toBe(`Bearer ${token}`);
      return json(order());
    });
    vi.stubGlobal('fetch', fetch);
    renderAt(`/checkout?pedido=${id}`, <CheckoutPage />);
    expect(await screen.findByRole('button', { name: 'Baixar produto' })).toBeEnabled();
    expect(readCommerceSession(id).token).toBe(token);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('stores nothing when the server rejects a personal link', async () => {
    window.history.replaceState(null, '', `/checkout?pedido=${id}#acesso=${token}`);
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Acesso inválido ou expirado.' }, 404)));
    renderAt(`/checkout?pedido=${id}`, <CheckoutPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('link de acesso é inválido');
    expect(localStorage.length).toBe(0);
    expect(window.location.hash).toBe('');
  });

  it('does not render the credential until the buyer explicitly asks for it', async () => {
    const user = userEvent.setup();
    store(id);
    vi.stubGlobal('fetch', vi.fn(async () => json(order())));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } });
    renderAt(`/checkout?pedido=${id}`, <CheckoutPage />);
    await screen.findByRole('button', { name: 'Baixar produto' });
    expect(document.body.innerHTML).not.toContain(token);
    expect(screen.getByRole('heading', { name: 'Salvar meu acesso' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Copiar link de acesso' }));
    const field = screen.getByLabelText('Seu link pessoal de acesso');
    expect(field.value).toBe(`${window.location.origin}/checkout?pedido=${id}#acesso=${token}`);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(field.value);
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Ocultar link' }));
    expect(document.body.innerHTML).not.toContain(token);
    // A confirmed order is no longer reused as the pending purchase.
    expect(Object.keys(localStorage).some((k) => k.startsWith('commerce:pending:'))).toBe(false);
  });
});

describe('Minhas compras', () => {
  it('explains recovery when this browser has no purchases', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderAt('/minhas-compras', <PurchasesPage />);
    expect(await screen.findByRole('heading', { name: 'Nenhuma compra salva neste navegador.' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
  });

  it('lists purchases of different products with authenticated status and forgets after confirmation', async () => {
    const user = userEvent.setup();
    store(id);
    store(other, { token: otherToken, product: 'planner-treino', created: Date.now() - 1000 });
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      expect(url).not.toMatch(/[a-f0-9]{64}/);
      return url.endsWith(id)
        ? json(order())
        : options.headers.Authorization === `Bearer ${otherToken}`
          ? json(order({ order_id: other, title: 'Planner de Treino', paid: false, status: 'created', status_detail: null }))
          : json({}, 404);
    }));
    renderAt('/minhas-compras', <PurchasesPage />);
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    await within(items[0]).findByText('Pagamento confirmado. Seu acesso está liberado.');
    await within(items[1]).findByText(/aguardando a confirmação/i);
    expect(within(items[0]).getByRole('link', { name: 'Abrir pedido' })).toHaveAttribute('href', `/checkout?pedido=${id}`);
    await user.click(within(items[1]).getByRole('button', { name: 'Esquecer neste dispositivo' }));
    expect(readCommerceSession(other)).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Confirmar: esquecer neste dispositivo' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(readCommerceSession(other)).toBeNull();
    expect(readCommerceSession(id)).not.toBeNull();
  });
});
