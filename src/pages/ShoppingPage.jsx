import { useEffect, useMemo, useRef, useState } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArchiveFolders } from '../components/shop/ArchiveFolders';
import { FeaturedProduct } from '../components/shop/FeaturedProduct';
import { ProductCard } from '../components/shop/ProductCard';
import { ArrowButton } from '../components/ui/ArrowButton';
import { Eyebrow } from '../components/ui/Eyebrow';
import { featuredProduct } from '../data/home';
import {
  STUDIO_LEAD_TIME,
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
 * Ordem: hero editorial → Arquivo JOIN (pastas) → Seleção JOIN → Ferramentas
 * Digitais → Papelaria & Impressos → outros universos → como comprar.
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
              <h1 id="shopping-title">
                <span>{shoppingHero.title[0]}</span> <span>{shoppingHero.title[1]}</span>{' '}
                <em>{shoppingHero.title[2]}</em>
              </h1>
              <p className="rj-shop-hero__lead">{shoppingHero.description}</p>
              <div className="rj-shop-hero__actions">
                <ArrowButton variant="ink" href="#selecao">
                  Explorar a loja
                </ArrowButton>
                <a className="rj-btn rj-btn--outline" href="#arquivo">
                  Ver categorias
                </a>
              </div>
            </div>
            <figure className="rj-shop-hero__visual">
              <span className="rj-shop-hero__block" aria-hidden="true" />
              <img
                className="rj-shop-hero__photo"
                src={shoppingHero.image.src}
                srcSet={shoppingHero.image.srcSet}
                sizes="(width <= 48rem) 88vw, 32rem"
                width={shoppingHero.image.width}
                height={shoppingHero.image.height}
                alt={shoppingHero.image.alt}
                fetchPriority="high"
              />
              <figcaption className="rj-shop-hero__tag">
                <span>Curadoria</span> Renata Join
              </figcaption>
              <span className="rj-shop-hero__vertical" aria-hidden="true">
                Shopping JOIN · Arquivo pessoal
              </span>
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
                <Eyebrow number="01">Arquivo JOIN</Eyebrow>
                <h2 id="arquivo-title" className="rj-display-italic">
                  Oito universos, uma pasta para cada.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Escolha uma aba para abrir a pasta. Cada universo tem a sua própria página.
              </p>
            </header>
            <ArchiveFolders categories={shoppingCategories} counts={counts} />
          </div>
        </section>

        {/* 3. SELEÇÃO JOIN */}
        <section
          className="rj-section rj-section--white rj-shop-selection"
          id="selecao"
          aria-labelledby="selecao-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="02">Seleção JOIN</Eyebrow>
                <h2 id="selecao-title" className="rj-display-italic">
                  Por onde começar.
                </h2>
              </div>
              <p className="rj-heading__copy">
                O destaque da loja agora: um sistema para decidir o próprio dinheiro com clareza.
              </p>
            </header>
            <FeaturedProduct product={featuredProduct} titleId="selecao-destaque" />
          </div>
        </section>

        {/* 4. FERRAMENTAS DIGITAIS */}
        <section
          className="rj-section rj-section--ink rj-shop-tools"
          id="ferramentas"
          aria-labelledby="ferramentas-title"
        >
          <div className="rj-container">
            <header className="rj-shop-tools__head" data-rj-reveal>
              <div>
                <Eyebrow number="03">Ferramentas Digitais</Eyebrow>
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

        {/* 5. PAPELARIA & IMPRESSOS */}
        <section
          className="rj-section rj-section--white rj-shop-paper"
          id="papelaria"
          aria-labelledby="papelaria-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="04">Papelaria & Impressos · Studio Goods</Eyebrow>
                <h2 id="papelaria-title" className="rj-display-italic">
                  Impressos com a sua cara, arte inclusa.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Preços ilustrativos com arte, produção e envio. O valor final é confirmado no
                orçamento; prazo de {STUDIO_LEAD_TIME} após a aprovação da arte.
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
                Explorar toda a papelaria
              </ArrowButton>
            </div>
          </div>
        </section>

        {/* 6. OUTROS UNIVERSOS */}
        <section
          className="rj-section rj-section--paper rj-shop-universes"
          id="universos"
          aria-labelledby="universos-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="05">Outros universos JOIN</Eyebrow>
                <h2 id="universos-title" className="rj-display-italic">
                  Em preparação.
                </h2>
              </div>
              <p className="rj-heading__copy">
                Universos que chegam aos poucos. Cada página mostra o que vem por aí.
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

        {/* 7. COMO COMPRAR */}
        <section
          className="rj-section rj-section--white rj-shop-guide"
          id="como-comprar"
          aria-labelledby="guia-title"
        >
          <div className="rj-container">
            <header className="rj-heading" data-rj-reveal>
              <div>
                <Eyebrow number="06">Como comprar</Eyebrow>
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
                  Você pede o orçamento, aprova a arte e o pedido fica pronto em até{' '}
                  {STUDIO_LEAD_TIME} depois da aprovação.
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
