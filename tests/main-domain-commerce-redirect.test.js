// @vitest-environment node
// The main-domain Worker sends the Meu Dinheiro commerce pages to the Shopping host, keeping
// path and query string, and never redirects the Shopping host itself.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { SHOPPING_ORIGIN, shoppingRedirect } from '../worker.js';

const assets = { fetch: vi.fn(async () => new Response('asset', { status: 200 })) };
const run = (url) => worker.fetch(new Request(url), { ASSETS: assets });

afterEach(() => vi.restoreAllMocks());

describe('main-domain commerce redirect', () => {
  it.each([
    ['/meu-dinheiro-minhas-regras', ''],
    ['/meu-dinheiro-minhas-regras/', ''],
    ['/checkout', '?produto=meu-dinheiro-minhas-regras'],
    ['/checkout/', '?pedido=32a6f0a0-2759-4ca1-a1be-c808c34921d1&utm_source=instagram'],
    ['/minhas-compras', ''],
    ['/minhas-compras/index.html', '?a=1&a=2&b=%C3%A7'],
  ])('moves %s%s to the Shopping host with the same path and query', async (path, query) => {
    const response = await run(`https://renatajoin.com${path}${query}`);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`${SHOPPING_ORIGIN}${path}${query}`);
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it('also covers www and preview hosts of the main Worker', async () => {
    const response = await run('https://www.renatajoin.com/checkout?produto=x');
    expect(response.headers.get('Location')).toBe(`${SHOPPING_ORIGIN}/checkout?produto=x`);
  });

  it('never redirects on the Shopping host (no loop)', async () => {
    for (const path of ['/meu-dinheiro-minhas-regras/', '/checkout?pedido=1', '/minhas-compras'])
      expect(shoppingRedirect(new URL(`${SHOPPING_ORIGIN}${path}`))).toBeNull();
  });

  it.each([
    '/',
    '/shopping',
    '/shopping/ferramentas-digitais',
    '/ferramentas',
    '/checkout-antigo',
    '/minhas-compras-x',
    '/meu-dinheiro-minhas-regras/outra',
    '/assets/checkout.js',
  ])('leaves %s to the site as it is today', async (path) => {
    const response = await run(`https://renatajoin.com${path}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('asset');
  });

  it('keeps hiding the Worker config', async () => {
    expect((await run('https://renatajoin.com/wrangler.jsonc')).status).toBe(404);
  });

  it('writes nothing to the logs (query strings may carry an order id)', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m));
    await run('https://renatajoin.com/checkout?pedido=32a6f0a0-2759-4ca1-a1be-c808c34921d1');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('runs the Worker before static assets for exactly these pages', () => {
    const config = JSON.parse(
      readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(
        /^\s*\/\/.*$/gm,
        '',
      ),
    );
    expect(config.assets.run_worker_first).toEqual([
      '/meu-dinheiro-minhas-regras*',
      '/checkout*',
      '/minhas-compras*',
      '/wrangler.jsonc',
    ]);
  });
});
