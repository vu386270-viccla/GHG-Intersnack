'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e, formatNumber, getScope3SummaryData } from '@/lib/data-service';
import { SCOPE_COLORS, MONTHS_VI } from '@/lib/types';
import type { ScopeSummary, FactorySummary, MonthlyData, TargetProgress } from '@/lib/types';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

type ScopeFilter = 'ALL' | 'scope_1' | 'scope_2' | 'scope_3';

const S_COLOR = { scope_1: '#E32314', scope_2: '#F5A623', scope_3: '#8CB92D' };

function getScopeVal(m: MonthlyData, scope: ScopeFilter): number {
  if (scope === 'scope_1') return m.scope1;
  if (scope === 'scope_2') return m.scope2;
  if (scope === 'scope_3') return m.scope3;
  return m.total;
}

/* ── Mini Stacked Bar Chart (inline SVG) ── */
function MiniStackedBar({ monthly, height = 80 }: { monthly: MonthlyData[]; height?: number }) {
  const active = monthly.filter(m => m.total > 0);
  if (active.length === 0) return <div style={{ height }} />;
  const maxV = Math.max(...active.map(m => m.total)) * 1.1;
  const W = 100, H = height, barW = Math.max(2, (W - 4) / active.length - 2), gap = (W - 4) / active.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      {active.map((m, i) => {
        const x = 2 + i * gap;
        const h1 = (m.scope1 / maxV) * (H - 4);
        const h2 = (m.scope2 / maxV) * (H - 4);
        return (
          <g key={m.month}>
            <rect x={x} y={H - 2 - h1} width={barW} height={Math.max(h1, 0.5)} fill={S_COLOR.scope_1} opacity={0.8} rx={1} />
            <rect x={x} y={H - 2 - h1 - h2} width={barW} height={Math.max(h2, 0.5)} fill={S_COLOR.scope_2} opacity={0.85} rx={1} />
            <text x={x + barW / 2} y={H - 1} textAnchor="middle" fontSize={5.5} fill="#aaa">{MONTHS_VI[m.month - 1]?.slice(0, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Scope Donut (SVG) ── */
function ScopeDonut({ s1, s2, s3, size = 100 }: { s1: number; s2: number; s3: number; size?: number }) {
  const total = s1 + s2 + s3;
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.36, thick = size * 0.13;
  const circ = 2 * Math.PI * r;
  const segs = [
    { val: s1, col: S_COLOR.scope_1 },
    { val: s2, col: S_COLOR.scope_2 },
    { val: s3, col: S_COLOR.scope_3 },
  ].filter(s => s.val > 0);
  let cum = -90;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      {segs.map((seg, i) => {
        const pct = seg.val / total;
        const dash = pct * circ;
        const rot = cum; cum += pct * 360;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.col} strokeWidth={thick}
            strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(${rot} ${cx} ${cy})`} />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={size * 0.1} fontWeight={700} fill="#333">
        {total > 0 ? `${Math.round(s1 / total * 100)}%` : ''}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={size * 0.08} fill="#999">S1</text>
    </svg>
  );
}

/* ── SBTi Progress Card — year-aware, 3 modes ── */
function SBTiProgressCard({ label, icon, targetPct, current, base, color, selectedYear, isFactoryFiltered, t, breakdown, footer }:
  { label: string; icon: string; targetPct: number; current: number; base: number; color: string; selectedYear: number; isFactoryFiltered?: boolean; t: (k: string) => string; breakdown?: { name: string; value: number; pct: number }[]; footer?: React.ReactNode }
) {
  const BASELINE_YEAR = 2021;
  const TARGET_YEAR = 2032;
  const totalYears = TARGET_YEAR - BASELINE_YEAR; // 11 years
  const targetVal = Math.round(base * (1 - targetPct / 100));
  const reducedPct = base > 0 ? Math.max(0, (base - current) / base * 100) : 0;

  // ── mode detection ──
  const isPreBaseline  = selectedYear < BASELINE_YEAR;
  const isBaselineYear = selectedYear === BASELINE_YEAR;
  const yearsElapsed   = Math.max(0, selectedYear - BASELINE_YEAR);
  const requiredPctNow = targetPct * (yearsElapsed / totalYears); // linear interpolation
  const onTrack        = !isPreBaseline && reducedPct >= requiredPctNow;

  // ── badge ──
  let badge: React.ReactNode;
  if (isPreBaseline) {
    badge = (
      <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>
        📂 Historical
      </div>
    );
  } else if (isBaselineYear) {
    badge = (
      <div style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#eff6ff', color: '#1d4ed8' }}>
        📌 Baseline Year
      </div>
    );
  } else {
    badge = (
      <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20,
        background: onTrack ? '#dcfce7' : '#fee2e2',
        color: onTrack ? '#166534' : '#991b1b'
      }}>
        {onTrack ? t('on_track') : t('behind')}
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, background: isPreBaseline ? '#fafafa' : 'var(--color-card-bg)',
      border: `1.5px solid ${isPreBaseline ? '#e5e7eb' : color + '22'}`, borderRadius: 14,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      borderLeft: `5px solid ${isPreBaseline ? '#d1d5db' : color}`,
      opacity: isPreBaseline ? 0.85 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: isPreBaseline ? '#6b7280' : color, letterSpacing: '0.3px' }}>{icon} {label}</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Target 2032: −{targetPct}% vs 2021 {t('baseline').toLowerCase()}</div>
        </div>
        {badge}
      </div>

      {/* Pre-baseline notice */}
      {isPreBaseline && (
        <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, borderLeft: '3px solid #94a3b8' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 2 }}>📅 Pre-Baseline Reference Data ({selectedYear})</div>
          <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>
            SBTi baseline is locked to <strong>2021</strong>. Data from {selectedYear} is shown for historical comparison only — On Track / Behind tracking starts from 2022 onwards.
          </div>
        </div>
      )}

      {/* Key metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            {t('baseline')} {BASELINE_YEAR}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isBaselineYear ? '#1d4ed8' : '#555', marginTop: 2 }}>
            {formatTCO2e(base)}
          </div>
          {isBaselineYear && (
            <div style={{ fontSize: 8, color: '#1d4ed8', fontWeight: 600, marginTop: 1 }}>← This year</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
            {selectedYear === new Date().getFullYear() ? t('current') : isPreBaseline ? '📂 Actual' : 'Actual'} {selectedYear}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2,
            color: isPreBaseline ? '#6b7280' : isBaselineYear ? '#1d4ed8' : onTrack ? color : '#ef4444'
          }}>
            {formatTCO2e(current)}
          </div>
          {isPreBaseline && (
            <div style={{ fontSize: 8, color: '#9ca3af', marginTop: 1 }}>
              {current > base ? `${((current - base) / base * 100).toFixed(1)}% above baseline` : `${((base - current) / base * 100).toFixed(1)}% below baseline`}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 9, color, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{t('target_2032')}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isPreBaseline ? '#9ca3af' : color, marginTop: 2 }}>
            {formatTCO2e(targetVal)}
          </div>
        </div>
      </div>

      {/* Progress bar — only meaningful for post-baseline years */}
      {!isPreBaseline && !isBaselineYear && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: onTrack ? color : '#ef4444' }}>
              {reducedPct.toFixed(1)}% {t('reduced_so_far')}
            </span>
            <span style={{ fontSize: 10, color: '#aaa' }}>
              {t('need_to_reduce')}: {targetPct}%
            </span>
          </div>
          <div style={{ position: 'relative', height: 10, background: '#f3f4f6', borderRadius: 6, overflow: 'visible' }}>
            {/* Actual progress */}
            <div style={{
              height: '100%', width: `${Math.min(reducedPct / targetPct * 100, 100)}%`,
              background: onTrack ? color : '#ef4444', borderRadius: 6, transition: 'width 0.6s ease', opacity: 0.85,
            }} />
            {/* Linear benchmark marker */}
            <div style={{
              position: 'absolute', left: `${Math.min(requiredPctNow / targetPct * 100, 100)}%`, top: -3,
              width: 2, height: 16, background: '#666', borderRadius: 1,
            }} />
            <div style={{
              position: 'absolute', left: `${Math.min(requiredPctNow / targetPct * 100, 100)}%`, top: -16,
              fontSize: 8, color: '#666', fontWeight: 700, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            }}>
              {requiredPctNow.toFixed(0)}%
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#ccc', marginTop: 2 }}>
            <span>0%</span>
            <span>−{targetPct}% target</span>
          </div>
        </div>
      )}

      {/* Baseline year: show a simple reference bar */}
      {isBaselineYear && (
        <div>
          <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, marginBottom: 4 }}>
            📌 This is the SBTi baseline year. All future tracking is measured from this point.
          </div>
          <div style={{ height: 6, background: '#dbeafe', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', background: '#93c5fd', borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 8, color: '#93c5fd', marginTop: 2 }}>Target: reach {formatTCO2e(targetVal)} by 2032</div>
        </div>
      )}

      {/* Explanation footnote — only for active tracking years */}
      {!isPreBaseline && !isBaselineYear && (
        <div style={{ fontSize: 9, color: '#aaa', lineHeight: 1.5, borderTop: '1px solid #f5f5f5', paddingTop: 8 }}>
          📐 {t('track_explain')}
          <br/>
          <span style={{ fontWeight: 600 }}>│</span> = {t('linear_benchmark')} {selectedYear}: −{requiredPctNow.toFixed(1)}% {t('target_vs_baseline')}
        </div>
      )}

      {/* S3 factory-filter note */}
      {isFactoryFiltered && (
        <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, background: '#fffbeb', padding: '4px 8px', borderRadius: 6 }}>
          {t('scope3_combined')}
        </div>
      )}

      {/* Breakdown rows */}
      {breakdown && breakdown.length > 0 && (
        <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {breakdown.map(b => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
              <span style={{ color: '#aaa', width: 100, flexShrink: 0 }}>{b.name}</span>
              <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.pct}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
              </div>
              <span style={{ color, fontWeight: 700, width: 38, textAlign: 'right', flexShrink: 0 }}>{formatNumber(b.value)}</span>
            </div>
          ))}
        </div>
      )}
      {footer && <div style={{ marginTop: 2 }}>{footer}</div>}
    </div>
  );
}


// ── Factory abbreviation map ──
function factoryAbbr(name: string, country: string): string {
  if (country === 'India') return 'Tuti';
  const n = name.toLowerCase();
  // order matters — more specific first
  if (n.includes('tây ninh') || (n.includes('ninh') && !n.includes('khánh'))) return 'TN';
  if (n.includes('phan thiết') || n.includes('phan thiet') || n.includes('thiết') || n.includes('thiet')) return 'PT';
  if (n.includes('long an')) return 'LA';
  if (n.includes('dĩ') || n.includes('di an') || n.includes('dỹ')) return 'DA';
  if (n.includes('nam m')) return 'NM';
  if (n.includes('tuti')) return 'Tuti';
  // fallback: capitalised last word
  return name.split(' ').pop() ?? name;
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [scopeSummaries, setScopeSummaries] = useState<ScopeSummary[]>([]);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyData[]>([]);
  const [targets, setTargets] = useState<TargetProgress[]>([]);
  const [rcnData, setRcnData] = useState<{ totalRCN: number; totalCK: number; intensity: number; monthlyIntensity: number[] } | null>(null);
  const [rcnByFactory, setRcnByFactory] = useState<Record<string, { totalRCN: number; totalCK: number; monthlyRCN: number[] }>>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [s3Annual, setS3Annual] = useState<{ year: number; total: number; cat1: number; cat3: number; cat4: number } | null>(null);
  const [s3PrevTotal, setS3PrevTotal] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [baselineEstimated, setBaselineEstimated] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedFactory('ALL');
    Promise.all([
      getDashboardData(selectedYear),
      getScope3SummaryData(),
    ]).then(([data, s3Data]) => {
      setGrandTotal(data.grandTotal);
      setScopeSummaries(data.scopeSummaries);
      setFactorySummaries(data.factorySummaries);
      setMonthlyTotals(data.monthlyTotals);
      setTargets(data.targets);
      setRcnData(data.rcnData);
      setRcnByFactory(data.rcnByFactory);
      setLastUpdated(data.lastUpdated ?? null);
      setBaselineEstimated(data.baselineEstimated ?? false);
      // Pick S3 for selected year, fallback to most recent year with data
      const s3Row = s3Data.rows.find(r => r.year === selectedYear)
        ?? s3Data.rows[s3Data.rows.length - 1];
      if (s3Row) {
        setS3Annual({ year: s3Row.year, total: s3Row.total, cat1: s3Row.cat1_cashew, cat3: s3Row.cat3_wtt, cat4: s3Row.cat4_vessel + s3Row.cat4_road });
      }
      const s3PrevRow = s3Data.rows.find(r => r.year === selectedYear - 1);
      setS3PrevTotal(s3PrevRow?.total ?? 0);
      setLoading(false);
    });
  }, [selectedYear]);

  const filteredFS = useMemo(
    () => selectedFactory === 'ALL' ? factorySummaries : factorySummaries.filter(fs => fs.factory.id === selectedFactory),
    [factorySummaries, selectedFactory],
  );

  const filteredMonthly = useMemo((): MonthlyData[] =>
    Array.from({ length: 12 }, (_, i) => {
      const s1 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope1, 0);
      const s2 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope2, 0);
      const s3 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope3, 0);
      return { month: i + 1, label: MONTHS_VI[i], scope1: s1, scope2: s2, scope3: s3, total: s1 + s2 + s3 };
    }),
    [filteredFS],
  );

  const totals = useMemo(() => {
    const s1 = filteredFS.reduce((s, fs) => s + fs.scope1, 0);
    const s2 = filteredFS.reduce((s, fs) => s + fs.scope2, 0);
    const s3 = filteredFS.reduce((s, fs) => s + fs.scope3, 0);
    return { s1, s2, s3, total: s1 + s2 + s3 };
  }, [filteredFS]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: 12 }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>{t('loading')}</span>
    </div>
  );

  const prevS12Total = scopeSummaries.reduce((s, sc) => sc.scope === 'scope_3' ? s : s + sc.previousYearEmissions, 0);
  const prevYearTotal = prevS12Total + s3PrevTotal;
  const changeVsPrev = prevYearTotal > 0 ? ((grandTotal - prevYearTotal) / prevYearTotal * 100) : 0;
  const sbtiS12 = targets.find(t => t.scope.includes('1'));
  const sbtiS3  = targets.find(t => t.scope.includes('3'));
  const activeMonths = filteredMonthly.filter(m => m.total > 0).length;
  const monthLabel = `${activeMonths} ${t('months_of')} ${selectedYear}`;
  // per-factory RCN
  const allRCN = selectedFactory === 'ALL' ? (rcnData?.totalRCN ?? 0) : (rcnByFactory[selectedFactory]?.totalRCN ?? 0);
  // S3: use real annual data from scope3_transport_data
  const s3Display = s3Annual?.total ?? 0;
  // correctedTotal: S1+S2 from factory rows + real computed S3 (company-wide)
  const correctedTotal = totals.s1 + totals.s2 + s3Display;
  const intensity = allRCN > 0 ? correctedTotal / allRCN : 0;
  const s3IsEstimated = s3Annual != null && s3Annual.year !== selectedYear;
  const s3Cats = s3Annual ? [
    { category: 'cat1', label: 'Cat.1 — Cashew', emissions: s3Annual.cat1, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat1 / s3Annual.total * 100) : 0 },
    { category: 'cat3', label: 'Cat.3 — WTT', emissions: s3Annual.cat3, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat3 / s3Annual.total * 100) : 0 },
    { category: 'cat4', label: `Cat.4 — ${t('cat4_transport')}`, emissions: s3Annual.cat4, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat4 / s3Annual.total * 100) : 0 },
  ].filter(c => c.emissions > 0) : [];
  // Max total across factories (for bar scaling)
  const maxFacTotal = Math.max(...factorySummaries.map(fs => fs.totalEmissions), 1);
  const isFactoryFiltered = selectedFactory !== 'ALL';

  // Format last-updated timestamp
  const lastUpdatedFmt = lastUpdated
    ? new Date(lastUpdated).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Baseline estimated warning ── */}
      {baselineEstimated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, fontSize: 12 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: '#92400e' }}>{t('baseline_warning_title')}</span>
            <span style={{ color: '#78350f', marginLeft: 6 }}>{t('baseline_warning_body')}</span>
          </div>
        </div>
      )}

      {/* ══ ROW 0: Header + Filters ══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('overview')}
            {lastUpdatedFmt && (
              <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: 20, letterSpacing: 0 }}>
                {t('data_until')} {lastUpdatedFmt}
              </span>
            )}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.1, color: 'var(--color-text)' }}>
            {formatTCO2e(correctedTotal)}
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 6 }}>tCO₂e</span>
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 10,
              color: changeVsPrev < 0 ? '#22c55e' : '#ef4444',
              background: changeVsPrev < 0 ? '#dcfce7' : '#fee2e2',
              padding: '2px 8px', borderRadius: 20 }}>
              {changeVsPrev < 0 ? '↓' : '↑'} {Math.abs(changeVsPrev).toFixed(1)}% {t('vs_prev_year')}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{monthLabel}</div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Factory buttons */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => setSelectedFactory('ALL')}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: selectedFactory === 'ALL' ? 'var(--color-primary)' : 'transparent',
                color: selectedFactory === 'ALL' ? '#fff' : 'var(--color-text-muted)',
              }}>{t('all_factories')}</button>
            {factorySummaries.map(fs => (
              <button key={fs.factory.id}
                onClick={() => setSelectedFactory(selectedFactory === fs.factory.id ? 'ALL' : fs.factory.id)}
                style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: selectedFactory === fs.factory.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedFactory === fs.factory.id ? '#fff' : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}
              </button>
            ))}
          </div>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link href="/overview" style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {t('ppt_view')}
          </Link>
        </div>
      </div>

      {/* ══ SBTi TARGETS ROW (MOVED TO TOP) ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {sbtiS12 && (
          <SBTiProgressCard
            label={t('sbti_s12')}
            icon="🏭"
            targetPct={50}
            current={isFactoryFiltered
              ? totals.s1 + totals.s2  // scoped to selected factory
              : sbtiS12.currentEmissions}
            base={sbtiS12.baseYearEmissions}
            color="#E32314"
            selectedYear={selectedYear}
            t={t}
            footer={<Link href="/targets" style={{ fontSize: 9, color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>SBTi #40003759 →</Link>}
          />
        )}
        {sbtiS3 && (
          <SBTiProgressCard
            label={t('sbti_s3')}
            icon="🌍"
            targetPct={30}
            current={s3Display > 0 ? s3Display : sbtiS3.currentEmissions}
            base={sbtiS3.baseYearEmissions}
            color="#8CB92D"
            selectedYear={selectedYear}
            isFactoryFiltered={isFactoryFiltered}
            t={t}
            breakdown={s3Cats.map(c => ({ name: c.label.split('—').pop()?.trim() ?? c.label, value: c.emissions, pct: c.percentOfScope }))}
            footer={s3IsEstimated ? <span style={{ fontSize: 9, color: '#aaa' }}>{t('nearest_year_s3')}</span> : undefined}
          />
        )}
      </div>

      {/* ══ ROW 1: 3 Scope KPIs + Donut ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 140px', gap: 10 }}>

        {/* Scope 1 */}
        <Link href="/scope-1" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_1}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_1, marginBottom: 4 }}>🔥 {t('scope1_label')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--color-text)' }}>
              {formatTCO2e(totals.s1)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ fontWeight: 700, color: S_COLOR.scope_1 }}>{correctedTotal > 0 ? Math.round(totals.s1 / correctedTotal * 100) : 0}% {t('of_total')}</span>
              {scopeSummaries.find(s => s.scope === 'scope_1') && (
                <span style={{ color: scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent < 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent < 0 ? '↓' : '↑'}
                  {Math.abs(scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${correctedTotal > 0 ? totals.s1 / correctedTotal * 100 : 0}%`, background: S_COLOR.scope_1, borderRadius: 2 }} />
            </div>
          </div>
        </Link>

        {/* Scope 2 */}
        <Link href="/scope-2" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_2}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_2, marginBottom: 4 }}>⚡ {t('scope2_label')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--color-text)' }}>
              {formatTCO2e(totals.s2)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ fontWeight: 700, color: S_COLOR.scope_2 }}>{correctedTotal > 0 ? Math.round(totals.s2 / correctedTotal * 100) : 0}% {t('of_total')}</span>
              {scopeSummaries.find(s => s.scope === 'scope_2') && (
                <span style={{ color: scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent < 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent < 0 ? '↓' : '↑'}
                  {Math.abs(scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${correctedTotal > 0 ? totals.s2 / correctedTotal * 100 : 0}%`, background: S_COLOR.scope_2, borderRadius: 2 }} />
            </div>
          </div>
        </Link>

        {/* Scope 3 — richer with categories */}
        <Link href="/scope-3" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_3}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_3, marginBottom: 4 }}>
              🌍 {t('scope3_label')}
              {s3IsEstimated && <span style={{ fontWeight: 500, color: '#bbb', marginLeft: 4 }}>{t('prev_year')}</span>}
              <span style={{ fontWeight: 400, fontSize: 9, color: '#bbb', marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>{t('annual_not_per_factory')}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: s3IsEstimated ? '#aaa' : 'var(--color-text)' }}>
              {formatTCO2e(s3Display)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            {/* Category breakdown */}
            {s3Cats.length > 0 ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {s3Cats.slice(0, 3).map(cat => (
                  <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#888' }}>
                    <div style={{ height: 3, width: `${cat.percentOfScope}%`, minWidth: 4, background: S_COLOR.scope_3, borderRadius: 2, opacity: 0.6 + cat.percentOfScope / 200 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{cat.label.split('—').pop()?.trim()}</span>
                    <span style={{ color: S_COLOR.scope_3, fontWeight: 700, marginLeft: 'auto', flexShrink: 0 }}>{formatNumber(cat.emissions)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 9, color: '#bbb' }}>Cat.1 {t('cat1_materials')} · Cat.3 WTT · Cat.4 {t('cat4_transport')}</div>
            )}
            {/* Factory filter note for S3 */}
            {isFactoryFiltered && (
              <div style={{ marginTop: 4, fontSize: 8, color: '#f59e0b', fontWeight: 600, background: '#fffbeb', padding: '2px 6px', borderRadius: 4 }}>
                ⚠ {t('scope3_combined')}
              </div>
            )}
          </div>
        </Link>

        {/* Donut + Intensity compact */}
        <div className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ScopeDonut s1={totals.s1} s2={totals.s2} s3={s3Display} size={90} />
          <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', lineHeight: 1.6 }}>
            <span style={{ color: S_COLOR.scope_1, fontWeight: 700 }}>●</span> S1&nbsp;
            <span style={{ color: S_COLOR.scope_2, fontWeight: 700 }}>●</span> S2&nbsp;
            <span style={{ color: S_COLOR.scope_3, fontWeight: 700 }}>●</span> S3
          </div>
          {allRCN > 0 && (
            <div style={{ borderTop: '1px solid #f0f0f0', width: '100%', paddingTop: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#6366f1' }}>{intensity.toFixed(3)}</div>
              <div style={{ fontSize: 8, color: '#aaa' }}>tCO₂e/MT RCN</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 2: Monthly Chart + Factory Table ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, minHeight: 0 }}>

        {/* Monthly Stacked Bar */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{t('monthly_emissions')} {selectedYear}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888', alignItems: 'center' }}>
              {[['S1', S_COLOR.scope_1], ['S2', S_COLOR.scope_2]].map(([lbl, col]) => (
                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, background: col as string, borderRadius: 2, display: 'inline-block' }} />{lbl}
                </span>
              ))}
              <span style={{ fontSize: 9, color: '#bbb', marginLeft: 4 }}>{t('s3_see_kpi')}</span>
            </div>
          </div>
          <MiniStackedBar monthly={filteredMonthly} height={110} />
        </div>

        {/* Factory Comparison Table */}
        <div className="card" style={{ padding: '12px 16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{t('factory_comparison')}</div>
            <Link href="/factories" style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>{t('view_detail')}</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #f0f0f0' }}>
                {[t('factory'), 'S1', 'S2', 'Total', 'tCO₂e/MT'].map(h => (
                  <th key={h} style={{ textAlign: h === t('factory') ? 'left' : 'right', padding: '3px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factorySummaries.map((fs, i) => {
                const fb = rcnByFactory[fs.factory.id];
                const fIntensity = fb && fb.totalRCN > 0 ? (fs.totalEmissions / fb.totalRCN).toFixed(3) : '—';
                const isSelected = selectedFactory === fs.factory.id;
                return (
                  <tr key={fs.factory.id}
                    onClick={() => setSelectedFactory(isSelected ? 'ALL' : fs.factory.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #fafafa', background: isSelected ? '#fff7f7' : i % 2 === 0 ? 'transparent' : '#fafafa' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 22, background: fs.totalEmissions > 0 ? 'var(--color-primary)' : '#eee', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                        <span>{fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_1, fontWeight: 600 }}>{formatNumber(fs.scope1)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_2, fontWeight: 600 }}>{formatNumber(fs.scope2)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 800, color: 'var(--color-text)' }}>{formatNumber(fs.scope1 + fs.scope2)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: '#6366f1', fontWeight: 700 }}>{fIntensity}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop: '1.5px solid #eee', background: '#f8f8f8' }}>
                <td style={{ padding: '5px 6px', fontWeight: 800, fontSize: 11 }}>{t('total_label')}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_1, fontWeight: 800 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope1, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_2, fontWeight: 800 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope2, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 900 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope1 + f.scope2, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: '#6366f1', fontWeight: 800 }}>
                  {allRCN > 0 ? (factorySummaries.reduce((s, f) => s + f.scope1 + f.scope2, 0) / allRCN).toFixed(3) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ ROW 3: Factory mini-bars (visual share) ══ */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{t('factory_distribution')}</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>Stacked: S1 · S2 · S3 (tCO₂e)</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {factorySummaries.map(fs => {
            const s12 = fs.scope1 + fs.scope2;
            const maxS12 = Math.max(...factorySummaries.map(f => f.scope1 + f.scope2), 1);
            const pct = s12 / maxS12 * 100;
            const s1Pct = s12 > 0 ? fs.scope1 / s12 * pct : 0;
            const s2Pct = s12 > 0 ? fs.scope2 / s12 * pct : 0;
            const isSelected = selectedFactory === fs.factory.id;
            return (
              <div key={fs.factory.id}
                onClick={() => setSelectedFactory(isSelected ? 'ALL' : fs.factory.id)}
                style={{ cursor: 'pointer', opacity: selectedFactory !== 'ALL' && !isSelected ? 0.35 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, fontSize: 11, fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}
                  </div>
                  <div style={{ flex: 1, height: 18, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s1Pct}%`, background: S_COLOR.scope_1, transition: 'width 0.5s' }} />
                    <div style={{ position: 'absolute', left: `${s1Pct}%`, top: 0, height: '100%', width: `${s2Pct}%`, background: S_COLOR.scope_2, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 800, textAlign: 'right', color: 'var(--color-text)', flexShrink: 0 }}>
                    {formatNumber(s12)} t
                  </div>
                  <div style={{ width: 34, fontSize: 10, color: '#aaa', textAlign: 'right', flexShrink: 0 }}>
                    {Math.round(pct)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ROW 4: Quick Links ══ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { href: '/scope-1', icon: '🔥', label: t('scope1_detail'), color: S_COLOR.scope_1 },
          { href: '/scope-2', icon: '⚡', label: t('scope2_detail'), color: S_COLOR.scope_2 },
          { href: '/scope-3', icon: '🌍', label: t('scope3_detail'), color: S_COLOR.scope_3 },
          { href: '/targets', icon: '🎯', label: t('sbti_targets_link'), color: '#6366f1' },
          { href: '/factories', icon: '🏭', label: t('factory_compare'), color: '#0ea5e9' },
          { href: '/opex-report', icon: '📋', label: t('opex_report'), color: '#8b5cf6' },
          { href: '/reference', icon: '📖', label: t('reference_ef'), color: '#6b7280' },
        ].map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: 'var(--color-card-bg)', border: `1.5px solid ${link.color}22`,
              borderRadius: 10, fontSize: 12, fontWeight: 700, color: link.color,
              transition: 'all 0.15s', cursor: 'pointer',
            }}>
              {link.icon} {link.label}
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
