import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { services } from '../data/services';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const introEase = [0.16, 1, 0.3, 1];

const introContainerVariants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.12 } },
};

const introItemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: introEase },
  },
};

function SectionConstellation({ variant = 'right' }) {
  return (
    <svg
      className={`section-constellation section-constellation--${variant}`}
      viewBox="0 0 600 190"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <path d="M18 150 92 96 164 126 238 54 322 104 402 36 488 82 578 30" />
      <path d="M92 96 132 34 238 54 274 158 322 104 438 154 488 82" />
      {[
        [18, 150],
        [92, 96],
        [132, 34],
        [164, 126],
        [238, 54],
        [274, 158],
        [322, 104],
        [402, 36],
        [438, 154],
        [488, 82],
        [578, 30],
      ].map(([cx, cy], index) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={index % 3 === 0 ? 3 : 2} />
      ))}
    </svg>
  );
}

export default function ServicesPage() {
  useDocumentMeta({
    title: 'Como posso ajudar | Renata Join',
    description:
      'Sistemas, sites e organização estruturados a partir do problema real — identidade e posicionamento como parte da entrega.',
    path: '/servicos',
  });
  useReveal();
  const shouldReduceMotion = useReducedMotion();
  const coreServices = services.filter((service) => service.id !== 'consultoria');
  const diagnostic = services.find((service) => service.id === 'consultoria');

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="page-servicos">
        <section className="page-hero page-hero--servicos">
          <SectionConstellation variant="right" />
          <m.div
            className="container"
            variants={introContainerVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
          >
            <m.p className="eyebrow" variants={introItemVariants}>
              Como posso ajudar
            </m.p>
            <m.h1 variants={introItemVariants}>
              O serviço certo começa pelo <em>problema certo.</em>
            </m.h1>
            <m.p className="lead" variants={introItemVariants}>
              Você não precisa saber se precisa de um site, uma nova marca ou um sistema. Traga o
              problema. A partir dele, estruturamos o que realmente precisa ser construído.
            </m.p>
            <m.div variants={introItemVariants}>
              <ButtonLink to="/#contato">Agendar uma consulta</ButtonLink>
            </m.div>
          </m.div>
        </section>

        <section id="para-voce">
          <div className="container">
            <SectionHeading
              eyebrow="Soluções"
              title={
                <>
                  Estrutura para pessoas e <em>negócios.</em>
                </>
              }
            >
              <p>
                Cada projeto combina as disciplinas necessárias para resolver o problema — sem
                empacotar complexidade em soluções genéricas.
              </p>
            </SectionHeading>
            <ol className="service-chapters">
              {coreServices.map((service, index) => (
                <li
                  className="service-chapter"
                  key={service.id}
                  data-reveal
                  style={{ '--reveal-delay': `${index * 90}ms` }}
                >
                  <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="card-label">{service.audience}</p>
                    <h3>{service.title}</h3>
                    <div className="service-chapter__body">
                      <div>
                        <strong>O que resolve</strong>
                        <p>{service.problem}</p>
                      </div>
                      <div>
                        <strong>Como construímos</strong>
                        <p>{service.solution}</p>
                      </div>
                    </div>
                    <p className="investment">{service.investment}</p>
                    <ButtonLink to="/#contato">Conversar sobre este projeto</ButtonLink>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="surface-section service-diagnostic" id="diagnostico">
          <div className="container">
            <p className="card-label">{diagnostic.audience}</p>
            <h2>{diagnostic.title}</h2>
            <div className="service-diagnostic__body">
              <div>
                <strong>O que resolve</strong>
                <p>{diagnostic.problem}</p>
              </div>
              <div>
                <strong>Como construímos</strong>
                <p>{diagnostic.solution}</p>
              </div>
            </div>
            <p className="hero-note">{diagnostic.investment}</p>
            <ButtonLink to="/#contato">{diagnostic.ctaLabel}</ButtonLink>
          </div>
        </section>

        <section id="para-negocio">
          <div className="container editorial-interlude">
            <p className="eyebrow">Uma diferença importante</p>
            <h2>
              Identidade visual ou <em>branding?</em>
            </h2>
            <p className="lead">
              Identidade visual organiza reconhecimento. Branding organiza significado, percepção
              e escolha.
            </p>
            <div className="editorial-interlude__columns">
              <div data-reveal>
                <h3>Já existe clareza</h3>
                <p>
                  Quando público, proposta e posicionamento estão definidos, a identidade visual
                  materializa essa base.
                </p>
              </div>
              <div data-reveal style={{ '--reveal-delay': '90ms' }}>
                <h3>Ainda é preciso definir</h3>
                <p>
                  Quando o negócio ainda não explica seu diferencial, o trabalho começa por
                  branding e posicionamento.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="services-closing">
          <SectionConstellation variant="left" />
          <m.div
            className="container"
            variants={introContainerVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            <m.p className="eyebrow" variants={introItemVariants}>
              Por onde começar
            </m.p>
            <m.h2 variants={introItemVariants}>
              Você não precisa ter a solução.
              <br />
              Precisa conseguir explicar o problema.
            </m.h2>
            <m.p className="lead" variants={introItemVariants}>
              Na consulta, começamos pelo contexto. Se o caminho já estiver claro, seguimos para o
              projeto. Se ainda houver pontos a investigar, o diagnóstico organiza o que vem
              primeiro.
            </m.p>
            <m.div variants={introItemVariants}>
              <ButtonLink to="/#contato" className="button--special">
                Agendar uma consulta
              </ButtonLink>
            </m.div>
          </m.div>
        </section>
      </div>
    </LazyMotion>
  );
}
