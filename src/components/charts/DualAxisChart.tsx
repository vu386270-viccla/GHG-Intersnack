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

  const PAD = { top: 24, right: 52, bottom: 32, left: 48 };
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

  // Approximate line length
  const approxLen = emissionValues.reduce((sum, val, i) => {
    if (i === 0) return 0;
    const dx = getX(i) - getX(i - 1);
    const dy = getEmY(val) - getEmY(emissionValues[i - 1]);
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  const lastIdx = n - 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <filter id="da-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {rcnValues.map((_, i) => (
            <clipPath key={`da-clip-${i}`} id={`da-clip-${i}`}>
              <rect
                x={getX(i) - barW / 2 - 2}
                y={PAD.top - 10}
                width={barW + 4}
                height={cH + 10}
                style={{
                  animation: `daGrow 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards`,
                  animationDelay: `${i * 60}ms`,
                  transformOrigin: `${getX(i)}px ${PAD.top + cH}px`,
                  transform: 'scaleY(0)',
                }}
              />
            </clipPath>
          ))}
        </defs>

        <style>{`
          @keyframes daGrow {
            0%   { transform: scaleY(0); }
            100% { transform: scaleY(1); }
          }
          @keyframes daDrawLine {
            to { stroke-dashoffset: 0; }
          }
          @keyframes daFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes daPulse {
            0%, 100% { r: 5px; opacity: 1; }
            50%      { r: 8px; opacity: 0.55; }
          }
        `}</style>

        {/* Y left ticks (emission) */}
        {yTicks.map(f => {
          const t = Math.round(maxEm * f);
          const y = PAD.top + cH - f * cH;
          return (
            <g key={`yL-${f}`}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="#E0DFDB" strokeWidth={0.8} strokeDasharray="3,3" />
              <text x={PAD.left - 5} y={y + 4} textAnchor="end"
                fontSize={9} fill="#888" fontFamily="Inter, sans-serif">{currency ? '$' + fmt(t) : fmt(t)}</text>
            </g>
          );
        })}

        {/* Y right ticks (RCN) */}
        {yTicks.map(f => {
          const t = Math.round(maxRcn * f);
          const y = PAD.top + cH - f * cH;
          return (
            <text key={`yR-${f}`} x={W - PAD.right + 5} y={y + 4} textAnchor="start"
              fontSize={9} fill={rcnColor} opacity={0.6} fontFamily="Inter, sans-serif">{fmt(t)}</text>
          );
        })}

        {/* RCN bars */}
        {rcnValues.map((v, i) => {
          const bh = (v / maxRcn) * cH;
          const x = getX(i) - barW / 2;
          const y = PAD.top + cH - bh;
          if (v === 0) return null;
          return (
            <rect key={`bar-${i}`} x={x} y={y} width={barW} height={bh}
              fill={rcnColor} opacity={0.18} rx={2} clipPath={`url(#da-clip-${i})`}>
              <title>{`${labels[i]} RCN: ${fmt(v)} MT`}</title>
            </rect>
          );
        })}

        {/* Emission area */}
        <path
          d={`${linePath} L${getX(n - 1)},${PAD.top + cH} L${getX(0)},${PAD.top + cH} Z`}
          fill={emissionColor}
          style={{
            opacity: 0,
            animation: 'daFadeIn 0.8s ease forwards',
            animationDelay: '600ms'
          }}
        />

        {/* Emission line glow */}
        <path d={linePath} fill="none" stroke={emissionColor}
          strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.25} filter="url(#da-glow)"
          style={{
            strokeDasharray: approxLen,
            strokeDashoffset: approxLen,
            animation: 'daDrawLine 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards'
          }}
        />

        {/* Emission line */}
        <path d={linePath} fill="none" stroke={emissionColor}
          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{
            strokeDasharray: approxLen,
            strokeDashoffset: approxLen,
            animation: 'daDrawLine 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards'
          }}
        />

        {/* Dots */}
        {emissionValues.map((v, i) => {
          const isLast = i === lastIdx;
          return (
            <g key={`dot-${i}`}>
              <circle cx={getX(i)} cy={getEmY(v)} r={isLast ? 4 : 3.5}
                fill="white" stroke={emissionColor} strokeWidth={2}
                style={{
                  opacity: 0,
                  animation: 'daFadeIn 0.3s ease forwards',
                  animationDelay: `${700 + i * 40}ms`
                }}>
                <title>{`${labels[i]} ${currency ? 'chi phí' : 'phát thải'}: ${currency ? '$' + fmt(v) : fmt(v) + ' tCO₂e'}`}</title>
              </circle>
              {isLast && (
                <circle cx={getX(i)} cy={getEmY(v)} r={5} fill="none" stroke={emissionColor} strokeWidth={1.5}
                  style={{
                    animation: 'daPulse 1.8s ease-in-out infinite',
                    animationDelay: '1100ms'
                  }}
                />
              )}
            </g>
          );
        })}

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
