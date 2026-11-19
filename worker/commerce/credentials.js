const TEST_SELLER = '3792015931';
const numericId = (value) => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value);
const credentialPresent = (env) => typeof env.MERCADOPAGO_ACCESS_TOKEN === 'string' && /^[-A-Za-z0-9_]+$/.test(env.MERCADOPAGO_ACCESS_TOKEN);
export function testMode(env) {
  return env.COMMERCE_ENVIRONMENT === 'staging' && env.COMMERCE_MODE === 'test' && credentialPresent(env);
}
export function productionMode(env) {
  return env.COMMERCE_ENVIRONMENT === 'production';
}
export function commerceMode(env) {
  if (testMode(env)) return true;
  if (!productionMode(env) || env.COMMERCE_MODE !== 'production' || !credentialPresent(env) ||
      !numericId(env.COMMERCE_SELLER_ID) || [TEST_SELLER, '3792015935'].includes(env.COMMERCE_SELLER_ID) ||
      !numericId(env.COMMERCE_APPLICATION_ID)) return false;
  try {
    const origin = new URL(env.COMMERCE_PRODUCTION_ORIGIN);
    return origin.origin === env.COMMERCE_ORIGIN && origin.origin === env.COMMERCE_PRODUCTION_ORIGIN &&
      origin.protocol === 'https:' && !origin.port && !origin.username && !origin.password &&
      origin.hostname.endsWith('.renatajoin.com') && origin.hostname !== 'homologacao.renatajoin.com';
  } catch { return false; }
}
export function validProviderOrder(remote, env) {
  if (productionMode(env)) {
    // Orders documentation may omit live_mode. Seller/application identity is checked separately.
    return /^ORD(?!TST)[A-Z0-9]{10,64}$/.test(remote?.id || '') && (remote.live_mode === undefined || remote.live_mode === true);
  }
  return env.COMMERCE_ENVIRONMENT === 'staging' && /^ORDTST[A-Z0-9]{10,64}$/.test(remote?.id || '') && (remote.live_mode === undefined || remote.live_mode === false);
}
async function identity(env) {
  const response = await fetch('https://api.mercadolibre.com/users/me', {
    method: 'GET', headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000), redirect: 'manual', cache: 'no-store',
  });
  if (!response.ok || response.status !== 200) { await response.body?.cancel(); throw new Error('identity'); }
  const account = await response.json();
  const id = typeof account?.id === 'string' && numericId(account.id) ? account.id : Number.isSafeInteger(account?.id) && account.id > 0 ? String(account.id) : null;
  const production = productionMode(env);
  if (id !== (production ? env.COMMERCE_SELLER_ID : TEST_SELLER) || account.site_id !== 'MLB' ||
      !Array.isArray(account.tags) || (production ? account.tags.includes('test_user') : !account.tags.includes('test_user')))
    throw new Error('identity');
  return env.MERCADOPAGO_ACCESS_TOKEN;
}
export async function verifiedTestCredential(env) {
  if (!testMode(env)) throw new Error('test-only');
  return identity(env);
}
export async function verifiedCredential(env) {
  if (!commerceMode(env)) throw new Error('environment-disabled');
  return identity(env);
}
