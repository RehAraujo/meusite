import { useEffect, useRef, useState } from 'react';

/*
 * Galeria de painéis que se expandem (Ateliê). Reutilizável: recebe as obras
 * por props (ver src/data/atelie.js) e não conhece o conteúdo.
 * - Mouse: passar sobre um painel o expande (com pequena intenção, sem tremor).
 * - Clique, toque e teclado: cada painel tem um botão; Tab ou setas
 *   (←/→, ↑/↓, Home, End) movem o foco e o destaque.
 * - "Reduzir movimento": a troca acontece sem animação de largura (CSS).
 * - Mobile: os painéis empilham na vertical e o destaque se expande para baixo.
 * - `children` entra no rodapé da galeria, ao lado do contador (ex.: um CTA).
 * - Os estilos (atelie.css) são importados nas entradas do app, depois de rj-2026.css,
 *   para que a camada `rj` seja declarada depois das camadas base.
 */
const HOVER_INTENT = 90;
const pad = (value) => String(value).padStart(2, '0');

// Largura aproximada da imagem no painel aberto: fotos horizontais ocupam a
// altura do painel, então pedem arquivos mais largos que as verticais.
const imageSizes = ({ width, height }) => {
  const ratio = width / height;
  const desktop = Math.ceil(Math.max(36, 40 * ratio));
  const mobile = Math.ceil(19 * ratio);
  return `(width <= 48rem) max(92vw, ${mobile}rem), ${desktop}rem`;
};

export function AtelieGallery({ items, initialIndex = 0, label = 'Galeria do Ateliê', children }) {
  const total = items.length;
  const [active, setActive] = useState(Math.min(Math.max(initialIndex, 0), total - 1));
  const buttons = useRef([]);
  const hoverTimer = useRef(null);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const canHover = (event) =>
    event.pointerType === 'mouse' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const onPointerEnter = (index) => (event) => {
    if (!canHover(event)) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActive(index), HOVER_INTENT);
  };
  const onPointerLeave = () => clearTimeout(hoverTimer.current);

  const onKeyDown = (index) => (event) => {
    const keys = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: total - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + total) % total;
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className="rj-atelie" style={{ '--atelie-count': total }}>
      <ul className="rj-atelie__list" aria-label={label}>
        {items.map((item, index) => {
          const isActive = index === active;
          const { image } = item;
          return (
            <li
              key={item.id}
              className="rj-atelie__panel"
              data-active={isActive || undefined}
              data-authorship={item.authorship}
              style={{ '--fx': image.focus?.x ?? 0.5, '--fy': image.focus?.y ?? 0.5 }}
              onPointerEnter={onPointerEnter(index)}
              onPointerLeave={onPointerLeave}
            >
              <figure className="rj-atelie__figure">
                <img
                  src={image.src}
                  srcSet={image.srcSet}
                  sizes={imageSizes(image)}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="rj-atelie__caption">
                  <small>
                    {item.category}
                    {item.date && ` · ${item.date}`}
                  </small>
                  <strong>{item.title}</strong>
                  {item.credits && <span>{item.credits}</span>}
                  {item.description && <span>{item.description}</span>}
                </figcaption>
              </figure>
              {item.placeholder && <span className="rj-atelie__temp">Imagem temporária</span>}
              <button
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                className="rj-atelie__trigger"
                type="button"
                aria-pressed={isActive}
                aria-label={`Destacar obra: ${item.title}`}
                onClick={() => setActive(index)}
                onFocus={() => setActive(index)}
                onKeyDown={onKeyDown(index)}
              />
            </li>
          );
        })}
      </ul>
      <div className="rj-atelie__footer">
        <p className="rj-atelie__counter" aria-hidden="true">
          <span>{pad(active + 1)}</span> / {pad(total)}
        </p>
        {children}
      </div>
    </div>
  );
}
