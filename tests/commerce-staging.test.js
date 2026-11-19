// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import staging from '../worker/commerce/staging.js';

const parse = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));
const config = parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
afterEach(() => vi.unstubAllGlobals());

describe('staging deployment isolation', () => {
  it('keeps the main-domain Worker config and uses only commerce staging bindings', () => {
    // The root is the renatajoin.com Worker: unchanged from main except that the three
    // commerce pages run the Worker first, so they can be redirected to the Shopping host.
    const root = { ...config };
    delete root.env;
    expect(root).toEqual({
      $schema: 'node_modules/wrangler/config-schema.json',
      name: 'meusite',
      main: 'worker.js',
      compatibility_date: '2026-07-09',
      observability: { enabled: true },
      assets: {
        directory: 'dist',
        binding: 'ASSETS',
        run_worker_first: [
          '/meu-dinheiro-minhas-regras*',
          '/checkout*',
          '/minhas-compras*',
          '/wrangler.jsonc',
        ],
        html_handling: 'auto-trailing-slash',
        not_found_handling: '404-page',
      },
    });
    const stage = config.env.staging;
    expect(stage.name).toBe('meusite-loja-staging');
    expect(stage.main).toBe('worker/commerce/staging.js');
    expect(stage.d1_databases.map((db) => db.binding)).toEqual(['COMMERCE_DB']);
    expect(stage.d1_databases[0].database_name).toBe('meusite-commerce-staging');
    expect(stage.d1_databases[0].database_id).toBe('799f4cf2-8970-4716-990f-36445c166ab3');
    expect(stage.d1_databases[0].migrations_dir).toBe('migrations/commerce');
    expect(stage.r2_buckets.map((b) => b.bucket_name)).toEqual([
      'meusite-digital-products-staging',
    ]);
    expect(stage.queues).toEqual({ producers: [], consumers: [] });
    expect(stage.vars).toEqual({
      COMMERCE_MODE: 'disabled',
      COMMERCE_ENVIRONMENT: 'staging',
      COMMERCE_ORIGIN: 'https://homologacao.renatajoin.com',
    });
    expect(stage.assets.run_worker_first).toBe(true);
    expect(stage.preview_urls).toBe(false);
    expect(stage.routes.length).toBeLessThanOrEqual(1);
    for (const route of stage.routes)
      expect(route).toMatchObject({ pattern: 'homologacao.renatajoin.com', custom_domain: true });
  });
  it('does not require credentials and cannot create checkout while disabled', async () => {
    const outbound = vi.fn(() => {
      throw new Error('No external calls allowed');
    });
    vi.stubGlobal('fetch', outbound);
    const env = { COMMERCE_MODE: 'disabled' };
    const response = await staging.fetch(
      new Request('https://homologacao.renatajoin.com/api/commerce/checkout', { method: 'POST' }),
      env,
    );
    expect(response.status).toBe(503);
    expect(outbound).not.toHaveBeenCalled();
  });
  it('makes all staging assets non-indexable and preserves existing security headers', async () => {
    const env = {
      ASSETS: {
        fetch: vi.fn(
          async () =>
            new Response('staging-only', {
              headers: {
                'Content-Security-Policy': "default-src 'self'",
                'X-Frame-Options': 'DENY',
              },
            }),
        ),
      },
    };
    const response = await staging.fetch(new Request('https://homologacao.renatajoin.com/'), env);
    expect(await response.text()).toBe('staging-only');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
  it.each(['/api/diagnostics/orders', '/api/other', '/wrangler.jsonc'])(
    'does not expose unrelated services or internal config: %s',
    async (path) => {
      const assets = vi.fn(() => {
        throw new Error('Unexpected asset fallback');
      });
      const response = await staging.fetch(
        new Request(`https://homologacao.renatajoin.com${path}`),
        { ASSETS: { fetch: assets } },
      );
      expect(response.status).toBe(404);
      expect(assets).not.toHaveBeenCalled();
    },
  );
});
