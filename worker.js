import { handleDiagnostics, processOrder } from './worker/diagnostics/handler.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/diagnostics')) {
      return handleDiagnostics(request, env, url);
    }

    if (url.pathname === "/wrangler.jsonc") {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }

    return env.ASSETS.fetch(request);
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try { await processOrder(env, message.body.order_id); message.ack(); }
      catch { message.retry({ delaySeconds: 30 }); }
    }
  },
};
