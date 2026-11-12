import { Link } from 'react-router-dom';
import { AtelieGallery } from '../components/atelie/AtelieGallery';
import { atelieSection, atelieWorks } from '../data/atelie';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/*
 * /atelie/: página provisória. Mostra a mesma curadoria da Home e avisa que o
 * acervo completo chega em breve. Fica fora do sitemap e com noindex até o acervo existir.
 */
export default function AteliePage() {
  useDocumentMeta({
    title: 'Ateliê | Renata Join',
    description: atelieSection.description,
    path: '/atelie/',
    noindex: true,
  });

  return (
    <div className="rj-home">
      <section
        className="rj-section rj-atelie-section rj-atelie-page"
        aria-labelledby="atelie-page-title"
      >
        <div className="rj-container">
          <header className="rj-atelie-section__header">
            <h1 id="atelie-page-title">{atelieSection.title}</h1>
            <p>{atelieSection.description}</p>
          </header>
          <AtelieGallery items={atelieWorks} initialIndex={atelieSection.initialIndex}>
            <Link className="rj-link rj-atelie-section__cta" to="/">
              <i aria-hidden="true">←</i> Voltar ao início
            </Link>
          </AtelieGallery>
          <p className="rj-atelie-page__note">
            <span className="rj-atelie-page__status">Em breve</span>O acervo completo, com
            fotografias, desenhos, ilustrações e experimentações visuais, estará disponível em
            breve.
          </p>
        </div>
      </section>
    </div>
  );
}
