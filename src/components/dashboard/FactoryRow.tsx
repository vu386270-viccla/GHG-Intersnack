'use client';

import React from 'react';
import type { FactorySummary } from '@/lib/types';

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('vi-VN');
}

interface FactoryRowProps {
    fs: FactorySummary;
    totalEmissions: number;
    maxTotal: number;
    isSelected?: boolean;
    onClick?: () => void;
}

export default function FactoryRow({ fs, totalEmissions, isSelected, onClick }: FactoryRowProps) {
    const total = fs.scope1 + fs.scope2;
    const pct = (v: number) => total > 0 ? (v / total) * 100 : 0;
    const pctOfAll = totalEmissions > 0 ? Math.round((total / totalEmissions) * 100) : 0;

    // Factory color by country
    const color = fs.factory.country === 'India' ? '#0ea5e9' : 'var(--ds-brand-500)';
    const flag = fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳';

    return (
        <div
            className={`ds-factory-row${isSelected ? ' ds-factory-row--selected' : ''}`}
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            <div style={{ minWidth: 0 }}>
                <div className="ds-factory-row__head">
                    <span className="ds-factory-dot" style={{ background: color }} />
                    <span className="ds-factory-name">{flag} {fs.factory.name}</span>
                    <span className="ds-factory-loc">{fs.factory.location} · {fs.factory.country}</span>
                </div>
                <div className="ds-factory-bar">
                    <span style={{ width: `${pct(fs.scope1)}%`, background: 'var(--ds-scope-1)' }} />
                    <span style={{ width: `${pct(fs.scope2)}%`, background: 'var(--ds-scope-2)' }} />
                </div>
            </div>
            <div className="ds-factory-total">
                {fmt(total)}
                <small>tCO₂e · {pctOfAll}%</small>
            </div>
        </div>
    );
}
