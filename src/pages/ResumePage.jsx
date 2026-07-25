import resume from '../../data/curriculo.json';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const practical = [
  'React',
  'JavaScript',
  'CSS',
  'HTML',
  'GitHub',
  'Cloudflare',
  'Notion',
  'Figma',
  'Documentação',
  'Excel',
  'Visio',
  'MS Project',
];
const foundations = [
  'Lógica de programação',
  'Pensamento computacional',
  'Fundamentos de JavaScript',
  'Desenvolvimento web',
  'Arquitetura da informação',
  'Análise de sistemas',
];
const developing = ['SQL', 'Modelagem de dados', 'TypeScript', 'Testes automatizados', 'APIs'];

export default function ResumePage() {
  useDocumentMeta({
    title: 'Currículo | Renata Gomes Araujo',
    description: 'Currículo profissional de Renata Gomes Araujo.',
    path: '/curriculo',
    noindex: true,
  });
  return (
    <article className="resume container">
      <header className="resume-header">
        <p className="eyebrow">Currículo profissional</p>
        <h1>{resume.identity.name}</h1>
        <p className="lead">{resume.identity.title}</p>
        <p>
          {resume.identity.location} · {resume.identity.availability}
        </p>
        <div className="button-group no-print">
          <a className="button" href="/documents/renata-gomes-araujo-curriculo.pdf" download>
            Baixar PDF
          </a>
          <button className="button button--secondary" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </header>
      <section>
        <h2>Resumo profissional</h2>
        <p>{resume.summary}</p>
        <p>
          <strong>{resume.focus}</strong>
        </p>
      </section>
      <section>
        <h2>Competências técnicas</h2>
        <div className="resume-grid">
          <SkillGroup title="Aplicação prática" items={practical} />
          <SkillGroup title="Conhecimentos em desenvolvimento" items={foundations} />
          <SkillGroup title="Em desenvolvimento" items={developing} />
        </div>
      </section>
      <section>
        <h2>Experiência</h2>
        {resume.experience.map((item) => (
          <article className="resume-entry" key={`${item.role}-${item.organization ?? ''}`}>
            <header>
              <h3>{item.role}</h3>
              <p>
                {item.organization} · {item.period}
              </p>
            </header>
            <p>{item.summary}</p>
            <ul>
              {item.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section>
        <h2>Projetos</h2>
        <div className="resume-grid">
          {resume.projects.map((project) => (
            <article key={project.name}>
              <h3>{project.name}</h3>
              <p>{project.context}</p>
              <p>
                <strong>Solução:</strong> {project.solution}
              </p>
              <p>
                <strong>Evidência:</strong> {project.evidence}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>Formação</h2>
        {resume.education.map((item) => (
          <article className="resume-entry" key={item.course}>
            <h3>{item.course}</h3>
            <p>
              {item.status} {item.year && `· ${item.year}`}
            </p>
          </article>
        ))}
      </section>
      <section>
        <h2>Sobre este projeto</h2>
        <p>
          Este site utiliza React, JavaScript moderno, CSS próprio, componentes reutilizáveis, dados
          centralizados, pré-renderização, acessibilidade, controles de segurança, SEO técnico,
          Cloudflare e versionamento no GitHub.
        </p>
        <p className="disclaimer">
          Tecnologia presente no projeto não equivale automaticamente a domínio profissional. As
          classificações acima diferenciam aplicação, fundamentos e estudos em desenvolvimento.
        </p>
      </section>
    </article>
  );
}

function SkillGroup({ title, items }) {
  return (
    <article>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
