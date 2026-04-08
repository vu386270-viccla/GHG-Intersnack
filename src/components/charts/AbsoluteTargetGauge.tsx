'use client';

interface AbsoluteTargetGaugeProps {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  size?: number;
}

export default function AbsoluteTargetGauge({ label, actual, target, unit = 'tấn', size = 180 }: AbsoluteTargetGaugeProps) {
  const thickness = 14;
  const radius = (size - thickness * 2) / 2;
  const center = size / 2;

  // Semi-circle: use 180 degrees (PI)
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalAngle = Math.PI;

  // Cap progress at 100% of target for drawing
  const maxDisplay = target * 1.5; // Let the gauge scale up to 150% of target
  const displayRatio = maxDisplay > 0 ? Math.min(actual / maxDisplay, 1) : 0;
  
  const targetRatio = maxDisplay > 0 ? target / maxDisplay : 0;
  const targetAngle = totalAngle * targetRatio;

  const actualAngle = totalAngle * displayRatio;

  const arcPath = (startA: number, endA: number, r: number) => {
    const sx = center + r * Math.cos(startA);
    const sy = center - r * Math.sin(startA);
    const ex = center + r * Math.cos(endA);
    const ey = center - r * Math.sin(endA);
    const largeArc = Math.abs(endA - startA) > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  const isExceeded = actual > target;
  const progressColor = isExceeded ? '#E32314' : '#27AE60'; // Red if exceeded, Green if within target

  return (
    <div className="gauge-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={arcPath(startAngle, endAngle, radius)}
          fill="none"
          stroke="#E0DFDB"
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* Progress arc (Actual) */}
        <path
          d={arcPath(startAngle, startAngle - actualAngle, radius)}
          fill="none"
          stroke={progressColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          style={{ transition: 'all 1s ease' }}
        />

        {/* Target limit marker */}
        <path
          d={arcPath(startAngle - targetAngle + 0.05, startAngle - targetAngle - 0.05, radius + 4)}
          fill="none"
          stroke="#333"
          strokeWidth={thickness + 8}
          strokeLinecap="butt"
          opacity={0.3}
        />

        {/* Center value */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize="30"
          fontFamily="inherit"
          fontWeight="700"
          fill={progressColor}
        >
          {Math.round(actual).toLocaleString('vi-VN')}
        </text>

        {/* Unit & Target label */}
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize="11"
          fontFamily="inherit"
          fill="#888"
        >
          Mục tiêu: {target} {unit}
        </text>
      </svg>

      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <strong style={{ fontSize: '14px', color: '#333' }}>{label}</strong>
      </div>

      <div style={{
        marginTop: '6px',
        fontSize: '12px',
        fontWeight: 600,
        color: isExceeded ? '#E32314' : '#27AE60',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {isExceeded ? '⚠️ Vượt mục tiêu' : '✅ Đạt mục tiêu'}
      </div>
    </div>
  );
}
