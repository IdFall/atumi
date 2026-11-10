/**
 * Planète IA d'ATUMI, façon Saturne : une sphère violette parcourue d'un
 * réseau lumineux (l'IA), deux anneaux inclinés et des lunes en orbite.
 * SVG pur, sans image ni script ; les animations s'arrêtent si l'élève a
 * demandé moins de mouvement.
 */
export function AiPlanet({ className = "" }: { className?: string }) {
  // Anneaux : arc arrière (derrière la planète) et arc avant (devant).
  const ring = (rx: number, ry: number) => ({
    back: `M ${200 - rx} 150 A ${rx} ${ry} 0 0 1 ${200 + rx} 150`,
    front: `M ${200 + rx} 150 A ${rx} ${ry} 0 0 1 ${200 - rx} 150`,
    orbit: `M ${200 - rx} 150 A ${rx} ${ry} 0 1 0 ${200 + rx} 150 A ${rx} ${ry} 0 1 0 ${200 - rx} 150`,
  });
  const inner = ring(132, 30);
  const outer = ring(172, 42);
  const nodes: [number, number][] = [
    [168, 112], [214, 98], [246, 132], [226, 176], [180, 186], [152, 152], [200, 142], [236, 156],
  ];
  const links: [number, number][] = [
    [0, 1], [1, 2], [2, 7], [7, 3], [3, 4], [4, 5], [5, 0], [0, 6], [6, 2], [6, 4], [6, 3],
  ];

  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id="atumi-planet" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#E9E2FF" />
          <stop offset="28%" stopColor="#B9A8F2" />
          <stop offset="58%" stopColor="#7557D9" />
          <stop offset="85%" stopColor="#3B2A8F" />
          <stop offset="100%" stopColor="#1A1450" />
        </radialGradient>
        <radialGradient id="atumi-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#13B8C8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#13B8C8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="atumi-ring" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#13B8C8" stopOpacity="0.15" />
          <stop offset="35%" stopColor="#13B8C8" />
          <stop offset="65%" stopColor="#B9A8F2" />
          <stop offset="100%" stopColor="#4C6BFF" stopOpacity="0.2" />
        </linearGradient>
        <clipPath id="atumi-sphere">
          <circle cx="200" cy="150" r="76" />
        </clipPath>
        <filter id="atumi-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Halo */}
      <circle cx="200" cy="150" r="128" fill="url(#atumi-halo)" className="atumi-planet-breathe" />

      <g transform="rotate(-16 200 150)">
        {/* Anneaux, partie arrière */}
        <path d={outer.back} fill="none" stroke="url(#atumi-ring)" strokeWidth="2" opacity="0.45" />
        <path d={inner.back} fill="none" stroke="url(#atumi-ring)" strokeWidth="7" opacity="0.35" />
      </g>

      {/* Planète et son réseau lumineux */}
      <circle cx="200" cy="150" r="76" fill="url(#atumi-planet)" />
      <g clipPath="url(#atumi-sphere)" stroke="#E9E2FF" strokeWidth="0.8" fill="none" opacity="0.28">
        <ellipse cx="200" cy="150" rx="76" ry="22" />
        <ellipse cx="200" cy="150" rx="76" ry="48" />
        <ellipse cx="200" cy="150" rx="26" ry="76" />
        <ellipse cx="200" cy="150" rx="54" ry="76" />
        <line x1="124" y1="150" x2="276" y2="150" />
      </g>
      <g clipPath="url(#atumi-sphere)" filter="url(#atumi-glow)">
        {links.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke="#13B8C8"
            strokeWidth="1.1"
            opacity="0.75"
          />
        ))}
        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 6 ? 4 : 2.6} fill={i === 6 ? "#FFFFFF" : "#7FF3FF"} className={`atumi-node atumi-node-${i % 4}`} />
        ))}
      </g>
      {/* Reflet */}
      <ellipse cx="176" cy="116" rx="26" ry="14" fill="#FFFFFF" opacity="0.18" transform="rotate(-28 176 116)" />

      <g transform="rotate(-16 200 150)">
        {/* Anneaux, partie avant */}
        <path d={inner.front} fill="none" stroke="url(#atumi-ring)" strokeWidth="7" opacity="0.85" />
        <path d={outer.front} fill="none" stroke="url(#atumi-ring)" strokeWidth="2" opacity="0.9" />
        {/* Lunes en orbite */}
        <circle r="5" fill="#13B8C8" filter="url(#atumi-glow)" className="atumi-orbiter">
          <animateMotion dur="14s" repeatCount="indefinite" path={outer.orbit} />
        </circle>
        <circle r="3.5" fill="#B9A8F2" filter="url(#atumi-glow)" className="atumi-orbiter">
          <animateMotion dur="9s" repeatCount="indefinite" path={inner.orbit} begin="-3s" />
        </circle>
        <circle r="2.5" fill="#FFFFFF" className="atumi-orbiter">
          <animateMotion dur="20s" repeatCount="indefinite" path={outer.orbit} begin="-11s" />
        </circle>
      </g>
    </svg>
  );
}
