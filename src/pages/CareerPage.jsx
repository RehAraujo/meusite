import resume from '../../data/curriculo.json';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const pdfPath = '/documents/renata-gomes-araujo-curriculo-ats.pdf';
const roles = ['Analista de Sistemas', 'Analista de Requisitos', 'Analista de Negócios'];
const technologies = [
  'React',
  'JavaScript',
  'HTML',
  'CSS',
  'Git',
  'GitHub',
  'GitHub Actions',
  'Cloudflare',
  'Notion',
  'Figma',
  'Excel',
  'Visio',
  'MS Project',
  'IA Generativa',
];

export default function CareerPage() {
  useReveal();
  useDocumentMeta({
    title: 'Carreira | Analista de Sistemas, Requisitos e Negócios | Renata Araujo',
    description:
      'Experiência de Renata Araujo em análise de sistemas, requisitos, negócios, processos, produtos digitais e experiência do usuário.',
    path: '/carreira',
  });

  return (
    <article className="career career--clear">
      <header className="career-clear-hero container" id="inicio">
        <div data-reveal>
          <p className="eyebrow">Carreira</p>
          <h1>
            Analista de soluções digitais com visão <em>integrada.</em>
          </h1>
        </div>
        <div className="career-clear-intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
          <p className="career-clear-name">Renata Gomes Araujo</p>
          <ul className="career-role-list" aria-label="Áreas profissionais">
            {roles.map((role) => (
              <li key={role}>{role}</li>
            ))}
          </ul>
          <p>
            Traduzo necessidades entre áreas técnicas e de negócio em requisitos, processos,
            documentação e soluções digitais claras.
          </p>
          <div className="button-group">
            <a className="button" href={pdfPath} download>
              Baixar currículo
            </a>
            <a className="button button--secondary" href="#experiencia">
              Ver experiência
            </a>
          </div>
        </div>
      </header>

      <nav className="career-clear-index" aria-label="Nesta página">
        <div className="container">
          <a href="#resumo">Resumo</a>
          <a href="#competencias">Competências</a>
          <a href="#experiencia">Experiência</a>
          <a href="#projetos">Projetos</a>
          <a href="#formacao">Formação</a>
          <a href="#contato-carreira">Contato</a>
        </div>
      </nav>

      <section className="career-clear-summary container" id="resumo">
        <p className="career-clear-kicker" data-reveal>
          Compreender <span>antes</span> de construir.
        </p>
        <div data-reveal style={{ '--reveal-delay': '90ms' }}>
          <p className="eyebrow">Resumo profissional</p>
          <p className="career-clear-lead">
            Profissional graduada em Análise e Desenvolvimento de Sistemas e Design Gráfico, com
            experiência na integração entre negócio, tecnologia, processos e experiência do usuário.
          </p>
          <p>
            Atua no levantamento e análise de requisitos, documentação funcional, modelagem de
            processos, implantação de sistemas, arquitetura da informação e organização de soluções
            digitais. Facilita a comunicação entre áreas técnicas e de negócio, transformando
            necessidades em estruturas compreensíveis e executáveis.
          </p>
        </div>
      </section>

      <section className="career-clear-section career-clear-skills" id="competencias">
        <div className="container">
          <CareerHeading
            eyebrow="Competências"
            title="Conhecimento organizado pelo problema que ajuda a resolver."
          />
          <div className="career-clear-skill-grid">
            {resume.competencies.slice(0, 4).map((competency, index) => (
              <article
                key={competency.title}
                data-reveal
                style={{ '--reveal-delay': `${index * 65}ms` }}
              >
                <span>0{index + 1}</span>
                <h3>{competency.title}</h3>
                <ul>
                  {competency.items.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="career-clear-section container" id="experiencia">
        <CareerHeading
          eyebrow="Experiência profissional"
          title="Três contextos. Uma mesma capacidade de organizar complexidade."
        />
        <div className="career-clear-timeline">
          {resume.experience.map((experience, index) => (
            <article
              key={experience.role}
              data-reveal
              style={{ '--reveal-delay': `${index * 70}ms` }}
            >
              <div className="career-clear-meta">
                <span>{experience.period}</span>
                {experience.organization && <span>{experience.organization}</span>}
              </div>
              <div>
                <h3>{experience.role}</h3>
                <p>{experience.summary}</p>
                <ul>
                  {experience.highlights.slice(0, 3).map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="career-clear-section career-clear-projects" id="projetos">
        <div className="container">
          <CareerHeading eyebrow="Projetos" title="Soluções que conectam estrutura e uso real." />
          <div className="career-clear-project-grid">
            {resume.projects.slice(0, 2).map((project, index) => (
              <article
                key={project.name}
                data-reveal
                style={{ '--reveal-delay': `${index * 80}ms` }}
              >
                <span>0{index + 1}</span>
                <h3>{project.name}</h3>
                <p>{project.context}</p>
                <strong>{project.solution}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="career-clear-section container career-clear-foundation" id="formacao">
        <div data-reveal>
          <p className="eyebrow">Formação</p>
          <h2>Base acadêmica</h2>
          {resume.education.slice(0, 2).map((item) => (
            <article key={item.course}>
              <h3>{item.course}</h3>
              {item.institution && <p className="career-clear-institution">{item.institution}</p>}
              <p>
                {item.status} · {item.year}
              </p>
            </article>
          ))}
        </div>
        <div data-reveal style={{ '--reveal-delay': '80ms' }}>
          <p className="eyebrow">Tecnologias</p>
          <ul className="career-clear-tags">
            {technologies.map((technology) => (
              <li key={technology}>{technology}</li>
            ))}
          </ul>
        </div>
        <div data-reveal style={{ '--reveal-delay': '160ms' }}>
          <p className="eyebrow">Idiomas</p>
          <dl className="career-clear-languages">
            <div>
              <dt>Português</dt>
              <dd>Nativo</dd>
            </div>
            <div>
              <dt>Inglês</dt>
              <dd>Leitura técnica</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="career-clear-contact" id="contato-carreira">
        <div className="container" data-reveal>
          <p className="eyebrow">Contato profissional</p>
          <h2>Projetos melhores começam com entendimento compartilhado.</h2>
          <p>Brasília - DF · Remoto ou híbrido</p>
          <div className="button-group">
            <a
              className="button"
              href="https://www.linkedin.com/in/renatajoin/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="button button--secondary"
              href="https://wa.me/5561992191272"
              target="_blank"
              rel="noopener noreferrer"
            >
              Conversar
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}

function CareerHeading({ eyebrow, title }) {
  return (
    <header className="career-clear-heading" data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </header>
  );
}
