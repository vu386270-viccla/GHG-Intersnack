'use client';

import { DonutSegment } from '@/lib/types';

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export default function DonutChart({
  segments,
  size = 200,
  thickness = 32,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;

  return (
    <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E0DFDB"
          strokeWidth={thickness}
          opacity="0.3"
        />

        {/* Segments */}
        {segments.map((seg, i) => {
          const percent = seg.value / total;
          const dashLength = circumference * percent;
          const dashOffset = circumference * (1 - cumulativePercent) + circumference * 0.25;
          cumulativePercent += percent;

          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease',
                animation: `donutDraw 1s ease forwards`,
                animationDelay: `${i * 150}ms`,
              }}
            >
              <title>{`${seg.label}: ${Math.round(percent * 100)}%`}</title>
            </circle>
          );
        })}

        {/* Center text */}
        {centerValue && (
          <>
            <text
              x={center}
              y={center - 6}
              textAnchor="middle"
              dominantBaseline="auto"
              fill="#1A1A1A"
              fontSize="28"
              fontFamily="'Caveat', cursive"
              fontWeight="700"
            >
              {centerValue}
            </text>
            {centerLabel && (
              <text
                x={center}
                y={center + 16}
                textAnchor="middle"
                dominantBaseline="auto"
                fill="#999"
                fontSize="11"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="chart-legend" style={{ justifyContent: 'center', borderTop: 'none', marginTop: '8px' }}>
        {segments.map((seg) => (
          <div key={seg.label} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: seg.color }} />
            {seg.label} ({Math.round((seg.value / total) * 100)}%)
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes donutDraw {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
