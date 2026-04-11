'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_COLORS, MONTHS_VI } from '@/lib/types';
import type { FactorySummary } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import TrendLine from '@/components/charts/TrendLine';

export default function FactoriesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [completeness, setCompleteness] = useState<Record<string, boolean[]>>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setFactorySummaries(data.factorySummaries);
        setCompleteness(data.completeness || {});
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [selectedYear]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  // Compute overall completeness % per factory
  const totalMonthsWithData = (factId: string) =>
    (completeness[factId] || []).filter(Boolean).length;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <div>
          <div className="page-title">🏭 <span className="page-title-accent">Nhà máy</span></div>
          <div className="page-subtitle">So sánh phát thải GHG giữa 4 nhà máy — 3 tại Việt Nam 🇻🇳 + 1 tại Ấn Độ 🇮🇳</div>
        </div>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 14, background: 'var(--color-card-bg)', color: 'var(--color-text)', fontWeight: 700, cursor: 'pointer' }}
        >
          {[2026, 2025, 2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── Factory cards ── */}
      <div className="grid-4 stagger-children mb-xl">
        {factorySummaries.map((fs, ri) => (
          <div key={fs.factory.id} className="card factory-card animate-fade-in-up">
            <div className="factory-card-header">
              <div className="factory-card-icon">{fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}</div>
              <div>
                <div className="factory-card-name">{fs.factory.name}</div>
                <div className="factory-card-location">{fs.factory.location}, {fs.factory.country}</div>
              </div>
              {ri === 0 && (
                <div style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 8px', background: 'var(--color-primary-alpha-10)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', textTransform: 'uppercase' }}>Cao nhất</div>
              )}
            </div>
            <div className="factory-card-emissions">
              {formatTCO2e(fs.totalEmissions)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
            </div>
            {fs.totalEmissions > 0 && (
              <>
                <div className="factory-card-bar" style={{ height: '8px' }}>
                  <div className="factory-card-bar-segment" style={{ width: `${(fs.scope1 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_1 }} />
                  <div className="factory-card-bar-segment" style={{ width: `${(fs.scope2 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_2 }} />
                  <div className="factory-card-bar-segment" style={{ width: `${(fs.scope3 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_3 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: 'var(--space-md)', fontSize: '12px' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ color: SCOPE_COLORS.scope_1, fontWeight: 700 }}>S1</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope1)}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: SCOPE_COLORS.scope_2, fontWeight: 700 }}>S2</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope2)}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: SCOPE_COLORS.scope_3, fontWeight: 700 }}>S3</div><div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope3)}</div></div>
                </div>
              </>
            )}
            {/* Data completeness badge */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {(() => {
                const months = totalMonthsWithData(fs.factory.id);
                const pct = Math.round((months / 12) * 100);
                const color = months === 12 ? '#22c55e' : months >= 6 ? '#f59e0b' : '#ef4444';
                return (
                  <>
                    <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{months}/12 tháng</span>
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* ── Completeness heatmap ── */}
      <div className="card mb-xl animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Độ đầy đủ dữ liệu — {selectedYear}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 2, display: 'inline-block' }} />Có dữ liệu</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 2, display: 'inline-block' }} />Chưa nhập</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, width: 140 }}>Nhà máy</th>
                {MONTHS_VI.map((m, i) => (
                  <th key={i} style={{ textAlign: 'center', padding: '6px 4px', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 32 }}>{m}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {factorySummaries.map(fs => {
                const cells = completeness[fs.factory.id] || Array(12).fill(false);
                const filled = cells.filter(Boolean).length;
                return (
                  <tr key={fs.factory.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>
                      {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fs.factory.name}
                    </td>
                    {cells.map((has, mi) => (
                      <td key={mi} style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <div
                          title={`${MONTHS_VI[mi]} ${selectedYear}: ${has ? 'Có dữ liệu' : 'Chưa nhập'}`}
                          style={{
                            width: 24, height: 24, borderRadius: 4, margin: '0 auto',
                            background: has ? '#dcfce7' : '#f3f4f6',
                            border: `1.5px solid ${has ? '#22c55e' : '#e5e7eb'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11,
                          }}
                        >
                          {has ? '✓' : ''}
                        </div>
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '8px 8px', fontWeight: 700, fontSize: 12, color: filled === 12 ? '#22c55e' : filled >= 6 ? '#f59e0b' : '#ef4444' }}>
                      {Math.round((filled / 12) * 100)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bar chart ── */}
      <div className="card mb-xl animate-fade-in-up">
        <div className="card-header"><div className="card-title">Phát thải theo Scope — So sánh nhà máy {selectedYear}</div></div>
        <BarChart
          data={factorySummaries.map(fs => ({
            label: `${fs.factory.name} ${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}`,
            values: [
              { key: 'scope_1', value: fs.scope1, color: SCOPE_COLORS.scope_1 },
              { key: 'scope_2', value: fs.scope2, color: SCOPE_COLORS.scope_2 },
              { key: 'scope_3', value: fs.scope3, color: SCOPE_COLORS.scope_3 },
            ],
          }))}
          legendLabels={{ scope_1: 'Scope 1 — Trực tiếp', scope_2: 'Scope 2 — Điện', scope_3: 'Scope 3 — Chuỗi giá trị' }}
          height={320}
        />
      </div>

      {/* ── Trend line ── */}
      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Xu hướng tổng phát thải {selectedYear} — Tất cả nhà máy</div></div>
        <TrendLine
          data={factorySummaries[0]?.monthlyTrend.map((_, i) => ({
            label: factorySummaries[0].monthlyTrend[i].label,
            values: factorySummaries.map((fs, fi) => ({
              key: fs.factory.code,
              value: fs.monthlyTrend[i].total,
              color: ['#E32314', '#F5A623', '#8CB92D', '#6366F1'][fi],
            })),
          })) || []}
          legendLabels={Object.fromEntries(factorySummaries.map(fs => [fs.factory.code, `${fs.factory.name} (${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'})`]))}
          height={300}
          showArea={false}
        />
      </div>
    </div>
  );
}
