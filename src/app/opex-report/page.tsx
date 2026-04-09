'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GRID_EMISSION_FACTORS } from '@/lib/types';

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
  const BASE = 2021, END = 2031;
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
  actual?: number;
  target?: number;
  isTotal?: boolean;         // draw from baseline (0) to value
  isSplitSubtotal?: boolean; // draw as actual/estimated stack
}

interface Callout {
  fromCol: number;
  toCol: number;
  fromVal: number;
  toVal: number;
  text: string;
  level?: number;
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
  // SVG dimensions — large top pad to hold bracket callouts above bars
  const W = 530, H = 300;
  const PL = 8, PR = 8, PT = 72, PB = 44;
  const cw = (W - PL - PR) / bars.length;
  const bw = Math.min(34, cw * 0.62);
  const chartH = H - PT - PB;

  // Y scale
  const allVals: number[] = [];
  bars.forEach(b => {
    if (b.actual) allVals.push(b.actual);
    if (b.target) allVals.push(b.target);
  });
  const maxVal = Math.max(...allVals) * 1.18;

  /** pixel Y for a value (low Y = top of chart = high emission) */
  const py = (v: number) => PT + chartH * (1 - v / maxVal);
  const ph = (v: number) => Math.max(chartH * v / maxVal, 2);
  const cx = (i: number) => PL + cw * i + cw / 2;
  const bx = (i: number) => cx(i) - bw / 2;

  const legendItems = (legendOrder || ['baseline', 'actual', 'estimated', 'target']).map(k => ({
    baseline: { color: C.baseline, label: 'Baseline' },
    actual:   { color: C.actual,   label: 'Actual' },
    estimated:{ color: C.estimated,label: 'Est. Emission' },
    target:   { color: C.target,   label: 'Target' },
  }[k] as { color: string; label: string }));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Chart title */}
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#222', marginBottom: '5px', lineHeight: 1.3 }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {/* Legend — top right position matching PPT */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '2px', fontSize: '10.5px', alignItems: 'center', justifyContent: 'flex-end' }}>
        {legendItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '2px', flexShrink: 0 }} />
            <span style={{ color: '#444' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SVG chart — overflow visible so callout brackets show above viewBox */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
        <defs>
          {/*
            Arrow marker: right-pointing triangle.
            With orient="auto", rotates to match line direction.
            For a DOWNWARD line → becomes downward-pointing arrow. ✓
          */}
          <marker id="arwD" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0,0 8,4 0,8" fill="#555" />
          </marker>
        </defs>

        {/* Bottom axis line */}
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth="1.5" />

        {/* ── Bars ── */}
        {(() => {
          let prevValForBox = 0;
          const boxTops = bars.map(b => {
             const val = b.actual ?? b.target ?? 0;
             let bt = py(val);
             if (!b.isTotal && val !== 0) bt = py(Math.max(prevValForBox, val));
             if (val !== 0) prevValForBox = val;
             return Math.min(bt, py(val)); // guarantee visual top
          });

          let prevVal = 0;
          const renderedBars = bars.map((b, i) => {
            const isFloating = !b.isTotal;
            const isTargetMarker = b.target !== undefined && !b.actual;
            const color = (b.key === 'base' || b.key === 'end') ? C.baseline :
                          isTargetMarker ? C.target : C.actual;
            
            const val = b.actual ?? b.target ?? 0;
            if (val === 0) {
              prevVal = val;
              return null;
            }

            // Box dimensions
            let boxTop, boxBottom;
            if (b.isTotal) {
              boxTop = py(val);
              boxBottom = py(0);
            } else {
              const v1 = prevVal;
              const v2 = val;
              boxTop = py(Math.max(v1, v2)); // max val = lowest py = top Edge
              boxBottom = py(Math.min(v1, v2));
            }
            const boxH = Math.max(boxBottom - boxTop, 1);
            const boxY = boxTop;
            const delta = isFloating ? Math.abs(val - prevVal) : val;

            // Connector from previous column
            const connLine = i > 0 && (
              <line x1={cx(i-1) + bw/2} y1={py(prevVal)} x2={bx(i)} y2={py(prevVal)} stroke="#222" strokeWidth="1" />
            );

            const rawDelta = val - prevVal;
            const absDeltaStr = fmt(Math.abs(rawDelta));
            const deltaStr = isFloating ? (rawDelta > 0 ? `+${absDeltaStr}` : `-${absDeltaStr}`) : fmt(val);

            prevVal = val;

            return (
              <g key={b.key}>
                {connLine}

                {b.isSplitSubtotal ? (
                  <>
                    {/* Stacked 2025 bar (approx match PPT ~ 62.4% Est / 37.6% Act) */}
                    <rect x={bx(i)} y={py(val)} width={bw} height={py(val * 0.376) - py(val)} fill={C.estimated} />
                    <rect x={bx(i)} y={py(val * 0.376)} width={bw} height={py(0) - py(val * 0.376)} fill={C.actual} />
                    <rect x={bx(i)} y={py(val)} width={bw} height={py(0) - py(val)} fill="none" stroke="#222" strokeWidth="0.8" />
                    
                    <text x={cx(i)} y={py(val) + (py(val * 0.376) - py(val))/2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#222">
                      {fmt(val * 0.624)}
                    </text>
                    <text x={cx(i)} y={py(val * 0.376) + (py(0) - py(val * 0.376))/2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="white">
                      {fmt(val * 0.376)}
                    </text>
                  </>
                ) : (
                  <>
                    <rect x={bx(i)} y={boxY} width={bw} height={boxH} fill={color} />
                    {isTargetMarker && (
                      <rect x={bx(i) - 2} y={boxY - 2} width={bw + 4} height={boxH + 4} fill="none" stroke={C.target} strokeWidth="1.5" rx="2" />
                    )}

                    {/* text delta — alternate above/below to avoid overlap on small bars */}
                    {boxH > 20 ? (
                      <text x={cx(i)} y={boxY + boxH/2 + 4.5} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="white">
                        {deltaStr}
                      </text>
                    ) : (
                      <text x={cx(i)} y={i % 2 === 0 ? boxY - 8 : boxTop + boxH + 18} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={color}>
                        {deltaStr}
                      </text>
                    )}
                  </>
                )}

                {/* Absolute value below axis for milestones */}
                {(b.isTotal || b.key === '2025') && (
                  <text x={cx(i)} y={PT + chartH + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="#222">
                    {fmt(val)}
                  </text>
                )}

                {/* Year labels below axis */}
                {b.label.map((l, li) => (
                  <text key={li} x={cx(i)} y={PT + chartH + ((b.isTotal || b.key === '2025') ? 28 : 15) + li * 13} textAnchor="middle" fontSize="10.5" fill="#555">
                    {l}
                  </text>
                ))}
              </g>
            );
          });

          const renderedCallouts = callouts.map((cal, idx) => {
            const fromX = cx(cal.fromCol);
            const toX   = cx(cal.toCol);
            const fromBarTopY = boxTops[cal.fromCol];     // Absolute physical top edge!
            const toBarTopY   = boxTops[cal.toCol];       // Absolute physical top edge!

            // Bracket horizontal level
            const bracketY = Math.min(fromBarTopY, toBarTopY) - 26 - ((cal.level || 0) * 30);

            // Oval label center
            const midX = (fromX + toX) / 2;
            const ovalRx = 32, ovalRy = 13;

            const isGood = cal.toVal <= cal.fromVal; // reduction = green
            const clr = isGood ? '#2E6B2E' : '#C8281A';
            const lineColor = '#555';
            const dash = '5,4';

            return (
              <g key={idx}>
                {/* LEFT vertical drop to physical bar top */}
                <line
                  x1={fromX} y1={bracketY}
                  x2={fromX} y2={fromBarTopY - 2}
                  stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash}
                  markerEnd="url(#arwD)"
                />

                <line x1={fromX} y1={bracketY} x2={midX - ovalRx} y2={bracketY} stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash} />
                <line x1={midX + ovalRx} y1={bracketY} x2={toX} y2={bracketY} stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash} />

                {/* RIGHT vertical drop to physical bar top */}
                <line
                  x1={toX} y1={bracketY}
                  x2={toX} y2={toBarTopY - 2}
                  stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash}
                  markerEnd="url(#arwD)"
                />

                {/* Oval label */}
                <ellipse cx={midX} cy={bracketY} rx={ovalRx} ry={ovalRy} fill="white" stroke={clr} strokeWidth="2" />
                <text x={midX} y={bracketY + 4.5} textAnchor="middle" fontSize="12" fontWeight="800" fill={clr}>
                  {cal.text}
                </text>
              </g>
            );
          });

          return (
            <>
              {renderedBars}
              {renderedCallouts}
            </>
          );
        })()}
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
      const [facRes, rowRes1, rowRes2] = await Promise.all([
        supabase.from('factories').select('id, country'),
        supabase.from('emissions_data')
          .select('factory_id, year, scope, activity_data, emissions_tco2e')
          .gte('year', 2021)
          .lte('year', 2025)
          .range(0, 999),
        supabase.from('emissions_data')
          .select('factory_id, year, scope, activity_data, emissions_tco2e')
          .gte('year', 2021)
          .lte('year', 2025)
          .range(1000, 1999)
      ]);

      const combData = [...(rowRes1.data || []), ...(rowRes2.data || [])];
      if (combData.length === 0) { setLoading(false); return; }

      const facDict: Record<string, string> = {};
      facRes.data?.forEach(f => facDict[f.id] = f.country);

      const byYear: Record<number, { s1: number; s2: number }> = {};
      for (const r of combData) {
        if (!byYear[r.year]) byYear[r.year] = { s1: 0, s2: 0 };
        if (r.scope === 'scope_1') {
          byYear[r.year].s1 += Number(r.emissions_tco2e);
        } else if (r.scope === 'scope_2') {
          const country = facDict[r.factory_id];
          const gef = GRID_EMISSION_FACTORS.find(ef => ef.country === country && ef.year === r.year);
          const factor = gef?.factor || 0.8041;
          byYear[r.year].s2 += Number(r.activity_data) * factor / 1000;
        }
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

  // Project targets down 5% of baseline every year starting FROM 2025 actuals
  const targetProj = (base: number, act2025: number, year: number) => act2025 - base * 0.05 * (year - 2025);

  const end28_s1 = Math.round(targetProj(b1, s1_2025, 2028));
  const end28_s2 = Math.round(targetProj(b2, s2_2025, 2028));

  // ── Scope 1 bars ──────────────────────────────────────────
  const s1Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b1, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope1 },
    { key: '2023', label: ['2023'], actual: get(2023).scope1 },
    { key: '2024', label: ['2024'], actual: get(2024).scope1 },
    { key: 'd2025', label: ['Δ', '2025'], actual: s1_2025 },
    { key: '2025', label: ['2025'], actual: s1_2025, isTotal: true },
    { key: '2026', label: ['2026'], target: Math.round(targetProj(b1, s1_2025, 2026)) },
    { key: '2027', label: ['2027'], target: Math.round(targetProj(b1, s1_2025, 2027)) },
    { key: '2028', label: ['2028'], target: Math.round(targetProj(b1, s1_2025, 2028)) },
    { key: 'end', label: ['by End', '2028'], actual: end28_s1, isTotal: true },
  ];

  // ── Scope 1 callouts ──────────────────────────────────────
  const s1_2024 = get(2024).scope1;
  const s1Callouts: Callout[] = [
    b1 > 0 && s1_2025 > 0 ? {
      fromCol: 0, toCol: 5,
      fromVal: b1, toVal: s1_2025,
      text: pctStr(s1_2025, b1),
      level: 0
    } : null,
    s1_2025 > 0 && end28_s1 > 0 ? {
      fromCol: 5, toCol: 9,
      fromVal: s1_2025, toVal: end28_s1,
      text: pctStr(end28_s1, s1_2025),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[];

  // ── Scope 2 bars ──────────────────────────────────────────
  const s2Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b2, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope2 },
    { key: '2023', label: ['2023'], actual: get(2023).scope2 },
    { key: '2024', label: ['2024'], actual: get(2024).scope2 },
    { key: 'd2025', label: ['Δ', '2025'], actual: s2_2025 },
    { key: '2025', label: ['2025'], actual: s2_2025, isTotal: true },
    { key: '2026', label: ['2026'], target: Math.round(targetProj(b2, s2_2025, 2026)) },
    { key: '2027', label: ['2027'], target: Math.round(targetProj(b2, s2_2025, 2027)) },
    { key: '2028', label: ['2028'], target: Math.round(targetProj(b2, s2_2025, 2028)) },
    { key: 'end', label: ['by End', '2028'], actual: end28_s2, isTotal: true },
  ];

  // ── Scope 2 callouts ──────────────────────────────────────
  const s2_2024 = get(2024).scope2;
  const s2Callouts: Callout[] = [
    b2 > 0 && s2_2025 > 0 ? {
      fromCol: 0, toCol: 5,
      fromVal: b2, toVal: s2_2025,
      text: pctStr(s2_2025, b2),
      level: 0
    } : null,
    s2_2025 > 0 && end28_s2 > 0 ? {
      fromCol: 5, toCol: 9,
      fromVal: s2_2025, toVal: end28_s2,
      text: pctStr(end28_s2, s2_2025),
      level: 0
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

          {/* Commentary — 100% data-driven from DB */}
          {(() => {
            const years = [2022, 2023, 2024, 2025];
            // YoY deltas for Scope 1
            const s1Deltas = years.map(y => ({
              year: y,
              delta: get(y).scope1 - (y === 2022 ? b1 : get(y - 1).scope1),
            }));
            const bestS1 = s1Deltas.reduce((a, b) => b.delta < a.delta ? b : a); // most negative = best
            const worstS1 = s1Deltas.reduce((a, b) => b.delta > a.delta ? b : a); // most positive = worst
            const yoy2025_s1 = get(2025).scope1 - get(2024).scope1;
            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                <p style={{ margin: '0 0 5px' }}>
                  <strong>2025 performance – Scope 1:</strong> Total emissions reached{' '}
                  <strong style={{ color: '#C8281A' }}>{fmt(s1_2025)} tCO₂e</strong>
                  {' '}({pct1_vs_baseline > 0 ? '+' : ''}{pct1_vs_baseline}% vs 2021 baseline;
                  {' '}
                  <span style={{ color: pct1_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct1_vs_target > 0 ? '+' : ''}{pct1_vs_target}%
                  </span>{' vs SBTi target). '}
                  YoY 2024→2025:{' '}
                  <strong style={{ color: yoy2025_s1 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s1 > 0 ? '+' : ''}{fmt(yoy2025_s1)} tCO₂e
                  </strong>.
                  {bestS1.delta < 0 && (
                    <> {' '}Best reduction year: <strong style={{ color: '#3E7B3E' }}>{bestS1.year}</strong> ({fmt(Math.abs(bestS1.delta))} tCO₂e drop).</>
                  )}
                  {worstS1.delta > 0 && (
                    <> Largest increase: <strong style={{ color: '#C8281A' }}>{worstS1.year}</strong> (+{fmt(worstS1.delta)} tCO₂e).</>
                  )}
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
            );
          })()}
        </div>

        {/* ── Scope 2 ── */}
        <div style={{ padding: '8px 8px 8px 16px' }}>
          <WaterfallChart
            bars={s2Bars}
            callouts={s2Callouts}
            title="<strong>Scope 2 (move towards renewable energy sources)</strong> CO₂ eq absol. emission in ton"
            legendOrder={['baseline', 'estimated', 'actual', 'target']}
          />

          {/* Commentary — 100% data-driven from DB */}
          {(() => {
            const years = [2022, 2023, 2024, 2025];
            const s2Deltas = years.map(y => ({
              year: y,
              delta: get(y).scope2 - (y === 2022 ? b2 : get(y - 1).scope2),
            }));
            const bestS2 = s2Deltas.reduce((a, b) => b.delta < a.delta ? b : a);
            const worstS2 = s2Deltas.reduce((a, b) => b.delta > a.delta ? b : a);
            const yoy2025_s2 = get(2025).scope2 - get(2024).scope2;
            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                <p style={{ margin: '0 0 5px' }}>
                  <strong>2025 performance – Scope 2:</strong> Electricity-related emissions reached{' '}
                  <strong style={{ color: '#E8960E' }}>{fmt(s2_2025)} tCO₂e</strong>
                  {' '}({pct2_vs_baseline > 0 ? '+' : ''}{pct2_vs_baseline}% vs 2021 baseline;
                  {' '}
                  <span style={{ color: pct2_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct2_vs_target > 0 ? '+' : ''}{pct2_vs_target}%
                  </span>{' vs SBTi target). '}
                  YoY 2024→2025:{' '}
                  <strong style={{ color: yoy2025_s2 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s2 > 0 ? '+' : ''}{fmt(Math.round(yoy2025_s2))} tCO₂e
                  </strong>.
                  {worstS2.delta > 0 && (
                    <> Largest single-year increase: <strong style={{ color: '#C8281A' }}>{worstS2.year}</strong> (+{fmt(Math.round(worstS2.delta))} tCO₂e), driven by higher grid electricity consumption.</>
                  )}
                  {bestS2.delta < 0 && (
                    <> Best reduction: <strong style={{ color: '#3E7B3E' }}>{bestS2.year}</strong> ({fmt(Math.abs(Math.round(bestS2.delta)))} tCO₂e drop).</>
                  )}
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
            );
          })()}
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
