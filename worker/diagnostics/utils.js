export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
export const id = (prefix) => `${prefix}.${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export const clean = (value, max = 1000) =>
  String(value || '')
    .replace(/[<>]/g, '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, max);
export const parseJson = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
export const hash = async (value) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

export function normalizeSite(value) {
  const candidate = clean(value, 200);
  const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error('Domínio inválido.');
  const host = url.hostname.toLowerCase();
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  )
    throw new Error('Use um domínio público.');
  return `https://${host}/`;
}

export const normalizeInstagram = (value) => {
  const handle = clean(value, 31).replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) throw new Error('@ do Instagram inválido.');
  return `@${handle}`;
};
