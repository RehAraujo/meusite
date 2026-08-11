import { useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { services } from '../data/services';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';
import { createWhatsAppUrl } from '../utils/whatsapp';

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

function ChoiceGroup({ options, selected, multi, onToggle }) {
  return (
    <div className="filters" role="group">
      {options.map((option) => {
        const isSelected = multi ? selected.includes(option) : selected === option;
        return (
          <button type="button" key={option} aria-pressed={isSelected} onClick={() => onToggle(option)}>
            {option}
          </button>
        );
      })}
    </div>
  );
}

const diagnosticQuestions = [
  {
    key: 'problem',
    type: 'single',
    question: 'O que você está tentando resolver?',
    options: [
      'Minha empresa parece menor no digital do que realmente é',
      'Meu site não representa meu negócio',
      'Minha marca não comunica meu valor',
      'Minha operação está desorganizada',
      'Tenho muitas ferramentas, mas pouca estrutura',
      'Quero lançar algo e não sei como organizar',
      'Não sei exatamente — só sei que algo precisa mudar',
    ],
  },
  {
    key: 'area',
    type: 'single',
    question: 'Onde esse problema aparece com mais força hoje?',
    options: [
      'Site',
      'Marca',
      'Presença digital / conteúdo',
      'Processos internos',
      'Organização de informações',
      'Vendas / jornada do cliente',
      'Mais de uma área',
    ],
  },
  {
    key: 'structured',
    type: 'multi',
    question: 'O que você já tem estruturado?',
    options: [
      'Site',
      'Identidade visual',
      'CRM',
      'Notion / sistema interno',
      'Estratégia definida',
      'Equipe',
      'Ainda estou começando',
    ],
  },
  {
    key: 'blocking',
    type: 'text',
    question: 'O que isso está dificultando hoje?',
    placeholder:
      'Ex.: clientes não entendem meu serviço, minha equipe se perde nas informações, meu site não gera confiança...',
  },
  {
    key: 'outcome',
    type: 'text',
    question: 'Se esse problema estivesse resolvido, o que mudaria na prática?',
  },
  {
    key: 'timing',
    type: 'single',
    question: 'Quando você gostaria de começar a resolver isso?',
    options: ['Agora', 'Nos próximos 30 dias', 'Nos próximos 3 meses', 'Ainda estou explorando possibilidades'],
  },
];

const totalSteps = diagnosticQuestions.length + 1;

const emptyAnswers = {
  problem: '',
  area: '',
  structured: [],
  blocking: '',
  outcome: '',
  timing: '',
  name: '',
  company: '',
  whatsapp: '',
  email: '',
};

const servicePresets = {
  sistemas: { problem: 'Minha operação está desorganizada', area: 'Organização de informações' },
  web: { problem: 'Meu site não representa meu negócio', area: 'Site' },
  identidade: { problem: 'Minha marca não comunica meu valor', area: 'Marca' },
};

const pathSteps = [
  { title: 'Consulta', description: 'Começamos pelo contexto, pela dor e pelo que precisa mudar.' },
  {
    title: 'Diagnóstico',
    description: 'Quando necessário, aprofundamos a investigação e organizamos prioridades.',
  },
  { title: 'Solução', description: 'Definimos e construímos o que realmente precisa existir.' },
];

const buildWhatsAppMessage = (answers) =>
  `Olá, Rê! Fiz o diagnóstico inicial do site.

Problema: ${answers.problem}
Onde aparece: ${answers.area}
Já estruturado: ${answers.structured.join(', ') || '—'}
O que dificulta: ${answers.blocking}
Resultado esperado: ${answers.outcome}
Quando quer começar: ${answers.timing}

Nome: ${answers.name}
Empresa/projeto: ${answers.company || '—'}
WhatsApp: ${answers.whatsapp}
E-mail: ${answers.email}`;

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

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [submitted, setSubmitted] = useState(false);

  const stepVariants = {
    hidden: { opacity: 0, x: shouldReduceMotion ? 0 : 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: introEase } },
    exit: { opacity: 0, x: shouldReduceMotion ? 0 : -16, transition: { duration: 0.25, ease: introEase } },
  };

  const currentQuestion = diagnosticQuestions[step];
  const isContactStep = step === diagnosticQuestions.length;

  const setSingle = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));
  const toggleMulti = (key, value) =>
    setAnswers((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value],
    }));

  const canAdvance = () => {
    if (isContactStep) {
      return answers.name.trim() && answers.whatsapp.trim() && answers.email.trim();
    }
    if (currentQuestion.type === 'single') return Boolean(answers[currentQuestion.key]);
    if (currentQuestion.type === 'multi') return answers[currentQuestion.key].length > 0;
    return answers[currentQuestion.key].trim().length > 0;
  };

  const goNext = () => canAdvance() && setStep((value) => Math.min(value + 1, totalSteps - 1));
  const goBack = () => setStep((value) => Math.max(value - 1, 0));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canAdvance()) return;
    setSubmitted(true);
  };

  const startDiagnosticFrom = (serviceId) => {
    const preset = servicePresets[serviceId];
    setAnswers((prev) => ({ ...prev, ...(preset ?? {}) }));
    setStep(0);
    setSubmitted(false);
    document.getElementById('diagnostico-inicial')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
              Você não precisa saber qual solução contratar. Comece me contando o que está
              acontecendo — o caminho vem depois.
            </m.p>
            <m.div className="button-group" variants={introItemVariants}>
              <a className="button" href="#diagnostico-inicial">
                Começar diagnóstico
              </a>
              <a className="button button--secondary" href="#solucoes">
                Conhecer soluções
              </a>
            </m.div>
          </m.div>
        </section>

        <section className="diagnostic-section" id="diagnostico-inicial">
          <div className="container diagnostic-intro">
            <div data-reveal>
              <p className="eyebrow">Diagnóstico inicial</p>
              <h2>Vamos começar pelo que está travando.</h2>
              <p className="lead">
                Em poucos passos, você organiza o contexto e me ajuda a entender onde está o
                problema. A partir disso, consigo avaliar qual caminho faz mais sentido.
              </p>
            </div>
            <img
              src="/assets/renata-diagnostico-inicial.jpg"
              alt="Renata Araujo segurando um tablet, sorrindo"
              width="600"
              height="900"
              loading="lazy"
              data-reveal
              style={{ '--reveal-delay': '90ms' }}
            />
          </div>

          <div className="container">
            <form className="diagnostic-form" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="diagnostic-success">
                  <p className="eyebrow">Diagnóstico enviado</p>
                  <h3>Já temos um ponto de partida.</h3>
                  <p>
                    Pelas suas respostas, consigo chegar à conversa com mais contexto. Vou
                    analisar o que você enviou e, se houver aderência, seguimos para a consulta e
                    definimos o próximo passo.
                  </p>
                  <div className="button-group">
                    <ButtonLink to={createWhatsAppUrl(buildWhatsAppMessage(answers))}>
                      Falar comigo no WhatsApp
                    </ButtonLink>
                    <a className="button button--secondary" href="#solucoes">
                      Conhecer as soluções
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="diagnostic-progress">
                    <span className="card-label">
                      Etapa {step + 1} de {totalSteps}
                    </span>
                    <div className="diagnostic-progress__track">
                      <div
                        className="diagnostic-progress__fill"
                        style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    <m.div
                      key={step}
                      variants={stepVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {isContactStep ? (
                        <div className="diagnostic-form__contact">
                          <label htmlFor="diag-name">Nome</label>
                          <input
                            id="diag-name"
                            required
                            autoComplete="name"
                            value={answers.name}
                            onChange={(event) => setSingle('name', event.target.value)}
                          />
                          <div className="contact-diagnostic__row">
                            <div>
                              <label htmlFor="diag-company">Empresa ou projeto</label>
                              <input
                                id="diag-company"
                                value={answers.company}
                                onChange={(event) => setSingle('company', event.target.value)}
                              />
                            </div>
                            <div>
                              <label htmlFor="diag-whatsapp">WhatsApp</label>
                              <input
                                id="diag-whatsapp"
                                required
                                autoComplete="tel"
                                value={answers.whatsapp}
                                onChange={(event) => setSingle('whatsapp', event.target.value)}
                              />
                            </div>
                          </div>
                          <label htmlFor="diag-email">E-mail</label>
                          <input
                            id="diag-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={answers.email}
                            onChange={(event) => setSingle('email', event.target.value)}
                          />
                        </div>
                      ) : currentQuestion.type === 'text' ? (
                        <div>
                          <label htmlFor={`diag-${currentQuestion.key}`}>{currentQuestion.question}</label>
                          <textarea
                            id={`diag-${currentQuestion.key}`}
                            required
                            placeholder={currentQuestion.placeholder}
                            value={answers[currentQuestion.key]}
                            onChange={(event) => setSingle(currentQuestion.key, event.target.value)}
                          />
                        </div>
                      ) : (
                        <fieldset className="diagnostic-form__field">
                          <legend>{currentQuestion.question}</legend>
                          <ChoiceGroup
                            options={currentQuestion.options}
                            selected={answers[currentQuestion.key]}
                            multi={currentQuestion.type === 'multi'}
                            onToggle={(option) =>
                              currentQuestion.type === 'multi'
                                ? toggleMulti(currentQuestion.key, option)
                                : setSingle(currentQuestion.key, option)
                            }
                          />
                        </fieldset>
                      )}
                    </m.div>
                  </AnimatePresence>

                  <div className="diagnostic-form__nav">
                    {step > 0 && (
                      <button type="button" className="button--link" onClick={goBack}>
                        Voltar
                      </button>
                    )}
                    {step < totalSteps - 1 ? (
                      <button
                        type="button"
                        className="button button--special"
                        disabled={!canAdvance()}
                        onClick={goNext}
                      >
                        Avançar
                      </button>
                    ) : (
                      <button type="submit" className="button button--special" disabled={!canAdvance()}>
                        Enviar meu diagnóstico inicial
                      </button>
                    )}
                  </div>
                </>
              )}
            </form>
          </div>
        </section>

        <section id="caminho">
          <div className="container">
            <SectionHeading
              eyebrow="O caminho"
              title={
                <>
                  Do problema à <em>solução.</em>
                </>
              }
            />
            <ol className="path-sequence">
              {pathSteps.map((item, index) => (
                <li key={item.title} data-reveal style={{ '--reveal-delay': `${index * 90}ms` }}>
                  <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="solucoes">
          <div className="container">
            <SectionHeading
              eyebrow="Soluções"
              title={
                <>
                  A solução depende do <em>problema.</em>
                </>
              }
            >
              <p>
                Cada projeto combina as disciplinas necessárias para resolver o que está travando
                — sem encaixar necessidades complexas em pacotes genéricos.
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
                    <button type="button" className="button" onClick={() => startDiagnosticFrom(service.id)}>
                      Esse parece ser meu problema
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="surface-section service-diagnostic" id="diagnostico-estrategico">
          <div className="container">
            <p className="card-label">{diagnostic.audience}</p>
            <h2>Quando ainda não está claro o que precisa ser construído.</h2>
            <p className="lead">
              Alguns problemas atravessam marca, tecnologia, processos e experiência ao mesmo
              tempo. Nesses casos, investigar antes de executar evita investir na solução errada.
            </p>
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
            <a className="button" href="#diagnostico-inicial">
              Começar pelo diagnóstico inicial
            </a>
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
              Precisa começar pelo problema.
            </m.h2>
            <m.p className="lead" variants={introItemVariants}>
              O diagnóstico inicial me ajuda a entender o contexto antes da nossa conversa — e
              ajuda você a organizar o que realmente precisa mudar.
            </m.p>
            <m.div className="button-group" variants={introItemVariants}>
              <a className="button button--special" href="#diagnostico-inicial">
                Começar diagnóstico
              </a>
              <ButtonLink to="/#contato" secondary>
                Falar comigo
              </ButtonLink>
            </m.div>
          </m.div>
        </section>
      </div>
    </LazyMotion>
  );
}
