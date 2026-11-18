import { useEffect } from 'react';

/*
 * Linguagem "Linha de construção": o conteúdo nasce visível no HTML
 * pré-renderizado. Depois da hidratação, só o que está abaixo da dobra é
 * preparado para revelar — nada que já está na tela pisca ou some.
 */
export const useRjReveal = (rootRef) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const elements = [...root.querySelectorAll('[data-rj-reveal]')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.setAttribute('data-rj-in', ''));
      return undefined;
    }

    const viewport = window.innerHeight;
    elements.forEach((element) => {
      const { top } = element.getBoundingClientRect();
      if (top < viewport * 0.92) element.setAttribute('data-rj-in', '');
    });
    root.setAttribute('data-rj-motion', 'ready');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-rj-in', '');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    elements
      .filter((element) => !element.hasAttribute('data-rj-in'))
      .forEach((element) => observer.observe(element));

    // Loops ambientes (órbitas, faixa de temas) só rodam enquanto visíveis.
    const loopObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) =>
        entry.target.toggleAttribute('data-rj-active', entry.isIntersecting),
      );
    });
    root.querySelectorAll('[data-rj-loop]').forEach((element) => loopObserver.observe(element));

    return () => {
      observer.disconnect();
      loopObserver.disconnect();
      root.removeAttribute('data-rj-motion');
    };
  }, [rootRef]);
};
