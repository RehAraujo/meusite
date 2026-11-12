import { useEffect, useRef, useState } from 'react';
import {
  LazyMotion,
  domAnimation,
  animate,
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { Link } from 'react-router-dom';
import { AtelieSection } from '../components/atelie/AtelieSection';
import { HeroCosmos, HeroWords } from '../components/home/HeroNetwork';
import { ProjectFlipCard } from '../components/home/ProjectFlipCard';
import { ScrollCharacters, ScrollDepth, ScrollRise } from '../components/home/ScrollMotion';
import { ArrowButton } from '../components/ui/ArrowButton';
import { BrazilFlag } from '../components/ui/BrazilFlag';
import {
  creatorInsights,
  creatorInsightsSource,
  creatorProposalUrl,
  creatorThemes,
  featuredProduct,
  featuredProjects,
  methodSteps,
  shoppingCategories,
  solutions,
} from '../data/home';
import { atelieSection, atelieWorks } from '../data/atelie';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useRjReveal } from '../hooks/useRjReveal';
import { useScrollMotionReady } from '../hooks/useScrollMotionReady';
import { createWhatsAppUrl } from '../utils/whatsapp';

const iconPaths = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  brand: (
    <>
      <path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9Z" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
  flow: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2v3.3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v-1.3" />
    </>
  ),
};

function LineIcon({ name }) {
  return (
    <svg
      className="rj-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}

// Resposta delicada ao cursor: posição relativa em CSS (--mx/--my), só com mouse.
const trackPointer = (event) => {
  if (event.pointerType !== 'mouse') return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  element.style.setProperty('--mx', ((event.clientX - bounds.left) / bounds.width).toFixed(3));
  element.style.setProperty('--my', ((event.clientY - bounds.top) / bounds.height).toFixed(3));
};

const resetPointer = (event) => {
  event.currentTarget.style.removeProperty('--mx');
  event.currentTarget.style.removeProperty('--my');
};

// Sutilezas de ambiente: textura pontilhada, brilho radial e pontos de luz.
// Ficam nas laterais, fora do conteúdo, e só animam enquanto visíveis.
function Ambient({ variant }) {
  return (
    <span className={`rj-ambient rj-ambient--${variant}`} aria-hidden="true" data-rj-loop>
      <i />
      <i />
    </span>
  );
}

// Contagem progressiva ao entrar na tela. O HTML nasce com o número real;
// a animação só acontece se o card ainda não estiver visível.
const numberFormat = new Intl.NumberFormat('pt-BR');

function CountUp({ value }) {
  const ref = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    const target = Number(value.replace(/\D/g, ''));
    if (!element || shouldReduceMotion || !target || !('IntersectionObserver' in window)) {
      return undefined;
    }
    if (element.getBoundingClientRect().top < window.innerHeight) return undefined;
    let controls;
    element.textContent = numberFormat.format(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        controls = animate(0, target, {
          duration: 1.6,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (latest) => {
            element.textContent = numberFormat.format(Math.round(latest));
          },
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      controls?.stop();
      element.textContent = value;
    };
  }, [value, shouldReduceMotion]);

  return <span ref={ref}>{value}</span>;
}

function Eyebrow({ number, children }) {
  return (
    <p className="rj-eyebrow">
      <span className="rj-eyebrow__line" aria-hidden="true" />
      {number && <span className="rj-eyebrow__number">{number} /</span>}
      {children}
    </p>
  );
}

// Cada etapa acende quando a linha do processo chega até ela.
function MethodStep({ step, index, total, progress, animated }) {
  const point = total > 1 ? index / (total - 1) : 0;
  const start = Math.max(0, point * 0.82 - 0.06);
  const end = start + 0.16;
  const opacity = useTransform(progress, [start, end], [0.28, 1]);
  const y = useTransform(progress, [start, end], [14, 0]);
  const dot = useTransform(progress, [start, end], [0.45, 1]);
  return (
    <m.li style={animated ? { opacity, y } : undefined}>
      <m.span
        className="rj-method__dot"
        aria-hidden="true"
        style={animated ? { scale: dot } : undefined}
      />
      <h3>{step.title}</h3>
      <p>{step.description}</p>
    </m.li>
  );
}

function MethodSteps() {
  const listRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const animated = useScrollMotionReady();
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start 80%', 'end 55%'],
  });

  return (
    <div className="rj-method__steps" ref={listRef}>
      <span className="rj-method__track" aria-hidden="true">
        <m.span
          className="rj-method__fill"
          style={shouldReduceMotion ? { scaleY: 1 } : { scaleY: scrollYProgress }}
        />
      </span>
      <ol>
        {methodSteps.map((step, index) => (
          <MethodStep
            key={step.title}
            step={step}
            index={index}
            total={methodSteps.length}
            progress={scrollYProgress}
            animated={animated}
          />
        ))}
      </ol>
    </div>
  );
}

function ProjectCard({ project, index }) {
  return (
    <ScrollRise as="li" className="rj-project-item" distance={28 + index * 14}>
      <ProjectFlipCard project={project} />
    </ScrollRise>
  );
}

export default function HomePage() {
  const rootRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const lightX = useSpring(0, { stiffness: 60, damping: 22 });
  const lightY = useSpring(0, { stiffness: 60, damping: 22 });
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    interest: 'Projeto para mim',
    stage: 'Tenho uma ideia e preciso organizar',
    priority: 'Clareza e direção',
    message: '',
  });

  useDocumentMeta({
    title: 'Renata Join — Pensamento & Execução | Estratégia, Design e Tecnologia',
    description:
      'Uno estratégia, design e tecnologia para ajudar negócios a fortalecer seu posicionamento, comunicar melhor suas ofertas e organizar seus processos.',
  });
  useRjReveal(rootRef);

  const moveHeroPointer = (event) => {
    if (shouldReduceMotion || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
    lightX.set(event.clientX - bounds.left);
    lightY.set(event.clientY - bounds.top);
  };

  const resetHeroPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const submit = (event) => {
    event.preventDefault();
    const message = `Olá, Rê! Vim pela consulta inicial do site.\n\nMeu nome: ${form.name.trim()}\nCaminho: ${form.interest}\nMomento: ${form.stage}\nPrioridade: ${form.priority}\n\nContexto:\n${form.message.trim()}`;
    window.open(createWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="rj-home" ref={rootRef}>
        {/* HERO */}
        <section
          className="rj-hero"
          id="inicio"
          aria-labelledby="hero-title"
          onPointerMove={moveHeroPointer}
          onPointerLeave={resetHeroPointer}
        >
          <HeroCosmos pointerX={pointerX} pointerY={pointerY} />
          <div className="rj-container rj-hero__grid">
            <div className="rj-hero__copy">
              <p className="rj-kicker rj-enter" style={{ '--rj-d': 0 }}>
                <BrazilFlag />
                <span>Estratégia · Design · Tecnologia</span>
              </p>
              <h1 className="rj-hero__title" id="hero-title">
                <span className="rj-mask">
                  <span className="rj-enter-line" style={{ '--rj-d': 1 }}>
                    Pensamento <span className="rj-amp">&amp;</span>
                  </span>
                </span>
                <span className="rj-mask">
                  <span className="rj-enter-line" style={{ '--rj-d': 2 }}>
                    Execução
                  </span>
                </span>
              </h1>
              <span className="rj-hero__rule" aria-hidden="true" />
              <p className="rj-hero__subtitle rj-enter" style={{ '--rj-d': 4 }}>
                Ideias precisam de direção para se tornarem realidade.
              </p>
              <p className="rj-hero__text rj-enter" style={{ '--rj-d': 5 }}>
                Uno estratégia, design e tecnologia para ajudar negócios a fortalecer seu
                posicionamento, comunicar melhor suas ofertas e organizar seus processos.
              </p>
              <div className="rj-hero__actions rj-enter" style={{ '--rj-d': 6 }}>
                <ArrowButton variant="pink" to="/servicos#diagnostico-inicial">
                  Conhecer o diagnóstico
                </ArrowButton>
                <a className="rj-link rj-link--yellow" href="#solucoes">
                  Explorar soluções <i aria-hidden="true">→</i>
                </a>
              </div>
            </div>
            <figure className="rj-hero__portrait">
              <HeroWords pointerX={pointerX} pointerY={pointerY} />
              <span className="rj-hero__curtain" aria-hidden="true" />
              <img
                src="/assets/renata-hero-portrait.webp"
                alt="Retrato de Renata Araujo"
                width="536"
                height="768"
                fetchPriority="high"
                decoding="async"
              />
            </figure>
          </div>
          {!shouldReduceMotion && (
            <m.span
              className="rj-hero__light"
              style={{ x: lightX, y: lightY }}
              aria-hidden="true"
            />
          )}
        </section>

        {/* 01 · SOLUÇÕES */}
        <section
          className="rj-section rj-section--paper"
          id="solucoes"
          aria-labelledby="solucoes-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="01">Soluções para negócios</Eyebrow>
                <h2 id="solucoes-title">
                  O que sua empresa precisa <em>resolver?</em>
                </h2>
              </div>
              <p className="rj-heading__copy">
                Nem todo problema exige uma grande mudança. Às vezes, o que falta é identificar a
                prioridade certa.
              </p>
            </header>
            <ul className="rj-solutions">
              {solutions.map((solution, index) => (
                <li key={solution.id} data-rj-reveal style={{ '--rj-i': index }}>
                  <Link
                    className={`rj-solution${solution.featured ? ' rj-solution--featured' : ''}`}
                    to={solution.to}
                    onPointerMove={trackPointer}
                    onPointerLeave={resetPointer}
                  >
                    <span className="rj-solution__top">
                      <LineIcon name={solution.icon} />
                      <span className="rj-solution__number" aria-hidden="true">
                        {solution.number}
                      </span>
                    </span>
                    <h3>{solution.title}</h3>
                    <p>{solution.description}</p>
                    <span className="rj-solution__cta">
                      {solution.cta} <i aria-hidden="true">↗</i>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="rj-actions-end" data-rj-reveal>
              <ArrowButton variant="ink" to="/servicos">
                Ver todas as soluções
              </ArrowButton>
            </div>
          </div>
        </section>

        {/* 02 · MÉTODO */}
        <section
          className="rj-section rj-section--paper rj-method"
          id="metodo"
          aria-labelledby="metodo-title"
        >
          <Ambient variant="method" />
          <div className="rj-container rj-method__grid">
            <header className="rj-method__intro" data-rj-reveal>
              <Eyebrow number="02">Método</Eyebrow>
              <h2 id="metodo-title">
                Da investigação à <em>implementação.</em>
              </h2>
              <p>
                Uma solução bem construída começa com as perguntas certas. Meu trabalho conecta
                análise, estratégia e execução para transformar necessidades em soluções funcionais.
              </p>
            </header>
            <MethodSteps />
          </div>
          <div className="rj-container">
            <div className="rj-actions-end" data-rj-reveal>
              <ArrowButton variant="ink" to="/processo">
                Conhecer minha metodologia
              </ArrowButton>
            </div>
          </div>
        </section>

        {/* 03 · PROJETOS */}
        <section
          className="rj-section rj-section--paper"
          id="projetos"
          aria-labelledby="projetos-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="03">Solução e evolução</Eyebrow>
                <h2 id="projetos-title">
                  Ideias que saíram do <em>papel.</em>
                </h2>
              </div>
              <p className="rj-heading__copy">
                Cada projeto começa com um contexto diferente. O objetivo é o mesmo: encontrar
                soluções coerentes com as necessidades de cada negócio.
              </p>
            </header>
            <ul className="rj-projects">
              {featuredProjects.map((project, index) => (
                <ProjectCard key={project.name} project={project} index={index} />
              ))}
            </ul>
            <div className="rj-actions-end" data-rj-reveal>
              <ArrowButton variant="yellow" to="/clientes">
                Conhecer meus projetos
              </ArrowButton>
            </div>
            <ScrollCharacters
              className="rj-interlude"
              lines={['Toda boa construção', 'começa pela identidade.']}
            >
              <span className="rj-interlude__mark" aria-hidden="true" data-rj-reveal>
                <i />
                <i />
                <i />
              </span>
            </ScrollCharacters>
          </div>
        </section>

        {/* 04 · SHOPPING JOIN */}
        <section
          className="rj-section rj-section--white"
          id="shopping"
          aria-labelledby="shopping-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="04">Shopping Join</Eyebrow>
                <h2 id="shopping-title" className="rj-display-italic">
                  Escolhas que acompanham seu estilo de vida.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Ferramentas, produtos e descobertas para organizar a rotina, cultivar interesses e
                viver com mais personalidade.
              </p>
            </header>
            <article
              className="rj-feature"
              aria-labelledby="feature-title"
              onPointerMove={trackPointer}
              onPointerLeave={resetPointer}
            >
              <ScrollRise className="rj-feature__copy" distance={24}>
                <p className="rj-feature__kicker">
                  <img src="/assets/notion-platform.ico" width="20" height="20" alt="" />
                  {featuredProduct.kicker}
                </p>
                <h3 id="feature-title">{featuredProduct.name}</h3>
                <p className="rj-feature__headline">
                  {featuredProduct.headline[0]} <em>{featuredProduct.headline[1]}</em>
                </p>
                <p>{featuredProduct.description}</p>
                <ul className="rj-feature__list">
                  {featuredProduct.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="rj-feature__offer">
                  <p className="rj-feature__price">
                    {featuredProduct.price}
                    <small>{featuredProduct.priceNote}</small>
                  </p>
                  <ArrowButton variant="yellow" href={featuredProduct.cta.href}>
                    {featuredProduct.cta.label}
                  </ArrowButton>
                  {featuredProduct.purchase ? (
                    <ArrowButton variant="pink" href={featuredProduct.purchase.href}>
                      {featuredProduct.purchase.label}
                    </ArrowButton>
                  ) : null}
                </div>
              </ScrollRise>
              <ScrollRise
                as="figure"
                className="rj-feature__media"
                distance={44}
                offset={['start 100%', 'start 55%']}
              >
                <span className="rj-feature__window" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <b>Meu Dinheiro, Minhas Regras</b>
                </span>
                <img
                  src={featuredProduct.image}
                  alt={featuredProduct.imageAlt}
                  width="1200"
                  height="536"
                  loading="lazy"
                />
              </ScrollRise>
            </article>
            <ul className="rj-shop" aria-label="Categorias do Shopping Join">
              {shoppingCategories.map((category, index) => {
                const photo = (
                  <img
                    src={category.image}
                    srcSet={category.imageSet}
                    sizes="(width <= 48rem) 46vw, 18rem"
                    alt=""
                    width="480"
                    height="640"
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: category.imagePosition }}
                  />
                );
                return (
                  <li key={category.id} data-rj-reveal style={{ '--rj-i': index }}>
                    {category.available ? (
                      <Link className="rj-shop__tile rj-shop__tile--active" to={category.to}>
                        {photo}
                        <span className="rj-shop__label">
                          <strong>{category.label}</strong>
                          <small>{category.description}</small>
                        </span>
                      </Link>
                    ) : (
                      <div
                        className={`rj-shop__tile rj-shop__tile--soon rj-shop__tile--${category.id}`}
                      >
                        {photo}
                        <span className="rj-shop__soon">Em breve</span>
                        <span className="rj-shop__label">
                          <strong>{category.label}</strong>
                          {category.description && <small>{category.description}</small>}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="rj-actions-center" data-rj-reveal>
              <ArrowButton variant="pink" to="/ferramentas">
                Explorar Shopping Join
              </ArrowButton>
            </div>
          </div>
        </section>

        {/* 05 · CREATOR */}
        <section
          className="rj-section rj-section--ink rj-creator"
          id="creator"
          aria-labelledby="creator-title"
        >
          <Ambient variant="creator" />
          <div className="rj-container rj-creator__grid">
            <header className="rj-creator__intro" data-rj-reveal>
              <Eyebrow number="05">Creator</Eyebrow>
              <h2 id="creator-title">
                Parcerias &amp; <em>influência</em>
              </h2>
              <p className="rj-creator__lead">
                Conteúdo autoral, presença digital e conexões construídas com personalidade.
              </p>
              <p>
                Uno criatividade, comunicação e estratégia em projetos com marcas que fazem sentido
                para minha audiência.
              </p>
              <div className="rj-hero__actions">
                <ArrowButton variant="yellow" to="/midia-kit">
                  Conhecer parcerias
                </ArrowButton>
                <a
                  className="rj-link rj-link--yellow"
                  href={creatorProposalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solicitar proposta <i aria-hidden="true">↗</i>
                </a>
              </div>
            </header>
            <figure className="rj-insights">
              <dl className="rj-insights__grid">
                {creatorInsights.map((insight, index) => (
                  <div
                    key={insight.id}
                    className={`rj-insight rj-insight--${insight.size ?? 'base'}${insight.tone ? ` is-${insight.tone}` : ''}`}
                    data-rj-reveal
                    style={{ '--rj-i': index }}
                  >
                    <dt>{insight.label}</dt>
                    <dd className="rj-insight__value">
                      <CountUp value={insight.value} />
                    </dd>
                    {insight.share && (
                      <dd className="rj-insight__share">
                        <span className="rj-insight__bar" aria-hidden="true">
                          <i style={{ '--rj-share': insight.share / 100 }} />
                        </span>
                        <span className="rj-insight__detail">{insight.detail}</span>
                      </dd>
                    )}
                    {!insight.share && insight.detail && (
                      <dd className="rj-insight__detail">{insight.detail}</dd>
                    )}
                  </div>
                ))}
              </dl>
              <figcaption className="rj-insights__source">
                Fonte: {creatorInsightsSource.source} · {creatorInsightsSource.period}
              </figcaption>
            </figure>
          </div>
          <div className="rj-marquee" aria-hidden="true" data-rj-loop>
            <div className="rj-marquee__track">
              {[0, 1].map((copy) => (
                <span className="rj-marquee__group" key={copy}>
                  {[0, 1, 2].flatMap((round) =>
                    creatorThemes.map((theme) => (
                      <span className="rj-marquee__item" key={`${round}-${theme}`}>
                        {theme}
                      </span>
                    )),
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 06 · COMUNIDADE */}
        <section className="rj-community" id="comunidade" aria-labelledby="comunidade-title">
          <div className="rj-container rj-community__grid">
            <header className="rj-community__intro" data-rj-reveal>
              <Eyebrow number="06">Comunidade Join</Eyebrow>
              <h2 id="comunidade-title">
                Ideias merecem espaço para <em>crescer.</em>
              </h2>
              <p>
                Um ambiente para explorar filosofia, economia, cultura, comunicação e tecnologia.
                Conhecimento, referências e boas conversas para quem valoriza o pensamento
                independente.
              </p>
              <div className="rj-community__actions">
                <ArrowButton variant="ink" to="/pensamentos">
                  Explorar conteúdos
                </ArrowButton>
                <ArrowButton
                  variant="outline"
                  icon="plus"
                  aria-expanded={premiumOpen}
                  aria-controls="join-premium"
                  onClick={() => setPremiumOpen((open) => !open)}
                >
                  Conhecer o Join Premium <small className="rj-btn__tag">Em breve</small>
                </ArrowButton>
              </div>
              <div className="rj-premium" id="join-premium" hidden={!premiumOpen}>
                <p className="rj-premium__name">
                  Join Premium <span className="rj-chip rj-chip--ink">Em breve</span>
                </p>
                <p>
                  Proposta em desenvolvimento: trilhas, materiais e experiências para aprofundar
                  conhecimentos. Ainda não há assinatura disponível; enquanto isso, os conteúdos
                  abertos seguem em Pensamentos.
                </p>
              </div>
            </header>
            <figure className="rj-community__art">
              <ScrollDepth
                as="img"
                src="/assets/comunidade-escultura.webp"
                alt=""
                width="1232"
                height="696"
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        {/* CONTATO */}
        <section
          className="rj-section rj-section--ink rj-contact"
          id="contato"
          aria-labelledby="contato-title"
        >
          <div className="rj-container rj-contact__grid">
            <header data-rj-reveal>
              <Eyebrow>Consulta inicial</Eyebrow>
              <h2 id="contato-title">
                Conte-me o que você tem em <em>mente.</em>
              </h2>
              <p>
                Você não precisa saber exatamente qual serviço contratar. Conte-me o que deseja
                construir, melhorar ou resolver. A partir do seu contexto, podemos identificar o
                caminho mais adequado.
              </p>
            </header>
            <form className="rj-form" onSubmit={submit} data-rj-reveal>
              <div className="rj-form__intro">
                <h3>Vamos começar pelo contexto.</h3>
                <p>
                  Algumas respostas ajudam a compreender sua necessidade e tornar nossa primeira
                  conversa mais produtiva.
                </p>
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
              <div className="rj-form__row">
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
              <ArrowButton variant="pink" type="submit" className="rj-form__submit">
                Iniciar conversa pelo WhatsApp
              </ArrowButton>
            </form>
          </div>
        </section>

        {/* ATELIÊ: última seção de conteúdo, antes do rodapé */}
        <AtelieSection section={atelieSection} works={atelieWorks} />
      </div>
    </LazyMotion>
  );
}
