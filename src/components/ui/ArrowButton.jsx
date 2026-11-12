import { Link } from 'react-router-dom';

/*
 * CTA da identidade 2026: pill com um círculo interno que, no hover ou no foco
 * por teclado, desliza da direita para a esquerda enquanto a seta gira.
 * Renderiza Link (rota interna), <a> (âncora ou externo) ou <button>.
 * O movimento é só visual: destino, envio e acessibilidade não mudam.
 */
const icons = {
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function ArrowButton({
  to,
  href,
  type = 'button',
  variant = 'pink',
  icon = 'arrow',
  className = '',
  children,
  ...rest
}) {
  const classes = ['rj-btn', 'rj-btn--icon', `rj-btn--${variant}`, className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      <span className="rj-btn__label">{children}</span>
      <span className={`rj-btn__icon rj-btn__icon--${icon}`} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          {icons[icon]}
        </svg>
      </span>
    </>
  );

  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        className={classes}
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...rest}
      >
        {content}
      </a>
    );
  }
  return type === 'submit' ? (
    <button className={classes} type="submit" {...rest}>
      {content}
    </button>
  ) : (
    <button className={classes} type="button" {...rest}>
      {content}
    </button>
  );
}
