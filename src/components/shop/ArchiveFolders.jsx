import { useId, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';

/*
 * Arquivo JOIN: os universos do Shopping como uma pilha de pastas físicas.
 * As abas ficam escalonadas sobre a pasta aberta; atrás dela, as bordas das
 * próximas pastas dão profundidade. Padrão de abas do WAI-ARIA: setas, Home e
 * End mudam a pasta (ativação automática); Tab entra no conteúdo da pasta.
 */
const statusText = {
  disponivel: 'Disponível',
  ilustrativo: 'Preços ilustrativos · sob orçamento',
  'em-breve': 'Em breve',
};

export function ArchiveFolders({ categories, counts, initial = categories[0].id }) {
  const [active, setActive] = useState(initial);
  // A pasta inicial nasce visível (HTML pré-renderizado); só as trocas animam.
  const [touched, setTouched] = useState(false);
  const open = (id) => {
    setTouched(true);
    setActive(id);
  };
  const reduce = useReducedMotion();
  const baseId = useId();
  const tabRefs = useRef([]);
  const index = categories.findIndex((item) => item.id === active);
  const current = categories[index];
  const behind = [1, 2].map((step) => categories[(index + step) % categories.length]);

  const select = (next) => {
    const target = (next + categories.length) % categories.length;
    open(categories[target].id);
    tabRefs.current[target]?.focus();
  };

  const onKeyDown = (event) => {
    const keys = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: categories.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key]);
  };

  const count = counts[current.id] ?? 0;

  return (
    <div className="rj-archive">
      <div className="rj-archive__tabs" role="tablist" aria-label="Universos do Shopping JOIN">
        {categories.map((category, i) => (
          <button
            key={category.id}
            ref={(node) => {
              tabRefs.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${category.id}`}
            aria-selected={category.id === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={category.id === active ? 0 : -1}
            className={`rj-archive__tab rj-tone--${category.tone}`}
            style={{ '--rj-i': i }}
            onClick={() => open(category.id)}
            onKeyDown={onKeyDown}
          >
            <span className="rj-archive__tab-number">{category.number}</span>
            <span className="rj-archive__tab-label">{category.label}</span>
            {category.status === 'em-breve' ? (
              <span className="rj-sr-only"> (em breve)</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="rj-archive__stack">
        {behind.map((category, depth) => (
          <span
            key={`${category.id}-${depth}`}
            className={`rj-archive__behind rj-tone--${category.tone}`}
            style={{ '--rj-depth': depth + 1 }}
            aria-hidden="true"
          />
        ))}

        <div
          className={`rj-archive__panel rj-tone--${current.tone}`}
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${current.id}`}
        >
          <m.div
            key={current.id}
            className="rj-archive__content"
            initial={touched ? (reduce ? { opacity: 0 } : { opacity: 0, y: 18 }) : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rj-archive__copy">
              <p className="rj-archive__kicker">
                <span>{current.number}</span>
                {current.signature ? ` · Assinatura ${current.signature}` : null}
              </p>
              <h3 className="rj-archive__title">{current.label}</h3>
              <p className="rj-archive__description">{current.description}</p>
              <p className="rj-archive__meta">
                {statusText[current.status]}
                {count > 0 ? ` · ${count} ${count === 1 ? 'produto' : 'produtos'}` : null}
              </p>
              <Link className="rj-archive__cta" to={current.path}>
                {current.status === 'em-breve' ? 'Conhecer o universo' : 'Abrir a categoria'}
                <span className="rj-sr-only">: {current.label}</span>
                <i aria-hidden="true">→</i>
              </Link>
            </div>
            <figure className="rj-archive__sheet" aria-hidden="true">
              {current.image ? (
                <img
                  src={current.image}
                  srcSet={current.imageSet ?? undefined}
                  sizes="(width <= 48rem) 40vw, 15rem"
                  alt=""
                  width="480"
                  height="600"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span>{current.label}</span>
              )}
            </figure>
          </m.div>
        </div>
      </div>
    </div>
  );
}
