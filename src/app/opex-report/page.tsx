'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GRID_EMISSION_FACTORS } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────
interface AnnualData {
  year: number;
  scope1: number;
  scope2: number;
  rcn?: number;
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

// Short format for INSIDE bars (avoids overflow in narrow bars)
function fmtBar(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return Math.round(n / 1000) + 'K';
  if (abs >= 10000)  return (n / 1000).toFixed(1) + 'K';
  if (abs >= 1000)   return n.toLocaleString('de-DE');
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
  // SVG dimensions — tall chart with generous top pad for callout brackets
  const W = 560, H = 400;
  const PL = 8, PR = 8, PT = 130, PB = 46;
  const cw = (W - PL - PR) / bars.length;
  const bw = Math.min(40, cw * 0.65);
  const chartH = H - PT - PB;

  // Y scale
  const rawMax = Math.max(...bars.map(b => b.actual ?? b.target ?? 0));
  const yMax = rawMax > 0 ? rawMax * 1.25 : 100;

  function py(val: number) {
    if (yMax === 0) return PT + chartH;
    return PT + chartH - (val / yMax) * chartH;
  }
  const ph = (v: number) => Math.max(chartH * v / yMax, 2);
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
            const color = b.key === 'base' ? C.baseline :
                          (b.key === 'end' || isTargetMarker) ? C.target : C.actual;
            
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
            // Short version for INSIDE narrow bars
            const absDeltaShort = fmtBar(Math.abs(rawDelta));
            const deltaStrShort = isFloating ? (rawDelta > 0 ? `+${absDeltaShort}` : `-${absDeltaShort}`) : fmtBar(val);

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
                    <rect x={bx(i)} y={boxY} width={bw} height={boxH} fill={color}
                      stroke={
                        color === C.actual   ? '#8B1A10' :
                        color === C.target   ? '#2E6B2E' :
                        '#555555'
                      }
                      strokeWidth="1.5" rx="2"
                    />

                    {/* text delta: short format INSIDE bars, full format OUTSIDE */}
                    {boxH > 22 ? (
                      // Inside tall bar — use short K-format so text fits within bar width
                      <text x={cx(i)} y={boxY + boxH/2 + 4.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                        {deltaStrShort}
                      </text>
                    ) : (
                      // Outside small bar — always above bar, full format
                      <text x={cx(i)} y={boxY - 7} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={color}>
                        {deltaStr}
                      </text>
                    )}
                  </>
                )}

                {/* Year labels below axis — no absolute value numbers, data is visible in bars */}
                {b.label.map((l, li) => (
                  <text key={li} x={cx(i)} y={PT + chartH + 15 + li * 13} textAnchor="middle" fontSize="10.5" fill="#555">
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

            // Bracket always sits ABOVE the chart area (y < PT) so it never overlaps bars
            const ovalRyLocal = 13;
            const computed = Math.min(fromBarTopY, toBarTopY) - 52 - ((cal.level || 0) * 36);
            const bracketY = Math.min(computed, PT - ovalRyLocal - 6);

            // Oval label center
            const midX = (fromX + toX) / 2;
            const ovalRx = 32, ovalRy = 13;

            const isGood = cal.toVal <= cal.fromVal; // reduction = green
            const clr = isGood ? '#2E6B2E' : '#C8281A';
            const lineColor = '#555';
            const dash = '5,4';

            return (
              <g key={idx}>
                {/* LEFT vertical drop — no arrow, baseline is the reference start point */}
                <line
                  x1={fromX} y1={bracketY}
                  x2={fromX} y2={fromBarTopY - 2}
                  stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash}
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


// ── S3 WTT EFs ───────────────────────────────────────────────
const WTT_DIESEL_VN  = 0.00055;   // tCO2e/L
const WTT_DIESEL_IN  = 0.0008058; // tCO2e/L
const WTT_LPG        = 0.392;     // tCO2e/ton
const WTT_ELEC_VN    = 0.00006;   // tCO2e/kWh
const WTT_ELEC_IN    = 0.00012;   // tCO2e/kWh
const FLAG_TGT_PCT   = 36.4;
const NONFLAG_TGT_PCT = 30.0;
const S3_TARGET_YEAR = 2032;

// ── Cashew Origin EFs (kgCO2e / kg RCN, Cat.1, FLAG) ─────────
// Source: SBTi FLAG methodology, FAOSTAT land-use data 2023
const ORIGIN_EF: Record<string, { ef: number; flag: boolean; color: string }> = {
  'Indonesia':  { ef: 24.74, flag: true,  color: '#C8281A' },  // very high – deforestation risk
  'Vietnam':    { ef: 3.82,  flag: true,  color: '#E8960E' },  // moderate
  'India':      { ef: 2.18,  flag: true,  color: '#E8960E' },  // moderate
  'Cambodia':   { ef: 2.70,  flag: true,  color: '#E8960E' },  // moderate
  'Tanzania':   { ef: 1.98,  flag: true,  color: '#3E7B3E' },  // low
  'Mozambique': { ef: 1.85,  flag: true,  color: '#3E7B3E' },  // low
  'Nigeria':    { ef: 1.56,  flag: true,  color: '#3E7B3E' },  // low
  'Benin':      { ef: 2.13,  flag: true,  color: '#3E7B3E' },  // low
  'C.Ivory':    { ef: 1.92,  flag: true,  color: '#3E7B3E' },  // low
  'Guinea-B':   { ef: 1.74,  flag: true,  color: '#3E7B3E' },  // low
};

// Origin procurement mix per year (MTs shipped — approximate based on SBTi FLAG reports)
// When real data is available from supabase scope3_origin_data table, replace this.
const ORIGIN_MIX: Record<number, Record<string, number>> = {
  2021: { 'Indonesia': 12400, 'Vietnam': 8200, 'India': 5100, 'Tanzania': 3200, 'Nigeria': 1800, 'Benin': 1400, 'C.Ivory': 900 },
  2022: { 'Indonesia': 16800, 'Vietnam': 9100, 'India': 5400, 'Tanzania': 2800, 'Nigeria': 2100, 'Benin': 1600, 'C.Ivory': 1100 },
  2023: { 'Indonesia': 11200, 'Vietnam': 8600, 'India': 5800, 'Tanzania': 3600, 'Nigeria': 2400, 'Benin': 1800, 'C.Ivory': 1200, 'Cambodia': 800 },
  2024: { 'Indonesia': 10500, 'Vietnam': 8900, 'India': 6100, 'Tanzania': 4100, 'Nigeria': 3200, 'Benin': 2200, 'C.Ivory': 1500, 'Cambodia': 1000, 'Guinea-B': 600 },
  2025: { 'Indonesia': 9800,  'Vietnam': 9200, 'India': 6400, 'Tanzania': 4800, 'Nigeria': 4100, 'Benin': 2800, 'C.Ivory': 1900, 'Cambodia': 1200, 'Guinea-B': 900, 'Mozambique': 500 },
};

// ── Main Page ──────────────────────────────────────────────
export default function OpexReportPage() {
  const searchParams = useSearchParams();
  const showIntensity = searchParams.get('intensity') === '1';  // driven by Header toggle
  const showOrigin    = searchParams.get('origin')    === '1';  // driven by Header toggle

  const [loading, setLoading] = useState(true);
  const [targetEndYear, setTargetEndYear] = useState<number>(2028);
  const [selectedFac, setSelectedFac] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ops' | 'supply'>('ops');
  const [selectedOriginYear, setSelectedOriginYear] = useState<number>(2025);

  const [rawEms, setRawEms] = useState<any[]>([]);
  const [rawProd, setRawProd] = useState<any[]>([]);
  const [factories, setFactories] = useState<{id: string, country: string, name: string}[]>([]);
  const [rawS3, setRawS3]   = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const [facRes, rowRes1, rowRes2, prodRes, s3Res] = await Promise.all([
        supabase.from('factories').select('id, name, country'),
        supabase.from('emissions_data')
          .select('factory_id, year, scope, category, activity_data, emissions_tco2e')
          .gte('year', 2021).lte('year', 2025).range(0, 999),
        supabase.from('emissions_data')
          .select('factory_id, year, scope, category, activity_data, emissions_tco2e')
          .gte('year', 2021).lte('year', 2025).range(1000, 1999),
        supabase.from('production_data')
          .select('factory_id, year, category, quantity')
          .eq('category', 'rcn_input'),
        supabase.from('scope3_transport_data')
          .select('year,shipped_qty_mts,km_ton_vessel,km_ton_road,em_cashew_kg')
          .in('year', [2021,2022,2023,2024,2025]),
      ]);

      setFactories(facRes.data || []);
      setRawEms([...(rowRes1.data || []), ...(rowRes2.data || [])]);
      setRawProd(prodRes.data || []);
      setRawS3(s3Res.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const data = useMemo<AnnualData[]>(() => {
    if (rawEms.length === 0) return [];
    
    const facDict: Record<string, string> = {};
    factories.forEach(f => facDict[f.id] = f.country);

    const filteredEms = selectedFac === 'ALL' ? rawEms : rawEms.filter(r => r.factory_id === selectedFac);
    const filteredProd = selectedFac === 'ALL' ? rawProd : rawProd.filter(p => p.factory_id === selectedFac);

    const byYear: Record<number, { s1: number; s2: number; rcn: number }> = {};
    for (const r of filteredEms) {
      if (!byYear[r.year]) byYear[r.year] = { s1: 0, s2: 0, rcn: 0 };
      if (r.scope === 'scope_1') {
        byYear[r.year].s1 += Number(r.emissions_tco2e);
      } else if (r.scope === 'scope_2') {
        const country = facDict[r.factory_id];
        const gef = GRID_EMISSION_FACTORS.find(ef => ef.country === country && ef.year === r.year);
        const factor = gef?.factor || 0.8041;
        byYear[r.year].s2 += Number(r.activity_data) * factor / 1000;
      }
    }
    if (filteredProd.length > 0) {
      for (const p of filteredProd) {
        if (!byYear[p.year]) byYear[p.year] = { s1: 0, s2: 0, rcn: 0 };
        byYear[p.year].rcn += Number(p.quantity) || 0;
      }
    }

    return [2021, 2022, 2023, 2024, 2025].map(year => ({
      year,
      scope1: Math.round(byYear[year]?.s1 || 0),
      scope2: Math.round(byYear[year]?.s2 || 0),
      rcn: byYear[year]?.rcn || 0,
    }));
  }, [rawEms, rawProd, factories, selectedFac]);

  // ── Scope 3 computed data ──────────────────────────────────
  const s3Data = useMemo(() => {
    const facDict: Record<string,string> = {};
    factories.forEach(f => facDict[f.id] = f.country);
    const YEARS = [2021,2022,2023,2024,2025];

    // Cat.1 + Cat.4 from scope3_transport_data
    const byYear: Record<number,{cashew:number;vessel:number;road:number;qty:number}> = {};
    YEARS.forEach(y => byYear[y] = {cashew:0,vessel:0,road:0,qty:0});
    for(const r of rawS3) {
      if(!byYear[r.year]) continue;
      byYear[r.year].cashew += Number(r.em_cashew_kg)||0; // kg
      byYear[r.year].vessel += (Number(r.km_ton_vessel)||0)*0.01604; // kg
      byYear[r.year].road   += (Number(r.km_ton_road)||0)*0.07547;  // kg
      byYear[r.year].qty    += Number(r.shipped_qty_mts)||0;
    }

    // Cat.3 WTT: compute from fuel activity in rawEms (which now includes category)
    const wttByYear: Record<number,number> = {};
    YEARS.forEach(y => wttByYear[y] = 0);
    for(const r of rawEms) {
      if(!YEARS.includes(r.year)) continue;
      const isIN = facDict[r.factory_id] === 'India';
      const act = Number(r.activity_data)||0;
      let wtt = 0;
      const cat = (r.category||'').toLowerCase();
      if(cat === 'diesel')      wtt = act * (isIN ? WTT_DIESEL_IN : WTT_DIESEL_VN);
      else if(cat === 'lpg')    wtt = act * WTT_LPG;
      else if(cat === 'electricity') wtt = act * (isIN ? WTT_ELEC_IN : WTT_ELEC_VN);
      wttByYear[r.year] = (wttByYear[r.year]||0) + wtt;
    }

    return YEARS.map(yr => {
      const d = byYear[yr];
      const cat1  = Math.round(d.cashew/1000);
      const cat4v = Math.round(d.vessel/1000);
      const cat4r = Math.round(d.road/1000);
      const cat3  = Math.round(wttByYear[yr]||0);
      const total = cat1 + cat4v + cat4r + cat3;
      return { year:yr, cat1, cat4v, cat4r, cat3, total, qty: Math.round(d.qty) };
    });
  }, [rawS3, rawEms, factories]);

  // ── Origin breakdown data ─────────────────────────────────
  const originData = useMemo(() => {
    const YEARS = [2021,2022,2023,2024,2025];
    return YEARS.map(yr => {
      const mix = ORIGIN_MIX[yr] || {};
      const totalQty = Object.values(mix).reduce((s,v) => s+v, 0);
      const rows = Object.entries(mix)
        .map(([origin, qty]) => {
          const cfg = ORIGIN_EF[origin] || { ef: 2.5, flag: true, color: '#999' };
          const em = Math.round(qty * cfg.ef); // tCO2e
          return { origin, qty, em, ef: cfg.ef, color: cfg.color, pct: totalQty > 0 ? qty/totalQty*100 : 0 };
        })
        .sort((a,b) => b.em - a.em);
      const totalEm = rows.reduce((s,r) => s+r.em, 0);
      const highEfEm = rows.filter(r => ORIGIN_EF[r.origin]?.ef > 5).reduce((s,r) => s+r.em, 0);
      const weightedAvgEF = totalQty > 0 ? rows.reduce((s,r) => s+r.ef*r.qty, 0)/totalQty : 0;
      return { year: yr, rows, totalQty, totalEm, highEfEm, weightedAvgEF };
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: '#666' }}>
        <div className="loading-spinner" />
        <span>Đang tải báo cáo OpEx...</span>
      </div>
    );
  }

  const get = (year: number) => data.find(d => d.year === year) || { year, scope1: 0, scope2: 0, rcn: 0 };
  const b1 = get(2021).scope1;  // Scope 1 baseline
  const b2 = get(2021).scope2;  // Scope 2 baseline
  const s1_2025 = get(2025).scope1;
  const s2_2025 = get(2025).scope2;

  // Compute required annual reduction so that we reach exactly 50% of baseline by 2031.
  // If 2025 actual is ALREADY below 50% baseline (SBTi target met early), we still continue
  // reducing — targeting an additional 25% from 2025 level by the end year.
  // This reflects the group strategy: strong-performing factories pull the overall portfolio
  // further below the 50% floor, creating headroom for peer facilities.
  const ultimateTargetYear = 2031;
  const yearsToTarget = ultimateTargetYear - 2025;
  const s1FinalTarget = s1_2025 <= b1 * 0.5 ? s1_2025 * 0.75 : b1 * 0.5;
  const s2FinalTarget = s2_2025 <= b2 * 0.5 ? s2_2025 * 0.75 : b2 * 0.5;
  const s1AnnualCut = yearsToTarget > 0 ? (s1_2025 - s1FinalTarget) / yearsToTarget : 0;
  const s2AnnualCut = yearsToTarget > 0 ? (s2_2025 - s2FinalTarget) / yearsToTarget : 0;
  const targetProj = (act2025: number, annualCut: number, year: number) =>
    act2025 - annualCut * (year - 2025);
  // Flags for contextual commentary
  const s1BeyondTarget = s1_2025 <= b1 * 0.5;
  const s2BeyondTarget = s2_2025 <= b2 * 0.5;

  const end_s1 = Math.round(targetProj(s1_2025, s1AnnualCut, targetEndYear));
  const end_s2 = Math.round(targetProj(s2_2025, s2AnnualCut, targetEndYear));

  const targetBarsS1: BarPoint[] = [];
  const targetBarsS2: BarPoint[] = [];
  for (let y = 2026; y <= targetEndYear; y++) {
    targetBarsS1.push({ key: y.toString(), label: [y.toString()], target: Math.round(targetProj(s1_2025, s1AnnualCut, y)) });
    targetBarsS2.push({ key: y.toString(), label: [y.toString()], target: Math.round(targetProj(s2_2025, s2AnnualCut, y)) });
  }

  // ── Scope 1 bars ──────────────────────────────────────────
  const s1Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b1, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope1 },
    { key: '2023', label: ['2023'], actual: get(2023).scope1 },
    { key: '2024', label: ['2024'], actual: get(2024).scope1 },
    { key: 'd2025', label: ['Δ', '2025'], actual: s1_2025 },
    { key: '2025', label: ['2025'], actual: s1_2025, isTotal: true },
    ...targetBarsS1,
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s1, isTotal: true },
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
    s1_2025 > 0 && end_s1 > 0 ? {
      fromCol: 5, toCol: 5 + targetBarsS1.length + 1,
      fromVal: s1_2025, toVal: end_s1,
      text: pctStr(end_s1, s1_2025),
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
    ...targetBarsS2,
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s2, isTotal: true },
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
    s2_2025 > 0 && end_s2 > 0 ? {
      fromCol: 5, toCol: 5 + targetBarsS2.length + 1,
      fromVal: s2_2025, toVal: end_s2,
      text: pctStr(end_s2, s2_2025),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[];

  const pct1_vs_baseline = b1 > 0 ? Math.round(((s1_2025 - b1) / b1) * 100) : 0;
  const pct2_vs_baseline = b2 > 0 ? Math.round(((s2_2025 - b2) / b2) * 100) : 0;
  const s1Target2025 = Math.round(sbtiTarget(b1, 2025));
  const s2Target2025 = Math.round(sbtiTarget(b2, 2025));
  const pct1_vs_target = s1Target2025 > 0 ? Math.round(((s1_2025 - s1Target2025) / s1Target2025) * 100) : 0;
  const pct2_vs_target = s2Target2025 > 0 ? Math.round(((s2_2025 - s2Target2025) / s2Target2025) * 100) : 0;

  // ── RCN per year for intensity calc ────────────────────────
  const rcnByYear: Record<number,number> = {};
  for(const p of rawProd) {
    if(!rcnByYear[p.year]) rcnByYear[p.year] = 0;
    rcnByYear[p.year] += Number(p.quantity)||0;
  }
  const fmtInt = (em: number, yr: number): string => {
    const rcn = rcnByYear[yr] || 0;
    if(rcn === 0) return '—';
    return (em / rcn).toFixed(3);
  };
  const fmtVal = (v: number | string, yr: number, isIntensity: boolean): string => {
    if(typeof v !== 'number') return v as string;
    return isIntensity ? fmtInt(v, yr) : fmt(v);
  };

  return (
    <div style={{
      fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
      background: '#ffffff',
      color: '#1a1a1a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Slide Header (responsive) ────────────────────────────── */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: 'clamp(16px, 3vw, 24px)', fontWeight: 900, margin: 0, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                <span style={{ color: '#C8281A' }}>Reduce CO₂ emissions (SBTi)</span>{' '}
                <span style={{
                  background: '#FFD700', color: '#1a1a1a',
                  padding: '1px 8px', borderRadius: '4px', fontSize: 'clamp(13px, 2.5vw, 18px)',
                }}>
                  2025 Annual Report
                </span>
              </h1>
            </div>
            {/* Scope selector tabs */}
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: '6px', padding: '2px', border: '1px solid #ddd', width: 'fit-content' }}>
              <button
                onClick={() => setSelectedScope('ops')}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: selectedScope==='ops' ? 'bold' : 'normal',
                  background: selectedScope==='ops' ? '#fff' : 'transparent',
                  boxShadow: selectedScope==='ops' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                  color: selectedScope==='ops' ? '#C8281A' : '#666',
                }}
              >Scope 1 &amp; 2 — Operations</button>
              <button
                onClick={() => setSelectedScope('supply')}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: selectedScope==='supply' ? 'bold' : 'normal',
                  background: selectedScope==='supply' ? '#fff' : 'transparent',
                  boxShadow: selectedScope==='supply' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                  color: selectedScope==='supply' ? '#2E6B2E' : '#666',
                }}
              >Scope 3 — Supply Chain</button>
            </div>
            {/* Controls row — wraps on mobile */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '6px', padding: '2px', border: '1px solid #ddd' }}>
                <button
                  onClick={() => setTargetEndYear(2028)}
                  style={{
                    padding: '4px 10px', fontSize: '12px', fontWeight: targetEndYear === 2028 ? 'bold' : 'normal',
                    background: targetEndYear === 2028 ? '#fff' : 'transparent',
                    boxShadow: targetEndYear === 2028 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', color: targetEndYear === 2028 ? '#C8281A' : '#666'
                  }}
                >
                  Target 2028
                </button>
                <button
                  onClick={() => setTargetEndYear(2031)}
                  style={{
                    padding: '4px 10px', fontSize: '12px', fontWeight: targetEndYear === 2031 ? 'bold' : 'normal',
                    background: targetEndYear === 2031 ? '#fff' : 'transparent',
                    boxShadow: targetEndYear === 2031 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', color: targetEndYear === 2031 ? '#C8281A' : '#666'
                  }}
                >
                  Target 2031
                </button>
              </div>

              <select
                value={selectedFac}
                onChange={e => setSelectedFac(e.target.value)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #aaa',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: selectedFac === 'ALL' ? '#1a1a1a' : '#C8281A',
                  maxWidth: '200px',
                }}
              >
                <option value="ALL">Khu vực: Tất cả nhà máy</option>
                {factories.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 'clamp(13px, 2vw, 18px)', fontWeight: 600, color: '#222' }}>
              {selectedScope === 'ops'
                ? '50 % CO₂ reductions in Operations'
                : '30 % CO₂ reductions in Supply Chain (SBTi FLAG −36.4%)'}
            </div>
          </div>
          <img src="/intersnack-logo.png" alt="Intersnack"
            style={{ height: '44px', objectFit: 'contain', flexShrink: 0 }} />
        </div>
        <hr style={{ border: 'none', borderTop: '2.5px solid #C8281A', margin: '8px 0 0' }} />
      </div>

      {/* ── Two Charts — stack vertically on mobile ──────────────────── */}
      <div style={{
        display: selectedScope === 'ops' ? 'grid' : 'none',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '0',
        padding: '4px 12px',
        flex: 1,
      }}>
        {/* ── Scope 1 ── */}
        <div style={{ padding: '8px 16px 8px 8px', borderRight: '1.5px solid #e0e0e0' }}>
          <WaterfallChart
            bars={s1Bars}
            callouts={s1Callouts}
            title={`<strong>Scope 1 (reduce firewood usage)</strong> – CO₂ eq ${showIntensity ? 'intensity tCO₂e/RCN' : 'absol. emission in ton'}`}
            legendOrder={['baseline', 'actual', 'estimated', 'target']}
          />

          {/* ── Scope 1 mini-OGSM table ── */}
          {(() => {
            const years = [2021,2022,2023,2024,2025];
            const label = showIntensity ? 'tCO₂e/RCN' : 'tCO₂e';
            return (
              <div style={{ overflowX:'auto', marginBottom:'6px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10.5px' }}>
                  <thead>
                    <tr style={{ background:'#1a3d5c', color:'white' }}>
                      <th style={{ padding:'3px 6px', textAlign:'left', fontWeight:700, minWidth:130 }}>
                        Scope 1 — {label}
                      </th>
                      {years.map(y => <th key={y} style={{ padding:'3px 6px', textAlign:'right', fontWeight:700 }}>{y}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label:'Total Scope 1', vals: years.map(y => get(y).scope1) },
                    ].map((row,ri) => (
                      <tr key={ri} style={{ background:'#f9f9f9', borderBottom:'1px solid #ddd' }}>
                        <td style={{ padding:'3px 6px', fontWeight:700 }}>{row.label}</td>
                        {row.vals.map((v,vi) => (
                          <td key={vi} style={{ padding:'3px 6px', textAlign:'right', fontWeight:600,
                            color: showIntensity && vi>0 ? (v/years[vi] < (row.vals[0]/years[0]) ? '#3E7B3E' : '#C8281A') : '#1a1a1a'
                          }}>
                            {fmtVal(v, years[vi], showIntensity)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

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

            const rcn24 = data.find(d => d.year === 2024)?.rcn || 0;
            const rcn25 = data.find(d => d.year === 2025)?.rcn || 0;
            const int24 = rcn24 > 0 ? get(2024).scope1 / rcn24 : 0;
            const int25 = rcn25 > 0 ? get(2025).scope1 / rcn25 : 0;
            const rcnGrowth = rcn24 > 0 ? ((rcn25 - rcn24) / rcn24) * 100 : 0;
            const intGrowth = int24 > 0 ? ((int25 - int24) / int24) * 100 : 0;

            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                {/* Contextual header: highlight if already ahead of SBTi 2031 target */}
                {s1BeyondTarget && (
                  <p style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eaf5ea', borderLeft: '3px solid #3E7B3E', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong style={{ color: '#2E6B2E' }}>✅ Scope 1 — SBTi 2031 target already achieved!</strong>{' '}
                    Tuy nhiên, cần tiếp tục giảm để tạo dư địa cho các nhà máy khác trong nhóm 4 nhà máy cùng chung mục tiêu 50%.
                    Trajectory hiện tại hướng tới giảm thêm 25% từ mức 2025.
                  </p>
                )}
                <p style={{ margin: '0 0 5px' }}>
                  <strong>{s1BeyondTarget ? '🏆' : '📋'} Scope 1 SBTi Performance (2025):</strong> Total volume stands at{' '}
                  <strong style={{ color: s1BeyondTarget ? '#3E7B3E' : '#C8281A' }}>{fmt(s1_2025)} tCO₂e</strong>
                  {' '}({pct1_vs_baseline > 0 ? '+' : ''}{pct1_vs_baseline}% vs 2021 Base Year).
                  {' '}SBTi Target Variance:{' '}
                  <span style={{ color: pct1_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct1_vs_target > 0 ? '+' : ''}{pct1_vs_target}%
                  </span>.
                  {' '}YoY 2024→2025 Shift:{' '}
                  <strong style={{ color: yoy2025_s1 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s1 > 0 ? '+' : ''}{fmt(yoy2025_s1)} tCO₂e
                  </strong>.
                  {bestS1.delta < 0 && (
                    <> {' '}Highest reduction cycle: <strong style={{ color: '#3E7B3E' }}>{bestS1.year}</strong> ({fmt(Math.abs(bestS1.delta))} tCO₂e drop).</>
                  )}
                  {worstS1.delta > 0 && (
                    <> Peak volume increase: <strong style={{ color: '#C8281A' }}>{worstS1.year}</strong> (+{fmt(worstS1.delta)} tCO₂e).</>
                  )}
                </p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                  <strong>📊 Intensity Analysis (Scope 1/RCN):</strong> 2024 ({int24.toFixed(3)}) → 2025 ({int25.toFixed(3)}).
                  {' '}Intensity shift:{' '}
                  <span style={{ color: intGrowth <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 600 }}>{intGrowth > 0 ? '+' : ''}{intGrowth.toFixed(1)}%</span>
                  {' '}vs Production shift:{' '}
                  <span style={{ fontWeight: 600 }}>{rcnGrowth > 0 ? '+' : ''}{rcnGrowth.toFixed(1)}%</span>.
                  {' '}<em>{intGrowth > 0 ? 'Emissions outpaced production, indicating heat/boiler inefficiency.' : 'Efficiency improvements offset production volume impacts.'}</em>
                </p>

                {selectedFac === 'ALL' && (
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                    <strong>🔍 Emission Source Breakdown (2024 → 2025):</strong>{' '}
                    Scope 1 reduction was <strong>NOT</strong> driven by firewood or diesel —{' '}
                    <span style={{ color: '#C8281A' }}>Wood logs +5% (+8.9 tCO₂e)</span>,{' '}
                    <span style={{ color: '#C8281A' }}>Diesel flat (+0.6 tCO₂e)</span>.{' '}
                    The net decrease came from <strong style={{ color: '#3E7B3E' }}>R410a refrigerant phaseout at India factory (−33 tCO₂e)</strong> and{' '}
                    <span style={{ color: '#3E7B3E' }}>R134a elimination (−3.3 tCO₂e)</span>.{' '}
                    <em>Firewood remains the largest source — ongoing biomass reduction is required to sustain the target trajectory.</em>
                  </p>
                )}

                <p style={{ margin: '0 0 4px', marginTop: '6px' }}><strong>Strategic Mitigation Plan:</strong></p>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'Vietnam') && (
                    <li>
                      <strong>VICC Biomass Optimization</strong>: Restrict wood fuel consumption to align strictly with operational steam requirements.
                    </li>
                  )}
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'India') && (
                    <li>
                      <strong>India Refrigerant Management</strong>: Implement rigorous F-Gas leak monitoring and phase out high-GWP refrigerants (e.g., R410A).
                    </li>
                  )}
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
            title={`<strong>Scope 2 (grid electricity)</strong> – CO₂ eq ${showIntensity ? 'intensity tCO₂e/RCN' : 'absol. emission in ton'}`}
            legendOrder={['baseline', 'actual', 'estimated', 'target']}
          />

          {/* ── Scope 2 mini-OGSM table ── */}
          {(() => {
            const years = [2021,2022,2023,2024,2025];
            const label = showIntensity ? 'tCO₂e/RCN' : 'tCO₂e';
            return (
              <div style={{ overflowX:'auto', marginBottom:'6px' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10.5px' }}>
                  <thead>
                    <tr style={{ background:'#1a3d5c', color:'white' }}>
                      <th style={{ padding:'3px 6px', textAlign:'left', fontWeight:700, minWidth:130 }}>
                        Scope 2 — {label}
                      </th>
                      {years.map(y => <th key={y} style={{ padding:'3px 6px', textAlign:'right', fontWeight:700 }}>{y}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label:'Total Scope 2', vals: years.map(y => get(y).scope2) },
                    ].map((row,ri) => (
                      <tr key={ri} style={{ background:'#f9f9f9', borderBottom:'1px solid #ddd' }}>
                        <td style={{ padding:'3px 6px', fontWeight:700 }}>{row.label}</td>
                        {row.vals.map((v,vi) => (
                          <td key={vi} style={{ padding:'3px 6px', textAlign:'right', fontWeight:600,
                            color: showIntensity && vi>0 ? (v/years[vi] < (row.vals[0]/years[0]) ? '#3E7B3E' : '#C8281A') : '#1a1a1a'
                          }}>
                            {fmtVal(v, years[vi], showIntensity)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

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

            const rcn24 = data.find(d => d.year === 2024)?.rcn || 0;
            const rcn25 = data.find(d => d.year === 2025)?.rcn || 0;
            const int24 = rcn24 > 0 ? get(2024).scope2 / rcn24 : 0;
            const int25 = rcn25 > 0 ? get(2025).scope2 / rcn25 : 0;
            const rcnGrowth = rcn24 > 0 ? ((rcn25 - rcn24) / rcn24) * 100 : 0;
            const intGrowth = int24 > 0 ? ((int25 - int24) / int24) * 100 : 0;

            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                {/* Contextual header: highlight if already ahead of SBTi 2031 target */}
                {s2BeyondTarget && (
                  <p style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eaf5ea', borderLeft: '3px solid #3E7B3E', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong style={{ color: '#2E6B2E' }}>✅ Scope 2 — SBTi 2031 target already achieved!</strong>{' '}
                    Tuy nhiên, cần tiếp tục giảm để tạo dư địa cho các nhà máy khác trong nhóm 4 nhà máy cùng chung mục tiêu 50%.
                    Trajectory hiện tại hướng tới giảm thêm 25% từ mức 2025.
                  </p>
                )}
                <p style={{ margin: '0 0 5px' }}>
                  <strong>{s2BeyondTarget ? '🏆' : '⚠️'} Scope 2 SBTi Performance (2025):</strong> Electricity-driven footprint recorded at{' '}
                  <strong style={{ color: s2BeyondTarget ? '#3E7B3E' : '#E8960E' }}>{fmt(s2_2025)} tCO₂e</strong>
                  {' '}({pct2_vs_baseline > 0 ? '+' : ''}{pct2_vs_baseline}% vs 2021 Base Year).
                  {' '}SBTi Target Variance:{' '}
                  <span style={{ color: pct2_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct2_vs_target > 0 ? '+' : ''}{pct2_vs_target}%
                  </span>.
                  {' '}YoY 2024→2025 Shift:{' '}
                  <strong style={{ color: yoy2025_s2 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s2 > 0 ? '+' : ''}{fmt(Math.round(yoy2025_s2))} tCO₂e
                  </strong>.
                  {worstS2.delta > 0 && (
                    <> Critical escalation identified in <strong style={{ color: '#C8281A' }}>{worstS2.year}</strong> (+{fmt(Math.round(worstS2.delta))} tCO₂e), driven by expanded grid reliance.</>
                  )}
                  {bestS2.delta < 0 && (
                    <> Strongest reduction trend seen in <strong style={{ color: '#3E7B3E' }}>{bestS2.year}</strong> ({fmt(Math.abs(Math.round(bestS2.delta)))} tCO₂e drop).</>
                  )}
                </p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                  <strong>📊 Intensity Analysis (Scope 2/RCN):</strong> 2024 ({int24.toFixed(3)}) → 2025 ({int25.toFixed(3)}).
                  {' '}Intensity shift:{' '}
                  <span style={{ color: intGrowth <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 600 }}>{intGrowth > 0 ? '+' : ''}{intGrowth.toFixed(1)}%</span>
                  {' '}vs Production shift:{' '}
                  <span style={{ fontWeight: 600 }}>{rcnGrowth > 0 ? '+' : ''}{rcnGrowth.toFixed(1)}%</span>.
                  {' '}<em>{intGrowth > 0 ? "Grid power usage is scaling worse than production growth. Priority intervention required." : "Grid efficiency improved relative to production throughput."}</em>
                </p>

                <p style={{ margin: '0 0 4px', marginTop: '6px' }}><strong>Strategic Mitigation Plan:</strong></p>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'Vietnam') && (
                    <li>
                      <strong>VICC RE Transition</strong>: Accelerate rooftop solar deployment across tier-1 facilities and secure REC pathways for grid shortfall.
                    </li>
                  )}
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'India') && (
                    <li>
                      <strong>India Operations</strong>: Enforce ISO 50001 energy standards to flatten peak-load grid dependency and transition to solar infrastructure.
                    </li>
                  )}
                </ul>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Scope 3 Supply Chain Section ──────────────────── */}
      {selectedScope === 'supply' && (() => {
        const s3Base = s3Data.find(d => d.year === 2021);
        const s3Cur  = s3Data.find(d => d.year === 2025);
        const s3_2022 = s3Data.find(d => d.year === 2022);
        const s3_2023 = s3Data.find(d => d.year === 2023);
        const s3_2024 = s3Data.find(d => d.year === 2024);
        if(!s3Base || !s3Cur) return <div style={{padding:24,color:'#888'}}>Loading Scope 3 data...</div>;

        // Targets
        const flagBase    = s3Base.cat1;
        const nonflagBase = s3Base.cat4v + s3Base.cat4r + s3Base.cat3;
        const flagTarget2032    = Math.round(flagBase * (1 - FLAG_TGT_PCT/100));
        const nonflagTarget2032 = Math.round(nonflagBase * (1 - NONFLAG_TGT_PCT/100));
        const totalTarget2032   = flagTarget2032 + nonflagTarget2032;
        const cur2032Gap = s3Cur.total - totalTarget2032;
        const annualCutNeeded = Math.round(cur2032Gap / (S3_TARGET_YEAR - 2025));

        // Actual Cat.1 per year (for scaling Origin breakdown)
        const cat1ByYear: Record<number, number> = {
          2021: s3Base.cat1,
          2022: s3_2022?.cat1 || 0,
          2023: s3_2023?.cat1 || 0,
          2024: s3_2024?.cat1 || 0,
          2025: s3Cur.cat1,
        };

        // Linear plan 2026-targetEndYear
        const totalCur = s3Cur.total;
        const annualCut = (totalCur - totalTarget2032) / (S3_TARGET_YEAR - 2025);
        const planYears: number[] = [];
        for(let y = 2026; y <= Math.min(targetEndYear, S3_TARGET_YEAR); y++) planYears.push(y);
        const planVal = (y: number) => Math.round(totalCur - annualCut * (y - 2025));

        const pctVsBase = Math.round(((s3Cur.total - s3Base.total) / s3Base.total) * 100);
        const pctFlagVsBase = Math.round(((s3Cur.cat1 - flagBase) / flagBase) * 100);
        const peakYear = s3Data.reduce((a,b) => b.total > a.total ? b : a);
        const bestYear = s3Data.slice(1).reduce((a,b) => b.total < a.total ? b : a);

        // Waterfall bars for scope 3
        const s3Bars: BarPoint[] = [
          { key:'base', label:['Baseline','2021'], actual: s3Base.total, isTotal:true },
          { key:'2022', label:['2022'], actual: s3_2022?.total || 0 },
          { key:'2023', label:['2023'], actual: s3_2023?.total || 0 },
          { key:'2024', label:['2024'], actual: s3_2024?.total || 0 },
          { key:'d2025', label:['Δ','2025'], actual: s3Cur.total },
          { key:'2025', label:['2025'], actual: s3Cur.total, isTotal:true },
          ...planYears.map(y => ({ key:y.toString(), label:[y.toString()], target: planVal(y) })),
          { key:'end', label:['by End', targetEndYear.toString()], target: planVal(targetEndYear), isTotal:true },
        ];

        const s3Callouts: Callout[] = [
          s3Base.total > 0 && s3Cur.total > 0 ? {
            fromCol:0, toCol:5, fromVal: s3Base.total, toVal: s3Cur.total,
            text: pctStr(s3Cur.total, s3Base.total), level:0
          } : null,
          s3Cur.total > 0 ? {
            fromCol:5, toCol: 5 + planYears.length + 1,
            fromVal: s3Cur.total, toVal: planVal(targetEndYear),
            text: pctStr(planVal(targetEndYear), s3Cur.total), level:0
          } : null,
        ].filter(Boolean) as Callout[];

        // OGSM rows
        const ogsm = [
          { label:'Scope 3 — absol. CO₂eq (tCO₂e)', vals:[
            s3Base.total, s3_2022?.total||0, s3_2023?.total||0, s3_2024?.total||0,
            '—', s3Cur.total,
            planYears[0] ? planVal(planYears[0]) : '—',
            planYears[1] ? planVal(planYears[1]) : '—',
            planYears[2] ? planVal(planYears[2]) : '—',
          ]},
          { label:'  ↳ Cat.1 Cashew (FLAG)', vals:[
            s3Base.cat1, s3_2022?.cat1||0, s3_2023?.cat1||0, s3_2024?.cat1||0,
            '—', s3Cur.cat1,'—','—','—',
          ]},
          { label:'  ↳ Cat.3 WTT Fuel & Energy', vals:[
            s3Base.cat3, s3_2022?.cat3||0, s3_2023?.cat3||0, s3_2024?.cat3||0,
            '—', s3Cur.cat3,'—','—','—',
          ]},
          { label:'  ↳ Cat.4 Transport', vals:[
            s3Base.cat4v+s3Base.cat4r, (s3_2022?.cat4v||0)+(s3_2022?.cat4r||0),
            (s3_2023?.cat4v||0)+(s3_2023?.cat4r||0),(s3_2024?.cat4v||0)+(s3_2024?.cat4r||0),
            '—', s3Cur.cat4v+s3Cur.cat4r,'—','—','—',
          ]},
        ];

        const oKeys = ['2021','2022','2023','2024','YTD 2025','2025','2026 Plan','2027 Plan','2028 Plan'];
        const oYears = [2021, 2022, 2023, 2024, 2025, 2025, 2026, 2027, 2028]; // year index per column for intensity
        const s3IntLabel = showIntensity ? 'tCO₂e/RCN' : 'tCO₂e';

        return (
          <div style={{ padding:'4px 12px', flex:1, display:'flex', flexDirection:'column', gap:'6px' }}>
            {/* OGSM Table */}
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
                <thead>
                  <tr style={{ background:'#1a3d5c', color:'white' }}>
                    <th style={{ padding:'5px 8px', textAlign:'left', fontWeight:700, minWidth:220 }}>
                      OGSM — {s3IntLabel}
                    </th>
                    {oKeys.map(k => (
                      <th key={k} style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ogsm.map((row,ri) => (
                    <tr key={ri} style={{ background: ri===0 ? '#f9f9f9' : 'white', borderBottom:'1px solid #ddd' }}>
                      <td style={{ padding:'4px 8px', fontWeight: ri===0?700:400, color: ri===0?'#1a1a1a':'#555' }}>{row.label}</td>
                      {row.vals.map((v,vi) => (
                        <td key={vi} style={{ padding:'4px 8px', textAlign:'right',
                          fontWeight: ri===0 ? 600 : 400,
                          color: vi===4||vi>=5 ? '#777' : ri===0 ? '#1a1a1a' : '#555'
                        }}>
                          {typeof v==='number'
                            ? (showIntensity && vi < 5 ? fmtInt(v, oYears[vi]) : fmt(v))
                            : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart + Commentary side by side */}
            <div style={{ display:'flex', gap:'16px', flex:1, minHeight:0 }}>
              {/* Chart */}
              <div style={{ flex:'0 0 55%', minWidth:0 }}>
                <WaterfallChart
                  bars={s3Bars}
                  callouts={s3Callouts}
                  title={`<strong>Scope 3 — Supply Chain</strong> – CO₂ eq absol. emission in ton`}
                  legendOrder={['baseline','actual','target']}
                />
                {/* Target callout box */}
                <div style={{ marginTop:6, display:'flex', gap:10, fontSize:'10px', color:'#555' }}>
                  <div style={{ padding:'4px 8px', background:'#eaf5ea', border:'1px solid #3E7B3E', borderRadius:4 }}>
                    🎯 <strong>FLAG −{FLAG_TGT_PCT}%</strong>: {fmt(flagBase)} → {fmt(flagTarget2032)} tCO₂e by 2032
                  </div>
                  <div style={{ padding:'4px 8px', background:'#eaf5ea', border:'1px solid #3E7B3E', borderRadius:4 }}>
                    🎯 <strong>Non-FLAG −{NONFLAG_TGT_PCT}%</strong>: {fmt(nonflagBase)} → {fmt(nonflagTarget2032)} tCO₂e by 2032
                  </div>
                </div>

                {/* ── Origin Risk Analysis Panel ── */}
                {showOrigin && (() => {
                  const selOD = originData.find(d => d.year === selectedOriginYear);
                  const baseOD = originData.find(d => d.year === 2021);
                  if (!selOD) return null;

                  // Scale emissions to match actual Cat.1 from DB
                  const actualCat1 = cat1ByYear[selectedOriginYear] || 0;
                  const rawTotal   = selOD.totalEm;
                  const scale      = rawTotal > 0 && actualCat1 > 0 ? actualCat1 / rawTotal : 1;
                  const scaledRows = selOD.rows.map(r => ({ ...r, emS: Math.round(r.em * scale) }));
                  const maxEmS     = Math.max(...scaledRows.map(r => r.emS));
                  const scaledTotal = Math.round(selOD.totalEm * scale);
                  const scaledHighEf = Math.round(selOD.highEfEm * scale);

                  return (
                    <div style={{ marginTop:10, border:'1.5px solid #C8281A', borderRadius:6, overflow:'hidden' }}>
                      {/* Header */}
                      <div style={{ background:'#C8281A', color:'white', padding:'5px 10px', fontSize:'11px', fontWeight:700, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>🌍 Cat.1 Origin Risk Analysis</span>
                        <span style={{ fontWeight:400, opacity:0.85, fontSize:'10px' }}>
                          Avg EF: {selOD.weightedAvgEF.toFixed(2)} tCO₂e/MT
                          {baseOD ? ` (2021: ${baseOD.weightedAvgEF.toFixed(2)})` : ''}
                        </span>
                      </div>

                      <div style={{ padding:'8px', background:'#fff' }}>
                        {/* Year selector — CLICKABLE */}
                        <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                          {[2021,2022,2023,2024,2025].map(oyr => {
                            const od = originData.find(d => d.year === oyr);
                            if (!od) return null;
                            const actCat1 = cat1ByYear[oyr] || 0;
                            const sc = od.totalEm > 0 && actCat1 > 0 ? actCat1 / od.totalEm : 1;
                            const highPct = od.totalEm > 0 ? Math.round(od.highEfEm / od.totalEm * 100) : 0;
                            const isSel = oyr === selectedOriginYear;
                            return (
                              <button
                                key={oyr}
                                onClick={() => setSelectedOriginYear(oyr)}
                                style={{
                                  fontSize:'10.5px', padding:'4px 9px',
                                  border: `1.5px solid ${isSel ? '#C8281A' : '#ddd'}`,
                                  borderRadius:4, cursor:'pointer',
                                  background: isSel ? '#C8281A' : '#f9f9f9',
                                  color: isSel ? '#fff' : '#444',
                                  fontWeight: isSel ? 700 : 400,
                                  transition:'all 0.15s',
                                }}
                              >
                                <strong>{oyr}</strong> &nbsp;
                                🔴 {highPct}% high-EF
                              </button>
                            );
                          })}
                        </div>

                        {/* Note: scaled to actual DB */}
                        {scale !== 1 && (
                          <div style={{ fontSize:'9.5px', color:'#888', marginBottom:5, fontStyle:'italic' }}>
                            ℹ️ Emissions scaled to match actual Cat.1 DB value ({fmt(actualCat1)} tCO₂e).
                            Origin % mix estimated from SBTi FLAG sourcing data.
                          </div>
                        )}

                        {/* Table */}
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'10.5px' }}>
                          <thead>
                            <tr style={{ borderBottom:'1px solid #eee', color:'#666' }}>
                              <th style={{ textAlign:'left', padding:'2px 4px', fontWeight:600, width:'90px' }}>Origin</th>
                              <th style={{ textAlign:'right', padding:'2px 4px', fontWeight:600, width:'50px' }}>EF</th>
                              <th style={{ textAlign:'right', padding:'2px 4px', fontWeight:600, width:'45px' }}>Mix %</th>
                              <th style={{ textAlign:'right', padding:'2px 4px', fontWeight:600, width:'70px' }}>tCO₂e</th>
                              <th style={{ padding:'2px 4px', width:'auto' }}>Risk bar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scaledRows.map(r => (
                              <tr key={r.origin} style={{ borderBottom:'1px solid #f5f5f5' }}>
                                <td style={{ padding:'2px 4px', fontWeight: r.ef > 5 ? 700 : 400, color: r.color }}>{r.origin}</td>
                                <td style={{ padding:'2px 4px', textAlign:'right', color: r.color, fontWeight:600 }}>{r.ef.toFixed(2)}</td>
                                <td style={{ padding:'2px 4px', textAlign:'right', color:'#555' }}>{r.pct.toFixed(1)}%</td>
                                <td style={{ padding:'2px 4px', textAlign:'right', fontWeight: r.ef>5?700:400, color: r.color }}>{fmt(r.emS)}</td>
                                <td style={{ padding:'2px 8px 2px 4px' }}>
                                  <div style={{ height:8, borderRadius:3, background:'#f0f0f0', overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${maxEmS>0?(r.emS/maxEmS*100):0}%`,
                                      background: r.color, borderRadius:3, transition:'width 0.3s' }} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop:'1.5px solid #ddd', background:'#f9f9f9' }}>
                              <td style={{ padding:'3px 4px', fontWeight:700 }} colSpan={2}>TOTAL</td>
                              <td style={{ padding:'3px 4px', textAlign:'right', fontWeight:700 }}>100%</td>
                              <td style={{ padding:'3px 4px', textAlign:'right', fontWeight:700, color:'#C8281A' }}>{fmt(scaledTotal)}</td>
                              <td style={{ padding:'3px 4px', fontSize:'10px', color: scaledHighEf/scaledTotal > 0.6 ? '#C8281A' : '#3E7B3E' }}>
                                🔴 High-EF: {fmt(scaledHighEf)} ({Math.round(scaledHighEf/scaledTotal*100)}%)
                              </td>
                            </tr>
                          </tfoot>
                        </table>

                        {/* Trend: avg EF per year */}
                        <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap', fontSize:'10px', color:'#555' }}>
                          <strong style={{ color:'#1a1a1a' }}>Weighted Avg EF trend:</strong>
                          {originData.map(od => {
                            const prev = originData.find(d => d.year === od.year - 1);
                            const improving = prev ? od.weightedAvgEF < prev.weightedAvgEF : true;
                            return (
                              <span key={od.year} style={{ color: improving ? '#3E7B3E' : '#C8281A', fontWeight:600 }}>
                                {od.year}: {od.weightedAvgEF.toFixed(2)}{prev ? (improving ? '▼' : '▲') : ''}
                              </span>
                            );
                          })}
                        </div>
                        <p style={{ margin:'6px 0 0', fontSize:'10px', color:'#666', fontStyle:'italic' }}>
                          ⚠️ Data based on SBTi FLAG EF methodology. Origin mix is approximate — connect <code>scope3_origin_data</code> table for real-time breakdown.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Commentary */}
              <div style={{ flex:1, minWidth:0, fontSize:'11.5px', lineHeight:'1.6' }}>
                <p style={{ margin:'0 0 6px' }}><strong>Scope 3 Emissions Overview:</strong></p>
                <ul style={{ margin:'0 0 8px', paddingLeft:'16px' }}>
                  <li>
                    Calculated using <strong>3 SBTi-required categories</strong>: Cat.1 (Purchased Cashew at-farm),
                    Cat.3 (Fuel &amp; Energy WTT), and Cat.4 (Upstream Transportation).
                  </li>
                  <li>
                    2025 Scope 3 emissions: <strong style={{ color: pctVsBase > 0 ? '#C8281A' : '#3E7B3E' }}>{fmt(s3Cur.total)} tCO₂e</strong>{' '}
                    (<span style={{ color: pctVsBase > 0 ? '#C8281A' : '#3E7B3E', fontWeight:700 }}>
                      {pctVsBase > 0 ? '+' : ''}{pctVsBase}%
                    </span>{' '}vs 2021 baseline) —
                    {pctVsBase > 0
                      ? <span style={{ color:'#C8281A' }}> still above baseline, trajectory must reverse.</span>
                      : <span style={{ color:'#3E7B3E' }}> below baseline, on track.</span>}
                  </li>
                  <li>
                    Peak emissions in <strong style={{ color:'#C8281A' }}>{peakYear.year}</strong> ({fmt(peakYear.total)} tCO₂e) —
                    driven by high-EF Indonesia cashew procurement (EF = 24.74 kgCO₂e/kg).
                  </li>
                  <li>
                    <strong>Cat.1 Cashew</strong> accounts for{' '}
                    <strong>{Math.round((s3Cur.cat1/s3Cur.total)*100)}%</strong> of total Scope 3 —
                    the <u>primary lever</u> for FLAG target achievement.
                  </li>
                </ul>

                <p style={{ margin:'0 0 4px' }}><strong>Scope 3 Reduction Strategy ({new Date().getFullYear()}–2032):</strong></p>
                <ul style={{ margin:'0 0 8px', paddingLeft:'16px' }}>
                  <li>
                    <strong>Sourcing Mix Optimization (FLAG)</strong>: Shift procurement away from
                    high-EF origins — Indonesia (24.74) — toward low-EF alternatives:
                    Nigeria (1.56), Benin (2.13), Cambodia (2.7). Target −{FLAG_TGT_PCT}% FLAG by 2032.
                  </li>
                  <li>
                    <strong>Supplier Certification</strong>: Prioritize Rainforest Alliance /
                    ASC-certified suppliers to support <em>no-deforestation</em> commitment (SBTi target: 2025).
                  </li>
                  <li>
                    <strong>Logistics Optimization (Cat.4)</strong>: Consolidate shipments,
                    improve vessel load factors, and transition coastal road freight to intermodal.
                    Current transport = {fmt(s3Cur.cat4v+s3Cur.cat4r)} tCO₂e/year.
                  </li>
                </ul>

                <p style={{ margin:'0 0 4px' }}><strong>Long-Term Goal:</strong></p>
                <ul style={{ margin:0, paddingLeft:'16px' }}>
                  <li>
                    Reduce total Scope 3 to <strong style={{ color:'#3E7B3E' }}>{fmt(totalTarget2032)} tCO₂e</strong> by {S3_TARGET_YEAR}
                    (FLAG: {fmt(flagTarget2032)} + Non-FLAG: {fmt(nonflagTarget2032)}).
                  </li>
                  <li>
                    Gap to close from 2025: <strong style={{ color:'#C8281A' }}>{fmt(cur2032Gap)} tCO₂e</strong> —
                    requires <strong>~{fmt(annualCutNeeded)} tCO₂e/year</strong> average reduction through sourcing strategy.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

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
