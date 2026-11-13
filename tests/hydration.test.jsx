import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { BrowserRouter, StaticRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const roots = [];

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount());
  });
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// clientUrl: endereço real no navegador (ex.: com ?query), que o HTML estático não conhece.
const expectCleanHydration = async (route, clientUrl = route) => {
  window.history.replaceState({}, '', clientUrl);
  document.body.innerHTML = `<div id="root">${renderToString(
    <StaticRouter location={route}>
      <App />
    </StaticRouter>,
  )}</div>`;
  const recoverableErrors = [];
  await act(async () => {
    roots.push(
      hydrateRoot(
        document.getElementById('root'),
        <BrowserRouter>
          <App />
        </BrowserRouter>,
        { onRecoverableError: (error) => recoverableErrors.push(error.message) },
      ),
    );
  });
  expect(recoverableErrors).toEqual([]);
};

describe('hidratação do HTML pré-renderizado', () => {
  it('hidrata a página inicial sem substituir a árvore', async () => {
    await expectCleanHydration('/');
  });

  it('hidrata a trajetória sem divergência', async () => {
    await expectCleanHydration('/sobre');
  });

  it('hidrata o case TED TEC sem substituir a árvore', async () => {
    await expectCleanHydration('/clientes/ted-tec');
  });

  it('hidrata o Shopping, inclusive com categoria na URL', async () => {
    await expectCleanHydration('/shopping');
    await act(async () => {
      roots.splice(0).forEach((root) => root.unmount());
    });
    await expectCleanHydration('/shopping', '/shopping?categoria=lifestyle');
    expect(document.querySelector('.rj-shop-status').textContent).toMatch(
      /lifestyle join: em breve/i,
    );
  });
});
