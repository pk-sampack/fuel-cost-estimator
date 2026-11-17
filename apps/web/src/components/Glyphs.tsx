const STROKE = 3;

function Wheel({ cx, cy, r = 9 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="var(--surface)" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx={cx} cy={cy} r={Math.max(2.5, r * 0.38)} fill="var(--hue)" />
    </g>
  );
}

function Motorcycle() {
  return (
    <g>
      <Wheel cx={28} cy={52} r={10} />
      <Wheel cx={102} cy={52} r={10} />
      <path d="M28 52 L54 32 H82 L102 52" />
      <path d="M48 30 H76" />
      <path d="M102 52 L106 24 M98 24 H114" />
      <path d="M60 32 q10 -12 22 -2" />
    </g>
  );
}

function Rickshaw() {
  return (
    <g>
      <Wheel cx={96} cy={54} r={8} />
      <Wheel cx={34} cy={54} r={9} />
      <Wheel cx={50} cy={54} r={9} />
      <path d="M16 46 V40 Q16 20 38 20 H70 Q92 20 94 40 V48" />
      <path d="M16 46 H92 L102 54" />
      <path d="M84 22 V38" />
    </g>
  );
}

function Car({ taxi = false }: { taxi?: boolean }) {
  return (
    <g>
      <path d="M10 52 q0 -10 14 -12 l14 -12 q6 -5 14 -5 h20 q10 0 16 8 l10 12 q10 3 10 9" />
      <path d="M42 30 H62 V40 H36" />
      <path d="M68 30 H82 L92 40 H68 Z" />
      <path d="M10 52 H118" />
      <Wheel cx={34} cy={54} />
      <Wheel cx={96} cy={54} />
      {taxi ? <rect x="58" y="6" width="18" height="7" rx="2" fill="var(--hue)" stroke="none" /> : null}
    </g>
  );
}

function Wagon() {
  return (
    <g>
      <path d="M14 52 V34 q0 -8 8 -8 h10 l10 -8 h24 q8 0 12 8 l8 14 q6 2 6 8" />
      <path d="M32 28 H52 V40 H27 Z" />
      <path d="M58 28 L70 40 H58 Z" />
      <path d="M14 52 H116" />
      <Wheel cx={36} cy={54} />
      <Wheel cx={98} cy={54} />
    </g>
  );
}

function Bolan() {
  return (
    <g>
      <path d="M20 52 V34 q0 -8 8 -8 h54 q9 0 13 9 l7 12 v5" />
      <path d="M32 32 H50 V42 H32 Z" />
      <path d="M56 32 H72 V42 H56 Z" />
      <path d="M78 32 H86 L92 42 H78 Z" />
      <path d="M20 52 H106" />
      <Wheel cx={40} cy={54} />
      <Wheel cx={92} cy={54} />
    </g>
  );
}

function CargoVan() {
  return (
    <g>
      <path d="M12 52 V34 q0 -10 10 -10 h76 q10 0 14 11 l4 10 v7" />
      <path d="M24 32 H44 V42 H24 Z" />
      <path d="M54 24 V50" />
      <path d="M86 38 H94" />
      <path d="M12 52 H116" />
      <Wheel cx={36} cy={54} />
      <Wheel cx={98} cy={54} />
    </g>
  );
}

function Coaster() {
  return (
    <g>
      <path d="M8 52 V32 q0 -8 8 -8 h84 q10 0 13 10 l5 18" />
      <path d="M20 30 H38 V42 H20 Z" />
      <path d="M42 30 H60 V42 H42 Z" />
      <path d="M64 30 H82 V42 H64 Z" />
      <path d="M86 30 H98 V42 H86 Z" />
      <path d="M86 42 V52" />
      <path d="M8 52 H120" />
      <Wheel cx={34} cy={54} />
      <Wheel cx={96} cy={54} />
    </g>
  );
}

function Pickup() {
  return (
    <g>
      <path d="M10 54 V34 q0 -6 6 -6 h26 l10 10 v16" />
      <path d="M24 32 H40 V42 H24 Z" />
      <path d="M56 36 H112 V54" />
      <path d="M56 36 V30 H112" />
      <path d="M10 54 H118" />
      <Wheel cx={32} cy={56} />
      <Wheel cx={98} cy={56} />
    </g>
  );
}

function Truck() {
  return (
    <g>
      <path d="M8 56 V32 q0 -6 6 -6 h26 v30" />
      <path d="M20 32 H34 V44 H20 Z" />
      <path d="M44 24 H116 V56" />
      <path d="M8 56 H120" />
      <Wheel cx={28} cy={58} r={9} />
      <Wheel cx={54} cy={58} r={9} />
      <Wheel cx={104} cy={58} r={9} />
    </g>
  );
}

function Trailer() {
  return (
    <g>
      <path d="M6 56 V36 q0 -6 6 -6 h20 v26" />
      <path d="M16 36 H28 V46 H16 Z" />
      <path d="M40 30 H124 V52" />
      <path d="M6 56 H126" />
      <Wheel cx={22} cy={58} r={8} />
      <Wheel cx={46} cy={58} r={8} />
      <Wheel cx={88} cy={58} r={8} />
      <Wheel cx={112} cy={58} r={8} />
    </g>
  );
}

export function VehicleGlyph({ kind }: { kind: string }) {
  const common = {
    viewBox: '0 0 128 72',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (kind) {
    case 'motorcycle':
      return (
        <svg {...common}>
          <Motorcycle />
        </svg>
      );
    case 'rickshaw':
      return (
        <svg {...common}>
          <Rickshaw />
        </svg>
      );
    case 'taxi':
      return (
        <svg {...common}>
          <Car taxi />
        </svg>
      );
    case 'car':
      return (
        <svg {...common}>
          <Car />
        </svg>
      );
    case 'pickup':
      return (
        <svg {...common}>
          <Pickup />
        </svg>
      );
    case 'trailer':
      return (
        <svg {...common}>
          <Trailer />
        </svg>
      );
    case 'shehzore':
    case 'mazda':
    case 'hino':
    case 'truck':
      return (
        <svg {...common}>
          <Truck />
        </svg>
      );
    case 'wagon':
      return (
        <svg {...common}>
          <Wagon />
        </svg>
      );
    case 'bolan':
      return (
        <svg {...common}>
          <Bolan />
        </svg>
      );
    case 'coaster':
      return (
        <svg {...common}>
          <Coaster />
        </svg>
      );
    case 'van':
      return (
        <svg {...common}>
          <CargoVan />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <CargoVan />
        </svg>
      );
  }
}

export function LoadGlyph({ level }: { level: 0 | 0.5 | 1 }) {
  const sacks: Array<[number, number, number]> = [
    [50, 44, -4],
    [80, 44, 3],
    [110, 44, -2],
    [65, 28, 2],
    [95, 28, -3],
    [80, 12, 0],
  ];
  const count = level === 0 ? 0 : level === 0.5 ? 3 : 6;
  return (
    <svg
      viewBox="0 0 160 72"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
    >
      <path d="M16 56 H144" />
      <path d="M22 56 V40" />
      <path d="M138 56 V40" />
      {sacks.slice(0, count).map(([x, y, tilt]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y + 10} rx={15} ry={8.5} fill="var(--surface-2)" transform={`rotate(${tilt} ${x} ${y + 10})`} />
          <path d={`M${x - 4} ${y + 2} q4 -4 8 0`} />
        </g>
      ))}
    </svg>
  );
}
