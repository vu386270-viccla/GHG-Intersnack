'use client';

import React, { useState } from 'react';

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('vi-VN');
}

interface Segment {
    label: string;
    value: number;
    color: string;
}

interface DonutChartProps {
    segments: Segment[];
    size?: number;
    stroke?: number;
    centerLabel?: string;
    centerVal?: string;
}

export default function DonutChart({ segments, size = 180, stroke = 22, centerLabel, centerVal }: DonutChartProps) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0);

    let acc = 0;
    const arcs = segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * c;
        const gap = c - dash;
        const rot = (acc / total) * 360 - 90;
        acc += s.value;
        return { ...s, dash, gap, rot, i };
    });

    const show = hoverIdx != null ? arcs[hoverIdx] : null;

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <g transform={`translate(${size / 2}, ${size / 2})`}>
                    {arcs.map(a => (
                        <circle
                            key={a.i}
                            r={r}
                            fill="none"
                            stroke={a.color}
                            strokeWidth={hoverIdx === a.i ? stroke + 4 : stroke}
                            strokeDasharray={`${a.dash} ${a.gap}`}
                            transform={`rotate(${a.rot})`}
                            style={{ transition: 'stroke-width 150ms', cursor: 'pointer' }}
                            onMouseEnter={() => setHoverIdx(a.i)}
                            onMouseLeave={() => setHoverIdx(null)}
                        />
                    ))}
                </g>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                    fontSize="22" fontWeight="500" fill="var(--ds-ink)" fontFamily="var(--ds-font-mono)" dy="-4">
                    {show ? fmt(show.value) : centerVal}
                </text>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fill="var(--ds-ink-muted)" letterSpacing="1.2" dy="16"
                    style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                    {show ? show.label : centerLabel}
                </text>
            </svg>
        </div>
    );
}
