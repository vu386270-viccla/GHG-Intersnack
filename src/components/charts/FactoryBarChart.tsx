'use client';

// ── FactoryBarChart: Grouped bar chart theo nhà máy ──
// Compact SVG, responsive, tooltip on hover

interface BarSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // one per month/x-point
}

interface FactoryBarChartProps {
  labels: string[];        // x-axis: months
  series: BarSeries[];     // one per factory
  height?: number;
  yLabel?: string;
  formatVal?: (v: number) => string;
  currency?: boolean;
}

function niceMax(max: number) {
  if (max <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const frac = max / mag;
  const n = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return n * mag;
}

function fmtNum(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return v.toFixed(0);
}

export default function FactoryBarChart({
  labels,
  series,
  height = 220,
  yLabel = 'tCO₂e',
  formatVal = fmtNum,
  currency = false,
}: FactoryBarChartProps) {
  if (!labels.length || !series.length) return null;

  const PAD = { top: 24, right: 12, bottom: 32, left: 48 };
  const W = 800;
  const H = height;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const nSeries = series.length;
  const nGroups = labels.length;
  const groupW = cW / nGroups;
  const barW = Math.min(groupW / nSeries * 0.75, 18);
  const groupPad = (groupW - barW * nSeries) / 2;

  const allVals = series.flatMap(s => s.values);
  const maxVal = niceMax(Math.max(...allVals, 1));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  const getBarX = (gi: number, si: number) =>
    PAD.left + gi * groupW + groupPad + si * barW;
  const getBarH = (v: number) => (v / maxVal) * cH;
  const getBarY = (v: number) => PAD.top + cH - getBarH(v);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <filter id="fbc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Per-group clipPath for grow animation */}
          {labels.map((_, gi) => {
            const gxCenter = PAD.left + gi * groupW + groupW / 2;
            return (
              <clipPath key={gi} id={`fbc-clip-${gi}`}>
                <rect
                  x={PAD.left + gi * groupW - 4}
                  y={PAD.top - 10}
                  width={groupW + 8}
                  height={cH + 10}
                  style={{
                    animation: `fbcGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards`,
                    animationDelay: `${gi * 60}ms`,
                    transformOrigin: `${gxCenter}px ${PAD.top + cH}px`,
                    transform: 'scaleY(0)',
                  }}
                />
              </clipPath>
            );
          })}
        </defs>

        <style>{`
          @keyframes fbcGrow {
            0%   { transform: scaleY(0); }
            100% { transform: scaleY(1); }
          }
        `}</style>

        {/* Y grid + labels */}
        {yTicks.map(t => {
          const y = PAD.top + cH - (t / maxVal) * cH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#E0DFDB" strokeWidth={0.8} strokeDasharray="3,3" />
              <text x={PAD.left - 5} y={y + 4} textAnchor="end"
                fontSize={9} fill="#888" fontFamily="Inter, sans-serif">
                {currency ? '$' + formatVal(t) : formatVal(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {labels.map((_, gi) => (
          <g key={`group-${gi}`} clipPath={`url(#fbc-clip-${gi})`}>
            {series.map((s, si) => {
              const v = s.values[gi];
              if (!v) return null;
              const x = getBarX(gi, si);
              const bh = getBarH(v);
              const y = getBarY(v);
              return (
                <rect key={`${si}-${gi}`} x={x} y={y} width={barW} height={bh}
                  fill={s.color} rx={2} opacity={0.9}>
                  <title>{`${s.label} — ${labels[gi]}: ${currency ? '$' + formatVal(v) : formatVal(v) + ' ' + yLabel}`}</title>
                </rect>
              );
            })}
          </g>
        ))}

        {/* X labels */}
        {labels.map((lbl, gi) => (
          <text key={gi}
            x={PAD.left + gi * groupW + groupW / 2}
            y={H - 6}
            textAnchor="middle" fontSize={9} fill="#888" fontFamily="Inter, sans-serif">
            {lbl}
          </text>
        ))}

        {/* Y label */}
        <text x={10} y={PAD.top + cH / 2} textAnchor="middle"
          fontSize={9} fill="#aaa" fontFamily="Inter, sans-serif"
          transform={`rotate(-90, 10, ${PAD.top + cH / 2})`}>
          {yLabel}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: 4, paddingLeft: 48 }}>
        {series.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
