'use client';

import { TrendPoint } from '@/lib/types';
import { formatNumber } from '@/lib/data-service';

interface TrendLineProps {
  data: TrendPoint[];
  height?: number;
  showLegend?: boolean;
  legendLabels?: Record<string, string>;
  showArea?: boolean;
}

export default function TrendLine({
  data,
  height = 260,
  showLegend = true,
  legendLabels = {},
  showArea = true,
}: TrendLineProps) {
  if (!data.length) return null;

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const svgWidth = 800;
  const chartH = height - padding.top - padding.bottom;
  const chartW = svgWidth - padding.left - padding.right;

  const keys = data[0].values.map(v => v.key);
  const allValues = data.flatMap(d => d.values.map(v => v.value));
  const maxVal = Math.max(...allValues);
  const niceMax = Math.ceil(maxVal / 100) * 100;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((niceMax / yTicks) * i)
  );

  const getX = (i: number) =>
    padding.left + (i / (data.length - 1)) * chartW;
  const getY = (val: number) =>
    padding.top + chartH - (val / niceMax) * chartH;

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
        </defs>

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
                {formatNumber(tick)}
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
          const points = data.map((d, i) => `${getX(i)},${getY(d.values[ki].value)}`).join(' ');
          const areaPath = `M${getX(0)},${getY(data[0].values[ki].value)} ` +
            data.map((d, i) => `L${getX(i)},${getY(d.values[ki].value)}`).join(' ') +
            ` L${getX(data.length - 1)},${padding.top + chartH} L${getX(0)},${padding.top + chartH} Z`;

          return (
            <path
              key={key}
              d={areaPath}
              fill={`url(#area-${key})`}
              style={{ animation: 'fadeIn 0.8s ease forwards', animationDelay: `${ki * 200}ms` }}
            />
          );
        })}

        {/* Lines */}
        {keys.map((key, ki) => {
          const pathD = data.map((d, i) => {
            const x = getX(i);
            const y = getY(d.values[ki].value);
            return `${i === 0 ? 'M' : 'L'}${x},${y}`;
          }).join(' ');

          return (
            <g key={key}>
              <path
                d={pathD}
                fill="none"
                stroke={data[0].values[ki].color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: 'fadeIn 0.6s ease forwards',
                  animationDelay: `${ki * 200}ms`,
                }}
              />
              {/* Data points */}
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(d.values[ki].value)}
                  r="4"
                  fill="white"
                  stroke={d.values[ki].color}
                  strokeWidth="2.5"
                  style={{
                    animation: 'fadeIn 0.4s ease forwards',
                    animationDelay: `${ki * 200 + i * 50}ms`,
                  }}
                >
                  <title>{`${d.label}: ${formatNumber(d.values[ki].value)} tCO₂e`}</title>
                </circle>
              ))}
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
