import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ToolsPage from '../src/pages/ToolsPage';
import ProductPage from '../src/pages/ProductPage';
import CheckoutPage from '../src/pages/CheckoutPage';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('preserves future catalogue cards and only links the finance product to purchase', () => {
  render(<MemoryRouter><ToolsPage /></MemoryRouter>);
  for (const name of ['Planner Anti-Inflamatório', 'Planner de Treino']) {
    const card = screen.getByRole('heading', { name }).closest('article');
    expect(within(card).getByText('Em breve')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Indisponível' })).toBeDisabled();
    expect(within(card).queryByRole('link', { name: 'Comprar' })).not.toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Saiba mais' })).toBeInTheDocument();
  }
  expect(screen.getAllByRole('link', { name: 'Comprar' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Comprar' })).toHaveAttribute('href', '/checkout?produto=meu-dinheiro-minhas-regras');
  expect(screen.getByText('R$ 47')).toBeInTheDocument();
});
it.each(['guide', 'training'])('direct %s product page does not advertise a purchase', type => {
  render(<MemoryRouter><ProductPage type={type} /></MemoryRouter>);
  expect(screen.getByText(/Em breve · ainda não disponível/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Comprar agora|Quero o planner/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/R\$ (25|67)/)).not.toBeInTheDocument();
});
it.each(['planner-alimentar', 'planner-treino'])('direct checkout route for %s has no purchase action or session', async id => {
  sessionStorage.clear();
  const fetch = vi.fn(async () => Response.json({ mode: 'production', products: [{ id, title: id, amount: '25.00', available: false, coming_soon: true }] }));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/checkout?produto=' + id]}><CheckoutPage /></MemoryRouter>);
  expect(await screen.findByRole('status')).toHaveTextContent('Este produto ainda não está disponível para compra.');
  expect(screen.queryByRole('button', { name: /Mercado Pago|Continuar/ })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sessionStorage.length).toBe(0);
});
