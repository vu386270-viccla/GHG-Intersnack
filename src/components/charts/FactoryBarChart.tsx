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
}: FactoryBarChartProps) {
  if (!labels.length || !series.length) return null;

  const PAD = { top: 16, right: 12, bottom: 32, left: 48 };
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
        {/* Y grid + labels */}
        {yTicks.map(t => {
          const y = PAD.top + cH - (t / maxVal) * cH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#E0DFDB" strokeWidth={0.8} strokeDasharray="3,3" />
              <text x={PAD.left - 5} y={y + 4} textAnchor="end"
                fontSize={9} fill="#888" fontFamily="Inter, sans-serif">
                {formatVal(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {series.map((s, si) =>
          s.values.map((v, gi) => {
            const x = getBarX(gi, si);
            const bh = getBarH(v);
            const y = getBarY(v);
            if (v === 0) return null;
            return (
              <rect key={`${si}-${gi}`} x={x} y={y} width={barW} height={bh}
                fill={s.color} rx={2} opacity={0.9}>
                <title>{`${s.label} — ${labels[gi]}: ${formatVal(v)} ${yLabel}`}</title>
              </rect>
            );
          })
        )}

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
