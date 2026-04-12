'use client';

import { useEffect, useState } from 'react';
import { getDashboardData, getAnnualTotals, formatTCO2e } from '@/lib/data-service';
import { SCOPE_COLORS } from '@/lib/types';
import type { TargetProgress } from '@/lib/types';
import TargetGauge from '@/components/charts/TargetGauge';
import BarChart from '@/components/charts/BarChart';

export default function TargetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<TargetProgress[]>([]);
  const [annualTotals, setAnnualTotals] = useState<Record<number, { s1: number; s2: number; s3: number }>>({});

  const baseYear = 2021;
  const targetYear = 2032;
  const currentYear = new Date().getFullYear();
  const yearsElapsed = currentYear - baseYear;
  const totalYears = targetYear - baseYear;
  const timeProgress = (yearsElapsed / totalYears) * 100;

  useEffect(() => {
    Promise.all([getDashboardData(), getAnnualTotals(baseYear, currentYear)])
      .then(([data, annual]) => {
        setTargets(data.targets);
        setAnnualTotals(annual);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">🎯 <span className="page-title-accent">SBTi Targets</span></div>
        <div className="page-subtitle">Science Based Targets initiative — Mục tiêu giảm phát thải đã được phê duyệt (Base year: {baseYear} → Target: {targetYear})</div>
      </div>

      <div className="card mb-xl animate-fade-in-up" style={{ background: 'linear-gradient(135deg, #E3231408, #E3231403)', border: '1px solid #E3231422' }}>
        <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '48px' }}>🎯</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--color-primary)', fontWeight: 700 }}>Intersnack Group — Science Based Targets</div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.7 }}>Cam kết giảm phát thải theo khung SBTi. Mục tiêu near-term targets đã được phê duyệt bởi SBTi.</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-xl)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-md) var(--space-lg)', background: 'white', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: SCOPE_COLORS.scope_1, fontWeight: 700 }}>-50%</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Scope 1 + 2</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-md) var(--space-lg)', background: 'white', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: SCOPE_COLORS.scope_3, fontWeight: 700 }}>-30%</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Scope 3</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-xl animate-fade-in-up">
        <div className="card-header">
          <div className="card-title">Tiến độ thời gian</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Năm {currentYear} — Năm thứ {yearsElapsed}/{totalYears}</div>
        </div>
        <div style={{ position: 'relative', height: '40px', marginTop: 'var(--space-md)' }}>
          <div style={{ position: 'absolute', top: '16px', left: 0, right: 0, height: '8px', background: 'var(--color-border-light)', borderRadius: '4px' }}>
            <div style={{ width: `${timeProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-scope-3))', borderRadius: '4px' }} />
          </div>
          {Array.from({ length: totalYears + 1 }, (_, i) => {
            const year = baseYear + i;
            const pos = (i / totalYears) * 100;
            const isCurrent = year === currentYear;
            return (
              <div key={year} style={{ position: 'absolute', left: `${pos}%`, top: isCurrent ? '-4px' : '8px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {isCurrent && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-primary)', border: '3px solid white', boxShadow: '0 0 0 2px var(--color-primary)', marginBottom: '4px' }} />}
                <div style={{ fontSize: isCurrent ? '12px' : '10px', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: isCurrent ? '2px' : '14px' }}>{year}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2 stagger-children mb-xl">
        {targets.map(target => (
          <div key={target.scope} className="card animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-2xl)' }}>
            <TargetGauge target={target} size={220} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-xl)', marginTop: 'var(--space-xl)', width: '100%', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border-light)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Năm gốc ({target.baseYear})</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>{formatTCO2e(target.baseYearEmissions)}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>tCO₂e</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hiện tại ({currentYear})</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatTCO2e(target.currentEmissions)}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>tCO₂e</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Mục tiêu ({target.targetYear})</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: SCOPE_COLORS.scope_3 }}>{formatTCO2e(target.targetEmissions)}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>tCO₂e</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card animate-fade-in-up">
        <div className="card-header"><div className="card-title">Lộ trình giảm phát thải — {baseYear} → {targetYear}</div></div>
        <BarChart
          data={Array.from({ length: targetYear - baseYear + 1 }, (_, i) => {
            const year = baseYear + i;
            const progress = i / totalYears;
            const s12Base = targets[0]?.baseYearEmissions || 0;
            const s3Base = targets[1]?.baseYearEmissions || 0;
            const s12Target = Math.round(s12Base * (1 - 0.50 * progress));
            const s3Target = Math.round(s3Base * (1 - 0.3 * progress));
            const actual = annualTotals[year];
            const actualS12 = actual ? actual.s1 + actual.s2 : 0;
            const hasS12 = actualS12 > 0;
            const hasS3  = !!actual && actual.s3 > 0;
            return {
              label: String(year),
              values: [
                { key: 'scope_1_2', value: hasS12 ? Math.round(actualS12) : s12Target, color: hasS12 ? '#E32314' : '#E3231444' },
                { key: 'scope_3',   value: hasS3  ? Math.round(actual.s3) : s3Target,  color: hasS3  ? '#8CB92D' : '#8CB92D44' },
              ],
            };
          })}
          legendLabels={{ scope_1_2: 'Scope 1 + 2', scope_3: 'Scope 3' }}
          height={320}
        />
        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Cột đậm = Thực tế | Cột nhạt = Lộ trình mục tiêu (linear pathway)
        </div>
      </div>
    </div>
  );
}
