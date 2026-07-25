import { useState } from 'react';
import { projects } from '../data/projects';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

const filters = [
  ['todos', 'Todos'],
  ['empresas', 'Empresas'],
  ['pessoas', 'Pessoas'],
  ['organizacoes', 'Organizações'],
  ['autoral', 'Projetos autorais'],
];

export default function ProjectsPage() {
  const [filter, setFilter] = useState('todos');
  useDocumentMeta({
    title: 'Construções | Renata Join',
    description: 'Projetos organizados pelo desafio, pelo raciocínio e pelas soluções construídas.',
    path: '/clientes',
  });
  useReveal();
  const visible =
    filter === 'todos' ? projects : projects.filter((project) => project.audience === filter);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Construções</p>
          <h1>
            Projetos apresentados pelo <em>desafio.</em>
          </h1>
          <p className="lead">
            Mais do que entregas isoladas, cada projeto revela contexto, raciocínio e escolhas.
          </p>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="filters" role="group" aria-label="Filtrar construções">
            {filters.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="filter-status" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'construção' : 'construções'}
          </p>
          <div className="card-grid">
            {visible.map((project) => (
              <article className="project-card project-card--detail" key={project.name}>
                <p className="card-label">{project.context}</p>
                <h2>{project.name}</h2>
                <p className="lead">{project.challenge}</p>
                <details>
                  <summary>Conheça a construção</summary>
                  <p>{project.result}</p>
                  <ul className="tag-list">
                    {project.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
