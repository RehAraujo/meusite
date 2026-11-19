import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export function SiteLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return undefined;
    }
    // Navegação client-side não rola até âncoras (ex.: /servicos#diagnostico-inicial).
    const frame = window.requestAnimationFrame(() => {
      let target = null;
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch {
        target = null;
      }
      target?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  const cleanPath = pathname.replace(/\/$/, '');
  // The landing and the commerce pages (summary, order, Minhas compras) bring their own
  // Renata Join 2026 header and footer.
  if (['/meu-dinheiro-minhas-regras', '/checkout', '/minhas-compras'].includes(cleanPath))
    return <Outlet />;

  return (
    <>
      <Header />
      <main id="conteudo">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
