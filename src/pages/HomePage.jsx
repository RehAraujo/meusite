import { useEffect, useState } from 'react';
import {
  LazyMotion,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { heroIndicators, paths, principles, processSteps } from '../data/site';
import { projects } from '../data/projects';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';
import { createWhatsAppUrl } from '../utils/whatsapp';

const heroEase = [0.16, 1, 0.3, 1];

const heroContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.12,
    },
  },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: heroEase },
  },
};

const heroLineVariants = {
  hidden: { y: '110%' },
  visible: { y: '0%', transition: { duration: 0.9, ease: heroEase } },
};

const heroImageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 1.12, duration: 0.95, ease: heroEase },
  },
};

const ecosystemCenter = [500, 450];
const ecosystemNodes = [
  { x: 500, y: 105, title: 'Tecnologia', subtitle: 'soluções digitais', anchor: 'middle' },
  { x: 744, y: 206, title: 'Automação', subtitle: 'integrações', anchor: 'start' },
  { x: 845, y: 450, title: 'Sistemas', subtitle: 'organização', anchor: 'start' },
  { x: 744, y: 694, title: 'Processos', subtitle: 'eficiência', anchor: 'start' },
  { x: 500, y: 795, title: 'Projetos', subtitle: 'planejamento', anchor: 'middle' },
  { x: 256, y: 694, title: 'UX', subtitle: 'experiência', anchor: 'end' },
  { x: 155, y: 450, title: 'Design', subtitle: 'identidade', anchor: 'end' },
  { x: 256, y: 206, title: 'Estratégia', subtitle: 'direção', anchor: 'end' },
];

function HeroNetwork({ active, shouldReduceMotion }) {
  return (
    <m.svg
      className="hero-network"
      viewBox="0 0 1000 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-hero-motion
    >
      <defs>
        <linearGradient id="hero-network-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9c493d" />
          <stop offset="52%" stopColor="#d47a3f" />
          <stop offset="100%" stopColor="#e1b16a" />
        </linearGradient>
      </defs>
      <m.g
        className="hero-ecosystem"
        animate={
          shouldReduceMotion
            ? undefined
            : active
              ? { scale: 1.025, opacity: 0.92 }
              : { scale: 0.97, opacity: 0.58 }
        }
        transition={{ duration: 0.82, ease: heroEase }}
      >
        <m.g
          className="hero-ecosystem__ring hero-ecosystem__ring--outer"
          animate={shouldReduceMotion ? undefined : { rotate: -360 }}
          transition={{ duration: 55, ease: 'linear', repeat: Infinity }}
        >
          <circle cx="500" cy="450" r="345" />
        </m.g>
        <m.g
          className="hero-ecosystem__ring hero-ecosystem__ring--inner"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 42, ease: 'linear', repeat: Infinity }}
        >
          <circle cx="500" cy="450" r="245" />
        </m.g>
        <g className="hero-ecosystem__spokes">
          {ecosystemNodes.map((node, index) => (
            <m.line
              key={node.title}
              x1={ecosystemCenter[0]}
              y1={ecosystemCenter[1]}
              x2={node.x}
              y2={node.y}
              pathLength="1"
              initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: active ? 0.34 : 0.15 }}
              transition={{ delay: 1.65 + index * 0.06, duration: 0.9, ease: heroEase }}
            />
          ))}
        </g>
        <g className="hero-ecosystem__nodes">
          {ecosystemNodes.map((node, index) => (
            <g
              className={`hero-ecosystem__node-group hero-ecosystem__node-group--${index}`}
              key={node.title}
              transform={`translate(${node.x} ${node.y})`}
              textAnchor={node.anchor}
            >
              <circle className="hero-ecosystem__node-halo" r="20" />
              <circle className="hero-ecosystem__node" r={index % 2 === 0 ? 4 : 3} />
              <text
                x={node.anchor === 'start' ? 28 : node.anchor === 'end' ? -28 : 0}
                y={node.anchor === 'middle' ? -24 : -3}
              >
                {node.title}
              </text>
              <text
                className="hero-ecosystem__subtitle"
                x={node.anchor === 'start' ? 28 : node.anchor === 'end' ? -28 : 0}
                y={node.anchor === 'middle' ? -12 : 10}
              >
                {node.subtitle}
              </text>
            </g>
          ))}
        </g>
        <m.g
          className="hero-ecosystem__orbit-light"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 13, ease: 'linear', repeat: Infinity }}
        >
          <circle cx="500" cy="105" r="5" />
        </m.g>
        {[0, 2, 4, 6].map((nodeIndex, index) => (
          <m.circle
            className="hero-ecosystem__spoke-light"
            key={`spoke-light-${nodeIndex}`}
            r="3"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    cx: [ecosystemCenter[0], ecosystemNodes[nodeIndex].x],
                    cy: [ecosystemCenter[1], ecosystemNodes[nodeIndex].y],
                    opacity: [0, 0.9, 0],
                  }
            }
            transition={{ delay: index * 0.85, duration: 3.4, ease: 'linear', repeat: Infinity }}
          />
        ))}
      </m.g>
    </m.svg>
  );
}

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

const useCompactViewport = () => {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 42rem)');
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isCompact;
};

export default function HomePage() {
  const [form, setForm] = useState({
    name: '',
    interest: 'Projeto para mim',
    stage: 'Tenho uma ideia e preciso organizar',
    priority: 'Clareza e direção',
    message: '',
  });
  const [isPortraitActive, setIsPortraitActive] = useState(false);
  const [titleLightPass, setTitleLightPass] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const isCompactViewport = useCompactViewport();
  const { scrollY } = useScroll();
  const scrollIndicatorOpacity = useTransform(scrollY, [0, 160], [1, 0]);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothPointerX = useSpring(pointerX, { stiffness: 42, damping: 24, mass: 0.8 });
  const smoothPointerY = useSpring(pointerY, { stiffness: 42, damping: 24, mass: 0.8 });
  const framePointerX = useTransform(smoothPointerX, [-0.5, 0.5], [-6, 6]);
  const framePointerY = useTransform(smoothPointerY, [-0.5, 0.5], [-6, 6]);
  useDocumentMeta({
    title: 'Renata Join — Soluções Digitais, Estratégia e Tecnologia',
    description:
      'Transformo problemas complexos em soluções digitais bem estruturadas. Tecnologia, negócio, processos e experiência do usuário, com Design como diferencial.',
  });
  useReveal();

  const submit = (event) => {
    event.preventDefault();
    const message = `Olá, Rê! Vim pela consulta inicial do site.\n\nMeu nome: ${form.name.trim()}\nCaminho: ${form.interest}\nMomento: ${form.stage}\nPrioridade: ${form.priority}\n\nContexto:\n${form.message.trim()}`;
    window.open(createWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  const handleHeroPointerMove = (event) => {
    if (shouldReduceMotion || isCompactViewport) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  const resetHeroPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <>
      <LazyMotion features={domAnimation} strict>
        <m.section
          className="hero hero-editorial"
          id="home"
          variants={heroContainerVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          animate="visible"
        >
          <m.div className="hero-text" variants={heroContainerVariants}>
            <m.p className="eyebrow hero-kicker" variants={heroItemVariants} data-hero-motion>
              Estratégia + Design + Tecnologia
            </m.p>
            <m.h1
              className="hero-motion-title"
              variants={heroItemVariants}
              onPointerEnter={() => setTitleLightPass((value) => value + 1)}
              data-hero-motion
            >
              <span className="hero-title-mask">
                <m.span variants={heroLineVariants} data-hero-motion>
                  A estética chama atenção.
                </m.span>
              </span>
              <span className="hero-title-mask hero-title-mask--accent">
                <m.span variants={heroLineVariants} data-hero-motion>
                  A lógica faz ficar.
                </m.span>
              </span>
            </m.h1>
            <m.span
              className="hero-title-accent-line"
              initial={shouldReduceMotion ? false : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: shouldReduceMotion ? 0 : 1.05, duration: 0.85, ease: heroEase }}
              aria-hidden="true"
              data-hero-motion
            >
              <m.i
                key={titleLightPass}
                initial={shouldReduceMotion ? false : { x: '-120%', opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 0 } : { x: '760%', opacity: [0, 1, 0] }}
                transition={{
                  delay: titleLightPass === 0 ? 1.72 : 0,
                  duration: titleLightPass === 0 ? 0.95 : 0.72,
                  times: [0, 0.5, 1],
                  ease: heroEase,
                }}
              />
            </m.span>
            <m.p className="hero-statement" variants={heroItemVariants} data-hero-motion>
              Problemas complexos pedem mais do que uma ferramenta.
            </m.p>
            <m.div className="hero-copy" variants={heroItemVariants} data-hero-motion>
              <p>
                Eu conecto estratégia, design e tecnologia para transformar necessidades em
                soluções claras, estruturadas e funcionais.
              </p>
            </m.div>
            <m.div className="button-group" variants={heroItemVariants} data-hero-motion>
              <ButtonLink to="/#contato" className="button--special">
                Agendar uma consulta
              </ButtonLink>
              <ButtonLink to="/clientes" secondary>
                Conheça minhas construções
              </ButtonLink>
            </m.div>
            <m.p className="hero-note" variants={heroItemVariants} data-hero-motion>
              Prefiro entender o contexto por inteiro antes de agir. É assim que evito automatizar
              confusão, desenhar caminhos inúteis ou construir soluções que ninguém consegue
              manter.
            </m.p>
          </m.div>
          <m.div
            className="hero-portrait"
            variants={heroImageVariants}
            onPointerEnter={() => setIsPortraitActive(true)}
            onPointerMove={handleHeroPointerMove}
            onPointerLeave={() => {
              setIsPortraitActive(false);
              resetHeroPointer();
            }}
            data-hero-motion
          >
            <span className="hero-ambient-glow" aria-hidden="true" />
            <m.div
              className="hero-frame-field"
              style={{ x: framePointerX, y: framePointerY }}
              aria-hidden="true"
            >
              <HeroNetwork active={isPortraitActive} shouldReduceMotion={shouldReduceMotion} />
            </m.div>
            <div className="hero-portrait-media">
              <img
                src="/assets/renata-hero-transparent.png"
                alt="Retrato de Renata Araujo"
                width="1366"
                height="768"
                fetchPriority="high"
              />
            </div>
            <span className="hero-portrait-name">Renata Araujo</span>
          </m.div>
          <m.div
            className="hero-scroll-indicator"
            style={{ opacity: shouldReduceMotion ? 0.65 : scrollIndicatorOpacity }}
            variants={heroItemVariants}
            aria-hidden="true"
            data-hero-motion
          >
            <span>Role para explorar</span>
            <i />
          </m.div>
        </m.section>
      </LazyMotion>

      <section className="hero-indicator-section">
        <div className="container">
          <ol className="hero-indicators">
            {heroIndicators.map((indicator, index) => (
              <li
                key={indicator.label ?? indicator.title}
                data-reveal
                style={{ '--reveal-delay': `${index * 80}ms` }}
              >
                {indicator.value ? (
                  <>
                    <span className="indicator-value">{indicator.value}</span>
                    <span className="indicator-label">{indicator.label}</span>
                  </>
                ) : (
                  <>
                    <p className="indicator-title">{indicator.title}</p>
                    <p className="indicator-description">{indicator.description}</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="surface-section">
        <div className="container">
          <SectionHeading
            eyebrow="Manifesto"
            title={
              <>
                Tecnologia não começa no <em>código.</em>
              </>
            }
          >
            <p>
              Uma boa solução digital começa antes da implementação. Ela começa quando alguém
              entende o contexto, faz as perguntas certas, organiza as informações e identifica o
              que realmente precisa ser resolvido.
            </p>
            <p>
              Meu trabalho acontece nessa ponte entre problema e execução: analiso necessidades,
              estruturo requisitos, organizo processos, documento decisões e ajudo a transformar
              ideias dispersas em soluções que pessoas e equipes conseguem compreender, utilizar e
              evoluir.
            </p>
          </SectionHeading>
        </div>
        <div className="principle-grid">
          {principles.map((principle, index) => (
            <details
              key={principle.title}
              className="principle-card"
              data-reveal
              style={{ '--reveal-delay': `${index * 55}ms` }}
            >
              <summary>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{principle.title}</strong>
              </summary>
              <p>{principle.description}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="paths-section constellation-section">
        <SectionConstellation />
        <div className="container">
          <SectionHeading
            eyebrow="Como posso ajudar"
            title={
              <>
                Diferentes caminhos. A mesma <em>origem.</em>
              </>
            }
          >
            <p>
              Nem todo mundo chega precisando da mesma coisa. Por isso, todo projeto começa por uma
              consulta: antes de propor uma solução, compreendo o contexto, o problema e o que
              precisa ser construído.
            </p>
          </SectionHeading>
          <div className="card-grid card-grid--three">
            {paths.map((path, index) => (
              <article
                className="path-card"
                key={path.title}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
              >
                <p className="card-label">{path.eyebrow}</p>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <ButtonLink to={path.to} className="button--home">
                  Conheça esse caminho
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-section featured-section constellation-section">
        <SectionConstellation variant="left" />
        <div className="container">
          <SectionHeading
            eyebrow="Construções em destaque"
            title={
              <>
                Não apresento apenas entregas. Apresento <em>construções.</em>
              </>
            }
          >
            <p>
              O que importa é o problema, o raciocínio e as soluções escolhidas para cada contexto.
            </p>
          </SectionHeading>
          <div className="card-grid featured-project-grid">
            {projects.slice(0, 2).map((project, index) => (
              <article
                className="project-card project-card--preview"
                key={project.name}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
              >
                <p className="card-label">{project.context}</p>
                <h3>{project.name}</h3>
                <p>{project.challenge}</p>
                <Link to="/clientes">Conheça a construção →</Link>
              </article>
            ))}
          </div>
          <Link className="section-action" to="/clientes">
            Ver todas as construções <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="process-section constellation-section">
        <SectionConstellation variant="right-low" />
        <div className="container">
          <SectionHeading
            eyebrow="Processo"
            title={
              <>
                Não começo desenhando. Começo <em>compreendendo.</em>
              </>
            }
          />
          <ol className="process-list">
            {processSteps.map(([title, description], index) => (
              <li key={title} data-reveal style={{ '--reveal-delay': `${index * 55}ms` }}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="container about-preview">
          <img
            src="/assets/re-araujo-sobre.jpg"
            alt="Renata Araujo"
            width="1024"
            height="1024"
            loading="lazy"
          />
          <div data-reveal>
            <p className="eyebrow">Sobre</p>
            <h2>
              Não separo lógica de <em>sensibilidade.</em>
            </h2>
            <p>
              Minha trajetória começou no Design, onde aprendi a observar, organizar informações e
              pensar na experiência das pessoas. A tecnologia ampliou essa capacidade: hoje atuo na
              conexão entre negócio, processos e experiência do usuário.
            </p>
            <ButtonLink to="/sobre" className="button--home">
              Conheça minha trajetória
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="contact-section constellation-section" id="contato">
        <SectionConstellation variant="left" />
        <div className="container contact-grid">
          <div data-reveal>
            <p className="eyebrow">Consulta inicial</p>
            <h2>
              Toda construção começa com uma conversa <em>honesta.</em>
            </h2>
            <p>
              Você não precisa chegar sabendo o nome do serviço ou a solução exata — é para isso que
              serve essa consulta: entender o contexto e identificar o caminho mais coerente.
            </p>
          </div>
          <form className="contact-diagnostic" onSubmit={submit} data-reveal>
            <div className="contact-diagnostic__intro">
              <p className="eyebrow">Antes da consulta</p>
              <h3>Vamos começar pelo contexto.</h3>
              <p>Quatro respostas rápidas ajudam a tornar nossa primeira conversa mais objetiva.</p>
            </div>
            <label htmlFor="contact-name">Seu nome</label>
            <input
              id="contact-name"
              required
              minLength="2"
              maxLength="100"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <label htmlFor="contact-interest">O que você deseja construir?</label>
            <select
              id="contact-interest"
              value={form.interest}
              onChange={(event) => setForm({ ...form, interest: event.target.value })}
            >
              <option>Projeto para mim</option>
              <option>Projeto para meu negócio</option>
              <option>Processos e estruturação</option>
              <option>Parceria com marca</option>
              <option>Ainda não sei</option>
            </select>
            <div className="contact-diagnostic__row">
              <div>
                <label htmlFor="contact-stage">Em que momento você está?</label>
                <select
                  id="contact-stage"
                  value={form.stage}
                  onChange={(event) => setForm({ ...form, stage: event.target.value })}
                >
                  <option>Tenho uma ideia e preciso organizar</option>
                  <option>Já comecei e preciso estruturar</option>
                  <option>Quero revisar o que já existe</option>
                  <option>Preciso decidir o melhor caminho</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-priority">Qual é a prioridade agora?</label>
                <select
                  id="contact-priority"
                  value={form.priority}
                  onChange={(event) => setForm({ ...form, priority: event.target.value })}
                >
                  <option>Clareza e direção</option>
                  <option>Organização e processos</option>
                  <option>Presença digital</option>
                  <option>Experiência e comunicação</option>
                </select>
              </div>
            </div>
            <label htmlFor="contact-message">Conte um pouco do contexto</label>
            <textarea
              id="contact-message"
              required
              minLength="10"
              maxLength="2000"
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
            <button className="button button--home" type="submit">
              Enviar pelo WhatsApp →
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
