export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
