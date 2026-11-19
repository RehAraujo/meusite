// Meu Dinheiro, Minhas Regras is sold only on the Shopping domain, which has its own Worker
// and commerce backend. On the main domain these pages would load without that backend, so
// they move permanently to the Shopping host with the same path and query string. The
// Shopping host itself is never redirected (no loop), and nothing is logged.
export const SHOPPING_ORIGIN = "https://shopping.renatajoin.com";
const SHOPPING_HOST = new URL(SHOPPING_ORIGIN).hostname;
const COMMERCE_PAGE = /^\/(meu-dinheiro-minhas-regras|checkout|minhas-compras)(\/|\/index\.html)?$/;

export function shoppingRedirect(url) {
  if (url.hostname === SHOPPING_HOST || !COMMERCE_PAGE.test(url.pathname)) return null;
  return new Response(null, {
    status: 301,
    headers: {
      Location: `${SHOPPING_ORIGIN}${url.pathname}${url.search}`,
      "Cache-Control": "public, max-age=86400",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const redirect = shoppingRedirect(url);
    if (redirect) return redirect;

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
  }
};
