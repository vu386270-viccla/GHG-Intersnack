'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardData, formatTCO2e, formatNumber, getScope3SummaryData } from '@/lib/data-service';
import { SCOPE_COLORS, MONTHS_VI } from '@/lib/types';
import type { ScopeSummary, FactorySummary, MonthlyData, TargetProgress } from '@/lib/types';
import Link from 'next/link';

type ScopeFilter = 'ALL' | 'scope_1' | 'scope_2' | 'scope_3';

const S_COLOR = { scope_1: '#E32314', scope_2: '#F5A623', scope_3: '#8CB92D' };

function getScopeVal(m: MonthlyData, scope: ScopeFilter): number {
  if (scope === 'scope_1') return m.scope1;
  if (scope === 'scope_2') return m.scope2;
  if (scope === 'scope_3') return m.scope3;
  return m.total;
}

/* ── Mini Stacked Bar Chart (inline SVG) ── */
function MiniStackedBar({ monthly, height = 80 }: { monthly: MonthlyData[]; height?: number }) {
  const active = monthly.filter(m => m.total > 0);
  if (active.length === 0) return <div style={{ height }} />;
  const maxV = Math.max(...active.map(m => m.total)) * 1.1;
  const W = 100, H = height, barW = Math.max(2, (W - 4) / active.length - 2), gap = (W - 4) / active.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      {active.map((m, i) => {
        const x = 2 + i * gap;
        const h1 = (m.scope1 / maxV) * (H - 4);
        const h2 = (m.scope2 / maxV) * (H - 4);
        const h3 = (m.scope3 / maxV) * (H - 4);
        return (
          <g key={m.month}>
            <rect x={x} y={H - 2 - h1} width={barW} height={Math.max(h1, 0.5)} fill={S_COLOR.scope_1} opacity={0.8} rx={1} />
            <rect x={x} y={H - 2 - h1 - h2} width={barW} height={Math.max(h2, 0.5)} fill={S_COLOR.scope_2} opacity={0.85} rx={1} />
            {h3 > 0 && <rect x={x} y={H - 2 - h1 - h2 - h3} width={barW} height={Math.max(h3, 0.5)} fill={S_COLOR.scope_3} opacity={0.85} rx={1} />}
            <text x={x + barW / 2} y={H - 1} textAnchor="middle" fontSize={5.5} fill="#aaa">{MONTHS_VI[m.month - 1]?.slice(0, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Scope Donut (SVG) ── */
function ScopeDonut({ s1, s2, s3, size = 100 }: { s1: number; s2: number; s3: number; size?: number }) {
  const total = s1 + s2 + s3;
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.36, thick = size * 0.13;
  const circ = 2 * Math.PI * r;
  const segs = [
    { val: s1, col: S_COLOR.scope_1 },
    { val: s2, col: S_COLOR.scope_2 },
    { val: s3, col: S_COLOR.scope_3 },
  ].filter(s => s.val > 0);
  let cum = -90;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      {segs.map((seg, i) => {
        const pct = seg.val / total;
        const dash = pct * circ;
        const rot = cum; cum += pct * 360;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.col} strokeWidth={thick}
            strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(${rot} ${cx} ${cy})`} />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize={size * 0.1} fontWeight={700} fill="#333">
        {total > 0 ? `${Math.round(s1 / total * 100)}%` : ''}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={size * 0.08} fill="#999">S1</text>
    </svg>
  );
}

/* ── SBTi Target Card ── */
function SBTiCard({ label, icon, targetPct, current, base, color, breakdown, footer }:
  { label: string; icon: string; targetPct: number; current: number; base: number; color: string; breakdown?: { name: string; value: number; pct: number }[]; footer?: React.ReactNode }
) {
  const reducedPct = base > 0 ? Math.max(0, (base - current) / base * 100) : 0;
  const targetVal  = Math.round(base * (1 - targetPct / 100));
  const onTrack    = reducedPct >= (targetPct * (new Date().getFullYear() - 2021) / (2032 - 2021));
  // Half-donut SVG (180° arc, left to right)
  const W = 160, H = 85, cx = W / 2, cy = H - 8, R = 68, thick = 14;
  function halfArc(pct: number) {
    const clamp = Math.min(Math.max(pct, 0), 100);
    const endAngle = Math.PI * (clamp / 100); // 0..PI = left..right
    const ex = cx - R * Math.cos(endAngle);   // mirror: left=0% right=100%
    const ey = cy - R * Math.sin(endAngle);
    const large = clamp > 50 ? 1 : 0;
    if (clamp <= 0) return '';
    if (clamp >= 100) return `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy}`;
    return `M ${cx - R} ${cy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
  }
  const targetAngle = Math.PI * (targetPct / 100);
  const tx = cx - R * Math.cos(targetAngle), ty = cy - R * Math.sin(targetAngle);
  return (
    <div style={{ flex: 1, background: 'var(--color-card-bg)', border: `1.5px solid ${color}22`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.5px' }}>{icon} {label}</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>Target 2032: −{targetPct}% vs 2021</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: onTrack ? '#dcfce7' : '#fee2e2',
          color: onTrack ? '#166534' : '#991b1b' }}>
          {onTrack ? '✓ On track' : '✗ Behind'}
        </div>
      </div>
      {/* Half-donut arc */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0, overflow: 'visible' }}>
          {/* Track */}
          <path d={halfArc(100)} fill="none" stroke="#f0f0f0" strokeWidth={thick} strokeLinecap="round" />
          {/* Actual */}
          {reducedPct > 0 && <path d={halfArc(reducedPct)} fill="none" stroke={onTrack ? color : '#ef4444'} strokeWidth={thick} strokeLinecap="round" opacity={0.85} />}
          {/* Target marker */}
          <circle cx={tx} cy={ty} r={6} fill={color} stroke="#fff" strokeWidth={2.5} />
          {/* Center labels */}
          <text x={cx} y={cy - R - 6} textAnchor="middle" fontSize={22} fontWeight={900} fill={onTrack ? color : '#ef4444'}>{reducedPct.toFixed(1)}%</text>
          <text x={cx} y={cy - R + 8} textAnchor="middle" fontSize={8} fill="#bbb">reduced so far</text>
          <text x={cx - R - 2} y={cy + 14} textAnchor="middle" fontSize={8} fill="#aaa">0%</text>
          <text x={cx + R + 2} y={cy + 14} textAnchor="middle" fontSize={8} fill="#aaa">100%</text>
          <text x={tx} y={ty - 10} textAnchor="middle" fontSize={8} fontWeight={700} fill={color}>T</text>
        </svg>
        {/* Key numbers */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase' }}>Baseline 2021</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#555' }}>{formatTCO2e(base)}</span>
          </div>
          <div style={{ height: 1, background: '#f0f0f0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: '#aaa', textTransform: 'uppercase' }}>Hiện tại</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: onTrack ? color : '#ef4444' }}>{formatTCO2e(current)}</span>
          </div>
          <div style={{ height: 1, background: '#f0f0f0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, color: color, textTransform: 'uppercase', fontWeight: 700 }}>Target 2032</span>
            <span style={{ fontSize: 14, fontWeight: 800, color }}>{formatTCO2e(targetVal)}</span>
          </div>
          {/* thin progress bar */}
          <div style={{ position: 'relative', height: 6, background: '#f3f4f6', borderRadius: 4, overflow: 'visible', marginTop: 2 }}>
            <div style={{ height: '100%', width: `${reducedPct}%`, background: onTrack ? color : '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
            <div style={{ position: 'absolute', left: `${targetPct}%`, top: -2, width: 2, height: 10, background: color, borderRadius: 1 }} />
          </div>
          <div style={{ fontSize: 8, color: '#bbb' }}>|——— target {targetPct}%</div>
        </div>
      </div>
      {/* Breakdown rows */}
      {breakdown && breakdown.length > 0 && (
        <div style={{ borderTop: '1px solid #f5f5f5', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {breakdown.map(b => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
              <span style={{ color: '#aaa', width: 100, flexShrink: 0 }}>{b.name}</span>
              <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.pct}%`, background: color, opacity: 0.6, borderRadius: 2 }} />
              </div>
              <span style={{ color, fontWeight: 700, width: 38, textAlign: 'right', flexShrink: 0 }}>{formatNumber(b.value)}</span>
            </div>
          ))}
        </div>
      )}
      {footer && <div style={{ marginTop: 4 }}>{footer}</div>}
    </div>
  );
}

// ── Factory abbreviation map ──
function factoryAbbr(name: string, country: string): string {
  if (country === 'India') return 'Tuti';
  const n = name.toLowerCase();
  // order matters — more specific first
  if (n.includes('tây ninh') || (n.includes('ninh') && !n.includes('khánh'))) return 'TN';
  if (n.includes('phan thiết') || n.includes('phan thiet') || n.includes('thiết') || n.includes('thiet')) return 'PT';
  if (n.includes('long an')) return 'LA';
  if (n.includes('dĩ') || n.includes('di an') || n.includes('dỹ')) return 'DA';
  if (n.includes('nam m')) return 'NM';
  if (n.includes('tuti')) return 'Tuti';
  // fallback: capitalised last word
  return name.split(' ').pop() ?? name;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [scopeSummaries, setScopeSummaries] = useState<ScopeSummary[]>([]);
  const [factorySummaries, setFactorySummaries] = useState<FactorySummary[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyData[]>([]);
  const [targets, setTargets] = useState<TargetProgress[]>([]);
  const [rcnData, setRcnData] = useState<{ totalRCN: number; totalCK: number; intensity: number; monthlyIntensity: number[] } | null>(null);
  const [rcnByFactory, setRcnByFactory] = useState<Record<string, { totalRCN: number; totalCK: number; monthlyRCN: number[] }>>({}); 
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [s3Annual, setS3Annual] = useState<{ year: number; total: number; cat1: number; cat3: number; cat4: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedFactory('ALL');
    Promise.all([
      getDashboardData(selectedYear),
      getScope3SummaryData(),
    ]).then(([data, s3Data]) => {
      setGrandTotal(data.grandTotal);
      setScopeSummaries(data.scopeSummaries);
      setFactorySummaries(data.factorySummaries);
      setMonthlyTotals(data.monthlyTotals);
      setTargets(data.targets);
      setRcnData(data.rcnData);
      setRcnByFactory(data.rcnByFactory);
      // Pick S3 for selected year, fallback to most recent year with data
      const s3Row = s3Data.rows.find(r => r.year === selectedYear)
        ?? s3Data.rows[s3Data.rows.length - 1];
      if (s3Row) {
        setS3Annual({ year: s3Row.year, total: s3Row.total, cat1: s3Row.cat1_cashew, cat3: s3Row.cat3_wtt, cat4: s3Row.cat4_vessel + s3Row.cat4_road });
      }
      setLoading(false);
    });
  }, [selectedYear]);

  const filteredFS = useMemo(
    () => selectedFactory === 'ALL' ? factorySummaries : factorySummaries.filter(fs => fs.factory.id === selectedFactory),
    [factorySummaries, selectedFactory],
  );

  const filteredMonthly = useMemo((): MonthlyData[] =>
    Array.from({ length: 12 }, (_, i) => {
      const s1 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope1, 0);
      const s2 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope2, 0);
      const s3 = filteredFS.reduce((s, fs) => s + fs.monthlyTrend[i].scope3, 0);
      return { month: i + 1, label: MONTHS_VI[i], scope1: s1, scope2: s2, scope3: s3, total: s1 + s2 + s3 };
    }),
    [filteredFS],
  );

  const totals = useMemo(() => {
    const s1 = filteredFS.reduce((s, fs) => s + fs.scope1, 0);
    const s2 = filteredFS.reduce((s, fs) => s + fs.scope2, 0);
    const s3 = filteredFS.reduce((s, fs) => s + fs.scope3, 0);
    return { s1, s2, s3, total: s1 + s2 + s3 };
  }, [filteredFS]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: 12 }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>Đang tải dữ liệu...</span>
    </div>
  );

  const prevYearTotal = scopeSummaries.reduce((s, sc) => s + sc.previousYearEmissions, 0);
  const changeVsPrev = prevYearTotal > 0 ? ((grandTotal - prevYearTotal) / prevYearTotal * 100) : 0;
  const sbtiS12 = targets.find(t => t.scope.includes('1'));
  const sbtiS3  = targets.find(t => t.scope.includes('3'));
  const activeMonths = filteredMonthly.filter(m => m.total > 0).length;
  const monthLabel = `${activeMonths} tháng ${selectedYear}`;
  // per-factory RCN
  const allRCN = selectedFactory === 'ALL' ? (rcnData?.totalRCN ?? 0) : (rcnByFactory[selectedFactory]?.totalRCN ?? 0);
  const intensity = allRCN > 0 ? totals.total / allRCN : 0;
  // S3: use real annual data from scope3_transport_data
  const s3Display = s3Annual?.total ?? 0;
  const s3IsEstimated = s3Annual != null && s3Annual.year !== selectedYear;
  const s3Cats = s3Annual ? [
    { category: 'cat1', label: 'Cat.1 — Cashew', emissions: s3Annual.cat1, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat1 / s3Annual.total * 100) : 0 },
    { category: 'cat3', label: 'Cat.3 — WTT', emissions: s3Annual.cat3, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat3 / s3Annual.total * 100) : 0 },
    { category: 'cat4', label: 'Cat.4 — Vận chuyển', emissions: s3Annual.cat4, percentOfScope: s3Annual.total > 0 ? Math.round(s3Annual.cat4 / s3Annual.total * 100) : 0 },
  ].filter(c => c.emissions > 0) : [];
  // Max total across factories (for bar scaling)
  const maxFacTotal = Math.max(...factorySummaries.map(fs => fs.totalEmissions), 1);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ══ ROW 0: Header + Filters ══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Tổng quan — GHG Emissions
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.1, color: 'var(--color-text)' }}>
            {formatTCO2e(totals.total)}
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 6 }}>tCO₂e</span>
            <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 10,
              color: changeVsPrev < 0 ? '#22c55e' : '#ef4444',
              background: changeVsPrev < 0 ? '#dcfce7' : '#fee2e2',
              padding: '2px 8px', borderRadius: 20 }}>
              {changeVsPrev < 0 ? '↓' : '↑'} {Math.abs(changeVsPrev).toFixed(1)}% vs năm trước
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{monthLabel}</div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Factory buttons */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => setSelectedFactory('ALL')}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: selectedFactory === 'ALL' ? 'var(--color-primary)' : 'transparent',
                color: selectedFactory === 'ALL' ? '#fff' : 'var(--color-text-muted)',
              }}>🏭 Tất cả</button>
            {factorySummaries.map(fs => (
              <button key={fs.factory.id}
                onClick={() => setSelectedFactory(selectedFactory === fs.factory.id ? 'ALL' : fs.factory.id)}
                style={{ padding: '4px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: selectedFactory === fs.factory.id ? 'var(--color-primary)' : 'transparent',
                  color: selectedFactory === fs.factory.id ? '#fff' : 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}
              </button>
            ))}
          </div>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            {[2026, 2025, 2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link href="/overview" style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            📊 PPT View
          </Link>
        </div>
      </div>

      {/* ══ ROW 1: 3 Scope KPIs + Donut ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 140px', gap: 10 }}>

        {/* Scope 1 */}
        <Link href="/scope-1" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_1}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_1, marginBottom: 4 }}>🔥 Scope 1 — Trực tiếp</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--color-text)' }}>
              {formatTCO2e(totals.s1)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ fontWeight: 700, color: S_COLOR.scope_1 }}>{totals.total > 0 ? Math.round(totals.s1 / totals.total * 100) : 0}% of total</span>
              {scopeSummaries.find(s => s.scope === 'scope_1') && (
                <span style={{ color: scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent < 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent < 0 ? '↓' : '↑'}
                  {Math.abs(scopeSummaries.find(s => s.scope === 'scope_1')!.changePercent)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totals.total > 0 ? totals.s1 / totals.total * 100 : 0}%`, background: S_COLOR.scope_1, borderRadius: 2 }} />
            </div>
          </div>
        </Link>

        {/* Scope 2 */}
        <Link href="/scope-2" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_2}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_2, marginBottom: 4 }}>⚡ Scope 2 — Năng lượng</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: 'var(--color-text)' }}>
              {formatTCO2e(totals.s2)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span style={{ fontWeight: 700, color: S_COLOR.scope_2 }}>{totals.total > 0 ? Math.round(totals.s2 / totals.total * 100) : 0}% of total</span>
              {scopeSummaries.find(s => s.scope === 'scope_2') && (
                <span style={{ color: scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent < 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent < 0 ? '↓' : '↑'}
                  {Math.abs(scopeSummaries.find(s => s.scope === 'scope_2')!.changePercent)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totals.total > 0 ? totals.s2 / totals.total * 100 : 0}%`, background: S_COLOR.scope_2, borderRadius: 2 }} />
            </div>
          </div>
        </Link>

        {/* Scope 3 — richer with categories */}
        <Link href="/scope-3" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${S_COLOR.scope_3}`, cursor: 'pointer', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: S_COLOR.scope_3, marginBottom: 4 }}>
              🌍 Scope 3 — Chuỗi giá trị
              {s3IsEstimated && <span style={{ fontWeight: 500, color: '#bbb', marginLeft: 4 }}>(năm trước)</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, lineHeight: 1, color: s3IsEstimated ? '#aaa' : 'var(--color-text)' }}>
              {formatTCO2e(s3Display)}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>tCO₂e</span>
            </div>
            {/* Category breakdown */}
            {s3Cats.length > 0 ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {s3Cats.slice(0, 3).map(cat => (
                  <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#888' }}>
                    <div style={{ height: 3, width: `${cat.percentOfScope}%`, minWidth: 4, background: S_COLOR.scope_3, borderRadius: 2, opacity: 0.6 + cat.percentOfScope / 200 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{cat.label.split('—').pop()?.trim()}</span>
                    <span style={{ color: S_COLOR.scope_3, fontWeight: 700, marginLeft: 'auto', flexShrink: 0 }}>{formatNumber(cat.emissions)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 9, color: '#bbb' }}>Cat.1 Nguyên liệu · Cat.3 WTT · Cat.4 Vận chuyển</div>
            )}
          </div>
        </Link>

        {/* Donut + Intensity compact */}
        <div className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ScopeDonut s1={totals.s1} s2={totals.s2} s3={s3Display} size={90} />
          <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', lineHeight: 1.6 }}>
            <span style={{ color: S_COLOR.scope_1, fontWeight: 700 }}>●</span> S1&nbsp;
            <span style={{ color: S_COLOR.scope_2, fontWeight: 700 }}>●</span> S2&nbsp;
            <span style={{ color: S_COLOR.scope_3, fontWeight: 700 }}>●</span> S3
          </div>
          {allRCN > 0 && (
            <div style={{ borderTop: '1px solid #f0f0f0', width: '100%', paddingTop: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#6366f1' }}>{intensity.toFixed(3)}</div>
              <div style={{ fontSize: 8, color: '#aaa' }}>tCO₂e/MT RCN</div>
            </div>
          )}
        </div>
      </div>

      {/* ══ SBTi TARGETS ROW ── 2-col grid ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {sbtiS12 && (
          <SBTiCard
            label="Scope 1+2 — Vận hành"
            icon="🏭"
            targetPct={42}
            current={sbtiS12.currentEmissions}
            base={sbtiS12.baseYearEmissions}
            color="#E32314"
            footer={<Link href="/targets" style={{ fontSize: 9, color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>SBTi #40003759 →</Link>}
          />
        )}
        {sbtiS3 && (
          <SBTiCard
            label="Scope 3 — Chuỗi giá trị"
            icon="🌍"
            targetPct={30}
            current={s3Display > 0 ? s3Display : sbtiS3.currentEmissions}
            base={sbtiS3.baseYearEmissions}
            color="#8CB92D"
            breakdown={s3Cats.map(c => ({ name: c.label.split('—').pop()?.trim() ?? c.label, value: c.emissions, pct: c.percentOfScope }))}
            footer={s3IsEstimated ? <span style={{ fontSize: 9, color: '#aaa' }}>Dữ liệu năm gần nhất — S3 annual</span> : undefined}
          />
        )}
      </div>

      {/* ══ ROW 2: Monthly Chart + Factory Table ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, minHeight: 0 }}>

        {/* Monthly Stacked Bar */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Phát thải theo tháng {selectedYear}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888' }}>
              {[['S1', S_COLOR.scope_1], ['S2', S_COLOR.scope_2], ['S3', S_COLOR.scope_3]].map(([lbl, col]) => (
                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 8, height: 8, background: col as string, borderRadius: 2, display: 'inline-block' }} />{lbl}
                </span>
              ))}
            </div>
          </div>
          <MiniStackedBar monthly={filteredMonthly} height={110} />
        </div>

        {/* Factory Comparison Table */}
        <div className="card" style={{ padding: '12px 16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>So sánh nhà máy</div>
            <Link href="/factories" style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Xem chi tiết →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #f0f0f0' }}>
                {['Nhà máy', 'S1', 'S2', 'S3', 'Total', 'tCO₂e/MT'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Nhà máy' ? 'left' : 'right', padding: '3px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factorySummaries.map((fs, i) => {
                const fb = rcnByFactory[fs.factory.id];
                const fIntensity = fb && fb.totalRCN > 0 ? (fs.totalEmissions / fb.totalRCN).toFixed(3) : '—';
                const isSelected = selectedFactory === fs.factory.id;
                return (
                  <tr key={fs.factory.id}
                    onClick={() => setSelectedFactory(isSelected ? 'ALL' : fs.factory.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #fafafa', background: isSelected ? '#fff7f7' : i % 2 === 0 ? 'transparent' : '#fafafa' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 22, background: fs.totalEmissions > 0 ? 'var(--color-primary)' : '#eee', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                        <span>{fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_1, fontWeight: 600 }}>{formatNumber(fs.scope1)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_2, fontWeight: 600 }}>{formatNumber(fs.scope2)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_3, fontWeight: 600 }}>{formatNumber(fs.scope3)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 800, color: 'var(--color-text)' }}>{formatNumber(fs.totalEmissions)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 6px', color: '#6366f1', fontWeight: 700 }}>{fIntensity}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop: '1.5px solid #eee', background: '#f8f8f8' }}>
                <td style={{ padding: '5px 6px', fontWeight: 800, fontSize: 11 }}>🏭 Tổng</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_1, fontWeight: 800 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope1, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_2, fontWeight: 800 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope2, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: S_COLOR.scope_3, fontWeight: 800 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.scope3, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 900 }}>{formatNumber(factorySummaries.reduce((s, f) => s + f.totalEmissions, 0))}</td>
                <td style={{ textAlign: 'right', padding: '5px 6px', color: '#6366f1', fontWeight: 800 }}>
                  {allRCN > 0 ? (factorySummaries.reduce((s, f) => s + f.totalEmissions, 0) / allRCN).toFixed(3) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ ROW 3: Factory mini-bars (visual share) ══ */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Phân bổ phát thải theo nhà máy</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>Stacked: S1 · S2 · S3 (tCO₂e)</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {factorySummaries.map(fs => {
            const pct = fs.totalEmissions / maxFacTotal * 100;
            const s1Pct = fs.totalEmissions > 0 ? fs.scope1 / fs.totalEmissions * pct : 0;
            const s2Pct = fs.totalEmissions > 0 ? fs.scope2 / fs.totalEmissions * pct : 0;
            const s3Pct = fs.totalEmissions > 0 ? fs.scope3 / fs.totalEmissions * pct : 0;
            const isSelected = selectedFactory === fs.factory.id;
            return (
              <div key={fs.factory.id}
                onClick={() => setSelectedFactory(isSelected ? 'ALL' : fs.factory.id)}
                style={{ cursor: 'pointer', opacity: selectedFactory !== 'ALL' && !isSelected ? 0.35 : 1, transition: 'opacity 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, fontSize: 11, fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fs.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factoryAbbr(fs.factory.name, fs.factory.country)}
                  </div>
                  <div style={{ flex: 1, height: 18, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s1Pct}%`, background: S_COLOR.scope_1, transition: 'width 0.5s' }} />
                    <div style={{ position: 'absolute', left: `${s1Pct}%`, top: 0, height: '100%', width: `${s2Pct}%`, background: S_COLOR.scope_2, transition: 'width 0.5s' }} />
                    <div style={{ position: 'absolute', left: `${s1Pct + s2Pct}%`, top: 0, height: '100%', width: `${s3Pct}%`, background: S_COLOR.scope_3, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ width: 70, fontSize: 11, fontWeight: 800, textAlign: 'right', color: 'var(--color-text)', flexShrink: 0 }}>
                    {formatNumber(fs.totalEmissions)} t
                  </div>
                  <div style={{ width: 34, fontSize: 10, color: '#aaa', textAlign: 'right', flexShrink: 0 }}>
                    {Math.round(pct)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ROW 4: Quick Links ══ */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { href: '/scope-1', icon: '🔥', label: 'Scope 1 Detail', color: S_COLOR.scope_1 },
          { href: '/scope-2', icon: '⚡', label: 'Scope 2 Detail', color: S_COLOR.scope_2 },
          { href: '/scope-3', icon: '🌍', label: 'Scope 3 Detail', color: S_COLOR.scope_3 },
          { href: '/targets', icon: '🎯', label: 'SBTi Targets', color: '#6366f1' },
          { href: '/factories', icon: '🏭', label: 'Factory Compare', color: '#0ea5e9' },
          { href: '/opex', icon: '📋', label: 'OpEx Report', color: '#8b5cf6' },
          { href: '/reference', icon: '📖', label: 'Reference & EF', color: '#6b7280' },
        ].map(link => (
          <Link key={link.href} href={link.href} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              background: 'var(--color-card-bg)', border: `1.5px solid ${link.color}22`,
              borderRadius: 10, fontSize: 12, fontWeight: 700, color: link.color,
              transition: 'all 0.15s', cursor: 'pointer',
            }}>
              {link.icon} {link.label}
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
