import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { footerGroups, site } from '../../data/site';
import { BrazilFlag } from '../ui/BrazilFlag';
import { SocialIcon } from '../ui/SocialIcon';

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
    <footer className="site-footer rj-footer">
      <div className="rj-container rj-footer__grid">
        <div className="rj-footer__brand">
          <p className="rj-footer__statement">
            Pensamento independente.
            <br />
            Execução com propósito.
          </p>
          <p className="rj-footer__tagline">
            Estratégia, design e tecnologia para negócios. Conhecimento, produtos e experiências
            para pessoas.
          </p>
        </div>
        <nav className="rj-footer__nav" aria-label="Navegação do rodapé">
          {footerGroups.map((group) => (
            <ul key={group.label} aria-label={group.label}>
              {group.links.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to}>{label}</Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>
      <div className="rj-container rj-footer__bottom">
        <span>© 2026 Renata Join · {site.location}</span>
        <button ref={triggerRef} type="button" onClick={() => setLegalOpen(true)}>
          Informações legais
        </button>
        <ul className="rj-footer__social" aria-label="Redes e contato">
          <li>
            <a href={site.social.instagram} target="_blank" rel="noopener noreferrer">
              <SocialIcon name="instagram" />
              <span className="rj-sr-only">Instagram</span>
            </a>
          </li>
          <li>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer">
              <SocialIcon name="whatsapp" />
              <span className="rj-sr-only">WhatsApp</span>
            </a>
          </li>
          <li>
            <a href={site.social.github} target="_blank" rel="noopener noreferrer">
              <SocialIcon name="github" />
              <span className="rj-sr-only">GitHub</span>
            </a>
          </li>
          <li>
            <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer">
              <SocialIcon name="linkedin" />
              <span className="rj-sr-only">LinkedIn</span>
            </a>
          </li>
        </ul>
        <span className="rj-footer__motto">
          <em>Ad Dei gloriam.</em>
          <BrazilFlag />
        </span>
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
