import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';

export function ProcessStepper({ steps }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const activeStep = steps[activeIndex];

  return (
    <div className="case-stepper" data-reveal>
      <div className="case-stepper__track" role="group" aria-label="Etapas do processo TED TEC">
        <span
          className="case-stepper__progress"
          aria-hidden="true"
          style={{ '--step-progress': activeIndex / (steps.length - 1) }}
        />
        {steps.map((step, index) => (
          <button
            type="button"
            className="case-stepper__step"
            key={step.title}
            aria-current={index === activeIndex ? 'step' : undefined}
            data-complete={index < activeIndex ? 'true' : undefined}
            onClick={() => setActiveIndex(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step.title}</strong>
          </button>
        ))}
      </div>
      <div className="case-stepper__detail" aria-live="polite">
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={activeStep.title}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span>{String(activeIndex + 1).padStart(2, '0')}</span>
              <h3>{activeStep.title}</h3>
              <p>{activeStep.description}</p>
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
}
