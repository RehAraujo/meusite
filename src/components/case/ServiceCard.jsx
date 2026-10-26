import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';

export function ServiceCard({ index, title, children, href, ariaLabel }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <m.a
        className="case-service-card"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        whileHover={prefersReducedMotion ? undefined : { y: -4 }}
        whileFocus={prefersReducedMotion ? undefined : { y: -3 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <span>{index}</span>
        <h3>{title}</h3>
        <p>{children}</p>
        <span className="case-service-card__action" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M20.5 11.8a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.3-4.4A8.4 8.4 0 1 1 20.5 11.8Z" />
            <path d="M8.4 7.7c.2-.4.4-.4.7-.4h.4c.1 0 .3 0 .4.4l.8 1.9c.1.2.1.4 0 .6l-.6.8c-.2.2-.2.4 0 .7.5.9 1.2 1.6 2.1 2.1.3.2.5.2.7 0l.9-1c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.4-.8 1.9-.5.5-1.2.8-2 .7-1.2-.2-2.9-.8-4.7-2.4-1.5-1.4-2.5-3.1-2.7-4.3-.2-1 .3-1.8.7-2.3Z" />
          </svg>
          <i>↗</i>
        </span>
      </m.a>
    </LazyMotion>
  );
}
