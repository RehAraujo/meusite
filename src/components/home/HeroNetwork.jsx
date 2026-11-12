import { useEffect, useRef, useState } from 'react';
import { m, useReducedMotion, useSpring, useTransform } from 'motion/react';

/*
 * Hero — "universo conectado".
 *
 * HeroCosmos: um planeta abstrato de grande escala, visto de cima, cujo
 * horizonte nasce atrás do retrato e continua além da tela. Meridianos e
 * conexões giram juntos (rotação real em 3D, muito lenta); órbitas amplas
 * cruzam o céu; pontos de luz pulsam devagar. A coluna de texto fica limpa
 * graças a uma máscara (CSS).
 *
 * HeroWords: palavras-nó ancoradas nas áreas transparentes da fotografia.
 */

/* ───────────── Geometria do planeta ───────────── */
const SCENE = { width: 1600, height: 900 };
const SPHERE = { cx: 1120, cy: 1210, r: 880 };
const TILT = (20 * Math.PI) / 180; // o polo inclina em direção ao observador
const SPIN = (2 * Math.PI) / 480; // uma volta a cada ~8 min: quase imperceptível
const rad = (degrees) => (degrees * Math.PI) / 180;
const fixed = (value) => Math.round(value * 10) / 10;

const unit = (lat, lon) => [
  Math.cos(rad(lat)) * Math.sin(rad(lon)),
  Math.sin(rad(lat)),
  Math.cos(rad(lat)) * Math.cos(rad(lon)),
];

const spin = ([x, y, z], theta) => [
  x * Math.cos(theta) + z * Math.sin(theta),
  y,
  -x * Math.sin(theta) + z * Math.cos(theta),
];

// Projeta um ponto (raio relativo `scale`) e informa se está visível.
const project = ([x, y, z], scale = 1) => {
  const r = SPHERE.r * scale;
  const tiltedY = y * Math.cos(TILT) - z * Math.sin(TILT);
  const depth = y * Math.sin(TILT) + z * Math.cos(TILT);
  const sx = x * r;
  const sy = tiltedY * r;
  const outside = Math.hypot(sx, sy) > SPHERE.r;
  return {
    x: SPHERE.cx + sx,
    y: SPHERE.cy - sy,
    depth,
    visible: depth >= 0 || outside,
  };
};

const toPath = (points) => {
  let d = '';
  let open = false;
  points.forEach((point) => {
    if (!point.visible) {
      open = false;
      return;
    }
    d += `${open ? 'L' : 'M'}${fixed(point.x)} ${fixed(point.y)}`;
    open = true;
  });
  return d || 'M0 0';
};

const latitudeArc = (lat) => {
  const cy = SPHERE.cy - SPHERE.r * Math.sin(rad(lat)) * Math.cos(TILT);
  const rx = SPHERE.r * Math.cos(rad(lat));
  const ry = rx * Math.sin(TILT);
  const limit = -Math.tan(rad(lat)) * Math.tan(TILT);
  const lambda = Math.acos(Math.max(-1, Math.min(1, limit)));
  const x1 = SPHERE.cx - rx * Math.sin(lambda);
  const x2 = SPHERE.cx + rx * Math.sin(lambda);
  const y = cy + ry * Math.cos(lambda);
  const large = lambda > Math.PI / 2 ? 1 : 0;
  return `M${fixed(x1)} ${fixed(y)}A${fixed(rx)} ${fixed(ry)} 0 ${large} 0 ${fixed(x2)} ${fixed(y)}`;
};

// Paralelos estáticos (a rotação não os altera) e o horizonte.
const latitudes = [36, 52, 66].map((lat) => ({ lat, d: latitudeArc(lat) }));
const horizon = `M${SPHERE.cx - SPHERE.r} ${SPHERE.cy}A${SPHERE.r} ${SPHERE.r} 0 0 1 ${SPHERE.cx + SPHERE.r} ${SPHERE.cy}`;

// Meridianos abertos: param antes do polo, sem formar uma "gaiola".
const meridianLongitudes = [0, 60, 120, 180, 240, 300];

// Pontos de rede sobre a superfície e as conexões entre eles.
const sites = [
  [44, -38],
  [56, 8],
  [38, 34],
  [64, -72],
  [47, 78],
  [30, -4],
  [58, 128],
  [36, 168],
  [50, -128],
  [42, -92],
];
const links = [
  [0, 1],
  [1, 2],
  [5, 1],
  [3, 0],
  [2, 4],
  [9, 0],
  [4, 6],
  [8, 9],
];

const slerp = (a, b, t) => {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-4) return a;
  const sa = Math.sin((1 - t) * omega) / Math.sin(omega);
  const sb = Math.sin(t * omega) / Math.sin(omega);
  return [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
};

const computeScene = (theta) => {
  const meridians = meridianLongitudes.map((lon) => {
    const points = [];
    let depth = 0;
    for (let lat = -6; lat <= 74; lat += 4) {
      const point = project(spin(unit(lat, lon), theta));
      depth += point.depth;
      points.push(point);
    }
    const average = depth / points.length;
    return { d: toPath(points), opacity: Math.max(0, Math.min(1, average * 1.4)) };
  });

  const siteVectors = sites.map(([lat, lon]) => spin(unit(lat, lon), theta));
  const nodes = siteVectors.map((vector) => {
    const point = project(vector, 1);
    return {
      x: fixed(point.x),
      y: fixed(point.y),
      opacity: point.depth > 0 ? fixed(Math.min(1, 0.25 + point.depth)) : 0,
    };
  });

  const arcs = links.map(([from, to]) => {
    const a = siteVectors[from];
    const b = siteVectors[to];
    const distance = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    const lift = 0.05 + distance * 0.22;
    const points = [];
    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      points.push(project(slerp(a, b, t), 1 + lift * Math.sin(Math.PI * t)));
    }
    return toPath(points);
  });

  return { meridians, nodes, arcs };
};

const initialScene = computeScene(0);

// Campo de estrelas determinístico (igual no servidor e no navegador).
const stars = (() => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: 34 }, (_, index) => ({
    x: fixed(420 + random() * 1180),
    y: fixed(20 + random() * 520),
    r: fixed(0.8 + random() * 1.5),
    o: fixed(0.18 + random() * 0.45),
    twinkle: index % 5 === 0,
    delay: fixed(random() * -9),
  }));
})();

// Curvas distantes: sugerem a rede continuando além da tela e da fotografia.
const farArcs = [
  'M380 -40C700 140 1180 120 1660 -20',
  'M1660 210C1380 300 1200 520 1260 940',
  'M560 960C760 640 1120 560 1660 620',
];

const orbits = [
  { rx: 1180, ry: 300, angle: -14, sway: 3, duration: 110, comet: 90, tone: 'pink', depth: 'near' },
  {
    rx: 1020,
    ry: 420,
    angle: 10,
    sway: -2,
    duration: 140,
    comet: 120,
    tone: 'light',
    depth: 'far',
  },
];

export function HeroCosmos({ pointerX, pointerY }) {
  const rootRef = useRef(null);
  const meridianRefs = useRef([]);
  const arcRefs = useRef([]);
  const cometRefs = useRef([]);
  const nodeRefs = useRef([]);
  const shouldReduceMotion = useReducedMotion();
  const smoothX = useSpring(pointerX, { stiffness: 28, damping: 20, mass: 1 });
  const smoothY = useSpring(pointerY, { stiffness: 28, damping: 20, mass: 1 });
  const farX = useTransform(smoothX, [-0.5, 0.5], [-6, 6]);
  const farY = useTransform(smoothY, [-0.5, 0.5], [-4, 4]);
  const midX = useTransform(smoothX, [-0.5, 0.5], [-12, 12]);
  const midY = useTransform(smoothY, [-0.5, 0.5], [-7, 7]);
  const nearX = useTransform(smoothX, [-0.5, 0.5], [-20, 20]);
  const nearY = useTransform(smoothY, [-0.5, 0.5], [-11, 11]);

  // Rotação contínua do planeta (~30 quadros/s), só enquanto a hero está visível.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || shouldReduceMotion) return undefined;
    let frame = 0;
    let visible = true;
    let last = 0;
    let theta = 0;
    let previous = performance.now();

    const render = (now) => {
      frame = window.requestAnimationFrame(render);
      const elapsed = Math.min(now - previous, 100);
      previous = now;
      if (!visible) return;
      theta += (elapsed / 1000) * SPIN;
      if (now - last < 33) return;
      last = now;
      const scene = computeScene(theta);
      scene.meridians.forEach((meridian, index) => {
        const element = meridianRefs.current[index];
        if (!element) return;
        element.setAttribute('d', meridian.d);
        element.style.opacity = meridian.opacity;
      });
      scene.arcs.forEach((d, index) => {
        arcRefs.current[index]?.setAttribute('d', d);
        cometRefs.current[index]?.setAttribute('d', d);
      });
      scene.nodes.forEach((node, index) => {
        const element = nodeRefs.current[index];
        if (!element) return;
        element.setAttribute('cx', node.x);
        element.setAttribute('cy', node.y);
        element.style.opacity = node.opacity;
      });
    };

    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            root.toggleAttribute('data-paused', !visible);
          })
        : null;
    observer?.observe(root);
    frame = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [shouldReduceMotion]);

  const layer = (x, y) => (shouldReduceMotion ? undefined : { x, y });

  return (
    <div className="rj-cosmos" ref={rootRef} aria-hidden="true">
      <svg
        className="rj-cosmos__svg"
        viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <radialGradient id="rj-atmosphere" cx="50%" cy="50%" r="50%">
            <stop offset="0.84" stopColor="#d8d4e8" stopOpacity="0" />
            <stop offset="0.94" stopColor="#d8d4e8" stopOpacity="0.05" />
            <stop offset="1" stopColor="#d8d4e8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rj-limb" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.26" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Plano distante: estrelas e a órbita mais ampla */}
        <m.g style={layer(farX, farY)}>
          <g className="rj-cosmos__far">
            {farArcs.map((d, index) => (
              <path key={d} d={d} style={{ '--rj-n': index }} />
            ))}
          </g>
          <g className="rj-cosmos__stars">
            {stars.map((star) => (
              <circle
                key={`${star.x}-${star.y}`}
                className={star.twinkle ? 'is-twinkle' : undefined}
                cx={star.x}
                cy={star.y}
                r={star.r}
                style={{ '--rj-o': star.o, '--rj-delay': `${star.delay}s` }}
              />
            ))}
          </g>
        </m.g>

        {/* Plano médio: o planeta */}
        <m.g style={layer(midX, midY)}>
          <circle
            className="rj-cosmos__atmosphere"
            cx={SPHERE.cx}
            cy={SPHERE.cy}
            r={SPHERE.r * 1.12}
            fill="url(#rj-atmosphere)"
          />
          <path className="rj-cosmos__limb" d={horizon} stroke="url(#rj-limb)" />
          {latitudes.map((latitude, index) => (
            <path
              key={latitude.lat}
              className="rj-cosmos__parallel"
              d={latitude.d}
              style={{ '--rj-n': index }}
            />
          ))}
          {initialScene.meridians.map((meridian, index) => (
            <path
              key={meridianLongitudes[index]}
              ref={(element) => {
                meridianRefs.current[index] = element;
              }}
              className="rj-cosmos__meridian"
              d={meridian.d}
              style={{ opacity: meridian.opacity }}
            />
          ))}
          {initialScene.arcs.map((d, index) => (
            <g key={links[index].join('-')} className="rj-cosmos__link" style={{ '--rj-n': index }}>
              <path
                ref={(element) => {
                  arcRefs.current[index] = element;
                }}
                className="rj-cosmos__arc"
                d={d}
                pathLength="1"
              />
              <path
                ref={(element) => {
                  cometRefs.current[index] = element;
                }}
                className="rj-cosmos__comet"
                d={d}
                pathLength="1"
              />
            </g>
          ))}
          {initialScene.nodes.map((node, index) => (
            <circle
              key={sites[index].join('-')}
              ref={(element) => {
                nodeRefs.current[index] = element;
              }}
              className={`rj-cosmos__site${index % 3 === 0 ? ' is-pulse' : ''}`}
              cx={node.x}
              cy={node.y}
              r={index % 4 === 0 ? 3.2 : 2.3}
              style={{ opacity: node.opacity, '--rj-n': index }}
            />
          ))}
        </m.g>

        {/* Plano próximo: órbitas que atravessam a cena */}
        <m.g style={layer(nearX, nearY)}>
          {orbits.map((orbit) => (
            <g
              key={orbit.angle}
              className={`rj-cosmos__orbit is-${orbit.depth}`}
              style={{
                '--rj-angle': `${orbit.angle}deg`,
                '--rj-sway': `${orbit.sway}deg`,
                '--rj-dur': `${orbit.duration}s`,
                '--rj-comet': `${orbit.comet}s`,
                transformOrigin: `${SPHERE.cx}px ${SPHERE.cy}px`,
              }}
            >
              <ellipse
                className={`rj-cosmos__ring is-${orbit.tone}`}
                cx={SPHERE.cx}
                cy={SPHERE.cy}
                rx={orbit.rx}
                ry={orbit.ry}
              />
              <ellipse
                className={`rj-cosmos__traveler is-${orbit.tone}`}
                cx={SPHERE.cx}
                cy={SPHERE.cy}
                rx={orbit.rx}
                ry={orbit.ry}
                pathLength="1"
              />
            </g>
          ))}
        </m.g>
      </svg>
    </div>
  );
}

/* ───────────── Palavras-nó (coordenadas do retrato: largura = 1000) ───────────── */
const VIEW = { x: -120, y: -60, width: 1470, height: 1160 };

const words = [
  { word: 'Design', x: 40, y: 120, hub: [190, 40] },
  { word: 'Tech', x: 790, y: 90, hub: [700, 20], tone: 'pink' },
  { word: 'Estratégia', x: 860, y: 300, hub: [800, 210] },
  { word: 'Branding', x: 20, y: 300, hub: [150, 230], wide: true },
  { word: 'Influência', x: 1150, y: 175, hub: [1110, 90], outer: true, tone: 'pink' },
  { word: 'CPF', x: 80, y: 470, hub: [190, 400] },
  { word: 'Tecnologia', x: 1150, y: 430, hub: [1120, 350], outer: true },
  { word: 'Brasil', x: 40, y: 625, hub: [180, 560], tone: 'green' },
  { word: 'CNPJ', x: 880, y: 560, hub: [840, 470], wide: true },
  { word: 'Liberdade', x: 1150, y: 680, hub: [1110, 600], outer: true },
].map((item) => {
  const [hx, hy] = item.hub;
  const bend = 0.28;
  const control = [
    (item.x + hx) / 2 - (hy - item.y) * bend,
    (item.y + hy) / 2 + (hx - item.x) * bend,
  ];
  return {
    ...item,
    path: `M${item.x} ${item.y} Q${fixed(control[0])} ${fixed(control[1])} ${hx} ${hy}`,
  };
});

const toPercent = (item) => ({
  left: `${((item.x - VIEW.x) / VIEW.width) * 100}%`,
  top: `${((item.y - VIEW.y) / VIEW.height) * 100}%`,
});

export function HeroWords({ pointerX, pointerY }) {
  const rootRef = useRef(null);
  const [hot, setHot] = useState(null);
  const shouldReduceMotion = useReducedMotion();
  const smoothX = useSpring(pointerX, { stiffness: 32, damping: 20, mass: 1 });
  const smoothY = useSpring(pointerY, { stiffness: 32, damping: 20, mass: 1 });
  const x = useTransform(smoothX, [-0.5, 0.5], [-14, 14]);
  const y = useTransform(smoothY, [-0.5, 0.5], [-9, 9]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      root.toggleAttribute('data-paused', !entry.isIntersecting);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const flags = (item) => [
    item.outer && 'is-outer',
    item.wide && 'is-wide',
    hot === item.word && 'is-hot',
  ];

  return (
    <m.div
      className="rj-net"
      ref={rootRef}
      aria-hidden="true"
      style={shouldReduceMotion ? undefined : { x, y }}
    >
      <svg
        className="rj-net__svg"
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
        focusable="false"
      >
        {words.map((item, index) => (
          <g
            key={item.word}
            className={['rj-net__link', ...flags(item)].filter(Boolean).join(' ')}
            style={{ '--rj-n': index }}
          >
            <path className="rj-net__wire" d={item.path} pathLength="1" />
            <path className="rj-net__signal" d={item.path} pathLength="1" />
            <circle className="rj-net__hub" cx={item.hub[0]} cy={item.hub[1]} r="3.2" />
            <circle
              className={`rj-net__anchor${item.tone ? ` is-${item.tone}` : ''}`}
              cx={item.x}
              cy={item.y}
              r="3"
            />
          </g>
        ))}
      </svg>
      {words.map((item, index) => (
        <span
          key={item.word}
          className={['rj-net__word', ...flags(item), item.tone && `is-${item.tone}`]
            .filter(Boolean)
            .join(' ')}
          style={{ ...toPercent(item), '--rj-n': index }}
          onPointerEnter={(event) => event.pointerType === 'mouse' && setHot(item.word)}
          onPointerLeave={() => setHot(null)}
        >
          {item.word}
        </span>
      ))}
    </m.div>
  );
}
