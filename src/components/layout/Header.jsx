import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navigation } from '../../data/site';
import { AccountEntry } from './AccountEntry';

export function Header() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const buttonRef = useRef(null);
  const headerRef = useRef(null);
  const location = useLocation();

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maximum > 0 ? (window.scrollY / maximum) * 100 : 0);
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpen(false);
    };
    const onFocusIn = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return (
    <>
      {mounted && (
        <div
          className="progress rj-progress"
          style={{ transform: `scaleX(${progress / 100})` }}
          aria-hidden="true"
        />
      )}
      <header ref={headerRef} className={`site-header rj-header${scrolled ? ' is-scrolled' : ''}`}>
        <Link className="rj-logo" to="/" aria-label="Renata Join — página inicial">
          Renata<em>Join</em>
        </Link>
        <button
          ref={buttonRef}
          className="rj-menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="rj-menu-button__icon" aria-hidden="true">
            <i />
            <i />
          </span>
          {open ? 'Fechar' : 'Menu'}
        </button>
        <nav
          id="main-navigation"
          aria-label="Navegação principal"
          className={open ? 'rj-nav is-open' : 'rj-nav'}
        >
          {navigation
            .filter(({ emphasis }) => !emphasis)
            .map(({ label, to }) =>
              to.includes('#') ? (
                <Link key={label} className="rj-nav__link" to={to}>
                  {label}
                </Link>
              ) : (
                <NavLink key={label} className="rj-nav__link" to={to}>
                  {label}
                </NavLink>
              ),
            )}
          <span className="rj-nav__actions">
            <AccountEntry />
            {navigation
              .filter(({ emphasis }) => emphasis)
              .map(({ label, to }) => (
                <Link key={label} className="rj-nav__cta" to={to}>
                  <span className="rj-nav__cta-dot" aria-hidden="true" />
                  {label}
                </Link>
              ))}
          </span>
        </nav>
      </header>
    </>
  );
}
