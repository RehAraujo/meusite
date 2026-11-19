// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testMode, verifiedTestCredential } from '../worker/commerce/credentials.js';
const env = () => ({
  COMMERCE_MODE: 'test',
  COMMERCE_ENVIRONMENT: 'staging',
  MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-synthetic-only',
});
const account = { id: 3792015931, site_id: 'MLB', tags: ['test_user'] };
afterEach(() => vi.unstubAllGlobals());
describe('test seller credential identity, with no external calls', () => {
  it.each(['APP_USR-synthetic-only', 'TEST-synthetic-only'])(
    'uses identity rather than prefix: %s',
    async (credential) => {
      const fetch = vi.fn(async () => Response.json(account));
      vi.stubGlobal('fetch', fetch);
      const config = { ...env(), MERCADOPAGO_ACCESS_TOKEN: credential };
      expect(await verifiedTestCredential(config)).toBe(credential);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.mercadolibre.com/users/me',
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          cache: 'no-store',
          headers: { Authorization: `Bearer ${credential}`, Accept: 'application/json' },
        }),
      );
    },
  );
  it.each([
    { COMMERCE_MODE: 'disabled' },
    { COMMERCE_MODE: 'production' },
    { COMMERCE_ENVIRONMENT: 'production' },
    { COMMERCE_ENVIRONMENT: undefined },
    { MERCADOPAGO_ACCESS_TOKEN: '' },
    { MERCADOPAGO_ACCESS_TOKEN: 'Bearer APP_USR-invalid' },
    { MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-invalid\n' },
  ])('blocks configuration before fetch: %j', async (overrides) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const config = { ...env(), ...overrides };
    expect(testMode(config)).toBe(false);
    await expect(verifiedTestCredential(config)).rejects.toThrow('test-only');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...account, id: 3792015932 },
    { ...account, id: '9007199254740993' },
    { ...account, id: Number.MAX_SAFE_INTEGER + 1 },
    { ...account, id: undefined },
    { ...account, tags: [] },
    { ...account, tags: 'test_user' },
    { ...account, tags: undefined },
    { ...account, site_id: 'MLA' },
    null,
  ])('rejects unproven or real account: %j', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );
    await expect(verifiedTestCredential(env())).rejects.toThrow();
  });
  it.each([301, 302, 303, 307, 308, 401, 403, 500])(
    'denies HTTP %s without following Location',
    async (status) => {
      const fetch = vi.fn(
        async () => new Response(null, { status, headers: { Location: 'https://evil.invalid' } }),
      );
      vi.stubGlobal('fetch', fetch);
      await expect(verifiedTestCredential(env())).rejects.toThrow('identity');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].redirect).toBe('manual');
    },
  );
  it('rejects invalid JSON and timeouts', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('not-json'))
      .mockRejectedValueOnce(new DOMException('synthetic timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', fetch);
    await expect(verifiedTestCredential(env())).rejects.toThrow();
    await expect(verifiedTestCredential(env())).rejects.toThrow();
  });
  it('never caches approval across requests or token rotation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(account))
      .mockResolvedValueOnce(Response.json({ ...account, tags: [] }))
      .mockResolvedValueOnce(Response.json({ ...account, id: 1 }));
    vi.stubGlobal('fetch', fetch);
    const config = env();
    await verifiedTestCredential(config);
    await expect(verifiedTestCredential(config)).rejects.toThrow('identity');
    config.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-replacement-synthetic';
    await expect(verifiedTestCredential(config)).rejects.toThrow('identity');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe(
      'Bearer APP_USR-replacement-synthetic',
    );
  });
});
