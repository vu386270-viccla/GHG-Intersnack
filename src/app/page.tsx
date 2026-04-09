'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_COLORS, MONTHS_VI } from '@/lib/types';
import type { ScopeSummary, FactorySummary, MonthlyData, TargetProgress } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import TrendLine from '@/components/charts/TrendLine';
import TargetGauge from '@/components/charts/TargetGauge';
import AbsoluteTargetGauge from '@/components/charts/AbsoluteTargetGauge';
import Link from 'next/link';

type ScopeFilter = 'ALL' | 'scope_1' | 'scope_2' | 'scope_3';

const SCOPE_LABEL: Record<ScopeFilter, string> = {
  ALL: 'Tất cả', scope_1: 'Scope 1', scope_2: 'Scope 2', scope_3: 'Scope 3',
};
const SCOPE_PILL_COLOR: Record<ScopeFilter, string> = {
  ALL: '#555',
  scope_1: SCOPE_COLORS.scope_1,
  scope_2: SCOPE_COLORS.scope_2,
  scope_3: SCOPE_COLORS.scope_3,
};

function getScopeVal(m: MonthlyData, scope: ScopeFilter): number {
  if (scope === 'scope_1') return m.scope1;
  if (scope === 'scope_2') return m.scope2;
  if (scope === 'scope_3') return m.scope3;
  return m.total;
}

export default function DashboardPage() {
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
  const [selectedScope, setSelectedScope] = useState<ScopeFilter>('ALL');

  useEffect(() => {
    setLoading(true);
    setSelectedFactory('ALL');
    setSelectedScope('ALL');
    getDashboardData(selectedYear).then(data => {
      setGrandTotal(data.grandTotal);
      setScopeSummaries(data.scopeSummaries);
      setFactorySummaries(data.factorySummaries);
      setMonthlyTotals(data.monthlyTotals);
      setTargets(data.targets);
      setRcnData(data.rcnData);
      setRcnByFactory(data.rcnByFactory);
      setLoading(false);
    });
  }, [selectedYear]);

  // ── Filtered factory set ──
  const filteredFS = useMemo(
    () => selectedFactory === 'ALL' ? factorySummaries : factorySummaries.filter(fs => fs.factory.id === selectedFactory),
    [factorySummaries, selectedFactory],
  );

  // ── Re-aggregate monthly totals for the filtered factory set ──
  const filteredMonthly = useMemo((): MonthlyData[] =>
    Array.from({ length: 12 }, (_, i) => {
      const s1 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope1, 0);
      const s2 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope2, 0);
      const s3 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope3, 0);
      return { month: i + 1, label: MONTHS_VI[i], scope1: s1, scope2: s2, scope3: s3, total: s1 + s2 + s3 };
    }),
    [filteredFS],
  );

  // ── Filtered totals (factory filter + scope filter) ──
  const filteredTotals = useMemo(() => {
    const s1 = filteredFS.reduce((s, fs) => s + fs.scope1, 0);
    const s2 = filteredFS.reduce((s, fs) => s + fs.scope2, 0);
    const s3 = filteredFS.reduce((s, fs) => s + fs.scope3, 0);
    const total = s1 + s2 + s3;
    const scopeVal = getScopeVal({ month: 0, label: '', scope1: s1, scope2: s2, scope3: s3, total }, selectedScope);
    return { s1, s2, s3, total, scopeVal };
  }, [filteredFS, selectedScope]);

  // ── RCN intensity for the current filter combination ──
  const computedRCN = useMemo(() => {
    let baseRCN: { totalRCN: number; totalCK: number; monthlyRCN: number[] } | null = null;

    if (selectedFactory === 'ALL') {
      if (!rcnData || rcnData.totalRCN === 0) return null;
      // Aggregate monthly RCN across all factories
      const monthlyRCN = Array.from({ length: 12 }, (_, i) =>
        Object.values(rcnByFactory).reduce((s, fb) => s + (fb.monthlyRCN[i] || 0), 0),
      );
      baseRCN = { totalRCN: rcnData.totalRCN, totalCK: rcnData.totalCK, monthlyRCN };
    } else {
      const fb = rcnByFactory[selectedFactory];
      if (!fb || fb.totalRCN === 0) return null;
      baseRCN = fb;
    }

    if (!baseRCN || baseRCN.totalRCN === 0) return null;

    const mIntensity = filteredMonthly.map((m, i) => {
      const mRCN = baseRCN!.monthlyRCN[i];
      const mEmit = getScopeVal(m, selectedScope);
      return mRCN > 0 ? Math.round((mEmit / mRCN) * 1000) / 1000 : 0;
    });

    return {
      totalRCN: baseRCN.totalRCN,
      totalCK: baseRCN.totalCK,
      intensity: Math.round((filteredTotals.scopeVal / baseRCN.totalRCN) * 1000) / 1000,
      monthlyIntensity: mIntensity,
    };
  }, [selectedFactory, selectedScope, rcnData, rcnByFactory, filteredMonthly, filteredTotals]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
        <div className="loading-spinner" />
        <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu từ Supabase...</span>
      </div>
    );
  }

  const prevYearTotal = scopeSummaries.reduce((s, sc) => s + sc.previousYearEmissions, 0);
  const changeVsPrev = prevYearTotal > 0 ? Math.round(((grandTotal - prevYearTotal) / prevYearTotal) * 1000) / 10 : 0;

  const activeFactoryName = factorySummaries.find(f => f.factory.id === selectedFactory)?.factory.name;
  const heroLabel = selectedFactory === 'ALL'
    ? `Tổng phát thải ${selectedYear}${selectedScope !== 'ALL' ? ` · ${SCOPE_LABEL[selectedScope]}` : ' (YTD)'}`
    : `${activeFactoryName} — ${selectedYear}${selectedScope !== 'ALL' ? ` · ${SCOPE_LABEL[selectedScope]}` : ''}`;

  // ── Chart data ──
  const barData = filteredMonthly
    .filter(m => getScopeVal(m, selectedScope) > 0)
    .map(m => ({
      label: m.label,
      values: selectedScope === 'ALL'
        ? [
            { key: 'scope_1', value: m.scope1, color: SCOPE_COLORS.scope_1 },
            { key: 'scope_2', value: m.scope2, color: SCOPE_COLORS.scope_2 },
            { key: 'scope_3', value: m.scope3, color: SCOPE_COLORS.scope_3 },
          ]
        : [{ key: selectedScope, value: getScopeVal(m, selectedScope), color: SCOPE_COLORS[selectedScope] }],
    }));

  const barLegend = selectedScope === 'ALL'
    ? { scope_1: 'Scope 1', scope_2: 'Scope 2', scope_3: 'Scope 3' }
    : { [selectedScope]: SCOPE_LABEL[selectedScope] };

  const trendData = filteredMonthly
    .filter(m => m.total > 0)
    .map(m => ({
      label: m.label,
      values: selectedScope === 'ALL'
        ? [
            { key: 'scope_1', value: m.scope1, color: SCOPE_COLORS.scope_1 },
            { key: 'scope_2', value: m.scope2, color: SCOPE_COLORS.scope_2 },
            { key: 'scope_3', value: m.scope3, color: SCOPE_COLORS.scope_3 },
          ]
        : [{ key: selectedScope, value: getScopeVal(m, selectedScope), color: SCOPE_COLORS[selectedScope] }],
    }));

  const trendLegend = selectedScope === 'ALL'
    ? { scope_1: 'Scope 1 — Trực tiếp', scope_2: 'Scope 2 — Điện', scope_3: 'Scope 3 — Chuỗi giá trị' }
    : { [selectedScope]: SCOPE_LABEL[selectedScope] };

  const donutSegments = [
    { label: 'Scope 1', value: filteredTotals.s1, color: SCOPE_COLORS.scope_1 },
    { label: 'Scope 2', value: filteredTotals.s2, color: SCOPE_COLORS.scope_2 },
    { label: 'Scope 3', value: filteredTotals.s3, color: SCOPE_COLORS.scope_3 },
  ].filter(s => s.value > 0);

  const donutCenter = filteredTotals.total > 0
    ? `${Math.round((filteredTotals.s1 / filteredTotals.total) * 100)}%`
    : '0%';

  const isFiltered = selectedFactory !== 'ALL' || selectedScope !== 'ALL';

  return (
    <div>
      {/* ── Hero KPI ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {heroLabel}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '64px', fontWeight: 700, lineHeight: 1,
              color: selectedScope !== 'ALL' ? SCOPE_COLORS[selectedScope] : 'var(--color-text)',
            }}>
              {formatTCO2e(filteredTotals.scopeVal)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '18px', color: 'var(--color-text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                tCO₂e
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {!isFiltered && (
              <div className={`card-change ${changeVsPrev < 0 ? 'positive' : 'negative'}`}>
                {changeVsPrev < 0 ? '↓' : '↑'} {Math.abs(changeVsPrev)}% vs năm trước
              </div>
            )}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-body)', fontSize: '14px', cursor: 'pointer',
                background: 'var(--color-card-bg)', color: 'var(--color-text)',
              }}
            >
              {[2026, 2025, 2024, 2023, 2022, 2021].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '10px 16px', background: 'var(--color-card-bg)',
          border: `1px solid ${isFiltered ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: '10px', marginBottom: 'var(--space-xl)',
          transition: 'border-color 0.2s',
        }}>
          {/* Factory dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>🏭 Nhà máy</span>
            <select
              value={selectedFactory}
              onChange={e => setSelectedFactory(e.target.value)}
              style={{
                padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-body)', fontSize: '13px', cursor: 'pointer',
                background: selectedFactory !== 'ALL' ? 'var(--color-primary)' : 'var(--color-card-bg)',
                color: selectedFactory !== 'ALL' ? '#fff' : 'var(--color-text)',
                fontWeight: selectedFactory !== 'ALL' ? 600 : 400,
              }}
            >
              <option value="ALL">Tất cả nhà máy</option>
              {factorySummaries.map(fs => (
                <option key={fs.factory.id} value={fs.factory.id}>
                  {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

          {/* Scope pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>📊 Phạm vi</span>
            {(['ALL', 'scope_1', 'scope_2', 'scope_3'] as ScopeFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setSelectedScope(s)}
                style={{
                  padding: '4px 12px', borderRadius: '20px',
                  border: `1.5px solid ${selectedScope === s ? SCOPE_PILL_COLOR[s] : 'var(--color-border)'}`,
                  fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: selectedScope === s ? SCOPE_PILL_COLOR[s] : 'transparent',
                  color: selectedScope === s ? '#fff' : 'var(--color-text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'ALL' ? 'Tất cả' : s === 'scope_1' ? '🔥 S1' : s === 'scope_2' ? '⚡ S2' : '🌍 S3'}
              </button>
            ))}
          </div>

          {isFiltered && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />
              <button
                onClick={() => { setSelectedFactory('ALL'); setSelectedScope('ALL'); }}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-body)', fontSize: '12px', cursor: 'pointer',
                  background: 'transparent', color: 'var(--color-text-muted)',
                }}
              >
                ✕ Xóa bộ lọc
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Scope Cards ── */}
      <div className="grid-3 stagger-children mb-xl">
        {scopeSummaries.map((scope) => {
          const scopeTotal = scope.scope === 'scope_1' ? filteredTotals.s1
            : scope.scope === 'scope_2' ? filteredTotals.s2 : filteredTotals.s3;
          const isActiveScope = selectedScope === scope.scope;
          return (
            <Link key={scope.scope} href={`/${scope.scope.replace('_', '-')}`}>
              <div
                className={`card scope-card ${scope.scope.replace('_', '-')} animate-fade-in-up`}
                style={{
                  outline: isActiveScope ? `2.5px solid ${SCOPE_COLORS[scope.scope]}` : 'none',
                  outlineOffset: '2px',
                  opacity: selectedScope !== 'ALL' && !isActiveScope ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <div className="scope-card-icon">
                  {scope.scope === 'scope_1' ? '🔥' : scope.scope === 'scope_2' ? '⚡' : '🌍'}
                </div>
                <div className="card-title">
                  {scope.scope === 'scope_1' ? 'Scope 1 — Trực tiếp' :
                   scope.scope === 'scope_2' ? 'Scope 2 — Năng lượng' : 'Scope 3 — Chuỗi giá trị'}
                </div>
                <div className="card-value">
                  {formatTCO2e(scopeTotal)}
                  <span className="card-value-unit">tCO₂e</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-md)' }}>
                  <div className="scope-card-pct" style={{ color: SCOPE_COLORS[scope.scope] }}>
                    {filteredTotals.total > 0 ? Math.round((scopeTotal / filteredTotals.total) * 100) : 0}%
                  </div>
                  {selectedFactory === 'ALL' && (
                    <div className={`card-change ${scope.changePercent < 0 ? 'positive' : 'negative'}`}>
                      {scope.changePercent < 0 ? '↓' : '↑'} {Math.abs(scope.changePercent)}%
                    </div>
                  )}
                </div>
                <div className="factory-card-bar" style={{ marginTop: 'var(--space-md)' }}>
                  {scope.categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="factory-card-bar-segment"
                      style={{
                        width: `${cat.percentOfScope}%`,
                        background: SCOPE_COLORS[scope.scope],
                        opacity: 0.4 + (cat.percentOfScope / 100) * 0.6,
                      }}
                    />
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid-2-1 mb-xl">
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phát thải theo tháng</div>
            <div className="header-badge" style={{ color: selectedScope !== 'ALL' ? SCOPE_COLORS[selectedScope] : undefined }}>
              📊 {selectedScope !== 'ALL' ? SCOPE_LABEL[selectedScope] : 'tCO₂e'}
            </div>
          </div>
          <BarChart data={barData} legendLabels={barLegend} height={300} />
        </div>

        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phân bổ phát thải</div>
            {selectedFactory !== 'ALL' && (
              <div className="header-badge" style={{ fontSize: '11px' }}>{activeFactoryName}</div>
            )}
          </div>
          <DonutChart
            segments={donutSegments}
            size={200}
            centerValue={donutCenter}
            centerLabel="Scope 1"
          />
        </div>
      </div>

      {/* ── Factory Comparison ── */}
      <div className="section mb-xl">
        <div className="section-header">
          <div className="section-title">So sánh nhà máy</div>
          <Link href="/factories" className="btn btn-outline" style={{ fontSize: '13px' }}>Xem chi tiết →</Link>
        </div>
        <div className="grid-4 stagger-children">
          {factorySummaries.map((fs) => {
            const isSelected = selectedFactory === fs.factory.id;
            const displayVal = selectedScope === 'ALL' ? fs.totalEmissions
              : selectedScope === 'scope_1' ? fs.scope1
              : selectedScope === 'scope_2' ? fs.scope2 : fs.scope3;
            const fb = rcnByFactory[fs.factory.id];
            const facIntensity = fb && fb.totalRCN > 0 ? displayVal / fb.totalRCN : null;
            return (
              <div
                key={fs.factory.id}
                className="card factory-card animate-fade-in-up"
                onClick={() => setSelectedFactory(isSelected ? 'ALL' : fs.factory.id)}
                style={{
                  cursor: 'pointer',
                  outline: isSelected ? `2.5px solid ${SCOPE_PILL_COLOR[selectedScope]}` : 'none',
                  outlineOffset: '2px',
                  opacity: selectedFactory !== 'ALL' && !isSelected ? 0.4 : 1,
                  transition: 'opacity 0.2s, outline 0.15s',
                }}
              >
                <div className="factory-card-header">
                  <div className="factory-card-icon">{fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}</div>
                  <div>
                    <div className="factory-card-name">{fs.factory.name}</div>
                    <div className="factory-card-location">{fs.factory.location}</div>
                  </div>
                </div>
                <div className="factory-card-emissions" style={{ color: selectedScope !== 'ALL' ? SCOPE_COLORS[selectedScope] : undefined }}>
                  {formatTCO2e(displayVal)}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
                </div>
                {fs.totalEmissions > 0 && (
                  <>
                    <div className="factory-card-bar">
                      <div className="factory-card-bar-segment" style={{ width: `${(fs.scope1 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_1 }} />
                      <div className="factory-card-bar-segment" style={{ width: `${(fs.scope2 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_2 }} />
                      <div className="factory-card-bar-segment" style={{ width: `${(fs.scope3 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_3 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <span style={{ fontWeight: selectedScope === 'scope_1' ? 700 : 400, color: selectedScope === 'scope_1' ? SCOPE_COLORS.scope_1 : undefined }}>S1: {formatNumber(fs.scope1)}</span>
                      <span style={{ fontWeight: selectedScope === 'scope_2' ? 700 : 400, color: selectedScope === 'scope_2' ? SCOPE_COLORS.scope_2 : undefined }}>S2: {formatNumber(fs.scope2)}</span>
                      <span style={{ fontWeight: selectedScope === 'scope_3' ? 700 : 400, color: selectedScope === 'scope_3' ? SCOPE_COLORS.scope_3 : undefined }}>S3: {formatNumber(fs.scope3)}</span>
                    </div>
                  </>
                )}
                {/* RCN intensity per factory */}
                {facIntensity !== null && (
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--color-border)', fontSize: '11px' }}>
                    <span style={{ fontWeight: 700, color: '#6366F1' }}>
                      {facIntensity.toFixed(3)} tCO₂e/MT RCN
                    </span>
                    {fb && <span style={{ marginLeft: '5px', color: 'var(--color-text-muted)' }}>({formatNumber(fb.totalRCN)} MT)</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RCN Emission Intensity ── */}
      {computedRCN && computedRCN.totalRCN > 0 && (
        <div className="section mb-xl">
          <div className="section-header">
            <div className="section-title">
              Cường độ phát thải theo RCN
              {selectedFactory !== 'ALL' && (
                <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                  — {activeFactoryName}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {selectedScope !== 'ALL' && (
                <div style={{ padding: '3px 10px', borderRadius: '6px', background: SCOPE_COLORS[selectedScope], color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                  {SCOPE_LABEL[selectedScope]}
                </div>
              )}
              <div className="header-badge" style={{ background: '#6366F1', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                tCO₂e / MT RCN
              </div>
            </div>
          </div>
          <div className="grid-3 stagger-children mb-lg">
            <div className="card animate-fade-in-up">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                🥜 Nguyên liệu RCN
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                {formatTCO2e(computedRCN.totalRCN)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>MT</span>
              </div>
            </div>
            <div className="card animate-fade-in-up">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                📦 Sản phẩm CK
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                {formatTCO2e(computedRCN.totalCK)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>MT</span>
              </div>
            </div>
            <div className="card animate-fade-in-up" style={{ borderLeft: '4px solid #6366F1' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                📊 Cường độ phát thải
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: '#6366F1', lineHeight: 1 }}>
                {computedRCN.intensity.toFixed(3)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>tCO₂e / MT RCN</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {formatTCO2e(filteredTotals.scopeVal)} tCO₂e ÷ {formatTCO2e(computedRCN.totalRCN)} MT
                {selectedScope !== 'ALL' && <span style={{ color: SCOPE_COLORS[selectedScope], fontWeight: 600 }}> · {SCOPE_LABEL[selectedScope]}</span>}
              </div>
            </div>
          </div>
          <div className="card animate-fade-in-up">
            <div className="card-header">
              <div className="card-title">Xu hướng cường độ phát thải theo tháng</div>
              <div className="header-badge">tCO₂e / MT RCN</div>
            </div>
            <TrendLine
              data={filteredMonthly
                .map((m, i) => ({ label: m.label, values: [{ key: 'intensity', value: computedRCN.monthlyIntensity[i], color: '#6366F1' }] }))
                .filter(d => d.values[0].value > 0)}
              legendLabels={{ intensity: 'Cường độ (tCO₂e / MT RCN)' }}
              height={220}
            />
          </div>
        </div>
      )}

      {/* ── SBTi Targets ── */}
      <div className="section mb-xl">
        <div className="section-header">
          <div className="section-title">
            Tiến độ mục tiêu giảm phát thải <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--color-primary)' }}>SBTi</span>
          </div>
          <Link href="/targets" className="btn btn-outline" style={{ fontSize: '13px' }}>Chi tiết →</Link>
        </div>
        <div className="grid-2 stagger-children">
          {targets.map((target) => (
            <div key={target.scope} className="card animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <TargetGauge target={target} />
              <div style={{ display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-md)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-text)', fontWeight: 700 }}>
                    {formatTCO2e(target.baseYearEmissions)}
                  </div>
                  <div>Năm gốc ({target.baseYear})</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {formatTCO2e(target.currentEmissions)}
                  </div>
                  <div>Hiện tại ({selectedYear})</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#8CB92D', fontWeight: 700 }}>
                    {formatTCO2e(target.targetEmissions)}
                  </div>
                  <div>Mục tiêu ({target.targetYear})</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Targets (Only 2026) ── */}
      {selectedYear === 2026 && (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            Mục tiêu Phát thải Tuyệt đối <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--color-primary)' }}>({selectedYear})</span>
          </div>
        </div>
        
        {(() => {
          // Monthly KPI targets (per month, NOT annual)
          const kpiData = [
            { key: 'LA', label: 'Long An', monthlyTarget: 265 },
            { key: 'TN', label: 'Tây Ninh', monthlyTarget: 304 },
            { key: 'PT', label: 'Phan Thiết', monthlyTarget: 223 },
            { key: 'Tuti', label: 'Tuticorin', monthlyTarget: 334 },
          ];

          // Compute actuals + count months with data for each factory
          const kpisWithActual = kpiData.map(kpi => {
            const fs = factorySummaries.find(f => 
              f.factory.name.includes(kpi.label) || 
              (kpi.key === 'LA' && f.factory.name.includes('Long An')) ||
              (kpi.key === 'TN' && f.factory.name.includes('Tây Ninh')) ||
              (kpi.key === 'PT' && f.factory.name.includes('Phan Thiết')) ||
              (kpi.key === 'Tuti' && f.factory.name.includes('Tuticorin')) ||
              f.factory.code === kpi.key
            );
            // Count months with actual S1+S2 data
            const monthsWithData = fs
              ? fs.monthlyTrend.filter(m => (m.scope1 + m.scope2) > 0).length
              : 0;
            // YTD target = monthly target × months elapsed
            const ytdTarget = kpi.monthlyTarget * Math.max(monthsWithData, 1);
            return {
              ...kpi,
              actual: fs ? (fs.scope1 + fs.scope2) : 0,
              monthsWithData,
              ytdTarget,
            };
          });

          const totalActual = kpisWithActual.reduce((acc, curr) => acc + curr.actual, 0);
          // Total YTD target = sum of each factory's YTD target (1125/month × months)
          const totalMonthlyTarget = 1125;
          // Use average months across factories for total (or take max, typically same)
          const avgMonths = kpisWithActual.length > 0
            ? Math.round(kpisWithActual.reduce((s, k) => s + k.monthsWithData, 0) / kpisWithActual.length)
            : 1;
          const totalYtdTarget = totalMonthlyTarget * Math.max(avgMonths, 1);

          return (
            <>
              <div className="grid-4 stagger-children">
                {kpisWithActual.map(kpi => (
                  <div key={kpi.key} className="card animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-xl) var(--space-md)' }}>
                    <AbsoluteTargetGauge
                      label={`Nhà máy ${kpi.label}`}
                      actual={kpi.actual}
                      target={kpi.ytdTarget}
                      size={150}
                      unit="tCO₂e"
                    />
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      KPI: {kpi.monthlyTarget} × {kpi.monthsWithData}T = <strong>{kpi.ytdTarget} tCO₂e</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card mt-lg animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-2xl)', background: 'var(--color-card-bg)', border: '2px solid #E0DFDB' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Tổng KPI theo Nhóm
                </div>
                <AbsoluteTargetGauge
                  label="Tổng 4 Nhà máy"
                  actual={totalActual}
                  target={totalYtdTarget}
                  size={240}
                  unit="tCO₂e"
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  KPI: 1,125/tháng × {avgMonths} tháng = <strong>{totalYtdTarget.toLocaleString()} tCO₂e</strong>
                </div>
              </div>
            </>
          );
        })()}
      </div>
      )}

      {/* ── Monthly Trend Line ── */}
      <div className="card mt-xl animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Xu hướng phát thải theo phạm vi</div>
          <div className="header-badge" style={{ color: selectedScope !== 'ALL' ? SCOPE_COLORS[selectedScope] : undefined }}>
            📈 {selectedScope !== 'ALL' ? SCOPE_LABEL[selectedScope] : 'tCO₂e / tháng'}
          </div>
        </div>
        <TrendLine data={trendData} legendLabels={trendLegend} height={280} />
      </div>
    </div>
  );
}
