import { Fragment, useRef } from 'react';
import { m, useScroll, useTransform } from 'motion/react';
import { useScrollMotionReady } from '../../hooks/useScrollMotionReady';

/*
 * Movimento vinculado à rolagem (scroll nativo + motion, sem dependências novas).
 * O HTML pré-renderizado nasce no estado final; os estilos de scroll só entram
 * depois da hidratação e nunca com "reduzir movimento". Assim não há conteúdo
 * escondido sem JavaScript nem diferença entre servidor e cliente.
 */
const ENTER = ['start 96%', 'start 62%'];

// Entrada progressiva: pequeno deslocamento vertical e opacidade.
export function ScrollRise({ as = 'div', distance = 36, offset = ENTER, style, ...props }) {
  const ref = useRef(null);
  const ready = useScrollMotionReady();
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const y = useTransform(scrollYProgress, [0, 1], [distance, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [0, 1]);
  const Component = m[as];
  return <Component ref={ref} style={ready ? { ...style, y, opacity } : style} {...props} />;
}

// Profundidade mínima: a imagem desliza alguns pixels enquanto a seção passa.
// Usa uma leve ampliação uniforme (sem distorção) para não abrir bordas.
export function ScrollDepth({ as = 'div', range = 14, style, ...props }) {
  const ref = useRef(null);
  const ready = useScrollMotionReady();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [range, -range]);
  const Component = m[as];
  return <Component ref={ref} style={ready ? { ...style, y, scale: 1.06 } : style} {...props} />;
}

/*
 * Interação editorial única: os caracteres se organizam durante a rolagem.
 * Deslocamentos curtos e determinísticos (sem dispersão nem rotação grande).
 */
function ScrollCharacter({ char, index, total, progress }) {
  const start = (index / total) * 0.55;
  const end = start + 0.45;
  const drift = ((index * 37) % 9) - 4; // -4…4
  const opacity = useTransform(progress, [start, end], [0.12, 1]);
  const y = useTransform(progress, [start, end], [drift * 2, 0]);
  const rotate = useTransform(progress, [start, end], [drift * 0.8, 0]);
  return (
    <m.span className="rj-chars__char" style={{ opacity, y, rotate }}>
      {char}
    </m.span>
  );
}

export function ScrollCharacters({ lines, className = '', children }) {
  const ref = useRef(null);
  const ready = useScrollMotionReady();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 92%', 'center 52%'] });
  const total = lines.join('').length;
  let counter = 0;

  return (
    <p ref={ref} className={`rj-chars ${className}`.trim()}>
      <span className="rj-sr-only">{lines.join(' ')}</span>
      <span aria-hidden="true">
        {lines.map((line) => (
          <span className="rj-chars__line" key={line}>
            {line.split(' ').map((word, wordIndex, words) => (
              <Fragment key={`${word}-${wordIndex}`}>
                <span className="rj-chars__word">
                  {[...word].map((char) => {
                    counter += 1;
                    return ready ? (
                      <ScrollCharacter
                        key={counter}
                        char={char}
                        index={counter}
                        total={total}
                        progress={scrollYProgress}
                      />
                    ) : (
                      <span className="rj-chars__char" key={counter}>
                        {char}
                      </span>
                    );
                  })}
                </span>
                {wordIndex < words.length - 1 && ' '}
              </Fragment>
            ))}
          </span>
        ))}
      </span>
      {children}
    </p>
  );
}
