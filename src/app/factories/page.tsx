'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_COLORS } from '@/lib/types';
import type { FactorySummary } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import TrendLine from '@/components/charts/TrendLine';

export default function FactoriesPage() {
  const [loading, setLoading] = useState(true);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);

  useEffect(() => {
    getDashboardData().then(data => {
      setFactorySummaries(data.factorySummaries);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🏭 <span className="page-title-accent">Nhà máy</span></div>
        <div className="page-subtitle">So sánh phát thải GHG giữa 4 nhà máy — 3 tại Việt Nam 🇻🇳 + 1 tại Ấn Độ 🇮🇳</div>
      </div>

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
          </div>
        ))}
      </div>

      <div className="card mb-xl animate-fade-in-up">
        <div className="card-header"><div className="card-title">Phát thải theo Scope — So sánh nhà máy</div></div>
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

      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Xu hướng tổng phát thải — Tất cả nhà máy</div></div>
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
