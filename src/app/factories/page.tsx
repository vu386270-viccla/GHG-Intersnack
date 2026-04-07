'use client';

import { DEMO_FACTORY_SUMMARIES, formatTCO2e, formatNumber } from '@/lib/demo-data';
import { SCOPE_COLORS } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import TrendLine from '@/components/charts/TrendLine';

export default function FactoriesPage() {
  const sortedFactories = [...DEMO_FACTORY_SUMMARIES].sort((a, b) => b.totalEmissions - a.totalEmissions);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          🏭
          <span className="page-title-accent">Nhà máy</span>
        </div>
        <div className="page-subtitle">So sánh phát thải GHG giữa 4 nhà máy — 3 tại Việt Nam 🇻🇳 + 1 tại Ấn Độ 🇮🇳</div>
      </div>

      {/* Factory Cards */}
      <div className="grid-4 stagger-children mb-xl">
        {sortedFactories.map((fs, ri) => (
          <div key={fs.factory.id} className="card factory-card animate-fade-in-up">
            <div className="factory-card-header">
              <div className="factory-card-icon">
                {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}
              </div>
              <div>
                <div className="factory-card-name">{fs.factory.name}</div>
                <div className="factory-card-location">{fs.factory.location}, {fs.factory.country}</div>
              </div>
              {ri === 0 && (
                <div style={{
                  marginLeft: 'auto',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  background: 'var(--color-primary-alpha-10)',
                  color: 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)',
                  textTransform: 'uppercase',
                }}>
                  Cao nhất
                </div>
              )}
            </div>
            <div className="factory-card-emissions">
              {formatTCO2e(fs.totalEmissions)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
            </div>
            <div className="factory-card-bar" style={{ height: '8px' }}>
              <div className="factory-card-bar-segment" style={{ width: `${(fs.scope1 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_1 }} />
              <div className="factory-card-bar-segment" style={{ width: `${(fs.scope2 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_2 }} />
              <div className="factory-card-bar-segment" style={{ width: `${(fs.scope3 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_3 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: 'var(--space-md)', fontSize: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: SCOPE_COLORS.scope_1, fontWeight: 700 }}>S1</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope1)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: SCOPE_COLORS.scope_2, fontWeight: 700 }}>S2</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope2)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: SCOPE_COLORS.scope_3, fontWeight: 700 }}>S3</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px' }}>{formatNumber(fs.scope3)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Grouped Bar Chart */}
      <div className="card mb-xl animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Phát thải theo Scope — So sánh nhà máy</div>
        </div>
        <BarChart
          data={DEMO_FACTORY_SUMMARIES.map(fs => ({
            label: `${fs.factory.code} ${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}`,
            values: [
              { key: 'scope_1', value: fs.scope1, color: SCOPE_COLORS.scope_1 },
              { key: 'scope_2', value: fs.scope2, color: SCOPE_COLORS.scope_2 },
              { key: 'scope_3', value: fs.scope3, color: SCOPE_COLORS.scope_3 },
            ],
          }))}
          legendLabels={{
            scope_1: 'Scope 1 — Trực tiếp',
            scope_2: 'Scope 2 — Điện',
            scope_3: 'Scope 3 — Chuỗi giá trị',
          }}
          height={320}
        />
      </div>

      {/* Monthly Trend All Factories */}
      <div className="card animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Xu hướng tổng phát thải — Tất cả nhà máy</div>
        </div>
        <TrendLine
          data={DEMO_FACTORY_SUMMARIES[0].monthlyTrend.map((_, i) => ({
            label: DEMO_FACTORY_SUMMARIES[0].monthlyTrend[i].label,
            values: DEMO_FACTORY_SUMMARIES.map((fs, fi) => ({
              key: fs.factory.code,
              value: fs.monthlyTrend[i].total,
              color: ['#E32314', '#F5A623', '#8CB92D', '#6366F1'][fi],
            })),
          }))}
          legendLabels={Object.fromEntries(
            DEMO_FACTORY_SUMMARIES.map(fs => [
              fs.factory.code,
              `${fs.factory.name} (${fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} ${fs.factory.location})`,
            ])
          )}
          height={300}
          showArea={false}
        />
      </div>
    </div>
  );
}
