import { Link } from 'react-router-dom';
import { statusLabels } from '../../data/shopping';

/*
 * Card de produto da vitrine. Mostra tipo (digital/físico), categoria, preço ou
 * "Sob orçamento" e o estado de disponibilidade. Produtos disponíveis levam à sua
 * página; Studio Goods (preço ilustrativo) leva a um orçamento. Nada é comprável aqui.
 */
function ProductAction({ product }) {
  const { cta } = product;
  // Só disponíveis levam à página do produto. Demonstrativos com preço ilustrativo
  // (Studio Goods) levam a um pedido de orçamento, nunca a uma compra.
  const quoteOnly = product.pricing === 'ilustrativo';
  if (!cta || (product.status !== 'disponivel' && !quoteOnly)) return null;
  const content = (
    <>
      {cta.label}
      <span className="rj-sr-only">: {product.name}</span> <i aria-hidden="true">→</i>
    </>
  );
  if (cta.to) {
    return (
      <Link className="rj-product__action" to={cta.to}>
        {content}
      </Link>
    );
  }
  return (
    <a className="rj-product__action" href={cta.href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}

export function ProductCard({ product, showCategory = false, categories = [] }) {
  const category = showCategory ? categories.find((item) => item.id === product.category) : null;
  const { image } = product;
  // Produtos e mockups aparecem inteiros (contain) sobre a cor do próprio fundo.
  const mediaStyle = image?.bg ? { background: image.bg } : undefined;
  return (
    <article
      className={`rj-product rj-product--${product.kind} rj-product--${product.pricing}`}
      aria-labelledby={`p-${product.id}`}
    >
      <figure className="rj-product__media" style={mediaStyle}>
        {image ? (
          <img
            src={image.src}
            srcSet={image.srcSet ?? undefined}
            sizes="(width <= 40rem) 46vw, (width <= 64rem) 30vw, 15rem"
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={`rj-product__cover rj-product__cover--${product.kind}`}>
            <small>{product.format}</small>
            <strong>{product.cover}</strong>
            <em>{product.coverNote ?? 'Capa provisória'}</em>
          </span>
        )}
        {/* Um único selo, só quando o estado muda a decisão de compra. */}
        {product.status !== 'disponivel' ? (
          <span className="rj-product__badges">
            <span className={`rj-product__status rj-product__status--${product.status}`}>
              {statusLabels[product.status]}
            </span>
          </span>
        ) : null}
      </figure>
      <div className="rj-product__body">
        <p className="rj-product__category">
          {category ? `${category.label} · ` : ''}
          {product.format}
        </p>
        <h3 id={`p-${product.id}`}>{product.name}</h3>
        <p className="rj-product__description">{product.description}</p>
        <div className="rj-product__footer">
          <p className="rj-product__price">
            {product.pricing === 'orcamento' ? 'Sob orçamento' : product.price}
            {product.priceNote ? <small>{product.priceNote}</small> : null}
          </p>
          <ProductAction product={product} />
        </div>
        {product.credit ? <p className="rj-product__credit">{product.credit}</p> : null}
      </div>
    </article>
  );
}
