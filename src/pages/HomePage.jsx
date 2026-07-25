import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { paths, principles, processSteps } from '../data/site';
import { projects } from '../data/projects';
import { tools } from '../data/tools';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';
import { createWhatsAppUrl } from '../utils/whatsapp';

export default function HomePage() {
  const [form, setForm] = useState({ name: '', interest: 'Projeto para mim', message: '' });
  useDocumentMeta({
    title: 'Renata Join — Identidade, Estratégia, Design e Tecnologia',
    description:
      'Estratégia, identidade, design, tecnologia e sistemas para pessoas e organizações que desejam construir com clareza.',
  });
  useReveal();

  const submit = (event) => {
    event.preventDefault();
    const message = `Olá, Rê! Vim pelo site.\n\nMeu nome: ${form.name.trim()}\nCaminho: ${form.interest}\n\n${form.message.trim()}`;
    window.open(createWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <section className="hero" id="home">
        <div className="container hero-content">
          <p className="eyebrow">Identidade · estratégia · construção</p>
          <h1>
            Antes de existir uma marca, existe uma <em>pessoa.</em>
          </h1>
          <div className="hero-copy">
            <p>
              Antes de existir uma empresa, uma carreira ou um projeto, existe alguém tentando
              construir algo que faça sentido.
            </p>
            <p>Meu trabalho começa aí.</p>
            <p>
              Uno identidade, estratégia, design e tecnologia para transformar o que pessoas e
              organizações pensam, fazem e acreditam em algo claro, coerente e reconhecível.
            </p>
          </div>
          <div className="button-group">
            <ButtonLink to="/servicos">Descubra como posso ajudar</ButtonLink>
            <ButtonLink to="/clientes" secondary>
              Conheça minhas construções
            </ButtonLink>
          </div>
          <p className="microcopy">Identidade para pensar, comunicar e construir sem personagem.</p>
        </div>
      </section>

      <section className="surface-section">
        <div className="container">
          <SectionHeading
            eyebrow="Manifesto"
            title={
              <>
                Toda construção revela uma <em>identidade.</em>
              </>
            }
          >
            <p>
              Uma marca revela como uma empresa pensa. Um sistema revela como ela funciona. Um site
              revela como organiza sua mensagem.
            </p>
            <p>
              Por isso, não começo pela aparência. Começo pelas pessoas, pelo contexto e pela lógica
              que sustenta cada decisão.
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
              compreensão da identidade e do contexto.
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
              <article className="project-card" key={project.name} data-reveal>
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
              Design me ensinou percepção. Tecnologia me ensinou <em>estrutura.</em>
            </h2>
            <p>
              Sou designer, profissional de tecnologia e estrategista. Observo pessoas, identifico
              padrões e transformo complexidade em estruturas compreensíveis.
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
