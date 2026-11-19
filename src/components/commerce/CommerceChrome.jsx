import { Link } from 'react-router-dom';
import '../../styles/finance-product.css';

// Renata Join 2026 chrome shared by the landing and the commerce pages (summary,
// order and Minhas compras). The logo always points to the main site.
export const BRAND_HOME = 'https://renatajoin.com/';

export function CommerceHeader({ note = 'Produto digital · Feito no Brasil' }) {
  return (
    <>
      <a className="fj-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="fj-header">
        <div className="fj-wrap fj-header-inner">
          <a
            href={BRAND_HOME}
            className="fj-brand"
            aria-label="Renata Join — ir para renatajoin.com"
          >
            Renata <em>Join</em>
            <span aria-hidden="true">/ Shopping Join</span>
          </a>
          <span className="fj-header-note">{note}</span>
        </div>
      </header>
    </>
  );
}

export function CommerceFooter() {
  return (
    <footer className="fj-footer fj-wrap">
      <a href={BRAND_HOME}>RENATAJOIN</a>
      <span>Organização com personalidade. Feito no Brasil.</span>
      <Link to="/produtos-digitais">Condições dos produtos digitais</Link>
    </footer>
  );
}

// Full page shell for the commerce pages; the landing composes header/footer itself.
export function CommerceShell({ note, children }) {
  return (
    <div className="finance-landing fj-commerce">
      <CommerceHeader note={note} />
      <main id="conteudo">{children}</main>
      <CommerceFooter />
    </div>
  );
}
