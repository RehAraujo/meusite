import resume from '../../data/curriculo.json';
import {
  careerCompetencies,
  careerExperience,
  careerProjects,
  currentStudies,
  problemFlow,
  technologyUses,
} from '../data/career';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const pdfPath = '/documents/renata-gomes-araujo-curriculo-ats.pdf';

export default function CareerPage() {
  useReveal();
  useDocumentMeta({
    title: 'Carreira | Analista de Soluções Digitais | Renata Gomes Araujo',
    description:
      'Trajetória e projetos de Renata Gomes Araujo em requisitos, processos, produto, tecnologia e experiência do usuário.',
    path: '/carreira',
  });

  return (
    <article className="career">
      <header className="career-hero container" id="inicio">
        <p className="eyebrow">Negócio · Produto · Processos · Tecnologia</p>
        <h1>
          Analista de <em>Soluções Digitais</em>
        </h1>
        <p className="career-value">
          Transformo problemas complexos em soluções digitais bem estruturadas.
        </p>
        <p className="lead">
          Conecto necessidades de negócio, requisitos, processos, arquitetura da informação e
          experiência do usuário para ajudar pessoas e equipes a construir com mais clareza.
        </p>
        <blockquote>“A estética chama atenção, a lógica faz ficar.”</blockquote>
        <div className="button-group">
          <a className="button" href={pdfPath} download>
            Baixar currículo PDF
          </a>
          <a className="button button--secondary" href="#trajetoria">
            Conhecer minha trajetória
          </a>
        </div>
      </header>

      <nav className="career-index" aria-label="Nesta página">
        <div className="container">
          {[
            ['Resumo', 'resumo'],
            ['Como resolvo', 'metodo'],
            ['Competências', 'competencias'],
            ['Experiência', 'trajetoria'],
            ['Projetos', 'projetos'],
            ['Formação', 'formacao'],
            ['Estudos', 'estudos'],
            ['Contato', 'contato-carreira'],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section className="career-section container career-summary" id="resumo" data-reveal>
        <div>
          <p className="eyebrow">Resumo profissional</p>
          <h2>Reduzir complexidade começa por compreender o problema certo.</h2>
        </div>
        <div>
          <p>
            Sou formada em Análise e Desenvolvimento de Sistemas e Design Gráfico. Minha atuação
            acontece na interseção entre negócio, tecnologia, processos, comunicação e experiência
            do usuário.
          </p>
          <p>
            Escuto pessoas, organizo informações e traduzo necessidades ainda pouco estruturadas em
            requisitos, fluxos, documentação, sistemas e experiências digitais compreensíveis.
          </p>
          <p>
            Crio uma linguagem comum entre clientes, usuários, gestores e pessoas técnicas. O Design
            amplia minha capacidade de estruturar e comunicar; não define sozinho o meu trabalho.
          </p>
        </div>
      </section>

      <section className="career-section career-method" id="metodo">
        <div className="container">
          <CareerHeading
            eyebrow="Como resolvo problemas"
            title="Uma solução é consequência de uma sequência de boas perguntas."
            text="A estrutura torna decisões, dependências e aprendizados visíveis sem tornar o processo rígido."
          />
          <ol className="career-flow">
            {problemFlow.map(([number, title, description]) => (
              <li key={number} data-reveal>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="career-section container" id="competencias">
        <CareerHeading
          eyebrow="Competências"
          title="Organizadas pela construção de um produto, não por uma lista de ferramentas."
        />
        <div className="career-competencies">
          {careerCompetencies.map(([title, description, items], index) => (
            <article
              key={title}
              data-reveal
              className={index === careerCompetencies.length - 1 ? 'career-competency--design' : ''}
            >
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="career-section career-experience" id="trajetoria">
        <div className="container">
          <CareerHeading
            eyebrow="Experiência"
            title="O trabalho visto pelo problema, pelo raciocínio e pela mudança construída."
          />
          <div className="career-experience-list">
            {careerExperience.map((item) => (
              <article key={item.role} data-reveal>
                <header>
                  <p>{item.period}</p>
                  <h3>{item.role}</h3>
                  <span>{item.organization}</span>
                </header>
                <dl>
                  <Fact label="Problema" value={item.problem} />
                  <Fact label="Como organizei" value={item.organized} />
                  <Fact label="Solução construída" value={item.solution} />
                  <Fact label="Impacto" value={item.impact} />
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="career-section container" id="projetos">
        <CareerHeading
          eyebrow="Projetos selecionados"
          title="Decisões técnicas sustentadas por contexto."
        />
        <div className="career-projects">
          {careerProjects.map((project) => (
            <details key={project.name} data-reveal>
              <summary>
                <span>{project.name}</span>
                <small>{project.context}</small>
              </summary>
              <dl>
                <Fact label="Problema" value={project.problem} />
                <Fact label="Minha atuação" value={project.role} />
                <Fact label="Decisões" value={project.decisions} />
                <Fact label="Tecnologias" value={project.technologies} />
                <Fact label="Resultado" value={project.result} />
                <Fact label="Lição aprendida" value={project.lesson} />
              </dl>
            </details>
          ))}
        </div>
      </section>

      <section className="career-section career-learning" id="formacao">
        <div className="container career-learning-grid">
          <div data-reveal>
            <p className="eyebrow">Formação</p>
            <h2>Base acadêmica</h2>
            {resume.education.slice(0, 2).map((item) => (
              <article key={item.course}>
                <h3>{item.course}</h3>
                <p>
                  {item.status} · {item.year}
                </p>
              </article>
            ))}
          </div>
          <div data-reveal>
            <p className="eyebrow">Cursos relevantes</p>
            <h2>Desenvolvimento complementar</h2>
            {resume.development.slice(0, 2).map((item) => (
              <article key={item.course}>
                <h3>{item.course}</h3>
                <p>
                  {item.institution && `${item.institution} · `}
                  {item.status}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="career-section container" id="estudos">
        <CareerHeading
          eyebrow="Estudos atuais"
          title="Aprendizado orientado por problemas que quero compreender melhor."
        />
        <div className="career-study-grid">
          {currentStudies.map(([title, description]) => (
            <article key={title} data-reveal>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="career-section career-technologies">
        <div className="container">
          <CareerHeading
            eyebrow="Tecnologias"
            title="Ferramentas escolhidas pelo que ajudam a construir."
          />
          <dl>
            {technologyUses.map(([technology, use]) => (
              <div key={technology} data-reveal>
                <dt>{technology}</dt>
                <dd>{use}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="career-section container career-philosophy" data-reveal>
        <p className="eyebrow">Filosofia de trabalho</p>
        <h2>Clareza para decidir. Estrutura para construir. Simplicidade para continuar.</h2>
        <p>
          Contexto vem antes da ferramenta. Documentação é parte da solução. Uma experiência só é
          boa quando pessoas diferentes conseguem compreendê-la, utilizá-la e fazê-la evoluir.
        </p>
      </section>

      <section className="career-contact" id="contato-carreira">
        <div className="container" data-reveal>
          <p className="eyebrow">Contato profissional</p>
          <h2>
            Se o desafio pede alguém capaz de conectar áreas e reduzir complexidade, vamos
            conversar.
          </h2>
          <p>
            Disponível em Brasília e Distrito Federal para formatos remoto, híbrido, CLT, PJ e
            projetos.
          </p>
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
              Contato profissional
            </a>
            <a className="text-link" href={pdfPath} download>
              Baixar currículo ATS
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}

function CareerHeading({ eyebrow, title, text }) {
  return (
    <header className="career-heading" data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </header>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
