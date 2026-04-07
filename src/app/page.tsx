'use client';

import { DEMO_SCOPE_SUMMARIES, DEMO_GRAND_TOTAL, DEMO_MONTHLY_TOTALS, DEMO_FACTORY_SUMMARIES, DEMO_TARGETS, formatTCO2e, formatNumber } from '@/lib/demo-data';
import { SCOPE_COLORS } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import TrendLine from '@/components/charts/TrendLine';
import TargetGauge from '@/components/charts/TargetGauge';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div>
      {/* ── Hero KPI Strip ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tổng phát thải {new Date().getFullYear()} (YTD)
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
              {formatTCO2e(DEMO_GRAND_TOTAL)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '18px', color: 'var(--color-text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                tCO₂e
              </span>
            </div>
          </div>
          <div className="card-change positive" style={{ marginBottom: '12px' }}>
            ↓ 5.2% vs năm trước
          </div>
        </div>
      </div>

      {/* ── Scope Cards ── */}
      <div className="grid-3 stagger-children mb-xl">
        {DEMO_SCOPE_SUMMARIES.map((scope) => (
          <Link key={scope.scope} href={`/${scope.scope.replace('_', '-')}`}>
            <div className={`card scope-card ${scope.scope.replace('_', '-')} animate-fade-in-up`}>
              <div className="scope-card-icon">
                {scope.scope === 'scope_1' ? '🔥' : scope.scope === 'scope_2' ? '⚡' : '🌍'}
              </div>
              <div className="card-title">
                {scope.scope === 'scope_1' ? 'Scope 1 — Trực tiếp' :
                 scope.scope === 'scope_2' ? 'Scope 2 — Năng lượng' :
                 'Scope 3 — Chuỗi giá trị'}
              </div>
              <div className="card-value">
                {formatTCO2e(scope.totalEmissions)}
                <span className="card-value-unit">tCO₂e</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-md)' }}>
                <div className="scope-card-pct" style={{ color: SCOPE_COLORS[scope.scope] }}>
                  {scope.percentOfTotal}%
                </div>
                <div className={`card-change ${scope.changePercent < 0 ? 'positive' : 'negative'}`}>
                  {scope.changePercent < 0 ? '↓' : '↑'} {Math.abs(scope.changePercent)}%
                </div>
              </div>

              {/* Mini bar breakdown */}
              <div className="factory-card-bar" style={{ marginTop: 'var(--space-md)' }}>
                {scope.categories.map((cat) => (
                  <div
                    key={cat.category}
                    className="factory-card-bar-segment"
                    style={{
                      width: `${cat.percentOfScope}%`,
                      background: SCOPE_COLORS[scope.scope],
                      opacity: 0.4 + (cat.percentOfScope / 100) * 0.6,
                    }}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Charts Row: Monthly Trend + Scope Breakdown ── */}
      <div className="grid-2-1 mb-xl">
        {/* Monthly Stacked Bar */}
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phát thải theo tháng</div>
            <div className="header-badge">📊 tCO₂e</div>
          </div>
          <BarChart
            data={DEMO_MONTHLY_TOTALS.map(m => ({
              label: m.label,
              values: [
                { key: 'scope_1', value: m.scope1, color: SCOPE_COLORS.scope_1 },
                { key: 'scope_2', value: m.scope2, color: SCOPE_COLORS.scope_2 },
                { key: 'scope_3', value: m.scope3, color: SCOPE_COLORS.scope_3 },
              ],
            }))}
            legendLabels={{
              scope_1: 'Scope 1',
              scope_2: 'Scope 2',
              scope_3: 'Scope 3',
            }}
            height={300}
          />
        </div>

        {/* Donut */}
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phân bổ phát thải</div>
          </div>
          <DonutChart
            segments={DEMO_SCOPE_SUMMARIES.map(s => ({
              label: s.scope === 'scope_1' ? 'Scope 1' : s.scope === 'scope_2' ? 'Scope 2' : 'Scope 3',
              value: s.totalEmissions,
              color: SCOPE_COLORS[s.scope],
            }))}
            size={200}
            centerValue={`${DEMO_SCOPE_SUMMARIES[2].percentOfTotal}%`}
            centerLabel="Scope 3"
          />
        </div>
      </div>

      {/* ── Factory Comparison ── */}
      <div className="section mb-xl">
        <div className="section-header">
          <div className="section-title">So sánh nhà máy</div>
          <Link href="/factories" className="btn btn-outline" style={{ fontSize: '13px' }}>
            Xem chi tiết →
          </Link>
        </div>
        <div className="grid-4 stagger-children">
          {DEMO_FACTORY_SUMMARIES.map((fs) => (
            <div key={fs.factory.id} className="card factory-card animate-fade-in-up">
              <div className="factory-card-header">
                <div className="factory-card-icon">🏭</div>
                <div>
                  <div className="factory-card-name">{fs.factory.name}</div>
                  <div className="factory-card-location">{fs.factory.location}</div>
                </div>
              </div>
              <div className="factory-card-emissions">
                {formatTCO2e(fs.totalEmissions)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                  tCO₂e
                </span>
              </div>
              <div className="factory-card-bar">
                <div className="factory-card-bar-segment" style={{ width: `${(fs.scope1 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_1 }} />
                <div className="factory-card-bar-segment" style={{ width: `${(fs.scope2 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_2 }} />
                <div className="factory-card-bar-segment" style={{ width: `${(fs.scope3 / fs.totalEmissions) * 100}%`, background: SCOPE_COLORS.scope_3 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span>S1: {formatNumber(fs.scope1)}</span>
                <span>S2: {formatNumber(fs.scope2)}</span>
                <span>S3: {formatNumber(fs.scope3)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SBTi Targets Progress ── */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            Tiến độ mục tiêu <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--color-primary)' }}>SBTi</span>
          </div>
          <Link href="/targets" className="btn btn-outline" style={{ fontSize: '13px' }}>
            Chi tiết →
          </Link>
        </div>
        <div className="grid-2 stagger-children">
          {DEMO_TARGETS.map((target) => (
            <div key={target.scope} className="card animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <TargetGauge target={target} />
              <div style={{ display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-md)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-text)', fontWeight: 700 }}>
                    {formatTCO2e(target.baseYearEmissions)}
                  </div>
                  <div>Năm gốc ({target.baseYear})</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-primary)', fontWeight: 700 }}>
                    {formatTCO2e(target.currentEmissions)}
                  </div>
                  <div>Hiện tại</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#8CB92D', fontWeight: 700 }}>
                    {formatTCO2e(target.targetEmissions)}
                  </div>
                  <div>Mục tiêu ({target.targetYear})</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly Trend Line ── */}
      <div className="card mt-xl animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Xu hướng phát thải hàng tháng</div>
        </div>
        <TrendLine
          data={DEMO_MONTHLY_TOTALS.map(m => ({
            label: m.label,
            values: [
              { key: 'total', value: m.total, color: '#E32314' },
              { key: 'scope_3', value: m.scope3, color: '#8CB92D' },
              { key: 'scope_1_2', value: m.scope1 + m.scope2, color: '#F5A623' },
            ],
          }))}
          legendLabels={{
            total: 'Tổng phát thải',
            scope_3: 'Scope 3',
            scope_1_2: 'Scope 1 + 2',
          }}
          height={280}
        />
      </div>
    </div>
  );
}
