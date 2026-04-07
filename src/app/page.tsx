'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, formatTCO2e, formatNumber } from '@/lib/data-service';
import { SCOPE_COLORS } from '@/lib/types';
import type { ScopeSummary, FactorySummary, MonthlyData, TargetProgress } from '@/lib/types';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import TrendLine from '@/components/charts/TrendLine';
import TargetGauge from '@/components/charts/TargetGauge';
import Link from 'next/link';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [scopeSummaries, setScopeSummaries] = useState<ScopeSummary[]>([]);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyData[]>([]);
  const [targets, setTargets] = useState<TargetProgress[]>([]);
  const [rcnData, setRcnData] = useState<{ totalRCN: number; totalCK: number; intensity: number; monthlyIntensity: number[] } | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    getDashboardData(selectedYear).then(data => {
      setGrandTotal(data.grandTotal);
      setScopeSummaries(data.scopeSummaries);
      setFactorySummaries(data.factorySummaries);
      setMonthlyTotals(data.monthlyTotals);
      setTargets(data.targets);
      setRcnData(data.rcnData);
      setLoading(false);
    });
  }, [selectedYear]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
        <div className="loading-spinner" />
        <span style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-muted)' }}>Đang tải dữ liệu từ Supabase...</span>
      </div>
    );
  }

  // Calculate change vs last year 
  const prevYearTotal = scopeSummaries.reduce((s, sc) => s + sc.previousYearEmissions, 0);
  const changeVsPrev = prevYearTotal > 0 ? Math.round(((grandTotal - prevYearTotal) / prevYearTotal) * 1000) / 10 : 0;

  return (
    <div>
      {/* ── Year Selector + Hero KPI Strip ── */}
      <div className="section">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tổng phát thải {selectedYear} (YTD)
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '64px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
              {formatTCO2e(grandTotal)}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '18px', color: 'var(--color-text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                tCO₂e
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div className={`card-change ${changeVsPrev < 0 ? 'positive' : 'negative'}`}>
              {changeVsPrev < 0 ? '↓' : '↑'} {Math.abs(changeVsPrev)}% vs năm trước
            </div>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                fontFamily: 'var(--font-body)', fontSize: '14px', cursor: 'pointer',
                background: 'var(--color-card-bg)', color: 'var(--color-text)',
              }}
            >
              {[2026, 2025, 2024, 2023, 2022, 2021].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Scope Cards ── */}
      <div className="grid-3 stagger-children mb-xl">
        {scopeSummaries.map((scope) => (
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

      {/* ── Charts Row ── */}
      <div className="grid-2-1 mb-xl">
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phát thải theo tháng</div>
            <div className="header-badge">📊 tCO₂e</div>
          </div>
          <BarChart
            data={monthlyTotals.filter(m => m.total > 0).map(m => ({
              label: m.label,
              values: [
                { key: 'scope_1', value: m.scope1, color: SCOPE_COLORS.scope_1 },
                { key: 'scope_2', value: m.scope2, color: SCOPE_COLORS.scope_2 },
                { key: 'scope_3', value: m.scope3, color: SCOPE_COLORS.scope_3 },
              ],
            }))}
            legendLabels={{ scope_1: 'Scope 1', scope_2: 'Scope 2', scope_3: 'Scope 3' }}
            height={300}
          />
        </div>

        <div className="card animate-fade-in-up">
          <div className="card-header">
            <div className="card-title">Phân bổ phát thải</div>
          </div>
          <DonutChart
            segments={scopeSummaries.map(s => ({
              label: s.scope === 'scope_1' ? 'Scope 1' : s.scope === 'scope_2' ? 'Scope 2' : 'Scope 3',
              value: s.totalEmissions,
              color: SCOPE_COLORS[s.scope],
            }))}
            size={200}
            centerValue={grandTotal > 0 ? `${scopeSummaries.find(s => s.scope === 'scope_1')?.percentOfTotal || 0}%` : '0%'}
            centerLabel="Scope 1"
          />
        </div>
      </div>

      {/* ── Factory Comparison ── */}
      <div className="section mb-xl">
        <div className="section-header">
          <div className="section-title">So sánh nhà máy</div>
          <Link href="/factories" className="btn btn-outline" style={{ fontSize: '13px' }}>Xem chi tiết →</Link>
        </div>
        <div className="grid-4 stagger-children">
          {factorySummaries.map((fs) => (
            <div key={fs.factory.id} className="card factory-card animate-fade-in-up">
              <div className="factory-card-header">
                <div className="factory-card-icon">{fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}</div>
                <div>
                  <div className="factory-card-name">{fs.factory.name}</div>
                  <div className="factory-card-location">{fs.factory.location}</div>
                </div>
              </div>
              <div className="factory-card-emissions">
                {formatTCO2e(fs.totalEmissions)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
              </div>
              {fs.totalEmissions > 0 && (
                <>
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
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── RCN Emission Intensity ── */}
      {rcnData && rcnData.totalRCN > 0 && (
        <div className="section mb-xl">
          <div className="section-header">
            <div className="section-title">Cường độ phát thải theo RCN</div>
            <div className="header-badge" style={{ background: 'var(--color-primary)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
              tCO₂e / MT RCN
            </div>
          </div>
          <div className="grid-3 stagger-children mb-lg">
            <div className="card animate-fade-in-up">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                🥜 Nguyên liệu RCN
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                {formatTCO2e(rcnData.totalRCN)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>MT</span>
              </div>
            </div>
            <div className="card animate-fade-in-up">
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                📦 Sản phẩm CK
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
                {formatTCO2e(rcnData.totalCK)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '16px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>MT</span>
              </div>
            </div>
            <div className="card animate-fade-in-up" style={{ borderLeft: '4px solid #6366F1' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                📊 Cường độ phát thải
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 700, color: '#6366F1', lineHeight: 1 }}>
                {rcnData.intensity.toFixed(3)}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>tCO₂e / MT RCN</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Tổng {formatTCO2e(grandTotal)} tCO₂e ÷ {formatTCO2e(rcnData.totalRCN)} MT RCN
              </div>
            </div>
          </div>
          <div className="card animate-fade-in-up">
            <div className="card-header">
              <div className="card-title">Xu hướng cường độ phát thải theo tháng</div>
              <div className="header-badge">tCO₂e / MT RCN</div>
            </div>
            <TrendLine
              data={monthlyTotals
                .map((m, i) => ({ label: m.label, values: [{ key: 'intensity', value: rcnData.monthlyIntensity[i], color: '#6366F1' }] }))
                .filter(d => d.values[0].value > 0)}
              legendLabels={{ intensity: 'Cường độ (tCO₂e / MT RCN)' }}
              height={220}
            />
          </div>
        </div>
      )}

      {/* ── SBTi Targets ── */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            Tiến độ mục tiêu <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--color-primary)' }}>SBTi</span>
          </div>
          <Link href="/targets" className="btn btn-outline" style={{ fontSize: '13px' }}>Chi tiết →</Link>
        </div>
        <div className="grid-2 stagger-children">
          {targets.map((target) => (
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
          <div className="card-title">Xu hướng phát thải theo phạm vi</div>
          <div className="header-badge">📈 tCO₂e / tháng</div>
        </div>
        <TrendLine
          data={monthlyTotals.filter(m => m.total > 0).map(m => ({
            label: m.label,
            values: [
              { key: 'scope_1', value: m.scope1, color: SCOPE_COLORS.scope_1 },
              { key: 'scope_2', value: m.scope2, color: SCOPE_COLORS.scope_2 },
              { key: 'scope_3', value: m.scope3, color: SCOPE_COLORS.scope_3 },
            ],
          }))}
          legendLabels={{ scope_1: 'Scope 1 — Trực tiếp', scope_2: 'Scope 2 — Điện', scope_3: 'Scope 3 — Chuỗi giá trị' }}
          height={280}
        />
      </div>
    </div>
  );
}
