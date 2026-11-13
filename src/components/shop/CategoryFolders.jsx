import { statusLabels } from '../../data/shopping';

/*
 * Categorias como pastas de arquivo: aba numerada, uma foto que sai da pasta no
 * hover/foco e o resumo do conteúdo. Cada pasta é um botão que filtra a vitrine.
 */
const summary = (category, products) => {
  const count = products.filter((item) => item.category === category.id).length;
  if (category.status === 'em-breve' || count === 0) return statusLabels['em-breve'];
  const noun = count === 1 ? 'item' : 'itens';
  if (category.status === 'demonstrativo') return `${count} ${noun} · sob orçamento`;
  return `${count} ${count === 1 ? 'produto' : 'produtos'}`;
};

export function CategoryFolders({ categories, products, active, onSelect }) {
  return (
    <ul className="rj-folders" aria-label="Pastas de categorias">
      {categories.map((category, index) => (
        <li key={category.id} data-rj-reveal style={{ '--rj-i': index }}>
          <button
            type="button"
            className={`rj-folder rj-folder--${category.tone}`}
            aria-pressed={active === category.id}
            aria-controls="vitrine"
            onClick={() => onSelect(category.id)}
          >
            <span className="rj-folder__tab">
              <span>{category.number}</span>
              {category.status === 'em-breve' ? <small>Em breve</small> : null}
            </span>
            <span className="rj-folder__sheet" aria-hidden="true">
              <img
                src={category.image}
                srcSet={category.imageSet}
                sizes="(width <= 48rem) 40vw, 16rem"
                alt=""
                width="480"
                height="640"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="rj-folder__body">
              <strong>{category.label}</strong>
              <span className="rj-folder__description">{category.description}</span>
              <span className="rj-folder__meta">
                {summary(category, products)}
                <i aria-hidden="true">→</i>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
