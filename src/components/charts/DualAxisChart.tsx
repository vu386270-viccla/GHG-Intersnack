'use client';

// ── DualAxisChart: Line (emission) + Bar (RCN) dual Y-axis ──
// Trục trái = tCO₂e (line), Trục phải = MT RCN (bar)

interface DualAxisChartProps {
  labels: string[];
  emissionValues: number[];   // line — left axis
  rcnValues: number[];        // bar  — right axis
  emissionColor?: string;
  rcnColor?: string;
  height?: number;
  currency?: boolean;
}

function niceMax(max: number) {
  if (max <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const frac = max / mag;
  const n = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return n * mag;
}

function fmt(v: number) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return v.toFixed(0);
}

export default function DualAxisChart({
  labels,
  emissionValues,
  rcnValues,
  emissionColor = '#E32314',
  rcnColor = '#6366F1',
  height = 220,
  currency = false,
}: DualAxisChartProps) {
  if (!labels.length) return null;

  const PAD = { top: 16, right: 52, bottom: 32, left: 48 };
  const W = 800;
  const H = height;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = labels.length;

  const maxEm = niceMax(Math.max(...emissionValues, 1));
  const maxRcn = niceMax(Math.max(...rcnValues, 1));
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const getX = (i: number) => PAD.left + (i / (n - 1)) * cW;
  const getEmY = (v: number) => PAD.top + cH - (v / maxEm) * cH;
  const getRcnY = (v: number) => PAD.top + cH - (v / maxRcn) * cH;

  const barW = Math.min(cW / n * 0.45, 24);
  const linePath = emissionValues.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${getX(i)},${getEmY(v)}`
  ).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y left ticks (emission) */}
        {yTicks.map(f => {
          const t = Math.round(maxEm * f);
          const y = PAD.top + cH - f * cH;
          return (
            <g key={f}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#E0DFDB" strokeWidth={0.8} strokeDasharray="3,3" />
              <text x={PAD.left - 5} y={y + 4} textAnchor="end"
                fontSize={9} fill="#888" fontFamily="Inter, sans-serif">{currency ? '$'+fmt(t) : fmt(t)}</text>
            </g>
          );
        })}

        {/* Y right ticks (RCN) */}
        {yTicks.map(f => {
          const t = Math.round(maxRcn * f);
          const y = PAD.top + cH - f * cH;
          return (
            <text key={f} x={W - PAD.right + 5} y={y + 4} textAnchor="start"
              fontSize={9} fill={rcnColor} fontFamily="Inter, sans-serif">{fmt(t)}</text>
          );
        })}

        {/* RCN bars */}
        {rcnValues.map((v, i) => {
          const bh = (v / maxRcn) * cH;
          const x = getX(i) - barW / 2;
          const y = PAD.top + cH - bh;
          return (
            <rect key={i} x={x} y={y} width={barW} height={bh}
              fill={rcnColor} opacity={0.18} rx={2}>
              <title>{`${labels[i]} RCN: ${fmt(v)} MT`}</title>
            </rect>
          );
        })}

        {/* Emission area */}
        <path
          d={`${linePath} L${getX(n - 1)},${PAD.top + cH} L${getX(0)},${PAD.top + cH} Z`}
          fill={emissionColor} opacity={0.08}
        />

        {/* Emission line */}
        <path d={linePath} fill="none" stroke={emissionColor}
          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {emissionValues.map((v, i) => (
          <circle key={i} cx={getX(i)} cy={getEmY(v)} r={3.5}
            fill="white" stroke={emissionColor} strokeWidth={2}>
            <title>{`${labels[i]} ${currency ? 'chi phí' : 'phát thải'}: ${currency ? '$' + fmt(v) : fmt(v) + ' tCO₂e'}`}</title>
          </circle>
        ))}

        {/* X labels */}
        {labels.map((lbl, i) => (
          <text key={i} x={getX(i)} y={H - 6} textAnchor="middle"
            fontSize={9} fill="#888" fontFamily="Inter, sans-serif">{lbl}</text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4, paddingLeft: 48, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 3, background: emissionColor, display: 'inline-block', borderRadius: 2 }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>{currency ? 'Chi phí (USD)' : 'Phát thải (tCO₂e)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 10, background: rcnColor, opacity: 0.4, display: 'inline-block', borderRadius: 2 }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>RCN nhập (MT) →</span>
        </div>
      </div>
    </div>
  );
}
