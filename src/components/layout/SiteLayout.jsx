import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export function SiteLayout() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  const cleanPath = pathname.replace(/\/$/, '');
  const financeCheckout = cleanPath === '/checkout' && new URLSearchParams(search).get('produto') === 'meu-dinheiro-minhas-regras' && !new URLSearchParams(search).has('pedido');
  if (cleanPath === '/meu-dinheiro-minhas-regras' || financeCheckout) return <Outlet />;

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
