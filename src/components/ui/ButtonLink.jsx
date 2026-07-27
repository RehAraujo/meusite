import { Link } from 'react-router-dom';

const isExternal = (to) => /^https?:\/\//.test(to);

export function ButtonLink({ children, to, secondary = false, className = '' }) {
  const classes = `button ${secondary ? 'button--secondary' : ''} ${className}`.trim();
  return isExternal(to) ? (
    <a className={classes} href={to} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link className={classes} to={to}>
      {children}
    </Link>
  );
}
