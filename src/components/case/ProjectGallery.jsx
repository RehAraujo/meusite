import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';

const projects = [
  {
    name: 'ASLU',
    category: 'Identidade · Experiência',
    description: 'Case em preparação.',
    initials: 'AS',
    accent: '#d84d88',
    surface: '#f2d7e2',
  },
  {
    name: 'Potência Solar',
    category: 'Estratégia · Sistemas',
    description: 'Case em preparação.',
    initials: 'PS',
    accent: '#c98245',
    surface: '#eddcc9',
  },
];

export function ProjectGallery() {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const project = projects[activeIndex];

  const move = (direction) => {
    setActiveIndex((current) => (current + direction + projects.length) % projects.length);
  };

  const handlePointerUp = (event) => {
    if (touchStart.current === null) return;
    const distance = event.clientX - touchStart.current;
    if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
    touchStart.current = null;
  };

  return (
    <div
      className="project-gallery"
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') touchStart.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') handlePointerUp(event);
      }}
    >
      <div className="project-gallery__visual" aria-hidden="true">
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              className="project-gallery__stack"
              key={project.name}
              style={{ '--project-accent': project.accent, '--project-surface': project.surface }}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="project-gallery__layer project-gallery__layer--back" />
              <span className="project-gallery__layer project-gallery__layer--middle" />
              <span className="project-gallery__cover">
                <small>Em breve</small>
                <strong>{project.initials}</strong>
                <em>{project.name}</em>
              </span>
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </div>

      <div className="project-gallery__content">
        <p className="eyebrow">Próximo projeto</p>
        <div className="project-gallery__live" aria-live="polite">
          <LazyMotion features={domAnimation}>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={project.name}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
              >
                <h3>{project.name}</h3>
                <p className="project-gallery__category">{project.category}</p>
                <p>{project.description}</p>
              </m.div>
            </AnimatePresence>
          </LazyMotion>
        </div>
        <div className="project-gallery__controls" aria-label="Navegação entre projetos">
          <button type="button" onClick={() => move(-1)} aria-label="Projeto anterior">
            ←
          </button>
          <span aria-hidden="true">
            {String(activeIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
          </span>
          <button type="button" onClick={() => move(1)} aria-label="Próximo projeto">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
