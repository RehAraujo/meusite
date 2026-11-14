import { useRef } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Link, useParams } from 'react-router-dom';
import { CatalogBrowser } from '../components/shop/CatalogBrowser';
import { ArrowButton } from '../components/ui/ArrowButton';
import { Eyebrow } from '../components/ui/Eyebrow';
import {
  STUDIO_LEAD_TIME,
  categoryById,
  papelariaLines,
  shoppingCategories,
  shoppingProducts,
  toolFilters,
} from '../data/shopping';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useRjReveal } from '../hooks/useRjReveal';
import NotFoundPage from './NotFoundPage';

const WHATSAPP = 'https://wa.me/5561992191272';
const whatsapp = (text) => `${WHATSAPP}?text=${encodeURIComponent(text)}`;

// Filtros de cada catálogo: linhas na papelaria, temas nas ferramentas.
const catalogs = {
  'papelaria-impressos': { filters: papelariaLines, key: 'line', label: 'Filtrar por linha' },
  'ferramentas-digitais': { filters: toolFilters, key: 'tag', label: 'Filtrar por tema' },
};

/*
 * /shopping/{categoria}: página própria de cada universo do Shopping JOIN.
 * Com produtos: catálogo completo (busca, filtros, ordenação). Sem produtos
 * confirmados: página conceitual "Em breve", sem itens fictícios.
 */
export default function ShoppingCategoryPage() {
  const { categoria } = useParams();
  const category = categoryById[categoria];
  const rootRef = useRef(null);
  useRjReveal(rootRef);
  useDocumentMeta({
    title: category ? `${category.label} | Shopping JOIN` : 'Página não encontrada | Renata Join',
    description: category?.description ?? '',
    path: category?.path ?? '/404',
  });

  if (!category) return <NotFoundPage />;

  const products = shoppingProducts.filter((item) => item.category === category.id);
  const catalog = catalogs[category.id];
  const soon = category.status === 'em-breve';
  const others = shoppingCategories.filter((item) => item.id !== category.id);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="rj-home rj-shopping" ref={rootRef}>
        <section
          className={`rj-shop-cat-hero rj-tone--${category.tone}`}
          aria-labelledby="categoria-title"
        >
          <div className="rj-container rj-shop-cat-hero__grid">
            <div>
              <nav className="rj-shop-crumbs" aria-label="Você está em">
                <Link to="/shopping">Shopping JOIN</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{category.label}</span>
              </nav>
              <p className="rj-shop-cat-hero__number">
                {category.number}
                {category.signature ? ` · Assinatura ${category.signature}` : ''}
              </p>
              <h1 id="categoria-title">{category.label}</h1>
              <p className="rj-shop-cat-hero__lead">{category.description}</p>
              <p className="rj-shop-cat-hero__status">
                {soon
                  ? 'Em breve'
                  : `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`}
                {category.status === 'ilustrativo' ? ' · preços ilustrativos' : ''}
              </p>
            </div>
            {category.image ? (
              <figure className="rj-shop-cat-hero__media">
                <img
                  src={category.image}
                  srcSet={category.imageSet ?? undefined}
                  sizes="(width <= 48rem) 60vw, 18rem"
                  width="480"
                  height="600"
                  alt={category.imageAlt ?? ''}
                  fetchPriority="high"
                />
              </figure>
            ) : (
              <span className="rj-shop-cat-hero__type" aria-hidden="true">
                {category.number}
              </span>
            )}
          </div>
        </section>

        {soon ? (
          <section
            className="rj-section rj-section--white rj-shop-soon"
            aria-labelledby="em-breve-title"
          >
            <div className="rj-container rj-shop-soon__grid" data-rj-reveal>
              <div>
                <Eyebrow>Em breve</Eyebrow>
                <h2 id="em-breve-title">Este universo está sendo preparado.</h2>
              </div>
              <div className="rj-shop-soon__copy">
                <p>
                  Os produtos de {category.label} entram aqui quando estiverem confirmados, com
                  fotos reais, preço e condições. Até lá, esta página mostra só o que já é real.
                </p>
                {category.instagram ? (
                  <p>
                    As peças do brechó aparecem primeiro no Instagram, onde a curadoria acontece.
                  </p>
                ) : null}
                <div className="rj-shop-guide__actions">
                  <ArrowButton
                    variant="ink"
                    href={whatsapp(`Oi Rê! Quero saber quando ${category.label} chegar.`)}
                  >
                    Avise-me quando chegar
                  </ArrowButton>
                  {category.instagram ? (
                    <a
                      className="rj-link rj-link--ink"
                      href={category.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Acompanhar no Instagram <i aria-hidden="true">→</i>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section
            className="rj-section rj-section--white rj-shop-showcase"
            id="catalogo"
            aria-label={`Catálogo de ${category.label}`}
          >
            <div className="rj-container">
              <CatalogBrowser
                products={products}
                categories={shoppingCategories}
                filters={catalog?.filters}
                filterKey={catalog?.key}
                filterLabel={catalog?.label}
              />
              {category.status === 'ilustrativo' ? (
                <aside className="rj-shop-custom" aria-label="Como funciona o orçamento">
                  <p>
                    <strong>Arte inclusa.</strong> Os preços são ilustrativos e já consideram a
                    criação da arte, o ajuste ao gabarito de impressão, a produção e o envio. O
                    valor final é confirmado no orçamento; o prazo é de {STUDIO_LEAD_TIME} depois da
                    aprovação da arte. Nenhuma compra é feita por esta página.
                  </p>
                  <ArrowButton
                    variant="ink"
                    href={whatsapp('Oi Rê! Quero um orçamento de papelaria e impressos.')}
                  >
                    Pedir orçamento
                  </ArrowButton>
                </aside>
              ) : null}
            </div>
          </section>
        )}

        <nav className="rj-section rj-section--paper rj-shop-more" aria-label="Outros universos">
          <div className="rj-container">
            <div className="rj-shop-more__head">
              <h2>Outros universos JOIN</h2>
              <Link className="rj-link rj-link--ink" to="/shopping">
                <i aria-hidden="true">←</i> Voltar ao Shopping
              </Link>
            </div>
            <ul className="rj-shop-more__list">
              {others.map((item) => (
                <li key={item.id}>
                  <Link className={`rj-tone--${item.tone}`} to={item.path}>
                    <span>{item.number}</span> {item.label}
                    {item.status === 'em-breve' ? <small>Em breve</small> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </LazyMotion>
  );
}
