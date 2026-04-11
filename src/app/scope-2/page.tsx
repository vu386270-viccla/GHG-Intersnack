'use client';

import { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { SCOPE_COLORS, GRID_EMISSION_FACTORS } from '@/lib/types';
import { getFactoryColor, getFactoryBg } from '@/lib/factory-colors';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import TrendLine from '@/components/charts/TrendLine';
import FactoryBarChart from '@/components/charts/FactoryBarChart';
import DualAxisChart from '@/components/charts/DualAxisChart';

type MonthlyByCat = {
  month: number; label: string;
  categories: { key: string; value: number }[];
  total: number;
};

type ViewMode = 'overview' | 'compare' | 'vs-rcn' | 'ef-ref';

const VIEW_TABS: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'overview', label: 'Tổng quan',   icon: '📊' },
  { key: 'compare',  label: 'So sánh NM',  icon: '🏭' },
  { key: 'vs-rcn',   label: 'vs RCN',      icon: '⚖️' },
  { key: 'ef-ref',   label: 'Hệ số điện',  icon: '⚡' },
];

function StatBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Scope2Page() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<ScopeSummary | null>(null);
  const [factories, setFactories] = useState<FactorySummary[]>([]);
  const [s2Monthly, setS2Monthly] = useState<MonthlyByCat[]>([]);
  const [monthlyRCN, setMonthlyRCN] = useState<number[]>([]);
  const [totalRCN, setTotalRCN]   = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode]   = useState<ViewMode>('overview');
  const [useIntensity, setUseIntensity] = useState(false);
  const [totalKwh, setTotalKwh]   = useState(0);
  // Cost analysis state
  const [vnUnitCost, setVnUnitCost] = useState(2000);   // VND/kWh default
  const [inUnitCost, setInUnitCost] = useState(8);      // INR/kWh default
  const [kwhByFactory, setKwhByFactory] = useState<Record<string, number>>({});

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_2') || null);
        setFactories(data.factorySummaries);
        setS2Monthly(data.scope2Monthly as MonthlyByCat[] || []);
        setMonthlyRCN(data.monthlyRCN || []);
        setTotalRCN(data.rcnData?.totalRCN || 0);
        setTotalKwh(data.totalKwh || 0);
        setKwhByFactory(data.kwhByFactory || {});
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [selectedYear]);

  const scopeColor = SCOPE_COLORS.scope_2;
  const vnEFs = GRID_EMISSION_FACTORS.filter(ef => ef.country === 'Vietnam');
  const inEFs = GRID_EMISSION_FACTORS.filter(ef => ef.country === 'India');
  const intensity = totalRCN > 0 && scopeData ? (scopeData.totalEmissions / totalRCN) : 0;

  // Overview trend — per factory
  const overviewTrendData = useMemo(() => {
    if (!factories.length) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      label: factories[0]?.monthlyTrend[i].label || `T${i+1}`,
      values: factories.map((fs, fi) => ({
        key: fs.factory.code,
        value: useIntensity
          ? (monthlyRCN[i] > 0 ? fs.monthlyTrend[i].scope2 / monthlyRCN[i] : 0)
          : fs.monthlyTrend[i].scope2,
        color: getFactoryColor(fs.factory.code, fi),
      })),
    })).filter(m => m.values.some(v => v.value > 0));
  }, [factories, monthlyRCN, useIntensity]);

  // Compare bar series
  const compareFactorySeries = useMemo(() =>
    factories.map((fs, fi) => ({
      key: fs.factory.code,
      label: fs.factory.name,
      color: getFactoryColor(fs.factory.code, fi),
      values: Array.from({ length: 12 }, (_, i) => {
        const v = fs.monthlyTrend[i].scope2;
        return useIntensity ? (monthlyRCN[i] > 0 ? v / monthlyRCN[i] : 0) : v;
      }),
    })), [factories, monthlyRCN, useIntensity]);

  // monthly totals for dual axis
  const monthlyTotals = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      factories.reduce((sum, fs) => sum + fs.monthlyTrend[i].scope2, 0)
    ), [factories]);

  if (loading || !scopeData) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span>
    </div>
  );
  if (error) return (
    <div style={{ color: scopeColor, padding: 16, background: '#FFFBEF', borderRadius: 8, margin: 16 }}>⚠️ {error}</div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: scopeColor }}>⚡</span>
          Scope 2
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>Năng lượng mua (Location-based)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setUseIntensity(v => !v)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1.5px solid ${useIntensity ? '#6366F1' : 'var(--color-border)'}`,
              background: useIntensity ? '#EEF2FF' : 'transparent',
              color: useIntensity ? '#6366F1' : 'var(--color-text-muted)', transition: 'all 0.15s',
            }}
          >
            {useIntensity ? '📊 tCO₂e/MT RCN' : '📊 tCO₂e'}
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

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        <StatBox label="Tổng Scope 2 (YTD)" value={formatTCO2e(scopeData.totalEmissions)} color={scopeColor} sub="tCO₂e" />
        <StatBox label="Tỷ trọng" value={`${scopeData.percentOfTotal}%`} color={scopeColor} sub="trong tổng phát thải" />
        <StatBox
          label="vs Năm trước"
          value={`${scopeData.changePercent > 0 ? '+' : ''}${scopeData.changePercent}%`}
          color={scopeData.changePercent < 0 ? '#10B981' : '#EF4444'}
          sub={scopeData.changePercent < 0 ? '▼ Giảm' : '▲ Tăng'}
        />
        <StatBox label="Cường độ" value={intensity > 0 ? intensity.toFixed(3) : '—'} color="#6366F1" sub="tCO₂e / MT RCN" />
        <StatBox label="EF Điện VN" value={`0.6592`} color={scopeColor} sub={`kg CO₂e/kWh · ${selectedYear}`} />
      </div>

      {/* ── View tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid var(--color-border)' }}>
        {VIEW_TABS.map(tab => (
          <button key={tab.key} onClick={() => setViewMode(tab.key)} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: 'none', borderBottom: `2px solid ${viewMode === tab.key ? scopeColor : 'transparent'}`,
            background: 'transparent', color: viewMode === tab.key ? scopeColor : 'var(--color-text-muted)',
            borderRadius: '4px 4px 0 0', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── View: Tổng quan ── */}
      {viewMode === 'overview' && (
        <div>
          <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              📈 Xu hướng điện tiêu thụ theo nhà máy — {selectedYear}
            </div>
            <TrendLine
              data={overviewTrendData}
              height={200}
              showArea={false}
              legendLabels={Object.fromEntries(factories.map((fs, fi) => [
                fs.factory.code,
                `${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} ${fs.factory.name}`,
              ]))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
            {factories.map((fs, fi) => {
              const col = getFactoryColor(fs.factory.code, fi);
              const bg = getFactoryBg(fs.factory.code, fi, '12');
              const pct = scopeData.totalEmissions > 0 ? Math.round((fs.scope2 / scopeData.totalEmissions) * 100) : 0;
              const ef = GRID_EMISSION_FACTORS.find(e => e.country === fs.factory.country && e.year === selectedYear)?.factor;
              return (
                <div key={fs.factory.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${col}`, background: bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                        {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>
                        {formatTCO2e(fs.scope2)}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 3 }}>tCO₂e</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>của Scope 2</div>
                      {ef && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>EF: {ef} kg/kWh</div>}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, height: 4, background: 'var(--color-border-light)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── View: So sánh nhà máy ── */}
      {viewMode === 'compare' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(factories.length, 4)}, 1fr)`, gap: 8, marginBottom: 10 }}>
            {[...factories].sort((a, b) => b.scope2 - a.scope2).map((fs, rank) => {
              const fi = factories.findIndex(f => f.factory.id === fs.factory.id);
              const col = getFactoryColor(fs.factory.code, fi);
              const pct = scopeData.totalEmissions > 0 ? Math.round((fs.scope2 / scopeData.totalEmissions) * 100) : 0;
              return (
                <div key={fs.factory.id} className="card" style={{ padding: '10px 12px', borderTop: `3px solid ${col}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                    #{rank + 1} {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: col }}>
                    {formatTCO2e(fs.scope2)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 2 }}>tCO₂e</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--color-border-light)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: col }} />
                  </div>
                  <div style={{ fontSize: 10, color: col, fontWeight: 700, marginTop: 3 }}>{pct}% tổng S2</div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              So sánh điện tiêu thụ hàng tháng — {useIntensity ? 'tCO₂e/MT RCN' : 'tCO₂e'}
            </div>
            <FactoryBarChart
              labels={Array.from({ length: 12 }, (_, i) => factories[0]?.monthlyTrend[i].label || `T${i+1}`)}
              series={compareFactorySeries}
              height={200}
              yLabel={useIntensity ? 'tCO₂e/MT' : 'tCO₂e'}
            />
          </div>

          {/* Detail table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Nhà máy', 'Quốc gia', 'Scope 2 (tCO₂e)', 'EF Điện', 'Cường độ', '% tổng S2'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: h.includes('tCO') || h.includes('%') || h.includes('độ') ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...factories].sort((a, b) => b.scope2 - a.scope2).map((fs, rank) => {
                  const fi = factories.findIndex(f => f.factory.id === fs.factory.id);
                  const col = getFactoryColor(fs.factory.code, fi);
                  const pct = scopeData.totalEmissions > 0 ? Math.round((fs.scope2 / scopeData.totalEmissions) * 100) : 0;
                  const ef = GRID_EMISSION_FACTORS.find(e => e.country === fs.factory.country && e.year === selectedYear)?.factor;
                  const intens = totalRCN > 0 ? (fs.scope2 / totalRCN).toFixed(4) : '—';
                  return (
                    <tr key={fs.factory.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }} />
                          <span style={{ fontWeight: 700, color: col }}>{fs.factory.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{fs.factory.country === 'India' ? '🇮🇳 India' : '🇻🇳 Vietnam'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: col }}>{formatTCO2e(fs.scope2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <code style={{ fontSize: 10, background: 'var(--color-bg-secondary)', padding: '1px 5px', borderRadius: 3 }}>
                          {ef ? ef.toFixed(4) : '—'} kg/kWh
                        </code>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{intens}</td>
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
                Phát thải Scope 2 vs RCN nhập — tương quan hàng tháng
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 12 }}>
                <span>Tổng RCN: <strong>{totalRCN.toLocaleString()} MT</strong></span>
                <span>Cường độ TB: <strong>{intensity.toFixed(4)} tCO₂e/MT</strong></span>
              </div>
            </div>
            <DualAxisChart
              labels={Array.from({ length: 12 }, (_, i) => factories[0]?.monthlyTrend[i]?.label || `T${i+1}`)}
              emissionValues={monthlyTotals}
              rcnValues={monthlyRCN}
              emissionColor={scopeColor}
              rcnColor="#6366F1"
              height={220}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {factories.map((fs, fi) => {
              const col = getFactoryColor(fs.factory.code, fi);
              const fsMonthlyEm = Array.from({ length: 12 }, (_, i) => fs.monthlyTrend[i].scope2);
              return (
                <div key={fs.factory.id} className="card" style={{ padding: '10px 14px', borderLeft: `3px solid ${col}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: col }}>
                      {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: col }}>{formatTCO2e(fs.scope2)} tCO₂e</div>
                  </div>
                  <DualAxisChart
                    labels={Array.from({ length: 12 }, (_, i) => fs.monthlyTrend[i].label)}
                    emissionValues={fsMonthlyEm}
                    rcnValues={monthlyRCN}
                    emissionColor={col}
                    rcnColor="#6366F1"
                    height={150}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── View: Hệ số điện ── */}
      {viewMode === 'ef-ref' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { country: '🇻🇳 Việt Nam', efs: vnEFs },
            { country: '🇮🇳 Ấn Độ', efs: inEFs },
          ].map(({ country, efs }) => (
            <div key={country} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{country}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>kg CO₂e / kWh</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {efs.map(ef => (
                    <tr key={ef.year} style={{
                      background: ef.year === selectedYear ? `${scopeColor}10` : undefined,
                      borderBottom: '1px solid var(--color-border-light)',
                    }}>
                      <td style={{ padding: '6px 14px', fontWeight: ef.year === selectedYear ? 800 : 400 }}>
                        {ef.year}{ef.year === selectedYear && <span style={{ marginLeft: 6, fontSize: 10, color: scopeColor, background: `${scopeColor}20`, padding: '1px 5px', borderRadius: 8 }}>Active</span>}
                      </td>
                      <td style={{ padding: '6px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: ef.year === selectedYear ? scopeColor : 'var(--color-text)' }}>
                        {ef.factor.toFixed(4)}
                      </td>
                      <td style={{ padding: '6px 14px', fontSize: 10, color: 'var(--color-text-muted)' }}>{ef.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── Cost Intelligence ── */}
      {(() => {
        // Calculate cost per factory
        const vnFactories = factories.filter(fs => fs.factory.country !== 'India');
        const inFactories = factories.filter(fs => fs.factory.country === 'India');
        const totalVnKwh = vnFactories.reduce((s, fs) => s + (kwhByFactory[fs.factory.id] || 0), 0);
        const totalInKwh = inFactories.reduce((s, fs) => s + (kwhByFactory[fs.factory.id] || 0), 0);
        const totalVnCost = totalVnKwh * vnUnitCost; // VND
        const totalInCostVnd = totalInKwh * inUnitCost * 280; // INR → VND (approx)
        const totalCostVnd = totalVnCost + totalInCostVnd;
        const s2Emissions = scopeData?.totalEmissions || 0;
        const costPerTonne = s2Emissions > 0 ? totalCostVnd / s2Emissions : 0;
        return (
          <div className="card animate-fade-in-up" style={{ marginTop: 12, border: '1.5px solid var(--color-scope-2)22' }}>
            <div className="card-header">
              <div className="card-title">💡 Phân tích chi phí điện → tCO₂e</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Nhập đơn giá để tính chi phí / tấn carbon</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>🇻🇳 Giá điện VN (VND/kWh)</div>
                <input type="number" value={vnUnitCost} onChange={e => setVnUnitCost(Number(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--color-border)', fontSize: 13, width: 140, textAlign: 'right' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>🇮🇳 Giá điện Ấn Độ (INR/kWh)</div>
                <input type="number" value={inUnitCost} onChange={e => setInUnitCost(Number(e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid var(--color-border)', fontSize: 13, width: 140, textAlign: 'right' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>🇻🇳 Tổng kWh</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{totalVnKwh.toLocaleString('vi-VN')}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>kWh tiêu thụ</div>
              </div>
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>🇮🇳 Tổng kWh</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{totalInKwh.toLocaleString('vi-VN')}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>kWh tiêu thụ</div>
              </div>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#9a3412', marginBottom: 4 }}>Tổng chi phí điện</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#c2410c' }}>
                  {totalCostVnd >= 1e9 ? (totalCostVnd / 1e9).toFixed(1) + ' tỷ' : (totalCostVnd / 1e6).toFixed(0) + ' triệu'}
                </div>
                <div style={{ fontSize: 10, color: '#9a3412' }}>VND (ước tính)</div>
              </div>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#0c4a6e', marginBottom: 4 }}>Chi phí / tCO₂e</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#0369a1' }}>
                  {costPerTonne > 0 ? (costPerTonne / 1e6).toFixed(1) + ' triệu' : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#0c4a6e' }}>VND / tấn CO₂e</div>
              </div>
            </div>
            {totalKwh > 0 && s2Emissions > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '8px 12px' }}>
                Gợi ý: Với {s2Emissions.toLocaleString()} tCO₂e Scope 2 — giảm 10% điện tiêu thụ tương đương giảm {Math.round(s2Emissions * 0.1).toLocaleString()} tCO₂e và tiết kiệm {((totalCostVnd * 0.1) / 1e6).toFixed(0)} triệu VND/năm.
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
