'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { SCOPE_COLORS, GRID_EMISSION_FACTORS } from '@/lib/types';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import TrendLine from '@/components/charts/TrendLine';

export default function Scope2Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<ScopeSummary | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear)
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_2') || null);
        setFactorySummaries(data.factorySummaries);
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

  if (loading || !scopeData) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span style={{ color: scopeColor }}>⚡</span> Scope 2 <span className="page-title-accent">Năng lượng mua</span></div>
        <div className="page-subtitle">Phát thải gián tiếp từ điện lưới mua — Location-based method</div>
      </div>

      <div className="grid-4 stagger-children mb-xl">
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{formatTCO2e(scopeData.totalEmissions)}</div><div className="kpi-card-label">Tổng tCO₂e (YTD)</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{scopeData.percentOfTotal}%</div><div className="kpi-card-label">Tỷ trọng tổng phát thải</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeData.changePercent < 0 ? '#2ECC71' : scopeColor }}>{scopeData.changePercent}%</div><div className="kpi-card-label">So với năm trước</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>100%</div><div className="kpi-card-label">Điện lưới</div></div>
      </div>

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

      <div className="section mb-xl">
        <div className="section-header"><div className="section-title">So sánh nhà máy — Scope 2 (Điện)</div></div>
        <div className="card animate-fade-in-up">
          <BarChart
            data={factorySummaries.map(fs => ({
              label: `${fs.factory.name} ${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}`,
              values: [{ key: 'scope_2', value: fs.scope2, color: scopeColor }],
            }))}
            legendLabels={{ scope_2: 'Scope 2 (tCO₂e)' }}
            height={260}
          />
        </div>
      </div>

      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Xu hướng Scope 2 hàng tháng</div></div>
        <TrendLine
          data={factorySummaries[0]?.monthlyTrend.map((_, i) => ({
            label: factorySummaries[0].monthlyTrend[i].label,
            values: factorySummaries.map((fs, fi) => ({
              key: fs.factory.code,
              value: fs.monthlyTrend[i].scope2,
              color: ['#F5A623', '#E8960E', '#D4890A', '#C07E08'][fi],
            })),
          })) || []}
          legendLabels={Object.fromEntries(factorySummaries.map(fs => [fs.factory.code, `${fs.factory.name} (${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'})`]))}
          height={280}
          showArea={false}
        />
      </div>
    </div>
  );
}
