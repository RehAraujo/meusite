// Identificador de seção da identidade 2026: traço, número opcional e rótulo.
export function Eyebrow({ number, children }) {
  return (
    <p className="rj-eyebrow">
      <span className="rj-eyebrow__line" aria-hidden="true" />
      {number && <span className="rj-eyebrow__number">{number} /</span>}
      {children}
    </p>
  );
}
