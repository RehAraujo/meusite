import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { heroIndicators, paths, principles, processSteps } from '../data/site';
import { projects } from '../data/projects';
import { tools } from '../data/tools';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';
import { createWhatsAppUrl } from '../utils/whatsapp';

export default function HomePage() {
  const [form, setForm] = useState({ name: '', interest: 'Projeto para mim', message: '' });
  useDocumentMeta({
    title: 'Renata Join — Soluções Digitais, Estratégia e Tecnologia',
    description:
      'Transformo problemas complexos em soluções digitais bem estruturadas. Tecnologia, negócio, processos e experiência do usuário, com Design como diferencial.',
  });
  useReveal();

  const submit = (event) => {
    event.preventDefault();
    const message = `Olá, Rê! Vim pelo site.\n\nMeu nome: ${form.name.trim()}\nCaminho: ${form.interest}\n\n${form.message.trim()}`;
    window.open(createWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <section className="hero hero-editorial" id="home">
        <div className="hero-text" data-reveal>
          <p className="eyebrow">Tecnologia · negócio · processos · UX</p>
          <h1 data-reveal="mask">
            <span>Transformo problemas complexos em soluções digitais bem estruturadas.</span>
          </h1>
          <div className="hero-copy">
            <p>
              Atuo na interseção entre tecnologia, negócio, processos e experiência do usuário para
              organizar informações, estruturar necessidades e construir soluções claras, funcionais
              e executáveis.
            </p>
          </div>
          <p className="hero-signature">A estética chama atenção. A lógica faz ficar.</p>
          <div className="button-group">
            <ButtonLink to="/servicos" className="button--special">
              Descubra como posso ajudar
            </ButtonLink>
            <ButtonLink to="/clientes" secondary>
              Conheça minhas construções
            </ButtonLink>
          </div>
          <p className="hero-note">
            Gosto de entender o problema antes de escolher a ferramenta. É assim que evito
            automatizar confusão, desenhar caminhos inúteis ou construir soluções que ninguém
            consegue manter.
          </p>
        </div>
        <div
          className="hero-portrait"
          data-reveal
          style={{ '--reveal-delay': '180ms' }}
        >
          <img
            src="/assets/renata-hero-workspace.jpg"
            alt="Renata Araujo em home office, com monitores ao fundo"
            width="1024"
            height="1024"
            fetchPriority="high"
          />
          <span>Renata Araujo</span>
        </div>
      </section>

      <section>
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
            <article key={principle} className="principle-card" data-reveal>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{principle}</strong>
            </article>
          ))}
        </div>
      </section>

      <section>
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
              Nem todo mundo chega precisando da mesma coisa. Todos os caminhos começam pela
              compreensão do problema e do contexto.
            </p>
          </SectionHeading>
          <div className="card-grid card-grid--three">
            {paths.map((path) => (
              <article className="path-card" key={path.title} data-reveal>
                <p className="card-label">{path.eyebrow}</p>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <ButtonLink to={path.to}>Conheça esse caminho</ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-section">
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
          <div className="card-grid card-grid--three">
            {projects.slice(0, 3).map((project) => (
              <article
                className="project-card project-card--preview"
                key={project.name}
                data-reveal
              >
                <p className="card-label">{project.context}</p>
                <h3>{project.name}</h3>
                <p>{project.challenge}</p>
                <Link to="/clientes">Conheça a construção →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Processo"
            title={
              <>
                Não começo desenhando. Começo <em>compreendendo.</em>
              </>
            }
          />
          <ol className="process-grid">
            {processSteps.map(([title, description], index) => (
              <li key={title} data-reveal>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="surface-section">
        <div className="container">
          <SectionHeading
            eyebrow="Ferramentas"
            title={
              <>
                Algumas construções podem começar <em>agora.</em>
              </>
            }
          >
            <p>
              Produtos digitais criados a partir de problemas recorrentes e da minha própria
              prática.
            </p>
          </SectionHeading>
          <div className="card-grid">
            {tools.map((tool) => (
              <article className="tool-card" key={tool.id} data-reveal>
                <p className="card-label">{tool.format}</p>
                <h3>{tool.name}</h3>
                <p>{tool.description}</p>
                <strong className="price">{tool.price}</strong>
                <ButtonLink to={tool.buyUrl}>Comprar ferramenta</ButtonLink>
              </article>
            ))}
          </div>
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
            <ButtonLink to="/sobre">Conheça minha trajetória</ButtonLink>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contato">
        <div className="container contact-grid">
          <div data-reveal>
            <p className="eyebrow">Contato</p>
            <h2>
              Toda construção começa com uma conversa <em>honesta.</em>
            </h2>
            <p>
              Você não precisa chegar sabendo o nome do serviço ou a solução exata. Conte o contexto
              e identificaremos o caminho mais coerente.
            </p>
          </div>
          <form onSubmit={submit} data-reveal>
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
            <label htmlFor="contact-message">Conte um pouco do contexto</label>
            <textarea
              id="contact-message"
              required
              minLength="10"
              maxLength="2000"
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
            <button className="button" type="submit">
              Enviar pelo WhatsApp →
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
