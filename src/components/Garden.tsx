const FLOWERS = [
  { x: 56, top: 92, color: "#fb7185", delay: "0s", scale: 0.95 },
  { x: 112, top: 106, color: "#c084fc", delay: "0.6s", scale: 0.9 },
  { x: 170, top: 76, color: "#f472b6", delay: "0.3s", scale: 1.12 },
  { x: 228, top: 100, color: "#fbbf24", delay: "0.9s", scale: 0.92 },
  { x: 284, top: 84, color: "#a78bfa", delay: "1.2s", scale: 1.03 },
];

function Flower({
  x,
  top,
  color,
  delay,
  scale,
}: {
  x: number;
  top: number;
  color: string;
  delay: string;
  scale: number;
}) {
  const ground = 152;
  const height = ground - top;
  const petals = Array.from({ length: 6 }, (_, i) => {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    return { cx: Math.cos(angle) * 9.4, cy: Math.sin(angle) * 9.4 };
  });

  return (
    <g transform={`translate(${x} ${ground})`}>
      <path
        d={`M0 0 C -5 ${-height * 0.4} 5 ${-height * 0.76} 0 ${-height}`}
        stroke="#69b45c"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse
        cx={-9}
        cy={-height * 0.42}
        rx={9}
        ry={4.4}
        fill="#8ed081"
        transform={`rotate(-28 -9 ${-height * 0.42})`}
      />
      <ellipse
        cx={9}
        cy={-height * 0.64}
        rx={8}
        ry={4}
        fill="#7ac56e"
        transform={`rotate(24 9 ${-height * 0.64})`}
      />
      <g transform={`translate(0 ${-height})`}>
        <g className="bloom-sway" style={{ animationDelay: delay }}>
          {petals.map((p, i) => (
            <circle key={i} cx={p.cx * scale} cy={p.cy * scale} r={6.4 * scale} fill={color} />
          ))}
          <circle r={5 * scale} fill="#fff6d8" />
          <circle r={2.3 * scale} fill="#f5b83d" />
        </g>
      </g>
    </g>
  );
}

export default function Garden() {
  return (
    <svg className="garden-scene" viewBox="0 0 340 176" role="img" aria-label="A blooming virtual garden">
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9a3" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffe9a3" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="296" cy="34" r="34" fill="url(#sunGlow)" />
      <circle cx="296" cy="34" r="16" fill="#ffd166" />

      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="52" cy="42" rx="22" ry="10" />
        <ellipse cx="70" cy="35" rx="15" ry="9" />
        <ellipse cx="36" cy="36" rx="13" ry="8" />
        <ellipse cx="238" cy="58" rx="18" ry="8" opacity="0.7" />
        <ellipse cx="252" cy="52" rx="12" ry="7" opacity="0.7" />
      </g>

      <g fill="#f9a8d4" opacity="0.85">
        <path d="M143 57c0-4 3-6 6-3 3-3 6-1 6 3 0 4-6 8-6 8s-6-4-6-8z" />
        <path d="M318 76c0-2.4 1.8-3.6 3.6-1.8 1.8-1.8 3.6-0.6 3.6 1.8 0 2.4-3.6 4.8-3.6 4.8s-3.6-2.4-3.6-4.8z" opacity="0.7" />
      </g>

      <path
        d="M0 150 C 40 118, 82 132, 122 142 C 168 154, 202 120, 252 132 C 294 142, 314 126, 340 136 L 340 176 L 0 176 Z"
        fill="#cdecc0"
      />

      {FLOWERS.map((f) => (
        <Flower key={f.x} {...f} />
      ))}

      <path
        d="M0 162 C 60 148, 104 164, 164 158 C 226 152, 272 166, 340 154 L 340 176 L 0 176 Z"
        fill="#a8df97"
      />

      <g transform="translate(192 44) scale(0.9)" fill="#fda4af" opacity="0.9">
        <path d="M0 4 C -6 -2, -16 2, -13 9 C -10 15, 0 20, 0 20 C 0 20, 10 15, 13 9 C 16 2, 6 -2, 0 4 Z" />
      </g>
      <g transform="translate(148 92) scale(0.55)" fill="#c4b5fd" opacity="0.85">
        <path d="M0 4 C -6 -2, -16 2, -13 9 C -10 15, 0 20, 0 20 C 0 20, 10 15, 13 9 C 16 2, 6 -2, 0 4 Z" />
      </g>
    </svg>
  );
}
