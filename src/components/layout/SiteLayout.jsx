import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export function SiteLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

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
