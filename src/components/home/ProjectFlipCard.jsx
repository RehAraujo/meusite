import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/*
 * Card de case com frente e verso (só quando há texto real para o verso).
 * - Mouse: o hover vira o card; o botão "Voltar" e um novo clique também funcionam.
 * - Toque e teclado: botão na frente (Enter/Espaço) vira; "Voltar" ou Esc desvira.
 * - O verso fica sempre no DOM e legível por leitores de tela; seus controles
 *   só entram na ordem de tabulação quando estão visíveis.
 * - Com "reduzir movimento", a troca é um esmaecimento, sem rotação (CSS).
 * O card inteiro não é um link: o CTA do case fica no verso, quando existe.
 */
// Card estático: projetos sem texto real aprovado para o verso (`back: null`).
// Para ativar a virada depois, basta preencher `back` em src/data/home.js.
export function ProjectFlipCard({ project }) {
  return project.back ? <FlippingCard project={project} /> : <StaticCard project={project} />;
}

function CardMedia({ project }) {
  return (
    <span className="rj-project__media">
      {project.image ? (
        <img src={project.image} alt={project.imageAlt} width="592" height="528" loading="lazy" />
      ) : (
        <span className="rj-project__placeholder" aria-hidden="true">
          {project.name
            .split(' ')
            .map((word) => word[0])
            .join('')}
        </span>
      )}
    </span>
  );
}

function StaticCard({ project }) {
  const titleId = useId();
  return (
    <div className="rj-flip rj-flip--static">
      <div className="rj-flip__inner">
        <article className="rj-flip__face rj-flip__front" aria-labelledby={titleId}>
          <CardMedia project={project} />
          <span className="rj-project__body">
            <small>{project.category}</small>
            <strong id={titleId}>{project.name}</strong>
          </span>
        </article>
      </div>
    </div>
  );
}

function FlippingCard({ project }) {
  const [flipped, setFlipped] = useState(false);
  const toggleRef = useRef(null);
  const backRef = useRef(null);
  const focusTarget = useRef(null);
  const backId = useId();
  const titleId = useId();

  useEffect(() => {
    if (focusTarget.current === 'back') backRef.current?.focus({ preventScroll: true });
    if (focusTarget.current === 'front') toggleRef.current?.focus({ preventScroll: true });
    focusTarget.current = null;
  }, [flipped]);

  const flip = (next, moveFocus) => {
    focusTarget.current = moveFocus ? (next ? 'back' : 'front') : null;
    setFlipped(next);
  };

  // Hover só em dispositivos com mouse de verdade; no toque, vale o botão.
  const canHover = (event) =>
    event.pointerType === 'mouse' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointerEnter = (event) => {
    if (canHover(event)) flip(true, false);
  };
  const onPointerLeave = (event) => {
    if (canHover(event)) flip(false, false);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && flipped) {
      event.stopPropagation();
      flip(false, true);
    }
  };

  const { back } = project;

  return (
    // Eventos de ponteiro só antecipam a virada para mouse; os controles reais são botões.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="rj-flip"
      data-flipped={flipped || undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      <div className="rj-flip__inner">
        <article className="rj-flip__face rj-flip__front" aria-labelledby={titleId}>
          <CardMedia project={project} />
          <span className="rj-project__body">
            <small>{project.category}</small>
            <strong id={titleId}>{project.name}</strong>
            <button
              ref={toggleRef}
              className="rj-flip__toggle"
              type="button"
              aria-expanded={flipped}
              aria-controls={backId}
              tabIndex={flipped ? -1 : 0}
              onClick={() => flip(true, true)}
            >
              <span>Sobre o projeto</span>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6M4 20v-4h4" />
              </svg>
            </button>
          </span>
        </article>

        <section
          ref={backRef}
          id={backId}
          className="rj-flip__face rj-flip__back"
          aria-label={`${project.name}: detalhes do projeto`}
          tabIndex={-1}
        >
          <small className="rj-flip__kicker">{project.name}</small>
          <h3 className="rj-flip__title">{back.title}</h3>
          <dl className="rj-flip__details">
            <div>
              <dt>Contexto</dt>
              <dd>{back.context}</dd>
            </div>
            <div>
              <dt>Solução</dt>
              <dd>{back.solution}</dd>
            </div>
          </dl>
          <div className="rj-flip__actions">
            {project.href && (
              <Link className="rj-flip__cta" to={project.href} tabIndex={flipped ? 0 : -1}>
                Conhecer o case <span aria-hidden="true">↗</span>
              </Link>
            )}
            <button
              className="rj-flip__back-button"
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={() => flip(false, true)}
            >
              Voltar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
