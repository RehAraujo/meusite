import { Link } from 'react-router-dom';
import { kindLabels, statusLabels } from '../../data/shopping';

/*
 * Card de produto da vitrine. Mostra tipo (digital/físico), categoria, preço ou
 * "Sob orçamento" e o estado de disponibilidade. Só produtos disponíveis têm CTA;
 * demonstrativos nunca parecem compráveis.
 */
function ProductAction({ product }) {
  const { cta } = product;
  // Demonstrativos e itens sem página não têm ação: o selo de estado já explica.
  if (product.status !== 'disponivel' || !cta) return null;
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

export function ProductCard({ product, categories }) {
  const category = categories.find((item) => item.id === product.category);
  const { image } = product;
  return (
    <article
      className={`rj-product rj-product--${product.kind}`}
      aria-labelledby={`p-${product.id}`}
    >
      <figure className="rj-product__media">
        {image ? (
          <img
            src={image.src}
            srcSet={image.srcSet ?? undefined}
            sizes="(width <= 40rem) 92vw, (width <= 64rem) 45vw, 18rem"
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="rj-product__cover">
            <small>{product.format}</small>
            <strong>{product.cover}</strong>
            <em>Capa provisória</em>
          </span>
        )}
        <span className="rj-product__badges">
          <span>{kindLabels[product.kind]}</span>
          <span className={`rj-product__status rj-product__status--${product.status}`}>
            {statusLabels[product.status]}
          </span>
        </span>
      </figure>
      <div className="rj-product__body">
        <p className="rj-product__category">
          {category?.label} · {product.format}
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
