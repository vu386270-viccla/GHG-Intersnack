'use client';

import { TargetProgress } from '@/lib/types';

interface TargetGaugeProps {
  target: TargetProgress;
  size?: number;
}

export default function TargetGauge({ target, size = 180 }: TargetGaugeProps) {
  const thickness = 14;
  const radius = (size - thickness * 2) / 2;
  const center = size / 2;

  // Semi-circle: use 180 degrees (PI)
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = Math.PI;

  // Progress: how far toward target we are
  // E.g., if target is 50% reduction and we've achieved 20%, progress = 20/50 = 40%
  const progressPct = Math.min(target.actualReductionPct / target.reductionTargetPct, 1);
  const progressAngle = totalAngle * progressPct;

  // Arc path helper
  const arcPath = (startA: number, endA: number, r: number) => {
    const sx = center + r * Math.cos(startA);
    const sy = center - r * Math.sin(startA);
    const ex = center + r * Math.cos(endA);
    const ey = center - r * Math.sin(endA);
    const largeArc = Math.abs(endA - startA) > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  const isOnTrack = target.onTrack;
  const progressColor = isOnTrack ? '#8CB92D' : '#E32314';

  return (
    <div className="gauge-container">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={arcPath(startAngle, endAngle, radius)}
          fill="none"
          stroke="#E0DFDB"
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={arcPath(startAngle, startAngle - progressAngle, radius)}
          fill="none"
          stroke={progressColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          style={{
            transition: 'all 1s ease',
            animation: 'gaugeGrow 1.2s ease forwards',
          }}
        />

        {/* Center value */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize="32"
          fontFamily="'Caveat', cursive"
          fontWeight="700"
          fill={progressColor}
        >
          -{target.actualReductionPct}%
        </text>

        {/* Target label */}
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize="11"
          fontFamily="Inter, sans-serif"
          fill="#999"
        >
          Mục tiêu: -{target.reductionTargetPct}%
        </text>
      </svg>

      <div className="gauge-label">
        <strong>{target.scope}</strong>
        <br />
        {target.label}
      </div>

      <div className="gauge-target" style={{
        color: isOnTrack ? '#5A7A1C' : '#E32314',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {isOnTrack ? '✅' : '⚠️'}
        {isOnTrack ? 'Đúng lộ trình' : 'Chưa đạt'}
        {' '}({target.baseYear}→{target.targetYear})
      </div>

      <style jsx>{`
        @keyframes gaugeGrow {
          from {
            stroke-dasharray: 0 1000;
          }
        }
      `}</style>
    </div>
  );
}
