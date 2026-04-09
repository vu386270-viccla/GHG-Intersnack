'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_1_CATEGORIES, SCOPE_COLORS } from '@/lib/types';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import TrendLine from '@/components/charts/TrendLine';

// Palette for category lines
const CAT_COLORS = [
  '#E32314', '#FF6B5A', '#F97316', '#F59E0B',
  '#8B5CF6', '#3B82F6', '#10B981', '#EC4899',
  '#6366F1', '#14B8A6',
];

type MonthlyByCat = {
  month: number; label: string;
  categories: { key: string; value: number }[];
  total: number;
};

export default function Scope1Page() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [scopeData, setScopeData]       = useState<ScopeSummary | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [scope1Monthly, setScope1Monthly]       = useState<MonthlyByCat[]>([]);
  const [monthlyRCN, setMonthlyRCN]     = useState<number[]>([]);
  const [totalRCN, setTotalRCN]         = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Filter state
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [useIntensity, setUseIntensity] = useState(false); // tCO₂e vs tCO₂e/MT RCN

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_1') || null);
        setFactorySummaries(data.factorySummaries);
        setScope1Monthly(data.scope1Monthly as MonthlyByCat[]);
        setMonthlyRCN(data.monthlyRCN || []);
        setTotalRCN(data.rcnData?.totalRCN || 0);
        // Default: select all categories that have data
        const catsWithData = new Set(
          (data.scope1Monthly as MonthlyByCat[])
            .flatMap(m => m.categories.map(c => c.key))
        );
        setSelectedCats(catsWithData);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [selectedYear]);

  // All unique categories that have any data
  const allCats = useMemo(() => {
    const keys = new Set(scope1Monthly.flatMap(m => m.categories.map(c => c.key)));
    return SCOPE_1_CATEGORIES.filter(c => keys.has(c.key));
  }, [scope1Monthly]);

  // Toggle a category selection
  const toggleCat = (key: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Build trend data for selected categories
  const trendData = useMemo(() => {
    return scope1Monthly
      .map(m => {
        const rcn = monthlyRCN[m.month - 1] || 0;
        const values = allCats
          .filter(cat => selectedCats.has(cat.key))
          .map((cat, idx) => {
            const raw = m.categories.find(c => c.key === cat.key)?.value || 0;
            const val = useIntensity ? (rcn > 0 ? Math.round((raw / rcn) * 10000) / 10000 : 0) : raw;
            return { key: cat.key, value: val, color: CAT_COLORS[idx % CAT_COLORS.length] };
          });
        return { label: m.label, values };
      })
      .filter(m => m.values.some(v => v.value > 0));
  }, [scope1Monthly, allCats, selectedCats, monthlyRCN, useIntensity]);

  const legendLabels = useMemo(() =>
    Object.fromEntries(
      allCats
        .filter(c => selectedCats.has(c.key))
        .map((c, i) => [c.key, `${c.icon} ${c.label}`])
    ),
    [allCats, selectedCats]
  );

  const scopeColor = SCOPE_COLORS.scope_1;

  if (loading || !scopeData) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }
  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi: {error}</div></div>;
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="page-title"><span style={{ color: scopeColor }}>🔥</span> Scope 1 <span className="page-title-accent">Phát thải trực tiếp</span></div>
          <div className="page-subtitle">Phát thải GHG trực tiếp từ các nguồn thuộc sở hữu hoặc kiểm soát của công ty</div>
        </div>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '14px', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
        >
          {[2026, 2025, 2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid-4 stagger-children mb-xl">
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{formatTCO2e(scopeData.totalEmissions)}</div><div className="kpi-card-label">Tổng tCO₂e (YTD)</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{scopeData.percentOfTotal}%</div><div className="kpi-card-label">Tỷ trọng tổng phát thải</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeData.changePercent < 0 ? '#2ECC71' : scopeColor }}>{scopeData.changePercent}%</div><div className="kpi-card-label">So với năm trước</div></div>
        <div className="card kpi-card animate-fade-in-up">
          <div className="kpi-card-value" style={{ color: '#6366F1' }}>
            {totalRCN > 0 ? (scopeData.totalEmissions / totalRCN).toFixed(3) : '—'}
          </div>
          <div className="kpi-card-label">tCO₂e / MT RCN (S1)</div>
        </div>
      </div>

      {/* ── Source Filter + Intensity Toggle ── */}
      <div className="card animate-fade-in-up mb-xl" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>🎛️ Lọc nguồn phát thải</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Select All / Clear */}
            <button
              onClick={() => setSelectedCats(new Set(allCats.map(c => c.key)))}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)' }}
            >Chọn tất cả</button>
            <button
              onClick={() => setSelectedCats(new Set())}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)' }}
            >Bỏ chọn</button>

            {/* Intensity toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', border: `1.5px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`, background: useIntensity ? '#EEF2FF' : 'transparent', cursor: 'pointer' }}
              onClick={() => setUseIntensity(v => !v)}>
              <div style={{
                width: '16px', height: '16px', borderRadius: '3px',
                border: `2px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`,
                background: useIntensity ? '#6366F1' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {useIntensity && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: useIntensity ? '#6366F1' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                📊 tCO₂e / MT RCN
              </span>
            </div>
          </div>
        </div>

        {/* Category checkboxes */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {allCats.map((cat, idx) => {
            const isOn = selectedCats.has(cat.key);
            const col = CAT_COLORS[idx % CAT_COLORS.length];
            const catEmissions = scopeData.categories.find(c => c.category === cat.key)?.emissions || 0;
            return (
              <button
                key={cat.key}
                onClick={() => toggleCat(cat.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '6px 12px', borderRadius: '20px',
                  border: `2px solid ${isOn ? col : 'var(--color-border)'}`,
                  background: isOn ? col + '18' : 'transparent',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px',
                  color: isOn ? col : 'var(--color-text-muted)', fontWeight: isOn ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                <span>{cat.label}</span>
                {catEmissions > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8 }}>
                    {formatTCO2e(catEmissions)} t
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Trend Chart: by source ── */}
      <div className="card animate-fade-in-up mb-xl">
        <div className="card-header">
          <div className="card-title">📈 Xu hướng theo nguồn phát thải — Scope 1</div>
          <div className="header-badge" style={{ background: useIntensity ? '#6366F1' : scopeColor, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
            {useIntensity ? 'tCO₂e / MT RCN' : 'tCO₂e / tháng'}
          </div>
        </div>
        {selectedCats.size === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
            ☝️ Chọn ít nhất một nguồn phát thải ở trên để xem biểu đồ
          </div>
        ) : (
          <TrendLine
            data={trendData}
            legendLabels={legendLabels}
            height={320}
            showArea={false}
          />
        )}
      </div>

      {/* ── Source breakdown table ── */}
      <div className="section mb-xl">
        <div className="section-header"><div className="section-title">Phân tích theo nguồn phát thải</div></div>
        <div className="card animate-fade-in-up">
          <table className="data-table">
            <thead><tr><th style={{ width: '40px' }}></th><th>Nguồn phát thải</th><th>Quy trình</th><th>Hệ số EF</th><th style={{ textAlign: 'right' }}>Phát thải (tCO₂e)</th><th style={{ textAlign: 'right' }}>Tỷ trọng</th></tr></thead>
            <tbody>
              {scopeData.categories.map((cat) => {
                const catDef = SCOPE_1_CATEGORIES.find(c => c.key === cat.category);
                return (
                  <tr key={cat.category}>
                    <td style={{ fontSize: '18px' }}>{catDef?.icon || '📊'}</td>
                    <td><div style={{ fontWeight: 600 }}>{catDef?.label || cat.label}</div><div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Đơn vị: {catDef?.unit || cat.unit}</div></td>
                    <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{catDef?.process || '-'}</td>
                    <td style={{ fontSize: '13px' }}><code style={{ background: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{catDef?.ef} {catDef?.efUnit}</code></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>{formatTCO2e(cat.emissions)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${cat.percentOfScope}%`, height: '100%', background: scopeColor, borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{cat.percentOfScope}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Factory Comparison ── */}
      <div className="section mb-xl">
        <div className="section-header"><div className="section-title">So sánh nhà máy — Scope 1</div></div>
        <div className="card animate-fade-in-up">
          <TrendLine
            data={
              Array.from({ length: 12 }, (_, i) => ({
                label: factorySummaries[0]?.monthlyTrend[i].label || `T${i + 1}`,
                values: factorySummaries.map((fs, fi) => ({
                  key: fs.factory.code,
                  value: fs.monthlyTrend[i].scope1,
                  color: ['#E32314', '#FF6B5A', '#B91C1C', '#F97316'][fi] || '#E32314',
                })),
              })).filter(m => m.values.some(v => v.value > 0))
            }
            legendLabels={Object.fromEntries(factorySummaries.map(fs => [fs.factory.code, fs.factory.name]))}
            height={280}
            showArea={false}
          />
        </div>
      </div>
    </div>
  );
}
