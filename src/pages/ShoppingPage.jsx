import { useEffect, useMemo, useRef, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArchiveFolders } from '../components/shop/ArchiveFolders';
import { ProductCard } from '../components/shop/ProductCard';
import { RevealHeadline } from '../components/shop/RevealHeadline';
import { ArrowButton } from '../components/ui/ArrowButton';
import { Eyebrow } from '../components/ui/Eyebrow';
import {
  categoryById,
  legacyCategoryIds,
  papelariaHighlights,
  shoppingCategories,
  shoppingHero,
  shoppingProducts,
  toolFilters,
} from '../data/shopping';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useRjReveal } from '../hooks/useRjReveal';

const ALL = 'todas';
const counts = shoppingProducts.reduce((total, item) => {
  total[item.category] = (total[item.category] ?? 0) + 1;
  return total;
}, {});
const tools = shoppingProducts.filter((item) => item.category === 'ferramentas-digitais');
const papelaria = papelariaHighlights.map((id) => shoppingProducts.find((item) => item.id === id));
const otherUniverses = shoppingCategories.filter((item) => item.status === 'em-breve');
const toolsPage = categoryById['ferramentas-digitais'].path;
const papelariaPage = categoryById['papelaria-impressos'].path;

/*
 * /shopping: vitrine de curadoria do Shopping JOIN (não o catálogo completo).
 * Ordem: hero editorial → universos (coverflow) → Ferramentas Digitais →
 * Papelaria & Impressos → próximos universos → como comprar.
 * Cada universo tem página própria em /shopping/{id}. Nada aqui inicia compra.
 */
export default function ShoppingPage() {
  useDocumentMeta({
    title: 'Shopping JOIN | Renata Join',
    description: shoppingHero.description,
    path: '/shopping',
  });

  const rootRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [toolFilter, setToolFilter] = useState(ALL);
  useRjReveal(rootRef);

  // Links antigos (?categoria=) seguem para a página da categoria.
  const legacy = legacyCategoryIds[searchParams.get('categoria')];
  useEffect(() => {
    if (legacy) navigate(categoryById[legacy].path, { replace: true });
  }, [legacy, navigate]);

  const visibleTools = useMemo(
    () => tools.filter((item) => toolFilter === ALL || item.tags?.includes(toolFilter)),
    [toolFilter],
  );
  const activeToolFilter = toolFilters.find((item) => item.id === toolFilter);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="rj-home rj-shopping" ref={rootRef}>
        {/* 1. HERO EDITORIAL */}
        <section className="rj-shop-hero" aria-labelledby="shopping-title">
          <div className="rj-container rj-shop-hero__grid">
            <div className="rj-shop-hero__copy">
              <Eyebrow>{shoppingHero.eyebrow}</Eyebrow>
              <RevealHeadline id="shopping-title" parts={shoppingHero.title} />
              <p className="rj-shop-hero__lead">{shoppingHero.description}</p>
              <div className="rj-shop-hero__actions">
                <ArrowButton variant="ink" href="#ferramentas">
                  Explorar a loja
                </ArrowButton>
                <a className="rj-link rj-link--ink" href="#arquivo">
                  Ver categorias <i aria-hidden="true">→</i>
                </a>
              </div>
            </div>
            <figure className="rj-shop-hero__visual">
              <img
                className="rj-shop-hero__photo"
                src={shoppingHero.image.src}
                srcSet={shoppingHero.image.srcSet}
                sizes="(width <= 48rem) 100vw, 44vw"
                width={shoppingHero.image.width}
                height={shoppingHero.image.height}
                alt={shoppingHero.image.alt}
                fetchPriority="high"
              />
              <figcaption className="rj-shop-hero__caption">
                Renata Join · Curadoria Shopping JOIN
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 2. ARQUIVO JOIN */}
        <section
          className="rj-section rj-section--paper rj-shop-archive"
          id="arquivo"
          aria-labelledby="arquivo-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="01">Universos JOIN</Eyebrow>
                <h2 id="arquivo-title" className="rj-display-italic">
                  Cinco universos. Diferentes formas de viver o seu estilo.
                </h2>
              </div>
              <p className="rj-heading__copy">Deslize ou use as setas para explorar.</p>
            </header>
            <ArchiveFolders categories={shoppingCategories} counts={counts} />
          </div>
        </section>

        {/* 3. FERRAMENTAS DIGITAIS */}
        <section
          className="rj-section rj-section--ink rj-shop-tools"
          id="ferramentas"
          aria-labelledby="ferramentas-title"
        >
          <div className="rj-container">
            <header className="rj-shop-tools__head" data-rj-reveal>
              <div>
                <Eyebrow number="02">Ferramentas Digitais</Eyebrow>
                <h2 id="ferramentas-title">Ferramentas para colocar a vida em ordem.</h2>
                <p>Sistemas, templates e recursos digitais para organizar melhor o que importa.</p>
              </div>
              <ArrowButton variant="yellow" to={toolsPage}>
                Ver todas as ferramentas
              </ArrowButton>
            </header>
            <div className="rj-shop-filters" role="group" aria-label="Filtrar ferramentas">
              {[{ id: ALL, label: 'Todos' }, ...toolFilters].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={toolFilter === option.id}
                  onClick={() => setToolFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {visibleTools.length > 0 ? (
              <ul className="rj-products rj-products--tools" aria-label="Ferramentas em destaque">
                {visibleTools.map((item) => (
                  <li key={item.id}>
                    <ProductCard product={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rj-shop-tools__soon" aria-live="polite">
                <strong>{activeToolFilter?.label}: em breve.</strong> As próximas ferramentas entram
                aqui assim que estiverem prontas.
              </p>
            )}
          </div>
        </section>

        {/* 4. PAPELARIA & IMPRESSOS */}
        <section
          className="rj-section rj-section--white rj-shop-paper"
          id="papelaria"
          aria-labelledby="papelaria-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="03">Papelaria & Impressos · Studio Goods</Eyebrow>
                <h2 id="papelaria-title" className="rj-display-italic">
                  Impressos com a sua cara, arte inclusa.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Peças com a identidade da sua marca e arte inclusa. Cada pedido começa por um
                orçamento.
              </p>
            </header>
            <ul className="rj-products rj-products--paper" aria-label="Seleção de papelaria">
              {papelaria.map((item, index) => (
                <li key={item.id} data-rj-reveal style={{ '--rj-i': index % 3 }}>
                  <ProductCard product={item} />
                </li>
              ))}
            </ul>
            <div className="rj-shop-section-cta">
              <ArrowButton variant="pink" to={papelariaPage}>
                Ver toda a papelaria
              </ArrowButton>
            </div>
          </div>
        </section>

        {/* 5. OUTROS UNIVERSOS */}
        <section
          className="rj-section rj-section--paper rj-shop-universes"
          id="universos"
          aria-labelledby="universos-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="04">Outros universos JOIN</Eyebrow>
                <h2 id="universos-title" className="rj-display-italic">
                  Próximos lançamentos.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Cada universo abre com produtos, fotos e preços reais. Entre na página para receber
                o aviso.
              </p>
            </header>
            <ul className="rj-universes" aria-label="Universos em breve">
              {otherUniverses.map((category, index) => (
                <li key={category.id} data-rj-reveal style={{ '--rj-i': index % 3 }}>
                  <Link className={`rj-universe rj-tone--${category.tone}`} to={category.path}>
                    <span className="rj-universe__number">{category.number}</span>
                    <span className="rj-universe__body">
                      <strong>{category.label}</strong>
                      <span>{category.description}</span>
                    </span>
                    <span className="rj-universe__status">
                      Em breve <i aria-hidden="true">→</i>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. COMO COMPRAR */}
        <section
          className="rj-section rj-section--white rj-shop-guide"
          id="como-comprar"
          aria-labelledby="guia-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="05">Como comprar</Eyebrow>
                <h2 id="guia-title" className="rj-display-italic">
                  Simples, do primeiro clique à entrega.
                </h2>
              </div>
            </header>
            <ol className="rj-shop-steps">
              <li data-rj-reveal>
                <strong>Ferramentas digitais</strong>
                <p>
                  Cada ferramenta tem página própria, com o que está incluído, o preço e a forma de
                  acesso.
                </p>
              </li>
              <li data-rj-reveal style={{ '--rj-i': 1 }}>
                <strong>Papelaria & Impressos</strong>
                <p>
                  Você pede o orçamento e recebe a proposta com valores e prazo antes da produção.
                </p>
              </li>
              <li data-rj-reveal style={{ '--rj-i': 2 }}>
                <strong>Ainda em dúvida?</strong>
                <p>Conte o que você precisa e eu indico o caminho que faz mais sentido.</p>
              </li>
            </ol>
            <div className="rj-shop-guide__actions">
              <ArrowButton variant="ink" to="/#contato">
                Quero orientação
              </ArrowButton>
              <Link className="rj-link rj-link--ink" to="/produtos-digitais">
                Política de produtos digitais <i aria-hidden="true">→</i>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </LazyMotion>
  );
}
