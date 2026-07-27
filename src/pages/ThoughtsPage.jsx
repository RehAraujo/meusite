import { useEffect, useMemo, useState } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useDocumentMeta({
    title: 'Pensamentos | Renata Join',
    description: 'Textos sobre identidade, design, tecnologia, comunicação, fé e trabalho.',
    path: '/pensamentos',
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/pensamentos.json', { signal: controller.signal, credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os pensamentos.');
        return response.json();
      })
      .then((data) =>
        setThoughts(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []),
      )
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, []);
  const filtered = useMemo(
    () =>
      thoughts.filter((item) =>
        JSON.stringify(item).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
      ),
    [query, thoughts],
  );
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Pensamentos</p>
          <h1>
            Ideias também são <em>construções.</em>
          </h1>
          <p className="lead">
            Notas sobre identidade, comportamento, design, tecnologia, comunicação, disciplina, fé e
            trabalho.
          </p>
        </div>
      </section>
      <section>
        <div className="container">
          <label className="search-label" htmlFor="thought-search">
            Buscar nos pensamentos
          </label>
          <input
            className="search-input"
            id="thought-search"
            type="search"
            maxLength="100"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="filter-status" aria-live="polite">
            {error ||
              `${filtered.length} ${filtered.length === 1 ? 'texto encontrado' : 'textos encontrados'}`}
          </p>
          <div className="card-grid">
            {filtered.map((item, index) => (
              <article className="thought-card" key={item.slug ?? item.title ?? index}>
                <p className="card-label">{item.category ?? item.tag ?? 'Pensamento'}</p>
                <h2>{item.title}</h2>
                <p>{item.excerpt ?? item.description ?? item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
