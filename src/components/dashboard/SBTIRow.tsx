'use client';

import React from 'react';
import type { TargetProgress } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

function fmt(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('vi-VN');
}

interface SBTIRowProps {
    target: TargetProgress;
    selectedYear: number;
}

export default function SBTIRow({ target: t, selectedYear }: SBTIRowProps) {
    const { t: i18n } = useI18n();
    const reducedPct = t.baseYearEmissions > 0
        ? Math.round(((t.baseYearEmissions - t.currentEmissions) / t.baseYearEmissions) * 100)
        : 0;
    const progressPct = Math.max(0, Math.min(100, (reducedPct / t.reductionTargetPct) * 100));

    const totalYears = t.targetYear - t.baseYear;
    const yearsElapsed = Math.max(0, selectedYear - t.baseYear);
    const requiredPct = t.reductionTargetPct * (yearsElapsed / totalYears);
    const onTrack = reducedPct >= requiredPct && selectedYear > t.baseYear && selectedYear < new Date().getFullYear();

    return (
        <div className="ds-sbti-row">
            <div className="ds-sbti-row__hd">
                <div>
                    <span className="ds-sbti-name">{t.scope.includes('3') ? '🌍 Scope 3' : '🏭 Scope 1+2'}</span>
                    <span className="ds-sbti-sub">· {t.scope.includes('3') ? 'Chuỗi giá trị' : 'Vận hành'}</span>
                </div>
                <div className="ds-sbti-pct">
                    {reducedPct}%<small>/ {t.reductionTargetPct}%</small>
                </div>
            </div>
            <div className="ds-sbti-track">
                <div className="ds-sbti-track__fill" style={{ width: `${progressPct}%` }} />
                <div className="ds-sbti-marker" data-label={`${t.reductionTargetPct}% · ${t.targetYear}`} style={{ left: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--ds-ink-muted)' }}>
                <span style={{ fontFamily: 'var(--ds-font-mono)' }}>Base {t.baseYear}: {fmt(t.baseYearEmissions)}</span>
                <span style={{ fontFamily: 'var(--ds-font-mono)' }}>Hiện tại: <strong style={{ color: 'var(--ds-ink)' }}>{fmt(t.currentEmissions)}</strong></span>
                <span style={{ fontFamily: 'var(--ds-font-mono)' }}>Mục tiêu: {fmt(t.targetEmissions)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
                <span className={`ds-chip ds-chip--${onTrack ? 'ok' : 'warn'}`}>
                    <span className="ds-chip__dot" />
                    {selectedYear <= t.baseYear ? '📌 Baseline' : selectedYear >= new Date().getFullYear() ? '⏳ YTD' : onTrack ? i18n('on_track') : i18n('behind')}
                </span>
            </div>
        </div>
    );
}
