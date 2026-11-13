import { ScrollRise } from '../home/ScrollMotion';
import { ArrowButton } from '../ui/ArrowButton';
import { resetPointer, trackPointer } from '../../utils/pointer';

/*
 * Banner do produto em destaque do Shopping Join (Home e /shopping/).
 * O CTA de descoberta leva à página pública de vendas; `purchase` fica reservado
 * para um futuro botão de compra direta e só aparece quando preenchido.
 * Precisa de um <LazyMotion> acima (ScrollRise usa componentes `m`).
 */
export function FeaturedProduct({ product, titleId = 'feature-title' }) {
  return (
    <article
      className="rj-feature"
      aria-labelledby={titleId}
      onPointerMove={trackPointer}
      onPointerLeave={resetPointer}
    >
      <ScrollRise className="rj-feature__copy" distance={24}>
        <p className="rj-feature__kicker">
          <img src="/assets/notion-platform.ico" width="20" height="20" alt="" />
          {product.kicker}
        </p>
        <h3 id={titleId}>{product.name}</h3>
        <p className="rj-feature__headline">
          {product.headline[0]} <em>{product.headline[1]}</em>
        </p>
        <p>{product.description}</p>
        <ul className="rj-feature__list">
          {product.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="rj-feature__offer">
          <p className="rj-feature__price">
            {product.price}
            <small>{product.priceNote}</small>
          </p>
          <ArrowButton variant="yellow" href={product.cta.href}>
            {product.cta.label}
          </ArrowButton>
          {product.purchase ? (
            <ArrowButton variant="pink" href={product.purchase.href}>
              {product.purchase.label}
            </ArrowButton>
          ) : null}
        </div>
      </ScrollRise>
      <ScrollRise
        as="figure"
        className="rj-feature__media"
        distance={44}
        offset={['start 100%', 'start 55%']}
      >
        <span className="rj-feature__window" aria-hidden="true">
          <i />
          <i />
          <i />
          <b>{product.name}</b>
        </span>
        <img src={product.image} alt={product.imageAlt} width="1200" height="536" loading="lazy" />
      </ScrollRise>
    </article>
  );
}
