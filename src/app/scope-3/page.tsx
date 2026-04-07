'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { SCOPE_COLORS, SCOPE_3_CATEGORIES } from '@/lib/types';
import type { ScopeSummary, FactorySummary } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import TrendLine from '@/components/charts/TrendLine';

export default function Scope3Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<ScopeSummary | null>(null);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);

  useEffect(() => {
    getDashboardData()
      .then(data => {
        setScopeData(data.scopeSummaries.find(s => s.scope === 'scope_3') || null);
        setFactorySummaries(data.factorySummaries);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  const scopeColor = SCOPE_COLORS.scope_3;
  const catColors = ['#8CB92D', '#6B9B1E', '#4A7A12'];

  if (loading || !scopeData) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title"><span style={{ color: scopeColor }}>🌍</span> Scope 3 <span className="page-title-accent">Chuỗi giá trị</span></div>
        <div className="page-subtitle">Phát thải gián tiếp khác trong chuỗi giá trị — SBTi cam kết theo dõi 3 Categories</div>
      </div>

      <div className="grid-4 stagger-children mb-xl">
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{formatTCO2e(scopeData.totalEmissions)}</div><div className="kpi-card-label">Tổng tCO₂e (YTD)</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>{scopeData.percentOfTotal}%</div><div className="kpi-card-label">Tỷ trọng tổng phát thải</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeData.changePercent < 0 ? '#2ECC71' : scopeColor }}>{scopeData.changePercent}%</div><div className="kpi-card-label">So với năm trước</div></div>
        <div className="card kpi-card animate-fade-in-up"><div className="kpi-card-value" style={{ color: scopeColor }}>3</div><div className="kpi-card-label">SBTi Categories</div></div>
      </div>

      <div className="grid-3 stagger-children mb-xl">
        {scopeData.categories.map((cat, i) => {
          const catDef = SCOPE_3_CATEGORIES.find(c => c.key === cat.category);
          return (
            <div key={cat.category} className="card animate-fade-in-up" style={{ borderLeft: `4px solid ${catColors[i]}` }}>
              <div style={{ fontSize: '24px', marginBottom: 'var(--space-sm)' }}>{catDef?.icon}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: catColors[i], textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{catDef?.ghgCategory}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>{catDef?.description}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>{cat.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, color: 'var(--color-text)' }}>
                {formatTCO2e(cat.emissions)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'var(--space-sm)' }}>
                <div style={{ flex: 1, height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${cat.percentOfScope}%`, height: '100%', background: catColors[i], borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{cat.percentOfScope}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-1-2 mb-xl">
        <div className="card animate-fade-in-up">
          <div className="card-header"><div className="card-title">Phân bổ Scope 3</div></div>
          <DonutChart
            segments={scopeData.categories.map((cat, i) => ({
              label: SCOPE_3_CATEGORIES.find(c => c.key === cat.category)?.ghgCategory || cat.label,
              value: cat.emissions,
              color: catColors[i],
            }))}
            size={180}
            centerValue={`${scopeData.percentOfTotal}%`}
            centerLabel="of Total"
          />
        </div>
        <div className="card animate-fade-in-up">
          <div className="card-header"><div className="card-title">So sánh nhà máy — Scope 3</div></div>
          <BarChart
            data={factorySummaries.map(fs => ({
              label: `${fs.factory.name} ${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}`,
              values: [{ key: 'scope_3', value: fs.scope3, color: scopeColor }],
            }))}
            legendLabels={{ scope_3: 'Scope 3 (tCO₂e)' }}
            height={240}
          />
        </div>
      </div>

      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Xu hướng Scope 3 hàng tháng</div></div>
        <TrendLine
          data={factorySummaries[0]?.monthlyTrend.map((_, i) => ({
            label: factorySummaries[0].monthlyTrend[i].label,
            values: [{ key: 'total_s3', value: factorySummaries.reduce((sum, fs) => sum + fs.monthlyTrend[i].scope3, 0), color: scopeColor }],
          })) || []}
          legendLabels={{ total_s3: 'Tổng Scope 3' }}
          height={280}
        />
      </div>

      <div className="card mt-xl animate-fade-in-up" style={{ background: 'linear-gradient(135deg, #8CB92D11, #8CB92D05)', border: '1px solid #8CB92D33' }}>
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '32px' }}>🎯</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: scopeColor, fontWeight: 700, marginBottom: '4px' }}>SBTi Commitment</div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              Theo cam kết SBTi, Intersnack Group theo dõi 3 categories Scope 3 chiếm phần lớn phát thải chuỗi giá trị:
              <strong> Cat.1 (Hàng hóa & Dịch vụ mua)</strong>,
              <strong> Cat.3 (Hoạt động năng lượng liên quan)</strong>, và
              <strong> Cat.4 (Vận tải ngược dòng)</strong>.
              Mục tiêu giảm <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: scopeColor, fontWeight: 700 }}>30%</span> tCO₂e trước năm 2032 (so với năm gốc 2021).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
