'use client';

import React, { useRef, useState } from 'react';

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    if (n < 10) return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return Math.round(n).toString();
}

interface DataPoint {
    label: string;
    s1: number;
    s2: number;
    s3?: number;
}

interface StackedAreaChartProps {
    data: DataPoint[];
    height?: number;
    showS3?: boolean;
}

const COLORS = {
    s1: '#E32314',
    s2: '#F5A623',
    s3: '#8CB92D',
};
const LABELS = { s1: 'Scope 1', s2: 'Scope 2', s3: 'Scope 3' };

export default function StackedAreaChart({ data, height = 260, showS3 = false }: StackedAreaChartProps) {
    const [hover, setHover] = useState<{ idx: number } | null>(null);
    const ref = useRef<SVGSVGElement>(null);

    const keys: Array<'s1' | 's2' | 's3'> = showS3 ? ['s1', 's2', 's3'] : ['s1', 's2'];
    const pad = { t: 14, r: 14, b: 26, l: 44 };
    const w = 700;
    const h = height;
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const totals = data.map(d => keys.reduce((a, k) => a + (d[k] ?? 0), 0));
    const rawMax = Math.max(...totals) * 1.1;

    // Adaptive Y-axis scaling: for small values (intensity < 10), use decimal steps; for large values, use 1000-step
    let niceMax: number;
    if (rawMax < 10) {
      // Intensity mode: round to 1 decimal place (e.g., 0.3, 0.4, 0.5)
      niceMax = Math.ceil(rawMax * 10) / 10;
      // Ensure minimum 0.1 to avoid zero scale
      niceMax = Math.max(0.1, niceMax);
    } else {
      // Absolute emissions: use 1000-step rounding
      niceMax = Math.max(1000, Math.ceil((rawMax || 1000) / 1000) * 1000);
    }

    const xStep = data.length > 1 ? iw / (data.length - 1) : iw;
    const xAt = (i: number) => pad.l + i * xStep;
    const yAt = (v: number) => pad.t + ih - (v / niceMax) * ih;

    // Build stacked paths
    type StackPath = { k: string; fill: string; path: string; linePath: string };
    const stackPaths: StackPath[] = [];
    const stackBase = new Array(data.length).fill(0);

    keys.forEach(k => {
        const top = data.map((d, j) => stackBase[j] + (d[k] ?? 0));
        const topPts = top.map((v, j) => [xAt(j), yAt(v)]);
        const botPts = stackBase.map((_, j) => [xAt(j), yAt(stackBase[j])]);
        const path = `M ${topPts.map(p => p.join(',')).join(' L ')} L ${[...botPts].reverse().map(p => p.join(',')).join(' L ')} Z`;
        const linePath = `M ${topPts.map(p => p.join(',')).join(' L ')}`;
        stackPaths.push({ k, fill: COLORS[k], path, linePath });
        top.forEach((v, j) => { stackBase[j] = v; });
    });

    const yTicks: number[] = rawMax < 10
      ? Array.from({ length: 5 }, (_, i) => Number((niceMax * i / 4).toFixed(2)))
      : Array.from({ length: 5 }, (_, i) => Math.round(niceMax * i / 4));

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * w;
        const i = Math.round((x - pad.l) / (xStep || 1));
        if (i >= 0 && i < data.length) setHover({ idx: i });
    };

    return (
        <div className="ds-chart-wrap" onMouseLeave={() => setHover(null)} onMouseMove={onMove} style={{ position: 'relative' }}>
            <svg ref={ref} viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }}>
                {yTicks.map((t, i) => (
                    <React.Fragment key={i}>
                        <line x1={pad.l} x2={w - pad.r} y1={yAt(t)} y2={yAt(t)} stroke="var(--ds-border-soft)" strokeWidth="1" />
                        <text x={pad.l - 8} y={yAt(t) + 4} fontSize="10.5" fill="var(--ds-ink-muted)" textAnchor="end" fontFamily="var(--ds-font-mono)">{fmt(t)}</text>
                    </React.Fragment>
                ))}

                {stackPaths.map(s => (
                    <path key={s.k} d={s.path} fill={s.fill} opacity="0.82" />
                ))}
                {stackPaths.map(s => (
                    <path key={s.k + 'ln'} d={s.linePath} fill="none" stroke={s.fill} strokeWidth="1.5" />
                ))}

                {data.map((d, i) => (
                    <text key={i} x={xAt(i)} y={h - 8} fontSize="10.5" fill="var(--ds-ink-muted)" textAnchor="middle" fontFamily="var(--ds-font-mono)">{d.label}</text>
                ))}

                {hover && (
                    <>
                        <line x1={xAt(hover.idx)} x2={xAt(hover.idx)} y1={pad.t} y2={h - pad.b}
                            stroke="var(--ds-ink-muted)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                        {keys.map((k, i) => {
                            let cum = 0;
                            for (let j = 0; j <= i; j++) cum += (data[hover.idx][keys[j]] ?? 0);
                            return <circle key={k} cx={xAt(hover.idx)} cy={yAt(cum)} r="4" fill="#fff" stroke={COLORS[k]} strokeWidth="2" />;
                        })}
                    </>
                )}
            </svg>

            {hover && (
                <div className="ds-chart-tt ds-chart-tt--on" style={{ left: `${(xAt(hover.idx) / w) * 100}%`, top: pad.t + 10 }}>
                    <div className="ds-chart-tt__hd">2025 · {data[hover.idx].label}</div>
                    {keys.map(k => (
                        <div className="ds-chart-tt__row" key={k}>
                            <span className="ds-chart-tt__lbl">
                                <span className="ds-chart-tt__sw" style={{ background: COLORS[k] }} />
                                {LABELS[k]}
                            </span>
                            <span className="ds-chart-tt__val">{fmt(data[hover.idx][k] ?? 0)}</span>
                        </div>
                    ))}
                    <div className="ds-chart-tt__row" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                        <span className="ds-chart-tt__lbl">Tổng</span>
                        <span className="ds-chart-tt__val">{fmt(keys.reduce((a, k) => a + (data[hover.idx][k] ?? 0), 0))} tCO₂e</span>
                    </div>
                </div>
            )}
        </div>
    );
}
