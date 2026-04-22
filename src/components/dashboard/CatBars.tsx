'use client';

import React from 'react';

interface CatRow {
    label: string;
    val: number;
    pct?: number;
}

type ColorKey = 's1' | 's2' | 's3';

interface CatBarsProps {
    rows: CatRow[];
    colorKey: ColorKey;
}

const colorMap: Record<ColorKey, string> = {
    s1: 'var(--ds-scope-1)',
    s2: 'var(--ds-scope-2)',
    s3: 'var(--ds-scope-3)',
};

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('vi-VN');
}

export default function CatBars({ rows, colorKey }: CatBarsProps) {
    const max = Math.max(...rows.map(r => r.val), 1);
    const color = colorMap[colorKey] || 'var(--ds-brand-500)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ds-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {r.label}
                            </span>
                            {r.pct != null && (
                                <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 11, color: 'var(--ds-ink-muted)' }}>{r.pct}%</span>
                            )}
                        </div>
                        <div style={{ height: 8, background: 'var(--ds-bg-inset)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${(r.val / max) * 100}%`,
                                background: color,
                                borderRadius: 999,
                                transition: 'width 600ms cubic-bezier(0.34,1.2,0.64,1)',
                            }} />
                        </div>
                    </div>
                    <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--ds-ink)', minWidth: 52, textAlign: 'right' }}>
                        {fmt(r.val)}
                    </div>
                </div>
            ))}
        </div>
    );
}
