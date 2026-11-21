import { handleCommerce, logEvent } from './handler.js';
import { runReconciler } from './ledger/pix.js';

// This entry point has no diagnostics, AI, queue or production-resource dependency.
export default {
  // Payment reconciler (only does work with COMMERCE_LEDGER=on); see ledger/pix.js.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runReconciler(env, { log: logEvent }).then(
        (result) => logEvent('reconciler_run', { detail: result.skipped ?? 'done', status: result.failures ?? 0 }),
        (error) => logEvent('reconciler_failed', { error }),
      ),
    );
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/commerce' || url.pathname.startsWith('/api/commerce/')) {
      return handleCommerce(request, env, url, ctx);
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/wrangler.jsonc') {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
