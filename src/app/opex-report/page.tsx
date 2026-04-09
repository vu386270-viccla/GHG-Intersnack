'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────
interface AnnualData {
  year: number;
  scope1: number;
  scope2: number;
}

// ── Colors matching the PPT slide exactly ──────────────────
const C = {
  baseline: '#8A8A8A',
  actual: '#C8281A',
  estimated: '#E8960E',
  target: '#3E7B3E',
  arrow: '#555555',
};

// ── Helpers ────────────────────────────────────────────────
function sbtiTarget(baseline: number, year: number): number {
  const BASE = 2021, END = 2032;
  if (year <= BASE) return baseline;
  if (year >= END) return baseline * 0.5;
  return baseline * (1 - 0.5 * (year - BASE) / (END - BASE));
}

function fmt(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(3).replace(/\./, ',');
  if (n >= 1000) return n.toLocaleString('de-DE');
  return Math.round(n).toString();
}

function pctStr(val: number, base: number): string {
  const p = Math.round(((val - base) / base) * 100);
  return (p >= 0 ? '+' : '') + p + '%';
}

// ── Waterfall Chart SVG ────────────────────────────────────
interface BarPoint {
  key: string;
  label: string[];
  actual?: number;       // red bar (or gray for baseline/end)
  target?: number;       // green floating bar
  isBaseline?: boolean;
  isEndTarget?: boolean;
}

interface Callout {
  fromCol: number; // index in bars array
  toCol: number;
  fromVal: number;
  toVal: number;
  text: string;
}

function WaterfallChart({
  bars,
  callouts = [],
  title,
  legendOrder,
}: {
  bars: BarPoint[];
  callouts?: Callout[];
  title: string;
  legendOrder?: ('baseline' | 'actual' | 'estimated' | 'target')[];
}) {
  const W = 530, H = 280;
  const PL = 8, PR = 8, PT = 56, PB = 44;
  const cw = (W - PL - PR) / bars.length;
  const bw = Math.min(34, cw * 0.62);
  const chartH = H - PT - PB;

  // Y scale
  const allVals: number[] = [];
  bars.forEach(b => {
    if (b.actual) allVals.push(b.actual);
    if (b.target) allVals.push(b.target);
  });
  const maxVal = Math.max(...allVals) * 1.22;

  const py = (v: number) => PT + chartH * (1 - v / maxVal);
  const ph = (v: number) => Math.max(chartH * v / maxVal, 2);
  const cx = (i: number) => PL + cw * i + cw / 2;
  const bx = (i: number) => cx(i) - bw / 2;

  const legendItems: { color: string; label: string }[] = (legendOrder || ['baseline', 'actual', 'estimated', 'target']).map(k => ({
    baseline: { color: C.baseline, label: 'Baseline' },
    actual: { color: C.actual, label: 'Actual' },
    estimated: { color: C.estimated, label: 'Est. Emission' },
    target: { color: C.target, label: 'Target' },
  }[k]));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Chart title */}
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#222', marginBottom: '6px', lineHeight: 1.3 }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '4px', fontSize: '10.5px', alignItems: 'center' }}>
        {legendItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '2px', flexShrink: 0 }} />
            <span style={{ color: '#444' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SVG chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
        <defs>
          <marker id="arw" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill={C.arrow} />
          </marker>
        </defs>

        {/* Bottom axis line */}
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth="1.5" />

        {/* Bars */}
        {bars.map((b, i) => {
          const color = (b.isBaseline || b.isEndTarget) ? C.baseline : (b.target !== undefined && !b.actual) ? C.target : C.actual;
          const val = b.actual ?? b.target ?? 0;
          const barY = py(val);
          const barH = ph(val);

          return (
            <g key={b.key}>
              {/* Main bar */}
              <rect x={bx(i)} y={barY} width={bw} height={barH} fill={color} rx="2" />

              {/* Green target: outline box */}
              {b.target !== undefined && !b.actual && (
                <rect x={bx(i) - 2} y={barY - 2} width={bw + 4} height={barH + 4}
                  fill="none" stroke={C.target} strokeWidth="1.5" rx="3" />
              )}

              {/* Value label inside bar (if tall enough) */}
              {barH > 22 && (
                <text x={cx(i)} y={barY + barH / 2 + 4} textAnchor="middle"
                  fontSize="12" fontWeight="700" fill="white">
                  {fmt(val)}
                </text>
              )}

              {/* Value label above bar */}
              <text x={cx(i)} y={barY - 5} textAnchor="middle"
                fontSize="12" fontWeight="700" fill={color}>
                {fmt(val)}
              </text>

              {/* Year labels below axis */}
              {b.label.map((l, li) => (
                <text key={li} x={cx(i)} y={PT + chartH + 14 + li * 13}
                  textAnchor="middle" fontSize="10.5" fill="#555">
                  {l}
                </text>
              ))}
            </g>
          );
        })}

        {/* Callout annotations (% change with oval label + dashed arrow) */}
        {callouts.map((cal, idx) => {
          const x1 = cx(cal.fromCol);
          const y1 = py(cal.fromVal) - 2;
          const x2 = cx(cal.toCol);
          const y2 = py(cal.toVal) - 2;
          const midX = (x1 + x2) / 2;
          const midY = Math.min(y1, y2) - 32;
          const cpY = midY - 10;

          return (
            <g key={idx}>
              {/* Dashed curved line with arrow */}
              <path
                d={`M ${x1} ${y1} Q ${x1} ${cpY} ${midX - 28} ${midY}`}
                fill="none" stroke={C.arrow} strokeWidth="1.2"
                strokeDasharray="5,4"
              />
              <path
                d={`M ${midX + 28} ${midY} Q ${x2} ${cpY} ${x2} ${y2}`}
                fill="none" stroke={C.arrow} strokeWidth="1.2"
                strokeDasharray="5,4"
                markerEnd="url(#arw)"
              />
              {/* Oval callout */}
              <ellipse cx={midX} cy={midY} rx="26" ry="12" fill="white" stroke={C.actual} strokeWidth="1.8" />
              <text x={midX} y={midY + 4} textAnchor="middle"
                fontSize="11" fontWeight="800" fill={C.actual}>
                {cal.text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function OpexReportPage() {
  const [data, setData] = useState<AnnualData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('emissions_data')
        .select('year, scope, emissions_tco2e')
        .gte('year', 2021)
        .lte('year', 2025);

      if (!rows) { setLoading(false); return; }

      const byYear: Record<number, { s1: number; s2: number }> = {};
      for (const r of rows) {
        if (!byYear[r.year]) byYear[r.year] = { s1: 0, s2: 0 };
        if (r.scope === 'scope_1') byYear[r.year].s1 += Number(r.emissions_tco2e);
        if (r.scope === 'scope_2') byYear[r.year].s2 += Number(r.emissions_tco2e);
      }

      setData([2021, 2022, 2023, 2024, 2025].map(year => ({
        year,
        scope1: Math.round(byYear[year]?.s1 || 0),
        scope2: Math.round(byYear[year]?.s2 || 0),
      })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: '#666' }}>
        <div className="loading-spinner" />
        <span>Đang tải báo cáo OpEx...</span>
      </div>
    );
  }

  const get = (year: number) => data.find(d => d.year === year) || { year, scope1: 0, scope2: 0 };
  const b1 = get(2021).scope1;  // Scope 1 baseline
  const b2 = get(2021).scope2;  // Scope 2 baseline
  const s1_2025 = get(2025).scope1;
  const s2_2025 = get(2025).scope2;
  const end28_s1 = Math.round(sbtiTarget(b1, 2028));
  const end28_s2 = Math.round(sbtiTarget(b2, 2028));

  // ── Scope 1 bars ──────────────────────────────────────────
  const s1Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b1, isBaseline: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope1 },
    { key: '2023', label: ['2023'], actual: get(2023).scope1 },
    { key: '2024', label: ['2024'], actual: get(2024).scope1 },
    { key: '2025', label: ['2025'], actual: s1_2025 },
    { key: '2026', label: ['2026'], target: Math.round(sbtiTarget(b1, 2026)) },
    { key: '2027', label: ['2027'], target: Math.round(sbtiTarget(b1, 2027)) },
    { key: '2028', label: ['2028'], target: Math.round(sbtiTarget(b1, 2028)) },
    { key: 'end', label: ['by End', '2028'], actual: end28_s1, isEndTarget: true },
  ];

  // ── Scope 1 callouts ──────────────────────────────────────
  const s1_2024 = get(2024).scope1;
  const s1Callouts: Callout[] = [
    b1 > 0 && s1_2024 > 0 ? {
      fromCol: 0, toCol: 3,
      fromVal: b1, toVal: s1_2024,
      text: pctStr(s1_2024, b1),
    } : null,
    b1 > 0 && s1_2025 > 0 ? {
      fromCol: 0, toCol: 4,
      fromVal: b1, toVal: s1_2025,
      text: pctStr(s1_2025, b1),
    } : null,
  ].filter(Boolean) as Callout[];

  // ── Scope 2 bars ──────────────────────────────────────────
  const s2Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b2, isBaseline: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope2 },
    { key: '2023', label: ['2023'], actual: get(2023).scope2 },
    { key: '2024', label: ['2024'], actual: get(2024).scope2 },
    { key: '2025', label: ['2025'], actual: s2_2025 },
    { key: '2026', label: ['2026'], target: Math.round(sbtiTarget(b2, 2026)) },
    { key: '2027', label: ['2027'], target: Math.round(sbtiTarget(b2, 2027)) },
    { key: '2028', label: ['2028'], target: Math.round(sbtiTarget(b2, 2028)) },
    { key: 'end', label: ['by End', '2028'], actual: end28_s2, isEndTarget: true },
  ];

  // ── Scope 2 callouts ──────────────────────────────────────
  const s2_2024 = get(2024).scope2;
  const s2Callouts: Callout[] = [
    b2 > 0 && s2_2024 > 0 ? {
      fromCol: 0, toCol: 3,
      fromVal: b2, toVal: s2_2024,
      text: pctStr(s2_2024, b2),
    } : null,
    b2 > 0 && s2_2025 > 0 ? {
      fromCol: 0, toCol: 4,
      fromVal: b2, toVal: s2_2025,
      text: pctStr(s2_2025, b2),
    } : null,
  ].filter(Boolean) as Callout[];

  const pct1_vs_baseline = b1 > 0 ? Math.round(((s1_2025 - b1) / b1) * 100) : 0;
  const pct2_vs_baseline = b2 > 0 ? Math.round(((s2_2025 - b2) / b2) * 100) : 0;
  const s1Target2025 = Math.round(sbtiTarget(b1, 2025));
  const s2Target2025 = Math.round(sbtiTarget(b2, 2025));
  const pct1_vs_target = s1Target2025 > 0 ? Math.round(((s1_2025 - s1Target2025) / s1Target2025) * 100) : 0;
  const pct2_vs_target = s2Target2025 > 0 ? Math.round(((s2_2025 - s2Target2025) / s2Target2025) * 100) : 0;

  return (
    <div style={{
      fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
      background: '#ffffff',
      color: '#1a1a1a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Slide Header ─────────────────────────────────── */}
      <div style={{ padding: '20px 32px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0, lineHeight: 1.25 }}>
              <span style={{ color: '#C8281A' }}>Reduce CO₂ emissions (SBTi)</span>{' '}
              <span style={{
                background: '#FFD700', color: '#1a1a1a',
                padding: '1px 10px', borderRadius: '4px', fontSize: '20px',
              }}>
                2025 Annual Report
              </span>
            </h1>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#222', marginTop: '4px' }}>
              50 % CO₂ reductions in Operations
            </div>
          </div>
          <img src="/intersnack-logo.png" alt="Intersnack"
            style={{ height: '52px', objectFit: 'contain', marginTop: '4px' }} />
        </div>
        <hr style={{ border: 'none', borderTop: '2.5px solid #C8281A', margin: '10px 0 0' }} />
      </div>

      {/* ── Two Charts Side by Side ──────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0',
        padding: '4px 24px',
        flex: 1,
      }}>
        {/* ── Scope 1 ── */}
        <div style={{ padding: '8px 16px 8px 8px', borderRight: '1.5px solid #e0e0e0' }}>
          <WaterfallChart
            bars={s1Bars}
            callouts={s1Callouts}
            title="<strong>Scope 1 (reduce firewood usage)</strong> – CO₂ eq absol. emission in ton"
            legendOrder={['baseline', 'actual', 'estimated', 'target']}
          />

          {/* Commentary */}
          <div style={{
            fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px',
            borderTop: '1px solid #ddd', paddingTop: '8px',
          }}>
            <p style={{ margin: '0 0 5px' }}>
              <strong>2025 performance – Scope 1:</strong> Total emissions reached{' '}
              <strong style={{ color: '#C8281A' }}>{fmt(s1_2025)} tCO₂e</strong>
              {' '}({pct1_vs_baseline > 0 ? '+' : ''}{pct1_vs_baseline}% vs 2021 baseline
              {'; '}
              <span style={{ color: pct1_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                {pct1_vs_target > 0 ? '+' : ''}{pct1_vs_target}%
              </span>{' vs SBTi target).'}
            </p>
            <p style={{ margin: '0 0 4px' }}><strong>2025 Reduction Strategy:</strong></p>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li>
                <strong>VICC</strong>: Balance wood fuel consumption with actual steam demand
                to improve boiler efficiency and reduce Scope 1 emissions.
              </li>
              <li>
                <strong>India</strong>: Monitor refrigerant usage, check for leakage,
                and explore a shift to lower-GWP refrigerants.
              </li>
            </ul>
          </div>
        </div>

        {/* ── Scope 2 ── */}
        <div style={{ padding: '8px 8px 8px 16px' }}>
          <WaterfallChart
            bars={s2Bars}
            callouts={s2Callouts}
            title="<strong>Scope 2 (move towards renewable energy sources)</strong> CO₂ eq absol. emission in ton"
            legendOrder={['baseline', 'estimated', 'actual', 'target']}
          />

          {/* Commentary */}
          <div style={{
            fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px',
            borderTop: '1px solid #ddd', paddingTop: '8px',
          }}>
            <p style={{ margin: '0 0 5px' }}>
              <strong>2025 performance – Scope 2:</strong> Electricity-related emissions reached{' '}
              <strong style={{ color: '#E8960E' }}>{fmt(s2_2025)} tCO₂e</strong>
              {' '}({pct2_vs_baseline > 0 ? '+' : ''}{pct2_vs_baseline}% vs 2021 baseline
              {'; '}
              <span style={{ color: pct2_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                {pct2_vs_target > 0 ? '+' : ''}{pct2_vs_target}%
              </span>{' vs SBTi target).'}
            </p>
            <p style={{ margin: '0 0 4px' }}><strong>2025 Reduction Strategy:</strong></p>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li>
                <strong>VICC</strong>: Install rooftop solar system and continue to improve
                ISO 50001 compliance to offset grid electricity usage.
              </li>
              <li>
                <strong>India</strong>: Implement ISO 50001 standards and install solar
                energy solutions to reduce peak-load grid purchases.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Slide Footer ─────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '10px 32px 14px',
        borderTop: '1px solid #ccc',
        fontSize: '11px', color: '#888',
        marginTop: 'auto',
      }}>
        <span style={{ fontStyle: 'italic' }}>MU presentation OpEx Meeting 2025</span>
        <span style={{ fontWeight: 700, color: '#555' }}>Intersnack Cashew Company</span>
      </div>
    </div>
  );
}
