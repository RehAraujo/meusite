import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { filterProducts, shoppingSortOptions } from '../../data/shopping';
import { ProductCard } from './ProductCard';

/*
 * Catálogo completo de uma categoria: busca, filtro (linhas ou temas, guardado na
 * URL em ?filtro=) e ordenação. O filtro da URL só é aplicado depois da
 * hidratação, porque o HTML pré-renderizado nasce com o catálogo inteiro.
 */
const ALL = 'todas';

export function CatalogBrowser({ products, categories, filters, filterKey, filterLabel }) {
  const searchId = useId();
  const sortId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('destaques');

  useEffect(() => setHydrated(true), []);

  const requested = searchParams.get('filtro');
  const filter = hydrated && filters?.some((option) => option.id === requested) ? requested : ALL;
  const activeFilter = filters?.find((option) => option.id === filter);

  const visible = useMemo(
    () => filterProducts(products, { [filterKey]: filter, query, sort }),
    [products, filterKey, filter, query, sort],
  );

  const selectFilter = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === ALL) next.delete('filtro');
    else next.set('filtro', id);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  const clear = () => {
    setQuery('');
    selectFilter(ALL);
  };

  return (
    <>
      <div className="rj-shop-toolbar" role="search">
        <div className="rj-shop-toolbar__field rj-shop-toolbar__search">
          <label htmlFor={searchId}>Buscar nesta categoria</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: certificado, planner"
            autoComplete="off"
          />
        </div>
        <div className="rj-shop-toolbar__field">
          <label htmlFor={sortId}>Ordenar por</label>
          <select id={sortId} value={sort} onChange={(event) => setSort(event.target.value)}>
            {shoppingSortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {filters ? (
          <div className="rj-shop-filters" role="group" aria-label={filterLabel}>
            {[{ id: ALL, label: 'Todos' }, ...filters].map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => selectFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="rj-shop-status" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'produto' : 'produtos'}
        {activeFilter ? ` · ${activeFilter.label}` : ''}
      </p>

      {visible.length > 0 ? (
        <ul className="rj-products" aria-label="Produtos">
          {visible.map((item) => (
            <li key={item.id}>
              <ProductCard product={item} categories={categories} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rj-shop-empty">
          <div>
            <h3>
              {query.trim() ? 'Nenhum produto encontrado' : `${activeFilter?.label}: em breve`}
            </h3>
            <p>
              {query.trim()
                ? `Nada corresponde a “${query.trim()}”${activeFilter ? ` em ${activeFilter.label}` : ''}.`
                : 'Ainda não há produtos neste filtro. Novos itens entram aqui assim que estiverem prontos.'}
            </p>
            <button type="button" className="rj-link rj-link--ink" onClick={clear}>
              Ver todos os produtos <i aria-hidden="true">→</i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
