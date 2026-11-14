import { useId, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';

/*
 * Arquivo JOIN: os universos do Shopping como pastas num arquivo, em coverflow.
 * A pasta ativa fica ao centro, um pouco à frente; as vizinhas se sobrepõem
 * recuadas em escala e profundidade, sem rotação 3D. Padrão de abas WAI-ARIA:
 * clique, setas, Home e End; no toque, arrastar para os lados troca a pasta.
 * O detalhe da pasta ativa (descrição e CTA) fica abaixo, no painel da aba.
 */
const statusText = {
  disponivel: 'Disponível',
  ilustrativo: 'Preços ilustrativos · sob orçamento',
  'em-breve': 'Em breve',
};

// Posição de cada pasta pela distância até a ativa (em % da largura da pasta).
const place = (offset) => {
  const distance = Math.abs(offset);
  const x = distance === 0 ? 0 : Math.sign(offset) * (62 + (distance - 1) * 32);
  return {
    x: `${x}%`,
    scale: distance === 0 ? 1 : Math.max(0.74, 0.9 - (distance - 1) * 0.07),
    y: distance === 0 ? -10 : 0,
    opacity: distance > 2 ? 0 : 1,
    zIndex: 20 - distance,
  };
};

export function ArchiveFolders({ categories, counts, initial = categories[0].id }) {
  const [active, setActive] = useState(initial);
  const reduce = useReducedMotion();
  const baseId = useId();
  const tabRefs = useRef([]);
  const index = categories.findIndex((item) => item.id === active);
  const current = categories[index];
  const count = counts[current.id] ?? 0;

  const total = categories.length;
  // Arquivo circular: sempre há pastas dos dois lados da ativa.
  const offsetOf = (i) =>
    ((i - index + total + Math.floor(total / 2)) % total) - Math.floor(total / 2);

  const go = (next, { focus = false } = {}) => {
    const target = (next + total) % total;
    setActive(categories[target].id);
    if (focus) tabRefs.current[target]?.focus();
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
    go(keys[event.key], { focus: true });
  };

  // Gesto no toque: deslizar o palco para os lados avança ou volta uma pasta.
  // O clique que encerra um deslize é ignorado, para não selecionar outra pasta.
  const swipe = useRef({ x: null, moved: false });
  const onPointerDown = (event) => {
    swipe.current = { x: event.clientX, moved: false };
  };
  const onPointerUp = (event) => {
    const start = swipe.current.x;
    if (start === null) return;
    const delta = event.clientX - start;
    swipe.current.x = null;
    if (Math.abs(delta) < 40) return;
    swipe.current.moved = true;
    go(index + (delta < 0 ? 1 : -1));
  };
  const onClickCapture = (event) => {
    if (!swipe.current.moved) return;
    swipe.current.moved = false;
    event.stopPropagation();
    event.preventDefault();
  };

  const transition = reduce
    ? { duration: 0 }
    : { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 };

  return (
    <div className="rj-coverflow">
      <div
        className="rj-coverflow__stage"
        role="tablist"
        aria-label="Universos do Shopping JOIN"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current.x = null;
        }}
        onClickCapture={onClickCapture}
      >
        {categories.map((category, i) => {
          const selected = category.id === active;
          return (
            <m.button
              key={category.id}
              ref={(node) => {
                tabRefs.current[i] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${category.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`rj-folder-card rj-tone--${category.tone}`}
              initial={false}
              animate={place(offsetOf(i))}
              transition={transition}
              onClick={() => go(i)}
              onKeyDown={onKeyDown}
            >
              <span className="rj-folder-card__tab">
                <span className="rj-folder-card__number">{category.number}</span>
                <span className="rj-folder-card__label">{category.label}</span>
                {category.status === 'em-breve' ? (
                  <span className="rj-sr-only"> (em breve)</span>
                ) : null}
              </span>
              <span className="rj-folder-card__body" aria-hidden="true">
                {category.image ? (
                  <img
                    src={category.image}
                    srcSet={category.imageSet ?? undefined}
                    sizes="(width <= 40rem) 12rem, 16rem"
                    alt=""
                    width="480"
                    height="600"
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                  />
                ) : (
                  <span className="rj-folder-card__type">{category.label}</span>
                )}
                {category.status === 'em-breve' ? (
                  <span className="rj-folder-card__soon">Em breve</span>
                ) : null}
              </span>
            </m.button>
          );
        })}
      </div>

      <div
        className="rj-coverflow__panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
      >
        <div className="rj-coverflow__info" aria-live="polite">
          <p className="rj-coverflow__kicker">
            {current.number} / {String(categories.length).padStart(2, '0')}
            {current.signature ? ` · Assinatura ${current.signature}` : ''}
          </p>
          <h3 className="rj-coverflow__title">{current.label}</h3>
          <p className="rj-coverflow__description">{current.description}</p>
          <p className="rj-coverflow__meta">
            {statusText[current.status]}
            {count > 0 ? ` · ${count} ${count === 1 ? 'produto' : 'produtos'}` : ''}
          </p>
        </div>
        <div className="rj-coverflow__actions">
          <Link className="rj-coverflow__cta" to={current.path}>
            {current.status === 'em-breve' ? 'Conhecer o universo' : 'Abrir a categoria'}
            <span className="rj-sr-only">: {current.label}</span>
            <i aria-hidden="true">→</i>
          </Link>
          <div className="rj-coverflow__nav">
            <button type="button" onClick={() => go(index - 1)} aria-label="Pasta anterior">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Próxima pasta">
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
