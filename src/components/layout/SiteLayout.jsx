import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export function SiteLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

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
