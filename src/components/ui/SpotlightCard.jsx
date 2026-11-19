import { useRef } from 'react';
import './spotlight-card.css';

// Pointer tracking stays local to this surface; no global listeners or React renders per move.
export default function SpotlightCard({ as: Component = 'div', className = '', children, ...props }) {
  const cardRef = useRef(null);

  function moveSpotlight(event) {
    if (
      event.pointerType === 'touch' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;
    const card = cardRef.current;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`);
    card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`);
    card.dataset.spotlightActive = 'true';
  }

  function clearSpotlight() {
    delete cardRef.current.dataset.spotlightActive;
  }

  return (
    <Component
      {...props}
      ref={cardRef}
      className={`spotlight-card ${className}`.trim()}
      onPointerMove={moveSpotlight}
      onPointerLeave={clearSpotlight}
      onPointerCancel={clearSpotlight}
    >
      {children}
    </Component>
  );
}
