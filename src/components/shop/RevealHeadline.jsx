import { useEffect } from 'react';
import { animate, m, useMotionValue, useScroll, useTransform } from 'motion/react';
import { useScrollMotionReady } from '../../hooks/useScrollMotionReady';

/*
 * Headline do hero revelada em três tempos: a primeira frase surge na entrada;
 * as seguintes acompanham os primeiros ~140 px de rolagem (sem prender o scroll).
 * Se a pessoa não rolar, a frase se completa sozinha em seguida, para nunca
 * ficar pela metade. O HTML pré-renderizado e "reduzir movimento" mostram a
 * frase inteira, sem animação.
 */
const SCROLL_RANGE = 140;

function Part({ progress, range, children, as = 'span' }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const y = useTransform(progress, range, ['0.18em', '0em']);
  const Component = m[as];
  return <Component style={{ opacity, y }}>{children}</Component>;
}

export function RevealHeadline({ id, parts }) {
  const ready = useScrollMotionReady();
  const { scrollY } = useScroll();
  const idle = useMotionValue(0);
  const scrolled = useTransform(scrollY, [0, SCROLL_RANGE], [0, 1]);
  const progress = useTransform(() => Math.max(idle.get(), scrolled.get()));

  useEffect(() => {
    if (!ready) return undefined;
    const controls = animate(idle, 1, { delay: 1.2, duration: 1.8, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [ready, idle]);

  const [first, second, third] = parts;
  return (
    <h1 id={id} className="rj-shop-headline" data-motion={ready ? 'on' : 'off'}>
      <span className="rj-shop-headline__first">{first}</span>{' '}
      {ready ? (
        <>
          <Part progress={progress} range={[0.04, 0.5]}>
            {second}
          </Part>{' '}
          <Part progress={progress} range={[0.45, 1]} as="em">
            {third}
          </Part>
        </>
      ) : (
        <>
          <span>{second}</span> <em>{third}</em>
        </>
      )}
    </h1>
  );
}
