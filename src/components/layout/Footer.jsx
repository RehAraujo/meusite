import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { footerLinks, site } from '../../data/site';

/* Mouse dismissal supplements the modal's native close button and Escape behavior. */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

export function Footer() {
  const [legalOpen, setLegalOpen] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!legalOpen) return undefined;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const focusable = [...dialog.querySelectorAll('a, button')];
    focusable[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setLegalOpen(false);
      if (event.key === 'Tab' && focusable.length) {
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [legalOpen]);

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <p className="footer-statement">Toda boa construção começa pela identidade.</p>
        <nav aria-label="Navegação do rodapé">
          {footerLinks.map(({ label, to }) => (
            <Link key={label} to={to}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Renata Join</span>
        <span>{site.location}</span>
        <button ref={triggerRef} type="button" onClick={() => setLegalOpen(true)}>
          Informações legais
        </button>
        <em>Ad Dei gloriam.</em>
      </div>
      {legalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setLegalOpen(false)}>
          <section
            className="legal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-title"
            ref={dialogRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="dialog-close" type="button" onClick={() => setLegalOpen(false)}>
              Fechar
            </button>
            <p className="eyebrow">Institucional</p>
            <h2 id="legal-title">Informações legais</h2>
            <dl>
              <div>
                <dt>Empresa</dt>
                <dd>{site.legalName}</dd>
              </div>
              <div>
                <dt>CNPJ</dt>
                <dd>53.373.466/0001-07</dd>
              </div>
            </dl>
            <nav aria-label="Documentos legais">
              <Link to="/privacidade">Política de Privacidade</Link>
              <Link to="/termos">Termos de Uso</Link>
              <Link to="/produtos-digitais">Produtos Digitais</Link>
              <Link to="/#contato">Contato</Link>
            </nav>
          </section>
        </div>
      )}
    </footer>
  );
}
