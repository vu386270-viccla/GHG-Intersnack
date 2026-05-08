'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDashboardData, formatTCO2e, formatNumber, getScope3SummaryData } from '@/lib/data-service';
import { MONTHS_VI } from '@/lib/types';
import type { ScopeSummary, FactorySummary, MonthlyData, TargetProgress } from '@/lib/types';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import SkeletonDashboard from '@/components/layout/SkeletonDashboard';

// New premium dashboard components
import KPICard from '@/components/dashboard/KPICard';
import StackedAreaChart from '@/components/dashboard/StackedAreaChart';
import DonutChart from '@/components/dashboard/DonutChart';
import FactoryRow from '@/components/dashboard/FactoryRow';
import SBTIRow from '@/components/dashboard/SBTIRow';
import CatBars from '@/components/dashboard/CatBars';

// ── Factory abbreviation map ──
function factoryAbbr(name: string, country: string): string {
  if (country === 'India') return 'Tuti';
  const n = name.toLowerCase();
  if (n.includes('tây ninh') || (n.includes('ninh') && !n.includes('khánh'))) return 'TN';
  if (n.includes('phan thiết') || n.includes('phan thiet') || n.includes('thiết') || n.includes('thiet')) return 'PT';
  if (n.includes('long an')) return 'LA';
  if (n.includes('dĩ') || n.includes('di an') || n.includes('dỹ')) return 'DA';
  if (n.includes('nam m')) return 'NM';
  if (n.includes('tuti')) return 'Tuti';
  return name.split(' ').pop() ?? name;
}

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const showIntensity = searchParams.get('intensity') === '1';  // intensity mode toggle
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
      const s3Row = s3Data.rows.find(r => r.year === selectedYear) ?? s3Data.rows[s3Data.rows.length - 1];
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

  if (loading) return <SkeletonDashboard />;

  const s3Display = s3Annual?.total ?? 0;
  const correctedTotal = totals.s1 + totals.s2 + s3Display;
  const prevS12Total = scopeSummaries.reduce((s, sc) => sc.scope === 'scope_3' ? s : s + sc.previousYearEmissions, 0);
  const prevYearTotal = prevS12Total + s3PrevTotal;
  const changeVsPrev = prevYearTotal > 0 ? ((grandTotal - prevYearTotal) / prevYearTotal * 100) : 0;
  const s3IsEstimated = s3Annual != null && s3Annual.year !== selectedYear;

  const allRCN = selectedFactory === 'ALL' ? (rcnData?.totalRCN ?? 0) : (rcnByFactory[selectedFactory]?.totalRCN ?? 0);
  const intensity = allRCN > 0 ? correctedTotal / allRCN : 0;

  const sbtiS12 = targets.find(t => t.scope.includes('1'));
  const sbtiS3 = targets.find(t => t.scope.includes('3'));

  // chart data: transform monthly to ds chart format
  // In intensity mode, show tCO2e/MT RCN; otherwise absolute emissions
  const chartData = filteredMonthly.map(m => {
    const rcn = m.rcn || 0;
    const s1Int = rcn > 0 ? m.scope1 / rcn : 0;
    const s2Int = rcn > 0 ? m.scope2 / rcn : 0;
    const s3Int = rcn > 0 ? m.scope3 / rcn : 0;
    return {
      label: MONTHS_VI[m.month - 1]?.replace('Th0', 'T').replace('Th', 'T') ?? `M${m.month}`,
      s1: showIntensity ? Math.round(s1Int * 1000) / 1000 : m.scope1,
      s2: showIntensity ? Math.round(s2Int * 1000) / 1000 : m.scope2,
      s3: showIntensity ? Math.round(s3Int * 1000) / 1000 : m.scope3,
    };
  });

  const sparkAll = filteredMonthly.map(m => {
    const rcn = m.rcn || 0;
    return showIntensity && rcn > 0 ? (m.scope1 + m.scope2) / rcn : m.scope1 + m.scope2;
  });
  const sparkS1 = filteredMonthly.map(m => {
    const rcn = m.rcn || 0;
    return showIntensity && rcn > 0 ? m.scope1 / rcn : m.scope1;
  });
  const sparkS2 = filteredMonthly.map(m => {
    const rcn = m.rcn || 0;
    return showIntensity && rcn > 0 ? m.scope2 / rcn : m.scope2;
  });
  const sparkS3 = filteredMonthly.map(m => {
    const rcn = m.rcn || 0;
    return showIntensity && rcn > 0 ? m.scope3 / rcn : m.scope3;
  });

  // Donut
  const donutSegments = [
    { label: 'Scope 1', value: totals.s1, color: '#E32314' },
    { label: 'Scope 2', value: totals.s2, color: '#F5A623' },
    { label: 'Scope 3', value: s3Display, color: '#8CB92D' },
  ].filter(s => s.value > 0);

  // Scope 1 breakdown bars
  const s1Scope = scopeSummaries.find(s => s.scope === 'scope_1');
  const s1Bars = s1Scope?.categories.slice(0, 8).map(c => ({
    label: c.label,
    val: c.emissions,
    pct: c.percentOfScope,
  })) ?? [];

  // Scope 3 breakdown bars
  const s3Cats = s3Annual ? [
    { label: 'Cat.1 — Cashew', val: s3Annual.cat1, pct: s3Annual.total > 0 ? Math.round(s3Annual.cat1 / s3Annual.total * 100) : 0 },
    { label: 'Cat.3 — WTT', val: s3Annual.cat3, pct: s3Annual.total > 0 ? Math.round(s3Annual.cat3 / s3Annual.total * 100) : 0 },
    { label: 'Cat.4 — Transport', val: s3Annual.cat4, pct: s3Annual.total > 0 ? Math.round(s3Annual.cat4 / s3Annual.total * 100) : 0 },
  ].filter(c => c.val > 0) : [];

  const lastUpdatedFmt = lastUpdated
    ? new Date(lastUpdated).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const maxFacTotal = Math.max(...factorySummaries.map(fs => fs.scope1 + fs.scope2), 1);
  const s12Total = factorySummaries.reduce((s, f) => s + f.scope1 + f.scope2, 0);

  return (
    <div className="ds-page page-enter">

      {/* ── Baseline warning ── */}
      {baselineEstimated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, fontSize: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <span style={{ fontWeight: 700, color: '#92400e' }}>{t('baseline_warning_title')}</span>
            <span style={{ color: '#78350f', marginLeft: 6 }}>{t('baseline_warning_body')}</span>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="ds-page-hero">
        <div>
          <div className="ds-page-title">{t('overview')}</div>
          <div className="ds-page-sub">
            {t('scope1_label')} · {t('scope2_label')} · {t('scope3_label')} — {selectedYear}
            {lastUpdatedFmt && (
              <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--ds-ink-muted)', background: 'var(--ds-bg-inset)', padding: '2px 8px', borderRadius: 20 }}>
                {t('data_until')} {lastUpdatedFmt}
              </span>
            )}
          </div>
        </div>
        <div className="ds-filter-row">
          {/* Factory filter */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--ds-bg-inset)', border: '1px solid var(--ds-border)', borderRadius: 8, padding: 3 }}>
            <button className="ds-select" style={{ padding: '4px 10px', border: 'none', background: selectedFactory === 'ALL' ? 'var(--ds-brand-500)' : 'transparent', color: selectedFactory === 'ALL' ? '#fff' : 'var(--ds-ink-muted)', borderRadius: 5 }}
              onClick={() => setSelectedFactory('ALL')}>
              {t('all_factories')}
            </button>
            {factorySummaries.map(fs => (
              <button key={fs.factory.id} className="ds-select"
                style={{ padding: '4px 10px', border: 'none', background: selectedFactory === fs.factory.id ? 'var(--ds-brand-500)' : 'transparent', color: selectedFactory === fs.factory.id ? '#fff' : 'var(--ds-ink-muted)', borderRadius: 5, whiteSpace: 'nowrap' }}
                onClick={() => setSelectedFactory(selectedFactory === fs.factory.id ? 'ALL' : fs.factory.id)}>
                {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}
              </button>
            ))}
          </div>
          <select className="ds-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link href="/overview" className="ds-select" style={{ background: 'var(--ds-brand-500)', color: '#fff', border: 'none', textDecoration: 'none', padding: '7px 14px' }}>
            {t('ppt_view')}
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="ds-kpi-grid">
        <KPICard
          feature
          label={t('total_emissions') || `Tổng phát thải ${selectedYear}`}
          val={formatTCO2e(correctedTotal)}
          unit="tCO₂e"
          delta={parseFloat(Math.abs(changeVsPrev).toFixed(1))}
          deltaDir={changeVsPrev < 0 ? 'down' : 'up'}
          foot={t('vs_prev_year')}
          sparkData={sparkAll}
        />
        <KPICard
          label={t('scope1_label')}
          val={formatTCO2e(totals.s1)}
          unit="tCO₂e"
          delta={Math.abs(scopeSummaries.find(s => s.scope === 'scope_1')?.changePercent ?? 0)}
          deltaDir={(scopeSummaries.find(s => s.scope === 'scope_1')?.changePercent ?? 0) < 0 ? 'down' : 'up'}
          foot={`${correctedTotal > 0 ? Math.round(totals.s1 / correctedTotal * 100) : 0}% ${t('of_total')}`}
          sparkData={sparkS1}
          sparkColor="var(--ds-scope-1)"
        />
        <KPICard
          label={t('scope2_label')}
          val={formatTCO2e(totals.s2)}
          unit="tCO₂e"
          delta={Math.abs(scopeSummaries.find(s => s.scope === 'scope_2')?.changePercent ?? 0)}
          deltaDir={(scopeSummaries.find(s => s.scope === 'scope_2')?.changePercent ?? 0) < 0 ? 'down' : 'up'}
          foot={`${correctedTotal > 0 ? Math.round(totals.s2 / correctedTotal * 100) : 0}% ${t('of_total')}`}
          sparkData={sparkS2}
          sparkColor="var(--ds-scope-2)"
        />
        <KPICard
          label={`${t('scope3_label')}${s3IsEstimated ? ' (prev yr)' : ''}`}
          val={formatTCO2e(s3Display)}
          unit="tCO₂e"
          delta={Math.abs(scopeSummaries.find(s => s.scope === 'scope_3')?.changePercent ?? 0)}
          deltaDir={(scopeSummaries.find(s => s.scope === 'scope_3')?.changePercent ?? 0) < 0 ? 'down' : 'up'}
          foot={`${correctedTotal > 0 ? Math.round(s3Display / correctedTotal * 100) : 0}% ${t('of_total')}`}
          sparkData={sparkS3}
          sparkColor="var(--ds-scope-3)"
        />
      </div>

      {/* ── Main Chart + Donut ── */}
      <div className="ds-grid-main">
        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">{t('monthly_emissions')} {selectedYear}</div>
              <div className="ds-card__sub">
                {t('factory_comparison')} · {showIntensity ? 'tCO₂e/MT RCN' : 'tCO₂e'}
                {rcnData && rcnData.totalRCN > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                    {showIntensity ? `Intensity: ${rcnData.intensity.toFixed(3)}` : `Total RCN: ${formatNumber(rcnData.totalRCN)} MT`}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="ds-legend">
                {[['Scope 1', '#E32314'], ['Scope 2', '#F5A623']].map(([lbl, col]) => (
                  <div key={lbl} className="ds-legend__item">
                    <span className="ds-legend__swatch" style={{ background: col }} />
                    {lbl}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  if (showIntensity) {
                    url.searchParams.delete('intensity');
                  } else {
                    url.searchParams.set('intensity', '1');
                  }
                  window.history.pushState({}, '', url);
                  window.location.reload();
                }}
                style={{
                  padding: '4px 10px',
                  border: '1px solid var(--ds-border)',
                  borderRadius: 6,
                  background: 'var(--ds-bg-inset)',
                  color: 'var(--ds-ink-muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title={showIntensity ? 'Switch to absolute emissions' : 'Switch to intensity (tCO₂e/MT RCN)'}
              >
                {showIntensity ? '📊 Abs' : '📈 Intensity'}
              </button>
            </div>
          </div>
          <StackedAreaChart data={chartData} height={showIntensity ? 320 : 260} />
          {/* Data period indicator */}
          <div style={{
            padding: '6px 12px',
            background: '#f8fafc',
            borderTop: '1px solid var(--ds-border)',
            fontSize: 11,
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              <strong>Data:</strong> {(() => {
                const lastMonthWithData = [...monthlyTotals].reverse().find(m => (m.scope1 > 0 || m.scope2 > 0 || m.scope3 > 0));
                if (lastMonthWithData) {
                  return `Jan–${MONTHS_VI[lastMonthWithData.month - 1]} ${selectedYear}`;
                }
                return `Full year ${selectedYear}`;
              })()}
            </span>
            {rcnData && rcnData.totalRCN > 0 && (
              <span style={{ color: '#6366f1', fontWeight: 600 }}>
                {showIntensity ? 'Intensity mode (tCO₂e/MT RCN)' : `Total RCN: ${formatNumber(rcnData.totalRCN)} MT`}
              </span>
            )}
          </div>
        </div>

        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="ds-card__hd" style={{ width: '100%' }}>
            <div>
              <div className="ds-card__title">{t('scope') || 'Tỷ trọng'}</div>
              <div className="ds-card__sub">YTD {selectedYear}</div>
            </div>
          </div>
          <DonutChart
            segments={donutSegments}
            centerLabel="tCO₂e · TỔNG"
            centerVal={formatNumber(correctedTotal)}
          />
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {donutSegments.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px dashed var(--ds-border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 12, color: 'var(--ds-ink-muted)' }}>{correctedTotal > 0 ? Math.round(s.value / correctedTotal * 100) : 0}%</span>
                  <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 13, fontWeight: 500 }}>{formatNumber(s.value)}</span>
                </div>
              </div>
            ))}
            {allRCN > 0 && (
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <div style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 18, fontWeight: 500, color: '#6366f1' }}>{intensity.toFixed(3)}</div>
                <div style={{ fontSize: 10, color: 'var(--ds-ink-muted)' }}>tCO₂e/MT RCN</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SBTi + Factories + Categories ── */}
      <div className="ds-grid-3">
        {/* SBTi Card */}
        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">{t('sbti_targets_link') || 'Tiến độ SBTi'}</div>
              <div className="ds-card__sub">1.5°C aligned · Base 2021</div>
            </div>
            <span className="ds-chip ds-chip--ok">
              <span className="ds-chip__dot" />
              Approved
            </span>
          </div>
          {sbtiS12 && <SBTIRow target={sbtiS12} selectedYear={selectedYear} />}
          {sbtiS3 && <SBTIRow target={sbtiS3} selectedYear={selectedYear} />}
          <div className="ds-sbti-foot">
            <span>BASE 2021</span><span>{selectedYear}</span><span>TARGET 2032</span>
          </div>
        </div>

        {/* Factory breakdown */}
        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">{t('factory_comparison')}</div>
              <div className="ds-card__sub">4 {t('factories') || 'nhà máy'} · xếp theo tổng phát thải</div>
            </div>
            <Link href="/factories" style={{ fontSize: 11, color: 'var(--ds-brand-500)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--ds-border)', borderRadius: 6 }}>
              {t('view_detail')} →
            </Link>
          </div>
          {factorySummaries.sort((a, b) => (b.scope1 + b.scope2) - (a.scope1 + a.scope2)).map(fs => (
            <FactoryRow
              key={fs.factory.id}
              fs={fs}
              totalEmissions={s12Total}
              maxTotal={maxFacTotal}
              isSelected={selectedFactory === fs.factory.id}
              onClick={() => setSelectedFactory(selectedFactory === fs.factory.id ? 'ALL' : fs.factory.id)}
            />
          ))}
        </div>

        {/* Intensity + quick links */}
        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">{t('reference_ef') || 'Liên kết nhanh'}</div>
              <div className="ds-card__sub">Khám phá chi tiết theo module</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { href: '/scope-1', icon: '🔥', label: t('scope1_detail'), color: '#E32314' },
              { href: '/scope-2', icon: '⚡', label: t('scope2_detail'), color: '#F5A623' },
              { href: '/scope-3', icon: '🌍', label: t('scope3_detail'), color: '#8CB92D' },
              { href: '/targets', icon: '🎯', label: t('sbti_targets_link'), color: '#6366f1' },
              { href: '/factories', icon: '🏭', label: t('factory_compare'), color: '#0ea5e9' },
              { href: '/opex-report', icon: '📋', label: t('opex_report'), color: '#8b5cf6' },
              { href: '/reference', icon: '📖', label: t('reference_ef'), color: '#6b7280' },
            ].map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--ds-bg-inset)', color: link.color, fontWeight: 600, fontSize: 12.5, transition: 'background 120ms' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--ds-border-soft)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'var(--ds-bg-inset)')}>
                  {link.icon} {link.label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scope 1 breakdown + Scope 3 breakdown ── */}
      <div className="ds-grid-2">
        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">🔥 Scope 1 — {t('scope1_label')}</div>
              <div className="ds-card__sub">{formatTCO2e(totals.s1)} tCO₂e · {selectedYear}</div>
            </div>
            <Link href="/scope-1" style={{ fontSize: 11, color: 'var(--ds-brand-500)', fontWeight: 600, textDecoration: 'none' }}>{t('view_detail')} →</Link>
          </div>
          <CatBars rows={s1Bars} colorKey="s1" />
        </div>

        <div className="ds-card">
          <div className="ds-card__hd">
            <div>
              <div className="ds-card__title">🌍 Scope 3 — {t('scope3_label')}</div>
              <div className="ds-card__sub">{formatTCO2e(s3Display)} tCO₂e{s3IsEstimated ? ` (${s3Annual?.year})` : ` · ${selectedYear}`}</div>
            </div>
            <Link href="/scope-3" style={{ fontSize: 11, color: '#8CB92D', fontWeight: 600, textDecoration: 'none' }}>{t('view_detail')} →</Link>
          </div>
          <CatBars rows={s3Cats} colorKey="s3" />
          {s3Cats.length > 0 && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--ds-bg-inset)', borderRadius: 8, fontSize: 11.5, color: 'var(--ds-ink-muted)' }}>
              <strong style={{ color: 'var(--ds-ink)' }}>Lưu ý SBTi:</strong>{' '}
              Cat.1 (Purchased Goods) chiếm {s3Cats[0]?.pct ?? 0}% — cần thiết lập cam kết SBTi với top 80% nhà cung ứng trước 2030.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
