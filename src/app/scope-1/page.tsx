'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_1_CATEGORIES, SCOPE_COLORS } from '@/lib/types';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import TrendLine from '@/components/charts/TrendLine';

export default function Scope1Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<ScopeSummary | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);

  useEffect(() => {
    getDashboardData()
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_1') || null);
        setFactorySummaries(data.factorySummaries);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  if (loading || !scopeData) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  const scopeColor = SCOPE_COLORS.scope_1;

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span style={{ color: scopeColor }}>🔥</span> Scope 1 <span className="page-title-accent">Phát thải trực tiếp</span></div>
        <div className="page-subtitle">Phát thải GHG trực tiếp từ các nguồn thuộc sở hữu hoặc kiểm soát của công ty</div>
      </div>

      <div className="grid-4 stagger-children mb-xl">
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{formatTCO2e(scopeData.totalEmissions)}</div><div className="kpi-card-label">Tổng tCO₂e (YTD)</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{scopeData.percentOfTotal}%</div><div className="kpi-card-label">Tỷ trọng tổng phát thải</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeData.changePercent < 0 ? '#2ECC71' : scopeColor }}>{scopeData.changePercent}%</div><div className="kpi-card-label">So với năm trước</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{scopeData.categories.length}</div><div className="kpi-card-label">Nguồn phát thải</div></div>
      </div>

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

      <div className="section mb-xl">
        <div className="section-header"><div className="section-title">So sánh nhà máy — Scope 1</div></div>
        <div className="card animate-fade-in-up">
          <BarChart
            data={factorySummaries.map(fs => ({
              label: `${fs.factory.name}`,
              values: [{ key: 'scope_1', value: fs.scope1, color: scopeColor }],
            }))}
            legendLabels={{ scope_1: 'Scope 1 (tCO₂e)' }}
            height={260}
          />
        </div>
      </div>

      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Xu hướng Scope 1 hàng tháng</div></div>
        <TrendLine
          data={factorySummaries[0]?.monthlyTrend.map((_, i) => ({
            label: factorySummaries[0].monthlyTrend[i].label,
            values: factorySummaries.map((fs, fi) => ({
              key: fs.factory.code,
              value: fs.monthlyTrend[i].scope1,
              color: ['#E32314', '#FF6B5A', '#B91C1C', '#F97316'][fi],
            })),
          })) || []}
          legendLabels={Object.fromEntries(factorySummaries.map(fs => [fs.factory.code, `${fs.factory.name}`]))}
          height={280}
          showArea={false}
        />
      </div>
    </div>
  );
}
