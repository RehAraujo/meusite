import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navigation } from '../../data/site';

export function Header() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    const update = () => {
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maximum > 0 ? (window.scrollY / maximum) * 100 : 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <>
      {mounted && <div className="progress" style={{ transform: `scaleX(${progress / 100})` }} />}
      <header className="site-header">
        <Link className="logo" to="/" aria-label="Renata Join — página inicial">
          Renata <em>Join</em>
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Fechar' : 'Menu'}
        </button>
        <nav id="main-navigation" className={open ? 'navigation is-open' : 'navigation'}>
          {navigation.map(({ label, to }) =>
            to.includes('#') ? (
              <Link key={label} to={to}>
                {label}
              </Link>
            ) : (
              <NavLink key={label} to={to}>
                {label}
              </NavLink>
            ),
          )}
        </nav>
      </header>
    </>
  );
}
