'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { SCOPE_COLORS, GRID_EMISSION_FACTORS } from '@/lib/types';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import TrendLine from '@/components/charts/TrendLine';

// Palette for scope2 category lines
const CAT_COLORS = ['#F5A623', '#E8960E', '#D4890A', '#FCD34D', '#FB923C', '#F59E0B'];

const ELECTRICITY_LABEL: Record<string, string> = {
  electricity: '⚡ Điện lưới',
};

type MonthlyByCat = {
  month: number; label: string;
  categories: { key: string; value: number }[];
  total: number;
};

export default function Scope2Page() {
  const [loading, setLoading]            = useState(true);
  const [error, setError]                = useState<string | null>(null);
  const [scopeData, setScopeData]        = useState<ScopeSummary | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [scope2Monthly, setScope2Monthly]        = useState<MonthlyByCat[]>([]);
  const [monthlyRCN, setMonthlyRCN]      = useState<number[]>([]);
  const [totalRCN, setTotalRCN]          = useState(0);
  const [selectedYear, setSelectedYear]  = useState(new Date().getFullYear());

  // Filter state
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(['electricity']));
  const [useIntensity, setUseIntensity] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_2') || null);
        setFactorySummaries(data.factorySummaries);
        setScope2Monthly((data as any).scope2Monthly as MonthlyByCat[] || []);
        setMonthlyRCN((data as any).monthlyRCN || []);
        setTotalRCN(data.rcnData?.totalRCN || 0);
        const catsWithData = new Set(
          ((data as any).scope2Monthly as MonthlyByCat[] || [])
            .flatMap((m: MonthlyByCat) => m.categories.map((c: { key: string }) => c.key))
        );
        setSelectedCats(catsWithData.size > 0 ? catsWithData : new Set(['electricity']));
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [selectedYear]);

  const scopeColor = SCOPE_COLORS.scope_2;
  const vnEFs = GRID_EMISSION_FACTORS.filter(ef => ef.country === 'Vietnam');
  const inEFs = GRID_EMISSION_FACTORS.filter(ef => ef.country === 'India');

  // All unique categories
  const allCats = useMemo(() => {
    const keys = new Set(scope2Monthly.flatMap(m => m.categories.map(c => c.key)));
    return Array.from(keys).map(k => ({ key: k, label: ELECTRICITY_LABEL[k] || k }));
  }, [scope2Monthly]);

  const toggleCat = (key: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Build trend data for selected categories
  const trendData = useMemo(() => {
    return scope2Monthly
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
  }, [scope2Monthly, allCats, selectedCats, monthlyRCN, useIntensity]);

  const legendLabels = useMemo(() =>
    Object.fromEntries(
      allCats.filter(c => selectedCats.has(c.key)).map(c => [c.key, c.label])
    ),
    [allCats, selectedCats]
  );

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
          <div className="page-title"><span style={{ color: scopeColor }}>⚡</span> Scope 2 <span className="page-title-accent">Năng lượng mua</span></div>
          <div className="page-subtitle">Phát thải gián tiếp từ điện lưới mua — Location-based method</div>
        </div>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: 'var(--font-body)', fontSize: '14px', background: 'var(--color-card-bg)', color: 'var(--color-text)' }}
        >
          {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
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
          <div className="kpi-card-label">tCO₂e / MT RCN (S2)</div>
        </div>
      </div>

      {/* ── Source Filter + Intensity Toggle ── */}
      <div className="card animate-fade-in-up mb-xl" style={{ padding: 'var(--space-lg) var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>🎛️ Lọc nguồn phát thải</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setSelectedCats(new Set(allCats.map(c => c.key)))}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)' }}>
              Chọn tất cả
            </button>
            <button onClick={() => setSelectedCats(new Set())}
              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)' }}>
              Bỏ chọn
            </button>
            {/* Intensity toggle */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '8px', border: `1.5px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`, background: useIntensity ? '#EEF2FF' : 'transparent', cursor: 'pointer' }}
              onClick={() => setUseIntensity(v => !v)}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '3px', border: `2px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`, background: useIntensity ? '#6366F1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {useIntensity && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: useIntensity ? '#6366F1' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                📊 tCO₂e / MT RCN
              </span>
            </div>
          </div>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {allCats.length === 0 ? (
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Không có dữ liệu nguồn</span>
          ) : allCats.map((cat, idx) => {
            const isOn = selectedCats.has(cat.key);
            const col = CAT_COLORS[idx % CAT_COLORS.length];
            return (
              <button key={cat.key} onClick={() => toggleCat(cat.key)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '6px 14px', borderRadius: '20px',
                border: `2px solid ${isOn ? col : 'var(--color-border)'}`,
                background: isOn ? col + '18' : 'transparent',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px',
                color: isOn ? col : 'var(--color-text-muted)', fontWeight: isOn ? 700 : 400,
                transition: 'all 0.15s',
              }}>
                {cat.label}
              </button>
            );
          })}

          {/* Factory-level pills */}
          {factorySummaries.map((fs, fi) => {
            const key = `factory_${fs.factory.id}`;
            return null; // For Scope 2 we show all as one electricity category
          })}
        </div>

        {/* Per-factory selector */}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>🏭 Hoặc xem theo nhà máy:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {factorySummaries.map((fs, fi) => {
              const col = ['#F5A623', '#E8960E', '#D4890A', '#C07E08'][fi] || '#F5A623';
              return (
                <div key={fs.factory.id} style={{ padding: '5px 12px', borderRadius: '16px', border: `1.5px solid ${col}`, background: col + '15', fontSize: '13px', fontWeight: 600, color: col }}>
                  {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}: {formatTCO2e(fs.scope2)} tCO₂e
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Trend Chart ── */}
      <div className="card animate-fade-in-up mb-xl">
        <div className="card-header">
          <div className="card-title">📈 Xu hướng Scope 2 hàng tháng</div>
          <div className="header-badge" style={{ background: useIntensity ? '#6366F1' : scopeColor, color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
            {useIntensity ? 'tCO₂e / MT RCN' : 'tCO₂e / tháng'}
          </div>
        </div>
        <TrendLine
          data={
            factorySummaries[0]?.monthlyTrend
              .map((_, i) => ({
                label: factorySummaries[0].monthlyTrend[i].label,
                values: factorySummaries.map((fs, fi) => {
                  const raw = fs.monthlyTrend[i].scope2;
                  const rcn = monthlyRCN[i] || 0;
                  const val = useIntensity ? (rcn > 0 ? Math.round((raw / rcn) * 10000) / 10000 : 0) : raw;
                  return {
                    key: fs.factory.code,
                    value: val,
                    color: ['#F5A623', '#E8960E', '#D4890A', '#C07E08'][fi] || '#F5A623',
                  };
                }),
              }))
              .filter(m => m.values.some(v => v.value > 0)) || []
          }
          legendLabels={Object.fromEntries(factorySummaries.map(fs => [
            fs.factory.code,
            `${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} ${fs.factory.name}`,
          ]))}
          height={300}
          showArea={false}
        />
      </div>

      {/* ── Grid EF Tables ── */}
      <div className="grid-2 mb-xl">
        <div className="card animate-fade-in-up">
          <div className="card-header"><div className="card-title">🇻🇳 Hệ số lưới điện Việt Nam</div><div className="header-badge">kg CO₂e / kWh</div></div>
          <table className="data-table"><thead><tr><th>Năm</th><th style={{ textAlign: 'right' }}>EF (kg CO₂e/kWh)</th><th>Nguồn</th></tr></thead>
          <tbody>{vnEFs.map(ef => (
            <tr key={ef.year} style={{ background: ef.year === selectedYear ? 'var(--color-scope-2-light)' : undefined }}>
              <td style={{ fontWeight: ef.year === selectedYear ? 700 : 400 }}>{ef.year}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{ef.factor.toFixed(4)}</td>
              <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{ef.source}</td>
            </tr>
          ))}</tbody></table>
        </div>
        <div className="card animate-fade-in-up">
          <div className="card-header"><div className="card-title">🇮🇳 Hệ số lưới điện Ấn Độ</div><div className="header-badge">kg CO₂e / kWh</div></div>
          <table className="data-table"><thead><tr><th>Năm</th><th style={{ textAlign: 'right' }}>EF (kg CO₂e/kWh)</th><th>Nguồn</th></tr></thead>
          <tbody>{inEFs.map(ef => (
            <tr key={ef.year} style={{ background: ef.year === selectedYear ? 'var(--color-scope-2-light)' : undefined }}>
              <td style={{ fontWeight: ef.year === selectedYear ? 700 : 400 }}>{ef.year}</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{ef.factor.toFixed(4)}</td>
              <td style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{ef.source}</td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>
    </div>
  );
}
