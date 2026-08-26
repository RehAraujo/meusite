import { Link } from 'react-router-dom';

function CardContent({ name, category, image, imageAlt, status, backLabel }) {
  return (
    <span className="featured-flip-card__inner">
      <span className="featured-flip-card__media">
        {image ? (
          <img src={image} alt={imageAlt} width="1440" height="900" loading="lazy" />
        ) : (
          <span className="featured-flip-card__placeholder" aria-hidden="true">
            <i>{name.slice(0, 2)}</i>
            <b />
            <b />
          </span>
        )}
      </span>
      <span className="featured-flip-card__meta">
        <small>{category}</small>
        <strong>{name}</strong>
        <em>{status}</em>
      </span>
      <span className="featured-flip-card__action">
        {backLabel} <i aria-hidden="true">→</i>
      </span>
    </span>
  );
}

export function FeaturedProjectCard({ name, category, image, imageAlt, href, status, backLabel }) {
  const content = (
    <CardContent
      name={name}
      category={category}
      image={image}
      imageAlt={imageAlt}
      status={status}
      backLabel={backLabel}
    />
  );

  if (href) {
    return (
      <Link className="featured-flip-card" to={href} aria-label={`${name}: ${backLabel}`}>
        {content}
      </Link>
    );
  }

  return (
    <article className="featured-flip-card featured-flip-card--upcoming" aria-label={`${name}: case em construção`}>
      {content}
    </article>
  );
}
