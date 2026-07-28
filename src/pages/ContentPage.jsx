import { ButtonLink } from '../components/ui/ButtonLink';
import { legalPages } from '../data/legal';
import { processSteps } from '../data/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const processPage = {
  title: 'Compreender antes de construir.',
  description:
    'Um processo orientado por contexto, investigação, requisitos, estrutura, implementação, validação e evolução.',
};

export default function ContentPage({ path }) {
  const page = legalPages[path] ?? processPage;
  useDocumentMeta({
    title: `${page.title} | Renata Join`,
    description: page.intro ?? page.description,
    path,
  });
  useReveal();

  if (legalPages[path]) {
    return (
      <>
        <section className="page-hero">
          <div className="container narrow">
            <p className="eyebrow">Institucional</p>
            <h1>{page.title}</h1>
            <p className="lead">{page.intro}</p>
          </div>
        </section>
        <section>
          <div className="container narrow prose">
            {page.sections.map(([heading, text]) => (
              <section className="legal-section" key={heading}>
                <h2>{heading}</h2>
                <p>{text}</p>
              </section>
            ))}
            <p className="disclaimer">Última atualização: julho de 2026.</p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <p className="eyebrow">Processo</p>
          <h1>
            Da complexidade à <em>execução.</em>
          </h1>
          <p className="lead">{page.description}</p>
        </div>
      </section>
      <section>
        <div className="container narrow prose">
          <p>
            Antes de propor uma solução, procuro compreender o problema por inteiro, separar causas
            e sintomas, organizar requisitos e construir um caminho lógico, visual e funcional.
          </p>
          <ol className="process-journey">
            {processSteps.map(([title, description], index) => (
              <li
                key={title}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
              >
                <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="lead">
            Nem toda evolução é visível no início. Algumas estruturas precisam ser repetidas,
            testadas e fortalecidas antes de sustentar algo maior.
          </p>
          <ButtonLink to="/#contato">Começar um projeto</ButtonLink>
        </div>
      </section>
    </>
  );
}
