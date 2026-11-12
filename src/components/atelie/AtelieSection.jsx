import { Link } from 'react-router-dom';
import { AtelieGallery } from './AtelieGallery';

// Seção "Ateliê" da Home (prevista para ficar imediatamente antes do rodapé).
export function AtelieSection({ section, works }) {
  return (
    <section className="rj-section rj-atelie-section" id="atelie" aria-labelledby="atelie-title">
      <div className="rj-container">
        <header className="rj-atelie-section__header">
          <h2 id="atelie-title">{section.title}</h2>
          <p>{section.description}</p>
        </header>
        <AtelieGallery items={works} initialIndex={section.initialIndex}>
          {section.cta && (
            <Link className="rj-link rj-atelie-section__cta" to={section.cta.to}>
              {section.cta.label} <i aria-hidden="true">→</i>
            </Link>
          )}
        </AtelieGallery>
      </div>
    </section>
  );
}
