import { handleCommerce } from './handler.js';

// Dedicated entry point; the existing site and diagnostics bindings are not used here.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.COMMERCE_ENVIRONMENT !== 'production' || url.origin !== env.COMMERCE_ORIGIN ||
        env.COMMERCE_ORIGIN !== env.COMMERCE_PRODUCTION_ORIGIN) {
      return new Response('Serviço indisponível.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/api/commerce' || url.pathname.startsWith('/api/commerce/'))
      return handleCommerce(request, env, url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/wrangler.jsonc')
      return new Response('Not Found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
