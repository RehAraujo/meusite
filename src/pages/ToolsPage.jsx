import { useState } from 'react';
import { ButtonLink } from '../components/ui/ButtonLink';
import { tools } from '../data/tools';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function ToolsPage() {
  const [filter, setFilter] = useState('todos');
  useDocumentMeta({
    title: 'Ferramentas | Renata Join',
    description:
      'Templates, sistemas e guias desenvolvidos para organizar pessoas, projetos e negócios.',
    path: '/ferramentas',
  });
  const visible =
    filter === 'todos' ? tools : tools.filter((tool) => tool.category.includes(filter));
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Ferramentas</p>
          <h1>
            Nem toda construção precisa começar por um projeto <em>personalizado.</em>
          </h1>
          <p className="lead">
            Produtos digitais que nasceram da prática e ajudam a organizar aquilo que você está
            construindo.
          </p>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="filters" role="group" aria-label="Filtrar ferramentas">
            {['todos', 'templates', 'guias'].map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="filter-status" aria-live="polite">
            Mostrando {visible.length} {visible.length === 1 ? 'ferramenta' : 'ferramentas'}
          </p>
          <div className="card-grid">
            {visible.map((tool) => (
              <article className="tool-card" key={tool.id}>
                <p className="card-label">{tool.format}</p>
                <h2>{tool.name}</h2>
                <p>{tool.description}</p>
                <strong>O que resolve</strong>
                <p>{tool.problem}</p>
                <p className="price">{tool.price}</p>
                <div className="button-group">
                  <ButtonLink to={tool.buyUrl}>Comprar</ButtonLink>
                  <ButtonLink to={tool.detailUrl} secondary>
                    Saiba mais
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="surface-section">
        <div className="container narrow">
          <p className="eyebrow">Como escolher</p>
          <h2>Não sabe qual ferramenta faz sentido?</h2>
          <p>
            Algumas pessoas precisam apenas de um template. Outras precisam de acompanhamento ou de
            um projeto personalizado.
          </p>
          <ButtonLink to="/#contato">Quero orientação</ButtonLink>
        </div>
      </section>
    </>
  );
}
