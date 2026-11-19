// Phase 1: the purchase buttons never stay stuck on "Abrindo pagamento…". Covers the
// Android case where the Mercado Pago app takes over the link (the page stays alive,
// hidden, then visible again), Back / back-forward cache restores, the grace period,
// bursts of taps on several buttons, client timeout and errors. Entirely offline.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FinanceProductPage from '../src/pages/FinanceProductPage';
import CheckoutPage from '../src/pages/CheckoutPage';
import { navigatePayment } from '../src/lib/commerce-session';
import {
  CHECKOUT_TIMEOUT_MS,
  REDIRECT_GRACE_MS,
  resetCheckoutState,
  startCheckout,
} from '../src/lib/commerce-checkout';

vi.mock('../src/lib/commerce-session', async (original) => ({
  ...(await original()),
  navigatePayment: vi.fn(),
}));

const ORDER = 'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9';
const PRODUCT = 'meu-dinheiro-minhas-regras';
const HINT = 'Se o pagamento não abriu, toque novamente. Seu pedido continua o mesmo.';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
let visibility = 'visible';

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
function summary() {
  return render(
    <MemoryRouter initialEntries={[`/checkout?produto=${PRODUCT}`]}>
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
const hero = () => screen.getAllByRole('link', { name: /Quero organizar meu dinheiro/ })[0];
const busyLinks = () => screen.queryAllByRole('link', { name: /Abrindo pagamento/ });
// Server stub: catalog plus an order endpoint that records idempotency keys.
function server({ hold = false } = {}) {
  const keys = [];
  let release;
  const fetch = vi.fn((url, options = {}) => {
    if (url.endsWith('/catalog'))
      return Promise.resolve(
        json({
          mode: 'test',
          products: [{ id: PRODUCT, title: 'Meu Dinheiro', amount: '47.00', available: true }],
        }),
      );
    keys.push(options.headers['Idempotency-Key']);
    const reply = () =>
      json({
        order_id: options.headers['Idempotency-Key'],
        environment: 'staging',
        checkout_url: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${ORDER}`,
      });
    if (!hold) return Promise.resolve(reply());
    return new Promise((resolve, reject) => {
      release = () => resolve(reply());
      options.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
    });
  });
  vi.stubGlobal('fetch', fetch);
  return { keys, fetch, release: () => release() };
}
function setVisibility(value) {
  visibility = value;
  document.dispatchEvent(new Event('visibilitychange'));
}
const orderCalls = (fetch) => fetch.mock.calls.filter(([url]) => url === '/api/commerce/checkout');

beforeEach(() => {
  localStorage.clear();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});
afterEach(() => {
  resetCheckoutState();
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('landing purchase buttons', () => {
  it('shows a loading indicator on the tapped button and marks it busy', async () => {
    const { release } = server({ hold: true });
    landing();
    fireEvent.click(hero());
    const [busy] = await waitFor(() => {
      const links = busyLinks();
      expect(links.length).toBeGreaterThan(0);
      return links;
    });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy.querySelector('.fj-spinner')).not.toBeNull();
    release();
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
  });

  it('sends a single request for a burst of taps across every button on the page', async () => {
    const { fetch, release } = server({ hold: true });
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(busyLinks().length).toBeGreaterThan(0));
    for (const link of busyLinks()) {
      fireEvent.click(link);
      fireEvent.click(link);
    }
    release();
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    expect(orderCalls(fetch)).toHaveLength(1);
  });

  it('ignores taps after the redirect started while the page is still visible', async () => {
    const { fetch } = server();
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    for (const link of busyLinks()) fireEvent.click(link);
    await act(async () => {});
    expect(orderCalls(fetch)).toHaveLength(1);
    expect(navigatePayment).toHaveBeenCalledTimes(1);
  });

  it('Android: recovers when the buyer comes back from the Mercado Pago app', async () => {
    const { keys } = server();
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    // The app takes over: the browser goes to the background with our page still alive.
    act(() => setVisibility('hidden'));
    expect(busyLinks().length).toBeGreaterThan(0);
    act(() => setVisibility('visible'));
    expect(busyLinks()).toHaveLength(0);
    expect(hero()).not.toHaveAttribute('aria-busy');
    // Only the tapped button explains what to do.
    expect(screen.getAllByText(HINT)).toHaveLength(1);
    // Tapping again resumes the same order: same idempotency key, no duplicate.
    fireEvent.click(hero());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(2));
    expect(new Set(keys).size).toBe(1);
  });

  it('recovers when the page is restored from the back/forward cache', async () => {
    server();
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false })));
    expect(busyLinks().length).toBeGreaterThan(0); // a fresh load is not a return
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    expect(busyLinks()).toHaveLength(0);
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('recovers after the grace period if the browser never left the page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server();
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    act(() => vi.advanceTimersByTime(REDIRECT_GRACE_MS - 100));
    expect(busyLinks().length).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(200));
    expect(busyLinks()).toHaveLength(0);
  });

  it('does not release the lock while the request is still in flight', async () => {
    const { fetch, release } = server({ hold: true });
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(busyLinks().length).toBeGreaterThan(0));
    act(() => {
      setVisibility('hidden');
      setVisibility('visible');
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(busyLinks().length).toBeGreaterThan(0);
    fireEvent.click(busyLinks()[0]);
    release();
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    expect(orderCalls(fetch)).toHaveLength(1);
  });

  it('refuses a second purchase call while one is loading or redirecting', async () => {
    const { fetch, release } = server({ hold: true });
    const first = startCheckout(PRODUCT);
    await waitFor(() => expect(orderCalls(fetch)).toHaveLength(1));
    expect(await startCheckout(PRODUCT)).toBe(false); // loading
    release();
    expect(await first).toBe(true);
    expect(await startCheckout(PRODUCT)).toBe(false); // redirecting
    expect(orderCalls(fetch)).toHaveLength(1);
  });

  it('times out a slow request and falls back to the summary page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server({ hold: true });
    landing();
    fireEvent.click(hero());
    await waitFor(() => expect(busyLinks().length).toBeGreaterThan(0));
    await act(async () => vi.advanceTimersByTime(CHECKOUT_TIMEOUT_MS + 10));
    expect(await screen.findByText('Página de resumo')).toBeInTheDocument();
    expect(navigatePayment).not.toHaveBeenCalled();
  });

  it('frees the buttons after an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ message: 'indisponível' }, 503)),
    );
    landing();
    fireEvent.click(hero());
    expect(await screen.findByText('Página de resumo')).toBeInTheDocument();
    await expect(startCheckout(PRODUCT)).rejects.toThrow('checkout-unavailable');
  });
});

describe('summary page purchase button', () => {
  it('shows progress, then recovers with a hint when the buyer returns', async () => {
    const { keys } = server();
    summary();
    const button = await screen.findByRole('button', { name: 'Continuar para o pagamento' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /Abrindo pagamento/ })).toBeDisabled();
    act(() => {
      setVisibility('hidden');
      setVisibility('visible');
    });
    expect(screen.getByText(HINT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para o pagamento' }));
    await waitFor(() => expect(navigatePayment).toHaveBeenCalledTimes(2));
    expect(new Set(keys).size).toBe(1);
  });

  it('explains a timeout and keeps the same order for the next attempt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { keys } = server({ hold: true });
    summary();
    const button = await screen.findByRole('button', { name: 'Continuar para o pagamento' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await act(async () => vi.advanceTimersByTime(CHECKOUT_TIMEOUT_MS + 10));
    expect(await screen.findByRole('alert')).toHaveTextContent(/demorou para responder/);
    expect(screen.getByRole('button', { name: 'Continuar para o pagamento' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para o pagamento' }));
    await waitFor(() => expect(keys).toHaveLength(2));
    expect(new Set(keys).size).toBe(1);
  });
});
