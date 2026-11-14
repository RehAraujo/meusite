import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScrollDepth } from '../components/home/ScrollMotion';
import { CategoryFolders } from '../components/shop/CategoryFolders';
import { FeaturedProduct } from '../components/shop/FeaturedProduct';
import { ProductCard } from '../components/shop/ProductCard';
import { ArrowButton } from '../components/ui/ArrowButton';
import { Eyebrow } from '../components/ui/Eyebrow';
import { featuredProduct } from '../data/home';
import {
  filterProducts,
  shoppingCategories,
  shoppingEditorial,
  shoppingHero,
  shoppingProducts,
  shoppingSortOptions,
  STUDIO_LEAD_TIME,
  studioGoodsLines,
} from '../data/shopping';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useRjReveal } from '../hooks/useRjReveal';

const ALL = 'todos';
const categoryIds = new Set(shoppingCategories.map((category) => category.id));
const filterOptions = [{ id: ALL, label: 'Todos' }, ...shoppingCategories];
const ALL_LINES = 'todas';
const STUDIO = 'studio-goods';
const lineIds = new Set(studioGoodsLines.map((line) => line.id));
const lineOptions = [{ id: ALL_LINES, label: 'Todas as linhas' }, ...studioGoodsLines];

/*
 * /shopping/: vitrine do Shopping Join.
 * O comércio integrado segue desativado: nenhum card inicia pagamento. Os produtos
 * digitais levam às suas páginas públicas; os personalizados são demonstrativos.
 * A categoria vem de ?categoria= (lida depois da hidratação, porque o HTML
 * pré-renderizado nasce com todos os produtos).
 */
export default function ShoppingPage() {
  useDocumentMeta({
    title: 'Shopping Join | Renata Join',
    description: shoppingHero.description,
    path: '/shopping',
  });

  const rootRef = useRef(null);
  const resultsRef = useRef(null);
  const searchId = useId();
  const sortId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('destaques');
  useRjReveal(rootRef);

  useEffect(() => setHydrated(true), []);

  const requested = searchParams.get('categoria');
  const category = hydrated && categoryIds.has(requested) ? requested : ALL;
  const activeCategory = shoppingCategories.find((item) => item.id === category);
  // Subcategoria (?linha=) só vale dentro de Studio Goods.
  const requestedLine = searchParams.get('linha');
  const line = category === STUDIO && lineIds.has(requestedLine) ? requestedLine : ALL_LINES;
  const activeLine = studioGoodsLines.find((item) => item.id === line);

  const showFeatured = !query.trim() && (category === ALL || category === 'ferramentas-digitais');
  const visible = useMemo(
    () =>
      filterProducts(shoppingProducts, { category, line, query, sort }).filter(
        (item) => !(showFeatured && item.featured),
      ),
    [category, line, query, sort, showFeatured],
  );
  const total = visible.length + (showFeatured ? 1 : 0);

  const selectCategory = (id, { scroll = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    if (id === ALL) next.delete('categoria');
    else next.set('categoria', id);
    next.delete('linha');
    setSearchParams(next, { replace: true, preventScrollReset: true });
    if (scroll) {
      document.getElementById('vitrine')?.scrollIntoView({ block: 'start' });
      resultsRef.current?.focus({ preventScroll: true });
    }
  };

  const selectLine = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === ALL_LINES) next.delete('linha');
    else next.set('linha', id);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  const clearFilters = () => {
    setQuery('');
    selectCategory(ALL);
  };

  const comingSoon = activeCategory?.status === 'em-breve';

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="rj-home rj-shopping" ref={rootRef}>
        {/* HERO */}
        <section className="rj-shop-hero" aria-labelledby="shopping-title">
          <div className="rj-container rj-shop-hero__grid">
            <div className="rj-shop-hero__copy">
              <Eyebrow>{shoppingHero.eyebrow}</Eyebrow>
              <h1 id="shopping-title">
                <span>{shoppingHero.title[0]}</span> <em>{shoppingHero.title[1]}</em>
              </h1>
              <p className="rj-shop-hero__lead">{shoppingHero.description}</p>
              <div className="rj-shop-hero__actions">
                <ArrowButton variant="yellow" href="#vitrine">
                  Explorar produtos
                </ArrowButton>
                <a className="rj-btn rj-btn--outline rj-btn--light" href="#categorias">
                  Ver categorias
                </a>
              </div>
              <ol className="rj-shop-hero__index" aria-label="Categorias">
                {shoppingCategories.map((item) => (
                  <li key={item.id}>
                    <span>{item.number}</span> {item.label}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rj-shop-hero__visual">
              <figure className="rj-shop-hero__photo">
                <img
                  src={shoppingHero.image.src}
                  srcSet={shoppingHero.image.srcSet}
                  sizes="(width <= 48rem) 92vw, 30rem"
                  width={shoppingHero.image.width}
                  height={shoppingHero.image.height}
                  alt={shoppingHero.image.alt}
                  fetchPriority="high"
                />
              </figure>
              <div className="rj-shop-window" aria-hidden="true">
                <span className="rj-shop-window__bar">
                  <i />
                  <i />
                  <i />
                  <b>meu_dinheiro.notion</b>
                </span>
                <img src={featuredProduct.image} alt="" width="1200" height="536" />
                <span className="rj-shop-window__meta">
                  <span>{featuredProduct.kicker.split(' · ')[0]}</span>
                  <strong>{featuredProduct.price}</strong>
                </span>
              </div>
              <span className="rj-shop-hero__sticker" aria-hidden="true">
                Nº 02 · Ferramentas digitais
              </span>
            </div>
          </div>
        </section>

        {/* CATEGORIAS */}
        <section
          className="rj-section rj-section--paper rj-shop-categories"
          id="categorias"
          aria-labelledby="categorias-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="01">Categorias</Eyebrow>
                <h2 id="categorias-title" className="rj-display-italic">
                  Cada coisa na sua pasta.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Do papel ao digital: escolha uma categoria para abrir a vitrine já filtrada.
              </p>
            </header>
            <CategoryFolders
              categories={shoppingCategories}
              products={shoppingProducts}
              active={category}
              onSelect={(id) => selectCategory(id, { scroll: true })}
            />
          </div>
        </section>

        {/* VITRINE */}
        <section
          className="rj-section rj-section--white rj-shop-showcase"
          id="vitrine"
          aria-labelledby="vitrine-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="02">Vitrine</Eyebrow>
                <h2 id="vitrine-title" className="rj-display-italic">
                  Encontre o que faz sentido para você.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Produtos digitais com página própria, impressos com arte inclusa e projetos
                personalizados sob orçamento.
              </p>
            </header>

            <div className="rj-shop-toolbar" role="search">
              <div className="rj-shop-toolbar__field rj-shop-toolbar__search">
                <label htmlFor={searchId}>Buscar produtos</label>
                <input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: planner, certificado"
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
              <div className="rj-shop-filters" role="group" aria-label="Filtrar por categoria">
                {filterOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={category === option.id}
                    onClick={() => selectCategory(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {category === STUDIO ? (
              <div className="rj-shop-lines" role="group" aria-label="Linhas do Studio Goods">
                {lineOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={line === option.id}
                    onClick={() => selectLine(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="rj-shop-status" aria-live="polite" ref={resultsRef} tabIndex={-1}>
              {comingSoon
                ? `${activeCategory.label}: em breve`
                : `${total} ${total === 1 ? 'produto' : 'produtos'}${
                    activeCategory ? ` em ${activeCategory.label}` : ''
                  }${activeLine ? ` · ${activeLine.label}` : ''}`}
            </p>

            {showFeatured && !comingSoon ? (
              <FeaturedProduct product={featuredProduct} titleId="vitrine-destaque" />
            ) : null}

            {visible.length > 0 ? (
              <ul className="rj-products" aria-label="Produtos">
                {visible.map((item, index) => (
                  <li key={item.id} data-rj-reveal style={{ '--rj-i': index % 4 }}>
                    <ProductCard product={item} categories={shoppingCategories} />
                  </li>
                ))}
              </ul>
            ) : null}

            {comingSoon ? (
              <div className="rj-shop-empty rj-shop-empty--soon">
                {activeCategory.image ? (
                  <img
                    src={activeCategory.image}
                    alt=""
                    width="480"
                    height="640"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <div>
                  <span className="rj-chip rj-chip--ink">Em breve</span>
                  <h3>{activeCategory.label}</h3>
                  <p>{activeCategory.description}</p>
                  <button type="button" className="rj-link rj-link--ink" onClick={clearFilters}>
                    Ver todos os produtos <i aria-hidden="true">→</i>
                  </button>
                </div>
              </div>
            ) : null}

            {!comingSoon && total === 0 ? (
              <div className="rj-shop-empty">
                <div>
                  <h3>Nenhum produto encontrado</h3>
                  <p>
                    Nada corresponde a “{query.trim()}”
                    {activeCategory ? ` em ${activeCategory.label}` : ''}. Tente outro termo ou veja
                    o catálogo completo.
                  </p>
                  <button type="button" className="rj-link rj-link--ink" onClick={clearFilters}>
                    Limpar busca e filtros <i aria-hidden="true">→</i>
                  </button>
                </div>
              </div>
            ) : null}

            {category === ALL || category === STUDIO ? (
              <aside
                className="rj-shop-custom rj-shop-custom--studio"
                data-rj-reveal
                aria-label="Como funciona o Studio Goods"
              >
                <p>
                  <strong>Studio Goods: arte inclusa.</strong> Os preços são ilustrativos e já
                  consideram a criação da arte, o ajuste ao gabarito de impressão, a produção e o
                  envio. O valor final é confirmado no orçamento, e o prazo é de {STUDIO_LEAD_TIME}{' '}
                  depois da aprovação da arte. Nenhuma compra é feita por esta página.
                </p>
                <ArrowButton
                  variant="ink"
                  href="https://wa.me/5561992191272?text=Oi%20R%C3%AA!%20Quero%20um%20or%C3%A7amento%20do%20Studio%20Goods."
                >
                  Pedir orçamento
                </ArrowButton>
              </aside>
            ) : null}

            {category === ALL || category === 'personalizados' ? (
              <aside
                className="rj-shop-custom"
                data-rj-reveal
                aria-label="Personalizados sob orçamento"
              >
                <p>
                  <strong>Personalizados sob medida.</strong> Os itens personalizados desta vitrine
                  são demonstrativos, com imagens de projetos já realizados. Cada pedido começa por
                  uma conversa e um orçamento.
                </p>
                <ArrowButton variant="ink" to="/#contato">
                  Conversar sobre um projeto
                </ArrowButton>
              </aside>
            ) : null}
          </div>
        </section>

        {/* DESTAQUE EDITORIAL */}
        <section
          className="rj-section rj-section--ink rj-shop-editorial"
          aria-labelledby="editorial-title"
        >
          <div className="rj-container rj-shop-editorial__grid">
            <ScrollDepth as="figure" className="rj-shop-editorial__main" range={18}>
              <img
                src={shoppingEditorial.images[0].src}
                srcSet={shoppingEditorial.images[0].srcSet}
                sizes="(width <= 48rem) 92vw, 36rem"
                width={shoppingEditorial.images[0].width}
                height={shoppingEditorial.images[0].height}
                alt={shoppingEditorial.images[0].alt}
                loading="lazy"
                decoding="async"
              />
            </ScrollDepth>
            <div className="rj-shop-editorial__copy" data-rj-reveal>
              <Eyebrow number="03">Editorial</Eyebrow>
              <h2 id="editorial-title">{shoppingEditorial.title}</h2>
              <p>{shoppingEditorial.description}</p>
            </div>
            <figure className="rj-shop-editorial__aside" data-rj-reveal>
              <img
                src={shoppingEditorial.images[1].src}
                srcSet={shoppingEditorial.images[1].srcSet}
                sizes="(width <= 48rem) 60vw, 20rem"
                width={shoppingEditorial.images[1].width}
                height={shoppingEditorial.images[1].height}
                alt={shoppingEditorial.images[1].alt}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </section>

        {/* ORIENTAÇÃO (conteúdo herdado de /ferramentas) */}
        <section
          className="rj-section rj-section--paper rj-shop-guide"
          aria-labelledby="guia-title"
        >
          <div className="rj-container rj-shop-guide__grid" data-rj-reveal>
            <div>
              <Eyebrow>Como escolher</Eyebrow>
              <h2 id="guia-title">Não sabe qual ferramenta faz sentido?</h2>
            </div>
            <div className="rj-shop-guide__copy">
              <p>
                Algumas pessoas precisam apenas de um template. Outras precisam de acompanhamento ou
                de um projeto personalizado.
              </p>
              <div className="rj-shop-guide__actions">
                <ArrowButton variant="pink" to="/#contato">
                  Quero orientação
                </ArrowButton>
                <Link className="rj-link rj-link--ink" to="/produtos-digitais">
                  Política de produtos digitais <i aria-hidden="true">→</i>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LazyMotion>
  );
}
