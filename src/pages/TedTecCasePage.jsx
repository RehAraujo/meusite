import { BrandGallery } from '../components/case/BrandGallery';
import { ProcessStepper } from '../components/case/ProcessStepper';
import { ProjectGallery } from '../components/case/ProjectGallery';
import { ServiceCard } from '../components/case/ServiceCard';
import { SectionHeading } from '../components/ui/SectionHeading';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const process = [
  [
    'Diagnóstico',
    'Antes de redesenhar, investiguei páginas, plugins, cache e dependências para preservar o que funcionava e localizar os problemas reais.',
  ],
  [
    'Marca',
    'Construí uma linguagem visual orientada à precisão técnica, usando grafite e teal para unir estrutura, tecnologia e reconhecimento.',
  ],
  [
    'Estratégia',
    'Reorganizei conteúdo, hierarquia e jornada para tornar mais claro o que a TED TEC resolve e conduzir o usuário até o atendimento.',
  ],
  [
    'Experiência',
    'Reduzi ruído e organizei os caminhos de navegação para facilitar a descoberta dos serviços sem reconstruir desnecessariamente o que já existia.',
  ],
  [
    'Interface',
    'Levei a identidade para uma experiência mais técnica e contemporânea, trabalhando contraste, respiro e hierarquia sem comprometer a clareza comercial.',
  ],
  [
    'Desenvolvimento',
    'Implementei a nova experiência sobre o WordPress existente com componentes próprios, responsividade e possibilidade de rollback localizado.',
  ],
  [
    'Integração',
    'Conectei as avaliações reais do Google à interface própria do site, mantendo conteúdo dinâmico sem descaracterizar a experiência visual.',
  ],
  [
    'QA & Produção',
    'Homologuei responsividade, acessibilidade, motion e integrações; versionei o código e documentei deploy, rollback e decisões técnicas antes da entrega.',
  ],
].map(([title, description]) => ({ title, description }));

const brandChapters = [
  {
    id: 'assinatura',
    label: 'Identidade',
    summary: 'A assinatura que concentra o sistema visual.',
    image: '/assets/tedtec/identity-signature.jpg',
    alt: 'Assinatura completa da TED TEC com símbolo do urso e logotipo sobre fundo claro',
    caption: 'Símbolo e nome formam uma assinatura direta, técnica e reconhecível.',
  },
  {
    id: 'paleta',
    label: 'Paleta',
    summary: 'Contraste estrutural e energia em teal.',
    image: '/assets/tedtec/identity-palette.jpg',
    alt: 'Paleta da TED TEC apresentada nas formas do símbolo em branco, teal e grafite',
    caption: 'Grafite para estrutura; teal para energia, orientação e interação.',
  },
  {
    id: 'construcao',
    label: 'Construção',
    summary: 'Estudos que conduziram à síntese do urso.',
    image: '/assets/tedtec/identity-evolution.jpg',
    alt: 'Estudos de evolução do símbolo da TED TEC até a versão final do urso geométrico',
    caption: 'A forma final surge por depuração, não por ornamentação.',
  },
  {
    id: 'aplicacao',
    label: 'Aplicação',
    summary: 'Materialidade sem perder clareza.',
    image: '/assets/tedtec/identity-application.jpg',
    alt: 'Marca TED TEC aplicada em relevo sobre papel branco texturizado e superfície escura',
    caption: 'A assinatura mantém presença quando sai da tela e encontra a matéria.',
  },
];

export default function TedTecCasePage() {
  useDocumentMeta({
    title: 'TED TEC — Da identidade à experiência digital | Renata Join',
    description:
      'Case TED TEC: identidade visual, estratégia, UX/UI, desenvolvimento WordPress, motion e integração de avaliações do Google.',
    path: '/clientes/ted-tec',
  });
  useReveal();

  return (
    <article className="case-page tedtec-case">
      <header className="case-hero case-hero--light">
        <div className="container case-hero__grid">
          <div className="case-hero__copy" data-reveal>
            <p className="eyebrow">TED TEC</p>
            <h1>
              Da identidade à <em>experiência digital.</em>
            </h1>
            <p className="case-disciplines">
              Branding · UX/UI · Desenvolvimento · Motion · WordPress
            </p>
            <p className="lead">
              A TED TEC precisava de mais do que uma nova interface. O trabalho começou na
              construção de sua identidade visual e avançou para a reorganização da presença
              digital, integrando marca, experiência e tecnologia.
            </p>
          </div>
          <figure className="case-hero__media case-hero__media--brand" data-reveal>
            <img
              src="/assets/tedtec/identity-application.jpg"
              alt="Marca TED TEC aplicada em relevo sobre papel texturizado"
              width="1366"
              height="768"
            />
          </figure>
        </div>
      </header>

      <section className="case-context surface-section">
        <div className="container case-editorial-grid">
          <div data-reveal>
            <p className="eyebrow">Contexto</p>
            <h2>Mais do que redesenhar uma página.</h2>
          </div>
          <div className="case-copy" data-reveal>
            <p>
              O projeto partiu de uma instalação WordPress existente. Antes de qualquer intervenção,
              foi preciso entender páginas, plugins, dados, cache e dependências para preservar o
              que já funcionava e localizar o problema real.
            </p>
            <p>
              A identidade desenvolvida para a TED TEC passou a orientar também conteúdo,
              hierarquia, interface e comportamento — sem transformar a implementação em uma
              reconstrução desnecessária.
            </p>
          </div>
        </div>
      </section>

      <section className="case-brand" aria-labelledby="tedtec-brand-title">
        <div className="container">
          <div className="case-brand__intro" data-reveal>
            <div>
              <p className="eyebrow">Identidade visual</p>
              <h2 id="tedtec-brand-title">Uma marca construída para transmitir precisão.</h2>
            </div>
            <p>
              O sistema nasce de uma síntese entre tecnologia, proteção e presença. O grafite cria
              estrutura; o teal conduz os pontos de energia e interação que depois atravessam a
              interface.
            </p>
          </div>
          <BrandGallery items={brandChapters} />
          <div className="case-brand__notes" data-reveal>
            <article>
              <p className="eyebrow">Cor</p>
              <p>
                O grafite estabelece precisão e estrutura. O teal concentra energia nos pontos que
                orientam, conectam e colocam a experiência em movimento.
              </p>
            </article>
            <article>
              <p className="eyebrow">Tipografia</p>
              <p>
                A combinação tipográfica sustenta clareza técnica sem tornar a comunicação fria,
                preservando presença e proximidade em diferentes escalas.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="case-brand-bridge" aria-labelledby="tedtec-bridge-title">
        <div className="container case-brand-bridge__grid">
          <div data-reveal>
            <p className="eyebrow">Da marca à interface</p>
            <h2 id="tedtec-bridge-title">A identidade não terminou no logotipo.</h2>
            <p>
              Contraste, linhas técnicas e pontos de luz foram traduzidos em hierarquia, motion e
              feedback visual. O site passa a agir como uma continuação da marca — não como uma
              camada separada.
            </p>
          </div>
          <figure data-reveal>
            <img
              src="/assets/tedtec-case-hero.png"
              alt="Hero final da TED TEC, resultado da tradução da identidade para a experiência digital"
              width="1440"
              height="900"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <section className="case-process surface-section" aria-labelledby="tedtec-process-title">
        <div className="container">
          <p className="eyebrow">Processo</p>
          <h2 id="tedtec-process-title">Do contexto à produção.</h2>
          <ProcessStepper steps={process} />
        </div>
      </section>

      <section className="case-insight">
        <div className="container case-insight__grid">
          <div data-reveal>
            <p className="eyebrow">Investigação + integração</p>
            <h2>Nem todo problema visual é visual.</h2>
          </div>
          <div className="case-copy" data-reveal>
            <p>
              As avaliações pareciam conectadas ao Google, mas os cards visíveis estavam gravados
              diretamente na página. A auditoria mostrou que o Rich Showcase já sincronizava novas
              avaliações em segundo plano.
            </p>
            <p>
              Em vez de trocar o design por um widget genérico, foi criada uma camada própria para
              ler, normalizar e apresentar esses dados na interface existente.
            </p>
            <p className="case-outcome">
              Avaliações dinâmicas, identidade preservada e menos manutenção manual.
            </p>
          </div>
        </div>
      </section>

      <section className="case-motion surface-section">
        <div className="container">
          <SectionHeading eyebrow="Motion & interface" title="Movimento a serviço da leitura.">
            <p>
              O notebook, o HUD e as transições foram construídos com JavaScript e Canvas 2D
              nativos, com fallback e movimento reduzido.
            </p>
          </SectionHeading>
          <div className="case-media-pair">
            <figure data-reveal>
              <img
                src="/assets/tedtec-case-hero.png"
                alt="Composição desktop do Hero técnico da TED TEC"
                width="1440"
                height="900"
                loading="lazy"
              />
              <figcaption>Composição desktop</figcaption>
            </figure>
            <figure data-reveal>
              <img
                src="/assets/tedtec-case-mobile.png"
                alt="Composição mobile do Hero técnico da TED TEC"
                width="390"
                height="844"
                loading="lazy"
              />
              <figcaption>Adaptação mobile</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="case-result">
        <div className="container case-result__grid">
          <div data-reveal>
            <p className="eyebrow">O resultado</p>
            <h2>Um sistema visual e técnico coerente.</h2>
          </div>
          <div className="case-copy" data-reveal>
            <p className="lead">
              Uma presença digital em que identidade, conteúdo, interação e tecnologia passaram a
              funcionar como partes do mesmo sistema — com uma base estruturada para manutenção e
              evolução.
            </p>
            <p className="case-evidence">
              Três componentes WordPress próprios · avaliações dinâmicas · motion nativo · QA em
              desktop, tablet e mobile · documentação e rollback.
            </p>
          </div>
        </div>
      </section>

      <section className="case-more-projects" aria-labelledby="more-projects-title">
        <div className="container">
          <div className="case-more-projects__heading" data-reveal>
            <div>
              <p className="eyebrow">Continua</p>
              <h2 id="more-projects-title">Outras construções.</h2>
            </div>
            <p>Uma galeria editorial de projetos que em breve ganham seus próprios recortes.</p>
          </div>
          <div data-reveal>
            <ProjectGallery />
          </div>
        </div>
      </section>

      <section className="case-help surface-section" aria-labelledby="case-help-title">
        <div className="container">
          <div className="case-help__heading" data-reveal>
            <div>
              <p className="eyebrow">Como posso te ajudar</p>
              <h2 id="case-help-title">O caminho certo começa por entender o problema.</h2>
            </div>
          </div>
          <div className="case-help__grid" data-reveal>
            <ServiceCard
              index="01"
              title="Estratégia"
              href="https://wa.me/5561992191272"
              ariaLabel="Falar sobre estratégia no WhatsApp"
            >
              Diagnóstico, posicionamento e definição do caminho antes da solução.
            </ServiceCard>
            <ServiceCard
              index="02"
              title="Design"
              href="https://wa.me/5561992191272"
              ariaLabel="Falar sobre design no WhatsApp"
            >
              Identidade, direção visual, UX/UI e experiências que traduzem a marca.
            </ServiceCard>
            <ServiceCard
              index="03"
              title="Tecnologia"
              href="https://wa.me/5561992191272"
              ariaLabel="Falar sobre tecnologia no WhatsApp"
            >
              Sites, sistemas, integrações e estruturas digitais construídas para funcionar.
            </ServiceCard>
          </div>
        </div>
      </section>

    </article>
  );
}
