export function SectionHeading({ eyebrow, title, children, align = 'split' }) {
  return (
    <header className={`section-heading section-heading--${align}`} data-reveal>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children && <div className="section-heading__copy">{children}</div>}
    </header>
  );
}
