import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const AUTOPLAY_DELAY = 6500;

export function BrandGallery({ items }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const rootRef = useRef(null);
  const activeItem = items[activeIndex];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !isInView || isPaused || document.hidden) return undefined;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % items.length),
      AUTOPLAY_DELAY,
    );
    return () => window.clearInterval(timer);
  }, [isInView, isPaused, items.length, prefersReducedMotion]);

  const selectItem = (index) => setActiveIndex(index);
  const move = (direction) => {
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  return (
    <div
      className="brand-gallery"
      ref={rootRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      <div className="brand-gallery__nav" role="tablist" aria-label="Capítulos da identidade TED TEC">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`brand-tab-${item.id}`}
            aria-controls={`brand-panel-${item.id}`}
            aria-selected={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => selectItem(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{item.label}</strong>
            <small>{item.summary}</small>
          </button>
        ))}
        <div className="brand-gallery__controls" aria-label="Navegação da galeria">
          <button type="button" onClick={() => move(-1)} aria-label="Capítulo anterior">
            ←
          </button>
          <span aria-live="polite">
            {String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
          <button type="button" onClick={() => move(1)} aria-label="Próximo capítulo">
            →
          </button>
        </div>
      </div>

      <div className="brand-gallery__stage">
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="wait" initial={false}>
            <m.figure
              key={activeItem.id}
              role="tabpanel"
              id={`brand-panel-${activeItem.id}`}
              aria-labelledby={`brand-tab-${activeItem.id}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={activeItem.image}
                alt={activeItem.alt}
                width="1080"
                height="1350"
                loading={activeIndex === 0 ? 'eager' : 'lazy'}
              />
              <figcaption>{activeItem.caption}</figcaption>
            </m.figure>
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
}
