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

const expectCleanHydration = async (route) => {
  window.history.replaceState({}, '', route);
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
});
