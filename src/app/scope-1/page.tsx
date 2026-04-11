'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { SCOPE_1_CATEGORIES, SCOPE_COLORS } from '@/lib/types';
import { getFactoryColor, getFactoryBg } from '@/lib/factory-colors';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import TrendLine from '@/components/charts/TrendLine';
import FactoryBarChart from '@/components/charts/FactoryBarChart';
import DualAxisChart from '@/components/charts/DualAxisChart';

// Palette for source categories
const CAT_COLORS = [
  '#E32314', '#FF6B5A', '#F97316', '#F59E0B',
  '#8B5CF6', '#3B82F6', '#10B981', '#EC4899',
  '#6366F1', '#14B8A6',
];

type MonthlyByCat = {
  month: number; label: string;
  categories: { key: string; value: number; cost?: number }[];
  total: number;
  totalCost?: number;
};

type ViewMode = 'overview' | 'by-source' | 'compare' | 'vs-rcn';

const VIEW_TABS: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'overview',   label: 'Tổng quan',     icon: '📊' },
  { key: 'by-source',  label: 'Theo nguồn',    icon: '🔍' },
  { key: 'compare',    label: 'So sánh NM',    icon: '🏭' },
  { key: 'vs-rcn',     label: 'vs RCN',        icon: '⚖️' },
];

function StatBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)',
      padding: '8px 12px', minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Scope1Page() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<ScopeSummary | null>(null);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [s1Monthly, setS1Monthly] = useState<MonthlyByCat[]>([]);
  const [monthlyRCN, setMonthlyRCN] = useState<number[]>([]);
  const [totalRCN, setTotalRCN]   = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode]   = useState<ViewMode>('overview');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  
  // Toggles
  const [useIntensity, setUseIntensity] = useState(false);
  const [useUSD, setUseUSD] = useState(false);

  // Helper functions for Dynamic Mode
  const formatVal = (v: number) => useUSD ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : formatTCO2e(v);
  const unitStr = useUSD ? 'USD' : 'tCO₂e';

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_1') || null);
        setFactories(data.factorySummaries);
        setS1Monthly(data.scope1Monthly as MonthlyByCat[]);
        setMonthlyRCN(data.monthlyRCN || []);
        setTotalRCN(data.rcnData?.totalRCN || 0);
        const catsWithData = new Set(
          (data.scope1Monthly as MonthlyByCat[]).flatMap(m => m.categories.map(c => c.key))
        );
        setSelectedCats(catsWithData);
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [selectedYear]);

  const allCats = useMemo(() => {
    const keys = new Set(s1Monthly.flatMap(m => m.categories.map(c => c.key)));
    return SCOPE_1_CATEGORIES.filter(c => keys.has(c.key));
  }, [s1Monthly]);

  const toggleCat = (key: string) =>
    setSelectedCats(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const sourceTrendData = useMemo(() => s1Monthly
    .map(m => {
      const rcn = monthlyRCN[m.month - 1] || 0;
      const values = allCats.filter(c => selectedCats.has(c.key)).map((cat, idx) => {
        const cData = m.categories.find(c => c.key === cat.key);
        const raw = useUSD ? (cData?.cost || 0) : (cData?.value || 0);
        const val = useIntensity ? (rcn > 0 ? raw / rcn : 0) : raw;
        return { key: cat.key, value: val, color: CAT_COLORS[idx % CAT_COLORS.length] };
      });
      return { label: m.label, values };
    }).filter(m => m.values.some(v => v.value > 0)), [s1Monthly, allCats, selectedCats, monthlyRCN, useIntensity, useUSD]);

  const overviewTrendData = useMemo(() => {
    if (!factories.length) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      label: factories[0]?.monthlyTrend[i].label || `T${i+1}`,
      values: factories.map((fs, fi) => {
        const mVal = useUSD ? (fs.monthlyTrend[i].costScope1 || 0) : fs.monthlyTrend[i].scope1;
        return {
          key: fs.factory.code,
          value: useIntensity ? (monthlyRCN[i] > 0 ? mVal / monthlyRCN[i] : 0) : mVal,
          color: getFactoryColor(fs.factory.code, fi),
        }
      }),
    })).filter(m => m.values.some(v => v.value > 0));
  }, [factories, monthlyRCN, useIntensity, useUSD]);

  const compareFactorySeries = useMemo(() =>
    factories.map((fs, fi) => ({
      key: fs.factory.code,
      label: fs.factory.name,
      color: getFactoryColor(fs.factory.code, fi),
      values: Array.from({ length: 12 }, (_, i) => {
        const v = useUSD ? (fs.monthlyTrend[i].costScope1 || 0) : fs.monthlyTrend[i].scope1;
        return useIntensity ? (monthlyRCN[i] > 0 ? v / monthlyRCN[i] : 0) : v;
      }),
    })), [factories, monthlyRCN, useIntensity, useUSD]);

  const monthlyTotals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      factories.reduce((sum, fs) => sum + (useUSD ? (fs.monthlyTrend[i].costScope1 || 0) : fs.monthlyTrend[i].scope1), 0)
    ), [factories, useUSD]);

  const scopeColor = useUSD ? '#E8960E' : SCOPE_COLORS.scope_1; // Orange if USD

  const totalMetric = scopeData ? (useUSD ? (scopeData.totalCost || 0) : scopeData.totalEmissions) : 0;
  const intensity = totalRCN > 0 && totalMetric > 0 ? (totalMetric / totalRCN) : 0;

  if (loading || !scopeData) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span>
    </div>
  );
  if (error) return (
    <div style={{ color: scopeColor, padding: 16, background: '#FFF0EF', borderRadius: 8, margin: 16 }}>⚠️ {error}</div>
  );

  return (
    <div>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: scopeColor }}>🔥</span>
            Scope 1 
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>Phát thải trực tiếp</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          
          {/* USD Toggle */}
          <button
            onClick={() => { setUseUSD(v => !v); setUseIntensity(false); }}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${useUSD ? '#E8960E' : 'var(--color-border)'}`,
              background: useUSD ? '#fffbeb' : 'transparent',
              color: useUSD ? '#b45309' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {useUSD ? '💰 Đang phân tích Chi phí' : '💰 Quy đổi Chi phí USD'}
          </button>

          {/* Intensity toggle */}
          <button
            onClick={() => setUseIntensity(v => !v)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`,
              background: useIntensity ? '#EEF2FF' : 'transparent',
              color: useIntensity ? '#6366F1' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {useIntensity ? `📊 ${unitStr}/MT RCN` : `📊 ${unitStr}`}
          </button>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-card-bg)', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {[2026, 2025, 2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI strip — compact 5 stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <StatBox label={`Tổng Scope 1 (${useUSD ? 'Chi phí' : 'YTD'})`} value={formatVal(totalMetric)} color={scopeColor} sub={unitStr} />
        <StatBox label="Tỷ trọng" value={`${scopeData.percentOfTotal}%`} color={scopeColor} sub="trong tổng phát thải" />
        <StatBox
          label="vs Năm trước"
          value={`${scopeData.changePercent > 0 ? '+' : ''}${scopeData.changePercent}%`}
          color={scopeData.changePercent < 0 ? '#10B981' : '#EF4444'}
          sub={scopeData.changePercent < 0 ? '▼ Giảm' : '▲ Tăng'}
        />
        <StatBox label="Cường độ" value={intensity > 0 ? intensity.toFixed(useUSD ? 2 : 3) : '—'} color="#6366F1" sub={`${unitStr} / MT RCN`} />
        <StatBox label="Nguồn chính" value={scopeData.categories[0]?.percentOfScope + '%'} color={scopeColor} sub={scopeData.categories[0]?.label?.slice(0, 14) || '—'} />
      </div>

      {/* ── View tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {VIEW_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderBottom: `2px solid ${viewMode === tab.key ? scopeColor : 'transparent'}`,
              background: 'transparent', color: viewMode === tab.key ? scopeColor : 'var(--color-text-muted)',
              borderRadius: '4px 4px 0 0', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── View: Tổng quan ── */}
      {viewMode === 'overview' && (
        <div>
          {/* Trend tổng */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              📈 Xu hướng {useUSD ? 'chi phí' : ''} theo nhà máy — {selectedYear}
            </div>
            <TrendLine
              data={overviewTrendData}
              height={200}
              showArea={false}
              legendLabels={Object.fromEntries(factories.map((fs, fi) => [
                fs.factory.code,
                `${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} ${fs.factory.name}`,
              ]))}
              currency={useUSD}
            />
          </div>

          {/* Factory mini cards — 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
            {factories.map((fs, fi) => {
              const col = getFactoryColor(fs.factory.code, fi);
              const bg = getFactoryBg(fs.factory.code, fi, '12');
              const fTotal = useUSD ? (fs.scope1Cost || 0) : fs.scope1;
              const pct = totalMetric > 0
                ? Math.round((fTotal / totalMetric) * 100) : 0;
              const intens = totalRCN > 0 && fTotal > 0 ? (fTotal / totalRCN).toFixed(useUSD ? 2 : 3) : '—';
              return (
                <div key={fs.factory.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${col}`, background: bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                        {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>
                        {formatVal(fTotal)}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 3 }}>{unitStr}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>của {useUSD ? 'tổng tiền S1' : 'Scope 1'}</div>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div style={{ marginTop: 8, height: 4, background: 'var(--color-border-light)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>Cường độ: {intens} {unitStr}/MT RCN</div>
                </div>
              );
            })}
          </div>

          {/* Source breakdown — compact table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Phân tích theo nguồn
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {scopeData.categories.map((cat, ci) => {
                  const catDef = SCOPE_1_CATEGORIES.find(c => c.key === cat.category);
                  const cVal = useUSD ? (cat.cost || 0) : cat.emissions;
                  const pct = totalMetric > 0 ? Math.round((cVal / totalMetric) * 100) : 0;
                  return (
                    <tr key={cat.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '6px 14px', width: 24 }}><span style={{ fontSize: 14 }}>{catDef?.icon || '📊'}</span></td>
                      <td style={{ padding: '6px 4px', fontWeight: 600, color: 'var(--color-text)' }}>{catDef?.label || cat.label}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: scopeColor, whiteSpace: 'nowrap' }}>
                        {formatVal(cVal)}
                      </td>
                      <td style={{ padding: '6px 14px', width: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 5, background: 'var(--color-border-light)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: CAT_COLORS[ci % CAT_COLORS.length], borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, width: 28, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View: Theo nguồn ── */}
      {viewMode === 'by-source' && (
        <div>
          {/* Filter bar */}
          <div className="card" style={{ padding: '10px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Nguồn:</span>
              {allCats.map((cat, idx) => {
                const isOn = selectedCats.has(cat.key);
                const col = CAT_COLORS[idx % CAT_COLORS.length];
                return (
                  <button key={cat.key} onClick={() => toggleCat(cat.key)} style={{
                    padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: isOn ? 700 : 400,
                    border: `1.5px solid ${isOn ? col : 'var(--color-border)'}`,
                    background: isOn ? col + '18' : 'transparent',
                    color: isOn ? col : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 12 }}>{cat.icon}</span>{cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              Xu hướng theo nguồn — {useIntensity ? `${unitStr} / MT RCN` : unitStr}
            </div>
            {selectedCats.size === 0
              ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', fontSize: 13 }}>☝️ Chọn ít nhất một nguồn</div>
              : <TrendLine data={sourceTrendData}
                  legendLabels={Object.fromEntries(allCats.filter(c => selectedCats.has(c.key)).map((c, i) => [c.key, `${c.icon} ${c.label}`]))}
                  height={230} showArea={false} currency={useUSD} />
            }
          </div>

          {/* Source table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 11 }}>Nguồn</th>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 11 }}>EF</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 11 }}>{unitStr}</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 11 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {scopeData.categories.map((cat, ci) => {
                  const catDef = SCOPE_1_CATEGORIES.find(c => c.key === cat.category);
                  const col = CAT_COLORS[ci % CAT_COLORS.length];
                  const cVal = useUSD ? (cat.cost || 0) : cat.emissions;
                  const pct = totalMetric > 0 ? Math.round((cVal / totalMetric) * 100) : 0;
                  return (
                    <tr key={cat.category} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '7px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{catDef?.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{catDef?.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{catDef?.process}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '7px 14px' }}>
                        <code style={{ fontSize: 10, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 3, color: 'var(--color-text-secondary)' }}>
                          {catDef?.ef} {catDef?.efUnit}
                        </code>
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 15, color: col }}>
                        {formatVal(cVal)}
                      </td>
                      <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 600 }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View: So sánh nhà máy ── */}
      {viewMode === 'compare' && (
        <div>
          {/* Ranking cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(factories.length, 4)}, 1fr)`, gap: 8, marginBottom: 10 }}>
            {[...factories].sort((a, b) => (useUSD?b.scope1Cost||0:b.scope1) - (useUSD?a.scope1Cost||0:a.scope1)).map((fs, rank) => {
              const fVal = useUSD ? (fs.scope1Cost || 0) : fs.scope1;
              const fi = factories.findIndex(f => f.factory.id === fs.factory.id);
              const col = getFactoryColor(fs.factory.code, fi);
              const pct = totalMetric > 0 ? Math.round((fVal / totalMetric) * 100) : 0;
              return (
                <div key={fs.factory.id} className="card" style={{
                  padding: '10px 12px', borderTop: `3px solid ${col}`,
                  background: rank === 0 ? getFactoryBg(fs.factory.code, fi, '10') : undefined,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                    #{rank + 1} {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: col }}>
                    {formatVal(fVal)}
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 2 }}>{unitStr}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--color-border-light)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col }} />
                  </div>
                  <div style={{ fontSize: 10, color: col, fontWeight: 700, marginTop: 3 }}>{pct}% {useUSD ? 'tổng tiền' : 'tổng S1'}</div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Grouped bar — {useIntensity ? `${unitStr} / MT RCN` : `${unitStr} / tháng`}
            </div>
            <FactoryBarChart
              labels={Array.from({ length: 12 }, (_, i) => factories[0]?.monthlyTrend[i].label || `T${i+1}`)}
              series={compareFactorySeries}
              height={200}
              yLabel={useIntensity ? `${unitStr}/MTRCN` : unitStr}
              currency={useUSD}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Nhà máy', `${unitStr}`, `Cường độ (${unitStr}/MT)`, 'Tháng cao nhất', `% tổng`].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: h.includes('Cường độ') || h.includes('%') || h.includes('USD') || h.includes('tCO₂e') ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...factories].sort((a, b) => (useUSD?b.scope1Cost||0:b.scope1) - (useUSD?a.scope1Cost||0:a.scope1)).map((fs, rank) => {
                  const fVal = useUSD ? (fs.scope1Cost || 0) : fs.scope1;
                  const fi = factories.findIndex(f => f.factory.id === fs.factory.id);
                  const col = getFactoryColor(fs.factory.code, fi);
                  const pct = totalMetric > 0 ? Math.round((fVal / totalMetric) * 100) : 0;
                  const fRCN = Array.from({ length: 12 }, (_, i) => monthlyRCN[i] || 0).reduce((s, v) => s + v, 0);
                  const intens = fRCN > 0 ? (fVal / fRCN).toFixed(useUSD ? 2 : 3) : '—';
                  const maxMonth = fs.monthlyTrend.reduce((max, m) => (useUSD?m.costScope1||0:m.scope1) > (useUSD?max.costScope1||0:max.scope1) ? m : max, fs.monthlyTrend[0]);
                  return (
                    <tr key={fs.factory.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: col, fontSize: 12 }}>{fs.factory.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fs.factory.location}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: col }}>{formatVal(fVal)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{intens}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {maxMonth.label} ({formatVal(useUSD ? (maxMonth.costScope1||0) : maxMonth.scope1)})
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: col }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── View: vs RCN ── */}
      {viewMode === 'vs-rcn' && (
        <div>
          <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {useUSD ? 'Chi phí' : 'Phát thải'} Scope 1 vs RCN nhập — tương quan hàng tháng
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 12 }}>
                <span>Tổng RCN: <strong>{totalRCN.toLocaleString()} MT</strong></span>
                <span>Cường độ TB: <strong>{intensity.toFixed(useUSD ? 2 : 3)} {unitStr}/MT</strong></span>
              </div>
            </div>
            <DualAxisChart
              labels={Array.from({ length: 12 }, (_, i) => factories[0]?.monthlyTrend[i]?.label || `T${i+1}`)}
              emissionValues={monthlyTotals}
              rcnValues={monthlyRCN}
              emissionColor={scopeColor}
              rcnColor="#6366F1"
              height={220}
              currency={useUSD}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {factories.map((fs, fi) => {
              const fVal = useUSD ? (fs.scope1Cost || 0) : fs.scope1;
              const col = getFactoryColor(fs.factory.code, fi);
              const fsMonthlyEm = Array.from({ length: 12 }, (_, i) => useUSD ? (fs.monthlyTrend[i].costScope1 || 0) : fs.monthlyTrend[i].scope1);
              const intensValues = monthlyRCN.map((rcn, i) => rcn > 0 ? fsMonthlyEm[i] / rcn : 0);
              const avgIntens = monthlyRCN.filter(v => v > 0).length > 0
                ? intensValues.filter((_, i) => monthlyRCN[i] > 0).reduce((s, v) => s + v, 0) / monthlyRCN.filter(v => v > 0).length
                : 0;
              return (
                <div key={fs.factory.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${col}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                      {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col }}>{formatVal(fVal)} {unitStr}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Cường độ: {avgIntens.toFixed(useUSD ? 2 : 3)}</div>
                    </div>
                  </div>
                  <DualAxisChart
                    labels={Array.from({ length: 12 }, (_, i) => fs.monthlyTrend[i].label)}
                    emissionValues={fsMonthlyEm}
                    rcnValues={monthlyRCN}
                    emissionColor={col}
                    rcnColor="#6366F1"
                    height={160}
                    currency={useUSD}
                  />
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 10 }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              Xếp hạng cường độ {useUSD ? 'chi phí' : 'phát thải'} Scope 1
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {[...factories]
                  .map((fs, fi) => ({
                    fs, fi,
                    intens: totalRCN > 0 ? (useUSD ? (fs.scope1Cost || 0) : fs.scope1) / totalRCN : 0,
                  }))
                  .sort((a, b) => a.intens - b.intens)
                  .map(({ fs, fi, intens }, rank) => {
                    const col = getFactoryColor(fs.factory.code, fi);
                    const maxIntens = totalRCN > 0
                      ? Math.max(...factories.map(f => (useUSD ? (f.scope1Cost || 0) : f.scope1) / totalRCN)) : 1;
                    return (
                      <tr key={fs.factory.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '7px 14px', width: 24, fontWeight: 800, color: 'var(--color-text-muted)', fontSize: 14 }}>#{rank + 1}</td>
                        <td style={{ padding: '7px 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }} />
                            <span style={{ fontWeight: 600, color: col }}>{fs.factory.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--color-border-light)', borderRadius: 3, overflow: 'hidden', maxWidth: 120 }}>
                              <div style={{ width: `${maxIntens > 0 ? (intens / maxIntens) * 100 : 0}%`, height: '100%', background: col, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: col }}>
                              {useUSD ? '$' + intens.toFixed(2) : intens.toFixed(4)}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{unitStr}/MT RCN</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
