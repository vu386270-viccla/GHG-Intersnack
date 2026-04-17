'use client';

import { TrendPoint } from '@/lib/types';
import { formatNumber } from '@/lib/data-service';

interface TrendLineProps {
  data: TrendPoint[];
  height?: number;
  showLegend?: boolean;
  legendLabels?: Record<string, string>;
  showArea?: boolean;
  currency?: boolean;
}

export default function TrendLine({
  data,
  height = 260,
  showLegend = true,
  legendLabels = {},
  showArea = true,
  currency = false,
}: TrendLineProps) {
  if (!data.length) return null;

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const svgWidth = 800;
  const chartH = height - padding.top - padding.bottom;
  const chartW = svgWidth - padding.left - padding.right;

  const keys = data[0].values.map(v => v.key);
  const allValues = data.flatMap(d => d.values.map(v => v.value));
  const maxVal = Math.max(...allValues);
  const niceMax = (() => {
    if (maxVal <= 0) return 100;
    const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const frac = maxVal / mag;
    const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * mag;
  })();

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((niceMax / yTicks) * i)
  );

  const getX = (i: number) =>
    padding.left + (i / (data.length - 1)) * chartW;
  const getY = (val: number) =>
    padding.top + chartH - (val / niceMax) * chartH;

  // Approximate path length for dasharray trick (good enough for straight segments)
  const approxLen = (ki: number) => {
    const pts = data.map((d, i) => ({ x: getX(i), y: getY(d.values[ki].value) }));
    return pts.reduce((sum, pt, i) => {
      if (i === 0) return 0;
      const dx = pt.x - pts[i - 1].x;
      const dy = pt.y - pts[i - 1].y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);
  };

  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto' }}
      >
        <defs>
          {keys.map((key, ki) => (
            <linearGradient key={key} id={`area-${key}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={data[0].values[ki].color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={data[0].values[ki].color} stopOpacity="0.02" />
            </linearGradient>
          ))}
          {/* Glow filter for lines */}
          <filter id="tl-glow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <style>{`
          @keyframes drawLine {
            to { stroke-dashoffset: 0; }
          }
          @keyframes tlFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes tlPulse {
            0%, 100% { r: 5px; opacity: 1; }
            50%       { r: 8px; opacity: 0.55; }
          }
        `}</style>

        {/* Y grid */}
        {yTickValues.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left} y1={y}
                x2={svgWidth - padding.right} y2={y}
                stroke="#E0DFDB" strokeWidth="1" strokeDasharray="4,4"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end"
                fill="#999" fontSize="11" fontFamily="Inter, sans-serif">
                {currency ? '$' + formatNumber(tick) : formatNumber(tick)}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {data.map((point, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 8}
            textAnchor="middle"
            fill="#666"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            {point.label}
          </text>
        ))}

        {/* Area fills */}
        {showArea && keys.map((key, ki) => {
          const areaPath = `M${getX(0)},${getY(data[0].values[ki].value)} ` +
            data.map((d, i) => `L${getX(i)},${getY(d.values[ki].value)}`).join(' ') +
            ` L${getX(data.length - 1)},${padding.top + chartH} L${getX(0)},${padding.top + chartH} Z`;
          const lineDelay = ki * 300;
          const lineDur = 800;
          return (
            <path
              key={key}
              d={areaPath}
              fill={`url(#area-${key})`}
              style={{
                opacity: 0,
                animation: `tlFadeIn 0.5s ease forwards`,
                animationDelay: `${lineDelay + lineDur * 0.6}ms`,
              }}
            />
          );
        })}

        {/* Lines — stroke-dasharray draw effect */}
        {keys.map((key, ki) => {
          const pathD = data.map((d, i) => {
            const x = getX(i);
            const y = getY(d.values[ki].value);
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
          }).join(' ');
          const len = approxLen(ki) || 800;
          const color = data[0].values[ki].color;
          const lineDelay = ki * 300;
          const lastIdx = data.length - 1;
          const tipX = getX(lastIdx);
          const tipY = getY(data[lastIdx].values[ki].value);

          return (
            <g key={key}>
              {/* Glow layer (behind) */}
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.25"
                filter="url(#tl-glow)"
                style={{
                  strokeDasharray: len,
                  strokeDashoffset: len,
                  animation: `drawLine 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
                  animationDelay: `${lineDelay}ms`,
                }}
              />
              {/* Main line */}
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: len,
                  strokeDashoffset: len,
                  animation: `drawLine 0.9s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
                  animationDelay: `${lineDelay}ms`,
                }}
              />
              {/* Data points — fade in after line */}
              {data.map((d, i) => {
                const isLast = i === lastIdx;
                return (
                  <g key={i}>
                    <circle
                      cx={getX(i)}
                      cy={getY(d.values[ki].value)}
                      r={isLast ? 5 : 4}
                      fill="white"
                      stroke={d.values[ki].color}
                      strokeWidth="2.5"
                      style={{
                        opacity: 0,
                        animation: `tlFadeIn 0.3s ease forwards`,
                        animationDelay: `${lineDelay + 700 + i * 40}ms`,
                      }}
                    >
                      <title>{`${d.label}: ${currency ? '$' + formatNumber(d.values[ki].value) : formatNumber(d.values[ki].value) + ' tCO₂e'}`}</title>
                    </circle>
                    {/* Pulsing ring on the latest/last data point */}
                    {isLast && (
                      <circle
                        cx={tipX}
                        cy={tipY}
                        r={5}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        style={{
                          animation: `tlPulse 1.8s ease-in-out infinite`,
                          animationDelay: `${lineDelay + 1100}ms`,
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="chart-legend">
          {keys.map((key, i) => (
            <div key={key} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ background: data[0].values[i].color }} />
              {legendLabels[key] || key}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

