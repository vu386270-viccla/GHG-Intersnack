'use client';

import React from 'react';

interface SparklineProps {
    values: number[];
    color?: string;
    fill?: string;
}

function Sparkline({ values, color = '#fff', fill = 'none' }: SparklineProps) {
    const width = 85, height = 38;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => [
        (i / (values.length - 1)) * width,
        height - ((v - min) / range) * height * 0.9 - height * 0.05,
    ]);
    const d = `M ${pts.map(p => p.join(',')).join(' L ')}`;
    const area = `${d} L ${width},${height} L 0,${height} Z`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {fill !== 'none' && <path d={area} fill={fill} />}
            <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
        </svg>
    );
}

interface KPICardProps {
    label: string;
    val: string;
    unit?: string;
    delta?: number;
    deltaDir?: 'down' | 'up';
    foot?: string;
    feature?: boolean;
    sparkData?: number[];
    sparkColor?: string;
}

export default function KPICard({ label, val, unit, delta, deltaDir = 'down', foot, feature, sparkData, sparkColor }: KPICardProps) {
    return (
        <div className={`ds-kpi${feature ? ' ds-kpi--feature' : ''}`}>
            <div className="ds-kpi__label">{label}</div>
            <div className="ds-kpi__val">
                {val}
                {unit && <span className="ds-kpi__unit">{unit}</span>}
            </div>
            <div className="ds-kpi__foot">
                {delta != null && (
                    <span className={`ds-kpi__delta ds-kpi__delta--${deltaDir}`}>
                        {deltaDir === 'down' ? '↓' : '↑'} {Math.abs(delta)}%
                    </span>
                )}
                {foot && <span>{foot}</span>}
            </div>
            {sparkData && (
                <div className="ds-kpi__spark">
                    <Sparkline
                        values={sparkData}
                        color={sparkColor || (feature ? '#fff' : 'var(--ds-brand-500)')}
                        fill={feature ? 'rgba(255,255,255,0.15)' : 'var(--ds-brand-100)'}
                    />
                </div>
            )}
        </div>
    );
}
