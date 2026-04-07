'use client';

import { BarChartData } from '@/lib/types';
import { formatNumber } from '@/lib/data-service';

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showLegend?: boolean;
  legendLabels?: Record<string, string>;
  animated?: boolean;
}

export default function BarChart({
  data,
  height = 280,
  showLegend = true,
  legendLabels = {},
  animated = true,
}: BarChartProps) {
  if (!data.length) return null;

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const chartWidth = 100; // percentage
  const svgWidth = 800;
  const chartH = height - padding.top - padding.bottom;
  const chartW = svgWidth - padding.left - padding.right;

  // Compute max
  const maxVal = Math.max(
    ...data.map(d => d.values.reduce((sum, v) => sum + v.value, 0))
  );
  const niceMax = Math.ceil(maxVal / 1000) * 1000;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((niceMax / yTicks) * i)
  );

  // Bar dimensions
  const keys = data[0].values.map(v => v.key);
  const barGroupWidth = chartW / data.length;
  const barPadding = barGroupWidth * 0.25;
  const barWidth = (barGroupWidth - barPadding) / keys.length;

  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto' }}
      >
        {/* Y-axis grid lines */}
        {yTickValues.map((tick) => {
          const y = padding.top + chartH - (tick / niceMax) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="#E0DFDB"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? "0" : "4,4"}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#999"
                fontSize="11"
                fontFamily="Inter, sans-serif"
              >
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((group, gi) => {
          const gx = padding.left + gi * barGroupWidth + barPadding / 2;
          let stackY = 0;

          return (
            <g key={gi}>
              {/* Stacked bars */}
              {group.values.map((v, vi) => {
                const barH = (v.value / niceMax) * chartH;
                const y = padding.top + chartH - stackY - barH;
                stackY += barH;

                return (
                  <rect
                    key={vi}
                    x={gx + (barGroupWidth - barPadding - barWidth) / 2}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill={v.color}
                    rx="3"
                    ry="3"
                    opacity="0.9"
                    style={animated ? {
                      animation: `growHeight 0.6s ease forwards`,
                      animationDelay: `${gi * 50 + vi * 100}ms`,
                    } : undefined}
                  >
                    <title>{`${v.key}: ${formatNumber(v.value)} tCO₂e`}</title>
                  </rect>
                );
              })}

              {/* X-axis label */}
              <text
                x={gx + (barGroupWidth - barPadding) / 2}
                y={height - 8}
                textAnchor="middle"
                fill="#666"
                fontSize="11"
                fontFamily="Inter, sans-serif"
              >
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="chart-legend">
          {keys.map((key, i) => (
            <div key={key} className="chart-legend-item">
              <span
                className="chart-legend-dot"
                style={{ background: data[0].values[i].color }}
              />
              {legendLabels[key] || key}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes growHeight {
          from {
            transform: scaleY(0);
            transform-origin: bottom;
          }
          to {
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }
      `}</style>
    </div>
  );
}
