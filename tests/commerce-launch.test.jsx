// Only the finance product is on sale: the planners have no purchase action at checkout.
// (The /ferramentas catalogue now lives in the Shopping JOIN, covered by its own tests.)
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPage from '../src/pages/CheckoutPage';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(['planner-alimentar', 'planner-treino'])('direct checkout route for %s has no purchase action or session', async id => {
  localStorage.clear();
  const fetch = vi.fn(async () => Response.json({ mode: 'production', products: [{ id, title: id, amount: '25.00', available: false, coming_soon: true }] }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/checkout?produto=' + id]}><CheckoutPage /></MemoryRouter>);
  expect(await screen.findByRole('status')).toHaveTextContent('Este produto ainda não está disponível para compra.');
  expect(screen.queryByRole('button', { name: /Mercado Pago|Continuar/ })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.length).toBe(0);
});
