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

const DIACRITICS_PATTERN = new RegExp('[\\u0300-\\u036f]', 'g');

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function ProjectsPage() {
  const [filter, setFilter] = useState('todos');
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (slug) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };
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
            {visible.map((project, index) => {
              const slug = slugify(project.name);
              const isOpen = expanded.has(slug);
              return (
                <article
                  className="card card--media project-card project-card--detail"
                  key={project.name}
                  data-reveal
                  style={{ '--reveal-delay': `${(index % 3) * 70}ms` }}
                >
                  <p className="card-label">{project.context}</p>
                  <h2>{project.name}</h2>
                  <p className="lead">{project.challenge}</p>
                  <button
                    type="button"
                    className="accordion-trigger"
                    aria-expanded={isOpen}
                    aria-controls={`project-panel-${slug}`}
                    onClick={() => toggleExpanded(slug)}
                  >
                    {isOpen ? 'Fechar' : 'Conheça a construção'}
                  </button>
                  <div className="accordion-panel" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                    <div className="accordion-panel__inner" id={`project-panel-${slug}`}>
                      <strong>Como atuei</strong>
                      <p>{project.decision}</p>
                      <strong>O que construímos</strong>
                      <p>{project.result}</p>
                      <strong>Impacto</strong>
                      <p>{project.impact}</p>
                      <ul className="tag-list">
                        {project.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
