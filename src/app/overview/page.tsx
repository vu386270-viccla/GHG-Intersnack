'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SCOPE_1_CATEGORIES, GRID_EMISSION_FACTORS, MONTHS_VI } from '@/lib/types';
import type { Factory } from '@/lib/types';

const COMMON_EF = 0.8041;
const S1_COLORS = ['#E32314', '#FF6B35', '#F5A623', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72CF', '#FF6B9D'];
const FAC_COLORS = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
const FAC_COLORS_LIGHT = ['#FF8A80', '#FFD180', '#B388FF', '#CCFF90'];

interface RawRow {
  factory_id: string; year: number; month: number; scope: string;
  category: string; activity_data: number; emissions_tco2e: number;
}
interface ProdRow {
  factory_id: string; year: number; month: number; category: string; quantity: number;
}

type ViewMode = 'ALL' | 'SINGLE' | 'COMPARE';

function MiniDonut({ segments, size = 120, thickness = 22, centerLabel, centerSub }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerSub?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let cumAngle = -90;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const rot = cumAngle; cumAngle += pct * 360;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
          strokeDasharray={`${dash} ${circ - dash}`} transform={`rotate(${rot} ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.5s' }} />;
      })}
      {centerLabel && <>
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="800" fill="#333" fontFamily="'Caveat',cursive">{centerLabel}</text>
        {centerSub && <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="#999" fontWeight="600">{centerSub}</text>}
      </>}
    </svg>
  );
}

export default function OverviewPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [allEmissions, setAllEmissions] = useState<RawRow[]>([]);
  const [prodData, setProdData] = useState<ProdRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [factoryA, setFactoryA] = useState('');
  const [factoryB, setFactoryB] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useCommonEF, setUseCommonEF] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch all emissions (Supabase default limit = 1000, we have 1200+)
      const [fRes, pRes] = await Promise.all([
        supabase.from('factories').select('*'),
        supabase.from('production_data').select('factory_id,year,month,category,quantity').range(0, 9999),
      ]);
      // Fetch emissions in 2 batches to bypass 1000-row limit
      const [e1, e2] = await Promise.all([
        supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e').range(0, 999),
        supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e').range(1000, 1999),
      ]);
      const allEm = [...(e1.data || []), ...(e2.data || [])] as RawRow[];
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      setAllEmissions(allEm);
      setProdData((pRes.data || []) as ProdRow[]);
      if (facs.length >= 2 && !factoryA) { setFactoryA(facs[0].id); setFactoryB(facs[1].id); }
      setLoading(false);
    }
    load();
  }, []);

  const calcS2 = (rows: RawRow[], year: number, fac?: Factory) =>
    rows.filter(e => e.scope === 'scope_2').reduce((s, e) => {
      if (useCommonEF) return s + (Number(e.activity_data) * COMMON_EF / 1000);
      const f = fac || factories.find(ff => ff.id === e.factory_id);
      const gef = GRID_EMISSION_FACTORS.find(ef => ef.country === f?.country && ef.year === year);
      return s + (Number(e.activity_data) * (gef?.factor || COMMON_EF) / 1000);
    }, 0);
  const calcS1 = (rows: RawRow[]) => rows.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);

  const emissions = useMemo(() => allEmissions.filter(e => e.year === selectedYear), [allEmissions, selectedYear]);

  const buildFactoryBlock = (fac: Factory, rows: RawRow[]) => {
    const fRows = rows.filter(e => e.factory_id === fac.id);
    const s1 = calcS1(fRows);
    const s2 = calcS2(fRows, selectedYear, fac);
    const kWh = fRows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    // S1 by category with activity_data
    const s1ByCat: { key: string; label: string; icon: string; value: number; activity: number; unit: string }[] = [];
    const catMap: Record<string, number> = {};
    const actMap: Record<string, number> = {};
    fRows.filter(e => e.scope === 'scope_1').forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.emissions_tco2e);
      actMap[e.category] = (actMap[e.category] || 0) + Number(e.activity_data);
    });
    Object.entries(catMap).sort(([, a], [, b]) => b - a).forEach(([key, val]) => {
      const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
      s1ByCat.push({ key, label: def?.label || key, icon: def?.icon || '📊', value: val, activity: actMap[key] || 0, unit: def?.unit || '' });
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mRows = fRows.filter(e => e.month === i + 1);
      return { month: i + 1, s1: calcS1(mRows), s2: calcS2(mRows, selectedYear, fac), total: calcS1(mRows) + calcS2(mRows, selectedYear, fac) };
    });
    return { factory: fac, s1, s2, total: s1 + s2, kWh, s1ByCat, monthly };
  };

  /* ── Multi-year SBTi roadmap data ── (filters by selected factories) */
  const roadmapData = useMemo(() => {
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    // Base year = 2021, ALL factories (for consistent baseline)
    const baseRows2021 = allEmissions.filter(e => e.year === 2021);

    // Selected factory IDs based on current viewMode
    const selIds = viewMode === 'ALL'
      ? factories.map(f => f.id)
      : viewMode === 'SINGLE'
        ? [factoryA]
        : [factoryA, factoryB];

    // Compute base for selected factories only
    const baseRowsSel = baseRows2021.filter(e => selIds.includes(e.factory_id));
    const baseTotalSel = calcS1(baseRowsSel) + calcS2(baseRowsSel, 2021);

    return years.map(yr => {
      const yrRows = allEmissions.filter(e => e.year === yr && selIds.includes(e.factory_id));
      const actual = calcS1(yrRows) + calcS2(yrRows, yr);
      // Linear target: from baseTotalSel → 50% of baseTotalSel over 11 years (2021→2032)
      const target = baseTotalSel * (1 - 0.5 * ((yr - 2021) / 11));
      const monthsActive = new Set(yrRows.map(e => e.month)).size;

      // Per-factory breakdown (only selected)
      const perFactory = factories
        .filter(f => selIds.includes(f.id))
        .map(f => {
          const fData = yrRows.filter(e => e.factory_id === f.id);
          const s1 = calcS1(fData);
          const s2 = calcS2(fData, yr, f);
          return { factory: f, s1, s2, total: s1 + s2 };
        });

      // RCN for this year (selected factories)
      const yrRCN = prodData
        .filter(p => p.year === yr && selIds.includes(p.factory_id) && p.category === 'rcn_input')
        .reduce((s, p) => s + Number(p.quantity), 0);

      return { year: yr, actual, target, baseTotal: baseTotalSel, monthsActive, perFactory, onTrack: actual <= target, rcn: yrRCN };
    });
  }, [allEmissions, factories, viewMode, factoryA, factoryB, useCommonEF, prodData]);

  /* ── SINGLE mode: YoY insight analysis ── */
  const singleInsight = useMemo(() => {
    if (viewMode !== 'SINGLE' || !factoryA) return null;
    const fac = factories.find(f => f.id === factoryA);
    if (!fac) return null;
    const prevYear = selectedYear - 1;
    const curRows  = allEmissions.filter(e => e.year === selectedYear  && e.factory_id === factoryA);
    const prevRows = allEmissions.filter(e => e.year === prevYear       && e.factory_id === factoryA);

    // Scope 1 by category
    const agg = (rows: RawRow[], scope: string) => {
      const em: Record<string, number> = {};
      const act: Record<string, number> = {};
      rows.filter(e => e.scope === scope).forEach(e => {
        em[e.category]  = (em[e.category]  || 0) + Number(e.emissions_tco2e);
        act[e.category] = (act[e.category] || 0) + Number(e.activity_data);
      });
      return { em, act };
    };
    const s1Cur  = agg(curRows,  'scope_1');
    const s1Prev = agg(prevRows, 'scope_1');
    const s1TotalCur  = Object.values(s1Cur.em).reduce((s, v) => s + v, 0);
    const s1TotalPrev = Object.values(s1Prev.em).reduce((s, v) => s + v, 0);

    // Scope 2
    const kWhCur  = curRows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    const kWhPrev = prevRows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    const efCur  = GRID_EMISSION_FACTORS.find(ef => ef.country === fac.country && ef.year === selectedYear)?.factor  || COMMON_EF;
    const efPrev = GRID_EMISSION_FACTORS.find(ef => ef.country === fac.country && ef.year === prevYear)?.factor || COMMON_EF;
    const s2EmCur  = useCommonEF ? kWhCur  * COMMON_EF / 1000 : kWhCur  * efCur  / 1000;
    const s2EmPrev = useCommonEF ? kWhPrev * COMMON_EF / 1000 : kWhPrev * efPrev / 1000;

    // Production
    const rcn = (yr: number) => prodData.filter(p => p.year === yr && p.factory_id === factoryA && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
    const rcnCur = rcn(selectedYear); const rcnPrev = rcn(prevYear);

    const totalCur  = s1TotalCur  + s2EmCur;
    const totalPrev = s1TotalPrev + s2EmPrev;

    // Intensity = tCO2e / MT RCN
    const intTotCur   = rcnCur  > 0 ? totalCur   / rcnCur  : 0;
    const intTotPrev  = rcnPrev > 0 ? totalPrev  / rcnPrev : 0;
    const intS1Cur    = rcnCur  > 0 ? s1TotalCur / rcnCur  : 0;
    const intS1Prev   = rcnPrev > 0 ? s1TotalPrev/ rcnPrev : 0;
    const intkWhCur   = rcnCur  > 0 ? kWhCur     / rcnCur  : 0;
    const intkWhPrev  = rcnPrev > 0 ? kWhPrev    / rcnPrev : 0;

    // All category keys
    const allCatKeys = Array.from(new Set([...Object.keys(s1Cur.em), ...Object.keys(s1Prev.em)]));
    const s1Drivers = allCatKeys.map(key => {
      const cur = s1Cur.em[key] || 0; const prev = s1Prev.em[key] || 0;
      const actCur = s1Cur.act[key] || 0; const actPrev = s1Prev.act[key] || 0;
      return { key, cur, prev, delta: cur - prev, actCur, actPrev };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : 0;

    return {
      prevYear, fac,
      s1TotalCur, s1TotalPrev, s1Drivers,
      kWhCur, kWhPrev, s2EmCur, s2EmPrev, efCur,
      rcnCur, rcnPrev,
      totalCur, totalPrev,
      intTotCur, intTotPrev, intS1Cur, intS1Prev, intkWhCur, intkWhPrev,
      pct,
    };
  }, [viewMode, factoryA, allEmissions, prodData, selectedYear, useCommonEF, factories]);

  const data = useMemo(() => {
    const allS1 = calcS1(emissions);
    const allS2 = calcS2(emissions, selectedYear);
    const allTotal = allS1 + allS2;
    const lastMonth = Math.max(...emissions.map(e => e.month), 0);
    const monthsWithData = new Set(emissions.map(e => e.month)).size;
    const baseRows = allEmissions.filter(e => e.year === 2021);
    const baseS1S2 = calcS1(baseRows) + calcS2(baseRows, 2021);
    const targetS1S2 = baseS1S2 * 0.5;
    const currentPct = baseS1S2 > 0 ? ((baseS1S2 - allTotal) / baseS1S2 * 100) : 0;
    const expectedPct = ((selectedYear - 2021) / 11) * 50;
    const factoryBlocks = factories.map(f => buildFactoryBlock(f, emissions)).sort((a, b) => b.total - a.total);
    return { allS1, allS2, allTotal, lastMonth, monthsWithData, baseS1S2, targetS1S2, currentPct, expectedPct, factoryBlocks };
  }, [emissions, allEmissions, factories, useCommonEF, selectedYear]);

  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const fmtPct = (n: number) => n.toFixed(1);

  const displayBlocks = useMemo(() => {
    if (viewMode === 'ALL') return data.factoryBlocks;
    if (viewMode === 'SINGLE') return data.factoryBlocks.filter(b => b.factory.id === factoryA);
    return data.factoryBlocks.filter(b => b.factory.id === factoryA || b.factory.id === factoryB);
  }, [viewMode, factoryA, factoryB, data.factoryBlocks]);

  const dispTotal = displayBlocks.reduce((s, b) => s + b.total, 0);
  const dispS1 = displayBlocks.reduce((s, b) => s + b.s1, 0);
  const dispS2 = displayBlocks.reduce((s, b) => s + b.s2, 0);
  const maxMonthly = Math.max(...displayBlocks.flatMap(b => b.monthly.map(m => m.total)), 1);

  if (loading) return (
    <div className="overview-wrapper">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div className="loading-spinner" /><span style={{ color: '#999' }}>Loading…</span>
      </div>
    </div>
  );

  /* Roadmap SVG dimensions for the SBTi chart */
  const rmMaxVal = Math.max(...roadmapData.map(d => Math.max(d.actual, d.target, d.baseTotal)), 1) * 1.15;
  const rmW = 560, rmH = 175, rmPadL = 42, rmPadR = 52, rmPadT = 22, rmPadB = 36;
  const rmPlotW = rmW - rmPadL - rmPadR;
  const rmPlotH = rmH - rmPadT - rmPadB;
  // RCN secondary axis
  const rmMaxRCN = Math.max(...roadmapData.map(d => d.rcn), 1) * 1.2;

  return (
    <div className="overview-wrapper">
      {/* Controls */}
      <div className="overview-controls">
        {/* Home button — prominent */}
        <Link href="/" className="ov-home-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Dashboard
        </Link>

        <div className="ov-controls-divider" />

        <div className="ov-mode-tabs">
          {([['ALL', '🏭 All Factories'], ['SINGLE', '🔍 Single'], ['COMPARE', '⚖️ Compare']] as [ViewMode, string][]).map(([mode, lb]) => (
            <button key={mode} className={`ov-mode-tab ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>{lb}</button>
          ))}
        </div>

        {(viewMode === 'SINGLE' || viewMode === 'COMPARE') && (
          <div className="ov-select-group">
            <span className="ov-select-label">{viewMode === 'COMPARE' ? 'Factory A' : 'Factory'}</span>
            <select value={factoryA} onChange={e => setFactoryA(e.target.value)} className="overview-select">
              {factories.map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
            </select>
          </div>
        )}
        {viewMode === 'COMPARE' && <>
          <span className="ov-vs-badge">VS</span>
          <div className="ov-select-group">
            <span className="ov-select-label">Factory B</span>
            <select value={factoryB} onChange={e => setFactoryB(e.target.value)} className="overview-select">
              {factories.filter(f => f.id !== factoryA).map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
            </select>
          </div>
        </>}

        <div className="ov-controls-divider" />

        <div className="ov-select-group">
          <span className="ov-select-label">Year</span>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="overview-select">
            {[2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <button className={`overview-ef-toggle ${useCommonEF ? 'common' : 'individual'}`} onClick={() => setUseCommonEF(!useCommonEF)}>
          {useCommonEF ? `EF ${COMMON_EF}` : 'Country EF'}
        </button>
      </div>

      {/* Slide */}
      <div className="overview-slide">
        <div className="ov-topbar">
          <div className="ov-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span>INTERSNACK GROUP</span>
          </div>
          <div className="ov-topbar-title">
            GHG Emissions Report — {selectedYear} YTD ({data.monthsWithData} months)
            {viewMode === 'SINGLE' && factories.find(f => f.id === factoryA) && (
              <span style={{ marginLeft: 8, padding: '1px 8px', background: 'rgba(255,255,255,0.18)', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                {factories.find(f => f.id === factoryA)!.country === 'India' ? '🇮🇳' : '🇻🇳'} {factories.find(f => f.id === factoryA)!.name}
              </span>
            )}
            {viewMode === 'COMPARE' && (
              <span style={{ marginLeft: 8, padding: '1px 8px', background: 'rgba(255,255,255,0.18)', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>
                {factories.find(f => f.id === factoryA)?.name} vs {factories.find(f => f.id === factoryB)?.name}
              </span>
            )}
          </div>
          <div className="ov-ef-badge">{useCommonEF ? `EF = ${COMMON_EF}` : 'Country Grid EF'} kg CO₂e/kWh</div>
        </div>

        <div className="ov-body">
          {/* LEFT */}
          <div className="ov-left">
            <div className="ov-grand-kpi">
              <div className="ov-grand-label">TOTAL SCOPE 1 + 2 · {selectedYear} YTD</div>
              <div className="ov-grand-value">{fmt(dispTotal)}</div>
              <div className="ov-grand-unit">tCO₂e</div>
            </div>
            <div className="ov-scope-row">
              <div className="ov-scope-card s1">
                <div className="ov-scope-header"><span className="ov-scope-icon">🔥</span> SCOPE 1</div>
                <div className="ov-scope-value">{fmt(dispS1)}</div>
                <div className="ov-scope-sub">{dispTotal > 0 ? fmtPct(dispS1/dispTotal*100) : '0'}%</div>
              </div>
              <div className="ov-scope-card s2">
                <div className="ov-scope-header"><span className="ov-scope-icon">⚡</span> SCOPE 2</div>
                <div className="ov-scope-value">{fmt(dispS2)}</div>
                <div className="ov-scope-sub">{dispTotal > 0 ? fmtPct(dispS2/dispTotal*100) : '0'}%</div>
              </div>
            </div>

            {/* Scope 1 Donut + Activity */}
            <div className="ov-donut-inline">
              <MiniDonut size={90} thickness={16} centerLabel={fmt(dispS1)} centerSub="S1"
                segments={(() => {
                  const cats: Record<string, number> = {};
                  displayBlocks.forEach(b => b.s1ByCat.forEach(c => { cats[c.key] = (cats[c.key] || 0) + c.value; }));
                  return Object.entries(cats).sort(([,a],[,b]) => b - a).map(([key, val], i) => {
                    const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                    return { label: def?.label || key, value: val, color: S1_COLORS[i] };
                  });
                })()} />
              <div className="ov-donut-legend-sm">
                {(() => {
                  const cats: Record<string, { em: number; act: number }> = {};
                  displayBlocks.forEach(b => b.s1ByCat.forEach(c => {
                    if (!cats[c.key]) cats[c.key] = { em: 0, act: 0 };
                    cats[c.key].em += c.value;
                    cats[c.key].act += c.activity;
                  }));
                  return Object.entries(cats).sort(([,a],[,b]) => b.em - a.em).slice(0, 5).map(([key, v], i) => {
                    const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                    const actFmt = v.act >= 1000 ? `${(v.act/1000).toFixed(1)}k` : v.act.toFixed(0);
                    return <div key={key} className="ov-dls-item">
                      <span className="ov-legend-dot" style={{ background: S1_COLORS[i] }}/>
                      <span>{def?.icon} {actFmt} {def?.unit}</span>
                      <span style={{ color: '#999', marginLeft: 'auto' }}>{fmt(v.em)} t</span>
                    </div>;
                  });
                })()}
              </div>
            </div>

            {/* RCN Intensity + Electricity */}
            <div className="ov-elec-detail">
              {(() => {
                const selFactoryIds = displayBlocks.map(b => b.factory.id);
                const yrProd = prodData.filter(p => p.year === selectedYear && selFactoryIds.includes(p.factory_id));
                const totalRCN = yrProd.filter(p => p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
                const totalCK = yrProd.filter(p => p.category === 'ck_output').reduce((s, p) => s + Number(p.quantity), 0);
                const intensity = totalRCN > 0 ? (dispTotal / totalRCN) : 0;
                return <>
                  <div className="ov-elec-item"><span className="ov-elec-label">🥜 RCN Input</span><span className="ov-elec-val">{fmt(totalRCN)} MT</span></div>
                  <div className="ov-elec-item"><span className="ov-elec-label">📦 CK Output</span><span className="ov-elec-val">{totalCK > 1000 ? `${(totalCK/1000).toFixed(0)}k` : fmt(totalCK)} MT</span></div>
                  <div className="ov-elec-item" style={{ borderTop: '1px solid #eee', paddingTop: '4px', marginTop: '2px' }}>
                    <span className="ov-elec-label" style={{ fontWeight: 700, color: '#E32314' }}>📊 Intensity</span>
                    <span className="ov-elec-val" style={{ color: '#E32314', fontWeight: 700 }}>{intensity.toFixed(2)} tCO₂e/MT RCN</span>
                  </div>
                  <div className="ov-elec-item"><span className="ov-elec-label">⚡ Electricity</span><span className="ov-elec-val">{(displayBlocks.reduce((s,b)=>s+b.kWh,0)/1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} MWh</span></div>
                </>;
              })()}
            </div>
          </div>

          {/* RIGHT */}
          <div className="ov-right">
            {/* Monthly chart */}
            <div className="ov-chart-title">Monthly Emissions {selectedYear} (tCO₂e)</div>
            <div className="ov-chart">
              <svg viewBox="0 0 560 120" width="100%" height="120">
                {[0, 0.5, 1].map((pct, i) => (
                  <g key={`g${i}`}>
                    <line x1={30} y1={100-pct*85} x2={555} y2={100-pct*85} stroke="#f0f0f0" strokeWidth={0.5}/>
                    <text x={28} y={103-pct*85} textAnchor="end" fontSize="6.5" fill="#ccc">{Math.round(maxMonthly*pct)}</text>
                  </g>
                ))}
                {Array.from({length:12}, (_,mi) => {
                  const bW = 36, gap = (525-12*bW)/13, x0 = 32+gap+mi*(bW+gap);
                  const barW = displayBlocks.length > 1 ? bW/displayBlocks.length - 1 : bW - 4;
                  return <g key={mi}>
                    {displayBlocks.map((fb,fi) => {
                      const m = fb.monthly[mi], h = maxMonthly>0?(m.total/maxMonthly)*85:0;
                      const s1h = maxMonthly>0?(m.s1/maxMonthly)*85:0, s2h = h-s1h;
                      const bx = x0+fi*(barW+1);
                      return <g key={fi}>
                        <rect x={bx} y={100-h} width={barW} height={s2h} rx={1} fill={FAC_COLORS_LIGHT[fi]} opacity={0.7}/>
                        <rect x={bx} y={100-s1h} width={barW} height={s1h} rx={s2h===0?1:0} fill={FAC_COLORS[fi]} opacity={0.85}/>
                      </g>;
                    })}
                    <text x={x0+bW/2} y={113} textAnchor="middle" fontSize="6.5" fill="#999">{MONTHS_VI[mi]}</text>
                  </g>;
                })}
              </svg>
              <div className="ov-chart-legend">
                {displayBlocks.map((fb,i) => <span key={fb.factory.id}><span className="ov-legend-dot" style={{background:FAC_COLORS[i]}}/>{fb.factory.name}</span>)}
              </div>
            </div>

            {/* ── SBTi ROADMAP — Full multi-year chart ── */}
            <div className="ov-roadmap-full">
              <div className="ov-chart-title">
                🎯 SBTi Roadmap — Scope 1+2 · 2021 → 2032
                {viewMode === 'SINGLE' && factories.find(f => f.id === factoryA) && (
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '1px 7px', background: '#E3231412', color: '#E32314', borderRadius: 4, border: '1px solid #E3231422' }}>
                    {factories.find(f => f.id === factoryA)!.country === 'India' ? '🇮🇳' : '🇻🇳'} {factories.find(f => f.id === factoryA)!.name}
                  </span>
                )}
                {viewMode === 'COMPARE' && (
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '1px 7px', background: '#E3231412', color: '#E32314', borderRadius: 4, border: '1px solid #E3231422' }}>
                    {factories.find(f => f.id === factoryA)?.name} + {factories.find(f => f.id === factoryB)?.name}
                  </span>
                )}
              </div>
              <svg viewBox={`0 0 ${rmW} ${rmH}`} width="100%" height={rmH} style={{overflow:'visible'}}>
                {/* Left axis grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                  <g key={`rg${i}`}>
                    <line x1={rmPadL} y1={rmPadT + rmPlotH*(1-p)} x2={rmW-rmPadR} y2={rmPadT + rmPlotH*(1-p)} stroke="#f0f0f0" strokeWidth={0.6}/>
                    <text x={rmPadL-4} y={rmPadT + rmPlotH*(1-p)+3} textAnchor="end" fontSize="7" fill="#bbb">{fmt(rmMaxVal*p)}</text>
                  </g>
                ))}

                {/* Target pathway line (dashed green) — extends to 2032 */}
                {(() => {
                  const pts = roadmapData.map((d, i) => {
                    const totalCols = roadmapData.length; // 6 bars (2021-2026)
                    const x = rmPadL + (i / (totalCols - 1)) * rmPlotW;
                    const y = rmPadT + rmPlotH * (1 - d.target / rmMaxVal);
                    return `${x},${y}`;
                  });
                  // Extend dashed line to 2032 endpoint at right edge
                  const x2032 = rmW - rmPadR + 48;
                  const t2032 = roadmapData[0]?.baseTotal * 0.5 || 0;
                  const y2032 = rmPadT + rmPlotH * (1 - t2032 / rmMaxVal);
                  return <polyline points={[...pts, `${x2032},${y2032}`].join(' ')} fill="none" stroke="#8CB92D" strokeWidth={1.5} strokeDasharray="5,3" opacity={0.75}/>;
                })()}

                {/* RCN dotted line (secondary axis — right side) */}
                {rmMaxRCN > 1 && (() => {
                  const rcnPts = roadmapData
                    .filter(d => d.rcn > 0)
                    .map(d => {
                      const i = roadmapData.indexOf(d);
                      const totalCols = roadmapData.length;
                      const x = rmPadL + (i / (totalCols - 1)) * rmPlotW;
                      const y = rmPadT + rmPlotH * (1 - d.rcn / rmMaxRCN);
                      return `${x},${y}`;
                    });
                  if (rcnPts.length < 2) return null;
                  return (
                    <g>
                      <polyline points={rcnPts.join(' ')} fill="none" stroke="#6366F1" strokeWidth={1.2} strokeDasharray="2,3" opacity={0.55}/>
                      {roadmapData.filter(d => d.rcn > 0).map(d => {
                        const i = roadmapData.indexOf(d);
                        const totalCols = roadmapData.length;
                        const x = rmPadL + (i / (totalCols - 1)) * rmPlotW;
                        const y = rmPadT + rmPlotH * (1 - d.rcn / rmMaxRCN);
                        const rcnK = d.rcn >= 1000 ? `${(d.rcn/1000).toFixed(1)}k` : Math.round(d.rcn).toString();
                        return (
                          <g key={`rcn${d.year}`}>
                            <circle cx={x} cy={y} r={2} fill="#6366F1" opacity={0.6}/>
                            <text x={x} y={y - 4} textAnchor="middle" fontSize="6" fill="#6366F1" opacity={0.8}>{rcnK}</text>
                          </g>
                        );
                      })}
                      {/* Right axis label */}
                      <text x={rmW - rmPadR + 4} y={rmPadT} fontSize="6.5" fill="#6366F1" opacity={0.7}>MT RCN →</text>
                    </g>
                  );
                })()}

                {/* Stacked bars per year */}
                {roadmapData.map((d, i) => {
                  const totalCols = roadmapData.length;
                  const x = rmPadL + (i / (totalCols - 1)) * rmPlotW;
                  const barW = 24;
                  const barX = x - barW / 2;
                  let cumH = 0;
                  const targetY = rmPadT + rmPlotH * (1 - d.target / rmMaxVal);
                  const isCurrent = d.year === selectedYear;

                  return (
                    <g key={d.year}>
                      {d.perFactory.sort((a,b) => b.total - a.total).map((pf, fi) => {
                        const h = rmMaxVal > 0 ? (pf.total / rmMaxVal) * rmPlotH : 0;
                        const y = rmPadT + rmPlotH - cumH - h;
                        cumH += h;
                        const fIdx = factories.findIndex(f => f.id === pf.factory.id);
                        return <rect key={fi} x={barX} y={y} width={barW} height={Math.max(h, 0.5)} rx={1.5}
                          fill={FAC_COLORS[fIdx >= 0 ? fIdx : fi]} opacity={isCurrent ? 0.92 : 0.55}
                          stroke={isCurrent ? '#333' : 'none'} strokeWidth={isCurrent ? 0.8 : 0}/>;
                      })}

                      {/* Actual value label above bar */}
                      {d.actual > 0 && (
                        <text x={x} y={rmPadT + rmPlotH - cumH - 5} textAnchor="middle" fontSize="7.5" fontWeight="700"
                          fill={isCurrent ? '#E32314' : '#666'}>
                          {fmt(d.actual)}
                        </text>
                      )}

                      {/* 2026: also show % vs target annotation */}
                      {isCurrent && d.actual > 0 && (() => {
                        const pctReduced = d.baseTotal > 0 ? ((d.baseTotal - d.actual) / d.baseTotal * 100) : 0;
                        const sign = pctReduced >= 0 ? '-' : '+';
                        return (
                          <text x={x} y={rmPadT + rmPlotH - cumH - 14} textAnchor="middle" fontSize="6.5" fontWeight="600"
                            fill={d.onTrack ? '#27AE60' : '#E32314'}>
                            {sign}{Math.abs(pctReduced).toFixed(1)}% vs 2021
                          </text>
                        );
                      })()}

                      {/* Target dot on SBTi pathway */}
                      <circle cx={x} cy={targetY} r={2.5} fill="#8CB92D" opacity={0.7}/>

                      {/* Year label */}
                      <text x={x} y={rmH - rmPadB + 12} textAnchor="middle" fontSize="8.5"
                        fill={isCurrent ? '#E32314' : '#888'}
                        fontWeight={isCurrent ? 800 : 400}>
                        {d.year}
                      </text>

                      {/* On-track status */}
                      {d.actual > 0 && (
                        <text x={x} y={rmH - rmPadB + 22} textAnchor="middle" fontSize="6.5"
                          fill={d.onTrack ? '#2ECC71' : '#E32314'} fontWeight="700">
                          {d.onTrack ? '✓ On track' : '✗ Over'}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 2032 target endpoint marker */}
                {(() => {
                  const x = rmW - rmPadR + 48;
                  const t2032 = roadmapData[0]?.baseTotal * 0.5 || 0;
                  const y = rmPadT + rmPlotH * (1 - t2032 / rmMaxVal);
                  return (
                    <g>
                      <circle cx={x} cy={y} r={6} fill="none" stroke="#8CB92D" strokeWidth={2}/>
                      <circle cx={x} cy={y} r={2.5} fill="#8CB92D"/>
                      {/* Value above */}
                      <text x={x} y={y - 10} textAnchor="middle" fontSize="7.5" fill="#4A6E12" fontWeight="800">{fmt(t2032)}</text>
                      {/* -50% target badge */}
                      <rect x={x-14} y={y+8} width={28} height={11} rx={3} fill="#8CB92D" opacity={0.15}/>
                      <text x={x} y={y+17} textAnchor="middle" fontSize="7" fill="#4A6E12" fontWeight="800">-50% target</text>
                      {/* Year */}
                      <text x={x} y={rmH - rmPadB + 12} textAnchor="middle" fontSize="8.5" fill="#8CB92D" fontWeight="800">2032</text>
                    </g>
                  );
                })()}
              </svg>

              <div className="ov-roadmap-legend">
                {viewMode === 'ALL'
                  ? factories.map((f, i) => (
                      <span key={f.id}><span className="ov-legend-dot" style={{ background: FAC_COLORS[i] }} />{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</span>
                    ))
                  : displayBlocks.map((fb, i) => (
                      <span key={fb.factory.id}><span className="ov-legend-dot" style={{ background: FAC_COLORS[factories.findIndex(f=>f.id===fb.factory.id)] }} />{fb.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fb.factory.name}</span>
                    ))
                }
                <span style={{ marginLeft: 'auto' }}><span style={{ borderBottom: '1.5px dashed #8CB92D', paddingBottom: 1 }}>&nbsp;&nbsp;&nbsp;</span> SBTi Target Pathway</span>
                <span><span style={{ borderBottom: '1.5px dotted #6366F1', paddingBottom: 1 }}>&nbsp;&nbsp;&nbsp;</span> RCN Input (MT)</span>
                <span>✓ On track · ✗ Over target</span>
              </div>
            </div>

            {/* Factory table (when ALL or COMPARE) */}
            {displayBlocks.length > 1 && (
              <div className="ov-factory-table compact">
                <div className="ov-table-title">Factory — {selectedYear} YTD</div>
                <table>
                  <thead><tr><th>Plant</th><th style={{textAlign:'right'}}>S1</th><th style={{textAlign:'right'}}>S2</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>MWh</th><th style={{width:'70px'}}>Share</th></tr></thead>
                  <tbody>
                    {displayBlocks.map((fb, i) => (
                      <tr key={fb.factory.id}>
                        <td><span style={{color:FAC_COLORS[factories.findIndex(f=>f.id===fb.factory.id)],fontWeight:700,marginRight:3}}>●</span>{fb.factory.country==='India'?'🇮🇳':'🇻🇳'} {fb.factory.name}</td>
                        <td style={{textAlign:'right',fontWeight:600}}>{fmt(fb.s1)}</td>
                        <td style={{textAlign:'right',fontWeight:600}}>{fmt(fb.s2)}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(fb.total)}</td>
                        <td style={{textAlign:'right',color:'#888'}}>{(fb.kWh/1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</td>
                        <td><div className="ov-share-bar"><div style={{width:`${dispTotal>0?(fb.total/dispTotal*100):0}%`,background:FAC_COLORS[factories.findIndex(f=>f.id===fb.factory.id)]}}/></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── SINGLE MODE: Scope 1 Drivers + Scope 2 vs RCN Analysis ── */}
            {viewMode === 'SINGLE' && singleInsight && (() => {
              const si = singleInsight;
              const { pct } = si;
              const hasPrev = si.s1TotalPrev > 0 || si.s2EmPrev > 0;
              const kWhPctChg = pct(si.kWhCur, si.kWhPrev);
              const rcnPctChg = pct(si.rcnCur, si.rcnPrev);
              const s1PctChg  = pct(si.s1TotalCur, si.s1TotalPrev);
              const s2PctChg  = pct(si.s2EmCur, si.s2EmPrev);

              // Electricity vs RCN narrative
              const kWhUp = kWhPctChg > 0;
              const rcnUp = rcnPctChg > 0;
              const intKWhChg = pct(si.intkWhCur, si.intkWhPrev);
              let narrative = '';
              if (!hasPrev) {
                narrative = 'Chưa có dữ liệu năm trước để so sánh.';
              } else if (kWhUp && rcnUp) {
                if (intKWhChg <= 1) narrative = `Điện tăng ${kWhPctChg.toFixed(1)}% nhưng RCN tăng ${rcnPctChg.toFixed(1)}% → hiệu suất điện ổn định (kWh/MT RCN gần như không đổi).`;
                else narrative = `Điện tăng ${kWhPctChg.toFixed(1)}% trong khi RCN chỉ tăng ${rcnPctChg.toFixed(1)}% → kém hiệu quả hơn, tiêu thụ điện tính theo RCN tăng ${intKWhChg.toFixed(1)}%.`;
              } else if (kWhUp && !rcnUp) {
                narrative = `Điện tăng ${kWhPctChg.toFixed(1)}% nhưng RCN giảm ${Math.abs(rcnPctChg).toFixed(1)}% → hiệu suất điện giảm đáng kể.`;
              } else if (!kWhUp && rcnUp) {
                narrative = `Điện giảm ${Math.abs(kWhPctChg).toFixed(1)}% trong khi RCN tăng ${rcnPctChg.toFixed(1)}% → hiệu suất điện cải thiện tốt.`;
              } else {
                narrative = `Điện giảm ${Math.abs(kWhPctChg).toFixed(1)}%, RCN giảm ${Math.abs(rcnPctChg).toFixed(1)}% → tỷ lệ kWh/MT RCN ${intKWhChg > 0 ? 'tăng nhẹ' : 'ổn định'}.`;
              }

              return (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>

                  {/* ── Scope 1 Drivers ── */}
                  <div className="ov-compare-block" style={{ flex: 1 }}>
                    <div className="ov-table-title" style={{ color: '#E32314', marginBottom: 6 }}>
                      🔥 Scope 1 — Phân tích nguyên nhân
                      {hasPrev && (
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600,
                          color: s1PctChg > 0 ? '#E32314' : '#27AE60' }}>
                          {s1PctChg > 0 ? '▲' : '▼'} {Math.abs(s1PctChg).toFixed(1)}% vs {si.prevYear}
                        </span>
                      )}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                          <th style={{ textAlign: 'left', padding: '2px 4px', color: '#888', fontWeight: 600 }}>Nguồn</th>
                          <th style={{ textAlign: 'right', padding: '2px 4px', color: '#888', fontWeight: 600 }}>{si.prevYear}</th>
                          <th style={{ textAlign: 'right', padding: '2px 4px', color: '#E32314', fontWeight: 700 }}>{selectedYear}</th>
                          <th style={{ textAlign: 'right', padding: '2px 4px', color: '#aaa', fontWeight: 600, fontSize: 9 }}>Δ tCO₂e</th>
                          <th style={{ textAlign: 'right', padding: '2px 4px', color: '#aaa', fontWeight: 600, fontSize: 9 }}>Δ%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {si.s1Drivers.filter(d => d.cur > 0 || d.prev > 0).map((d, di) => {
                          const def = SCOPE_1_CATEGORIES.find(c => c.key === d.key);
                          const isTop = di === 0 && Math.abs(d.delta) > 0;
                          const maxVal = Math.max(d.cur, d.prev, 1);
                          return (
                            <tr key={d.key} style={{ borderBottom: '1px solid #f5f5f5',
                              background: isTop ? '#fff5f5' : undefined }}>
                              <td style={{ padding: '3px 4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span>{def?.icon || '📊'}</span>
                                  <span style={{ color: '#444' }}>{def?.label?.replace(/ \(.*\)/, '') || d.key}</span>
                                  {isTop && hasPrev && (
                                    <span style={{ fontSize: 8, background: '#E32314', color: '#fff',
                                      padding: '1px 4px', borderRadius: 3, fontWeight: 700, marginLeft: 2 }}>TOP</span>
                                  )}
                                </div>
                                {(d.actCur > 0 || d.actPrev > 0) && (
                                  <div style={{ fontSize: 8, color: '#bbb', marginTop: 1, paddingLeft: 14 }}>
                                    {d.actPrev > 0 ? `${d.actPrev >= 1000 ? (d.actPrev/1000).toFixed(1)+'k' : d.actPrev.toFixed(0)} ${def?.unit || ''}` : '—'}
                                    {' → '}
                                    {d.actCur > 0 ? `${d.actCur >= 1000 ? (d.actCur/1000).toFixed(1)+'k' : d.actCur.toFixed(0)} ${def?.unit || ''}` : '—'}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', padding: '3px 4px', color: '#999', fontWeight: 600 }}>
                                {d.prev > 0 ? fmt(d.prev) : '—'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 700, color: '#333' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                  <span>{d.cur > 0 ? fmt(d.cur) : '—'}</span>
                                  {d.cur > 0 && <div style={{ width: `${(d.cur / maxVal) * 40}px`, height: 2, background: '#E32314', opacity: 0.5, borderRadius: 1 }} />}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', padding: '3px 4px', fontWeight: 700, fontSize: 9,
                                color: d.delta > 0 ? '#E32314' : d.delta < 0 ? '#27AE60' : '#aaa' }}>
                                {d.delta !== 0 ? (d.delta > 0 ? '+' : '') + fmt(d.delta) : '='}
                              </td>
                              <td style={{ textAlign: 'right', padding: '3px 4px', fontSize: 9,
                                color: d.delta > 0 ? '#E32314' : d.delta < 0 ? '#27AE60' : '#aaa' }}>
                                {hasPrev && d.prev > 0 ? (d.delta > 0 ? '+' : '') + pct(d.cur, d.prev).toFixed(1) + '%' : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total */}
                        <tr style={{ borderTop: '2px solid #eee', background: '#fafafa' }}>
                          <td style={{ padding: '4px', fontWeight: 700, fontSize: 11 }}>🔥 S1 Total</td>
                          <td style={{ textAlign: 'right', padding: '4px', color: '#999', fontWeight: 700 }}>
                            {si.s1TotalPrev > 0 ? fmt(si.s1TotalPrev) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '4px', fontWeight: 800, color: '#E32314', fontSize: 11 }}>
                            {fmt(si.s1TotalCur)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '4px', fontWeight: 700, fontSize: 9,
                            color: si.s1TotalCur > si.s1TotalPrev ? '#E32314' : '#27AE60' }}>
                            {hasPrev ? (si.s1TotalCur > si.s1TotalPrev ? '+' : '') + fmt(si.s1TotalCur - si.s1TotalPrev) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '4px', fontSize: 9,
                            color: s1PctChg > 0 ? '#E32314' : '#27AE60' }}>
                            {hasPrev && si.s1TotalPrev > 0 ? (s1PctChg > 0 ? '+' : '') + s1PctChg.toFixed(1) + '%' : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ── Scope 2 vs RCN ── */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="ov-compare-block">
                      <div className="ov-table-title" style={{ color: '#F5A623', marginBottom: 6 }}>
                        ⚡ Scope 2 — Điện vs RCN
                        {hasPrev && (
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600,
                            color: s2PctChg > 0 ? '#E32314' : '#27AE60' }}>
                            {s2PctChg > 0 ? '▲' : '▼'} {Math.abs(s2PctChg).toFixed(1)}% vs {si.prevYear}
                          </span>
                        )}
                      </div>

                      {/* kWh & tCO2e row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                        <div style={{ background: '#fffbf0', border: '1px solid #ffe5a0', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 9, color: '#F5A623', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>⚡ Tiêu thụ điện</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#333' }}>
                            {si.kWhCur >= 1000000 ? (si.kWhCur/1000000).toFixed(2)+' GWh' : (si.kWhCur/1000).toFixed(0)+' MWh'}
                          </div>
                          {hasPrev && si.kWhPrev > 0 && (
                            <div style={{ fontSize: 9, marginTop: 2, color: kWhPctChg > 0 ? '#E32314' : '#27AE60', fontWeight: 700 }}>
                              {kWhPctChg > 0 ? '▲' : '▼'} {Math.abs(kWhPctChg).toFixed(1)}% vs năm trước
                            </div>
                          )}
                        </div>
                        <div style={{ background: '#fff5f5', border: '1px solid #fce0e0', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ fontSize: 9, color: '#E32314', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>🌡 Phát thải S2</div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#333' }}>
                            {fmt(si.s2EmCur)} <span style={{ fontSize: 10, fontWeight: 400, color: '#aaa' }}>tCO₂e</span>
                          </div>
                          {hasPrev && si.s2EmPrev > 0 && (
                            <div style={{ fontSize: 9, marginTop: 2, color: s2PctChg > 0 ? '#E32314' : '#27AE60', fontWeight: 700 }}>
                              {s2PctChg > 0 ? '▲' : '▼'} {Math.abs(s2PctChg).toFixed(1)}% vs năm trước
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RCN row */}
                      <div style={{ background: '#f5fbff', border: '1px solid #c0dff5', borderRadius: 6, padding: '6px 8px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>🥜 Sản lượng RCN (MT)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#333' }}>
                              {si.rcnCur > 0 ? fmt(si.rcnCur) : 'N/A'}
                            </div>
                            <div style={{ fontSize: 9, color: '#888' }}>{selectedYear}</div>
                          </div>
                          {hasPrev && si.rcnPrev > 0 && (
                            <>
                              <div style={{ color: '#ccc', fontSize: 12 }}>→</div>
                              <div>
                                <div style={{ fontSize: 11, color: '#aaa' }}>{fmt(si.rcnPrev)}</div>
                                <div style={{ fontSize: 9, color: '#bbb' }}>{si.prevYear}</div>
                              </div>
                              <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                                color: rcnPctChg > 0 ? '#27AE60' : '#E32314' }}>
                                {rcnPctChg > 0 ? '▲' : '▼'} {Math.abs(rcnPctChg).toFixed(1)}%
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Intensity metrics */}
                      {si.rcnCur > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                          <div style={{ background: '#fafafa', borderRadius: 6, padding: '6px 8px', border: '1px solid #eee' }}>
                            <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>⚡ kWh / MT RCN</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#333' }}>
                              {si.intkWhCur.toFixed(0)}
                            </div>
                            {hasPrev && si.intkWhPrev > 0 && (
                              <div style={{ fontSize: 9, marginTop: 1, color: intKWhChg > 2 ? '#E32314' : intKWhChg < -2 ? '#27AE60' : '#888', fontWeight: 700 }}>
                                {intKWhChg > 0 ? '▲' : '▼'} {Math.abs(intKWhChg).toFixed(1)}% vs năm trước
                              </div>
                            )}
                          </div>
                          <div style={{ background: '#fafafa', borderRadius: 6, padding: '6px 8px', border: '1px solid #eee' }}>
                            <div style={{ fontSize: 9, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>🌡 tCO₂e / MT RCN</div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#333' }}>
                              {si.intTotCur.toFixed(3)}
                            </div>
                            {hasPrev && si.intTotPrev > 0 && (
                              <div style={{ fontSize: 9, marginTop: 1,
                                color: pct(si.intTotCur, si.intTotPrev) > 2 ? '#E32314' : pct(si.intTotCur, si.intTotPrev) < -2 ? '#27AE60' : '#888',
                                fontWeight: 700 }}>
                                {pct(si.intTotCur, si.intTotPrev) > 0 ? '▲' : '▼'} {Math.abs(pct(si.intTotCur, si.intTotPrev)).toFixed(1)}% vs năm trước
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Narrative */}
                    <div style={{ background: 'linear-gradient(135deg, #F5A62308, #6366F108)',
                      border: '1px solid #F5A62333', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#F5A623', marginBottom: 4, textTransform: 'uppercase' }}>
                        💡 Phân tích cho Ban Giám Đốc
                      </div>
                      <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>{narrative}</div>
                      {si.rcnCur > 0 && hasPrev && si.s1TotalPrev > 0 && (() => {
                        const topDriver = si.s1Drivers[0];
                        const def = topDriver ? SCOPE_1_CATEGORIES.find(c => c.key === topDriver.key) : null;
                        if (!topDriver || Math.abs(topDriver.delta) < 1) return null;
                        return (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#444', lineHeight: 1.6, borderTop: '1px dashed #ddd', paddingTop: 6 }}>
                            <strong>Scope 1:</strong> Nguồn phát thải tăng nhiều nhất là{' '}
                            <strong style={{ color: '#E32314' }}>{def?.icon} {def?.label?.replace(/ \(.*\)/, '') || topDriver.key}</strong>
                            {' '}({topDriver.delta > 0 ? '+' : ''}{fmt(topDriver.delta)} tCO₂e, {topDriver.delta > 0 ? '▲' : '▼'}{Math.abs(pct(topDriver.cur, topDriver.prev)).toFixed(1)}%).
                            {topDriver.actCur > 0 && topDriver.actPrev > 0 && (
                              <span> Lượng tiêu thụ {topDriver.actPrev.toFixed(0)} → {topDriver.actCur.toFixed(0)} {def?.unit || ''}.</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── COMPARE MODE: Scope 1 Breakdown + RCN Intensity ── */}
            {viewMode === 'COMPARE' && displayBlocks.length === 2 && (() => {
              const [blkA, blkB] = displayBlocks;
              const colorA = FAC_COLORS[factories.findIndex(f => f.id === blkA.factory.id)] || FAC_COLORS[0];
              const colorB = FAC_COLORS[factories.findIndex(f => f.id === blkB.factory.id)] || FAC_COLORS[1];

              // Collect all S1 categories from both
              const allCatKeys = Array.from(new Set([
                ...blkA.s1ByCat.map(c => c.key),
                ...blkB.s1ByCat.map(c => c.key),
              ]));
              const getVal = (blk: typeof blkA, key: string) => blk.s1ByCat.find(c => c.key === key)?.value || 0;
              const getAct = (blk: typeof blkA, key: string) => blk.s1ByCat.find(c => c.key === key)?.activity || 0;
              const maxS1Cat = Math.max(...allCatKeys.map(k => Math.max(getVal(blkA, k), getVal(blkB, k))), 1);

              // RCN + intensity per factory
              const rcnA = prodData.filter(p => p.year === selectedYear && p.factory_id === blkA.factory.id && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
              const rcnB = prodData.filter(p => p.year === selectedYear && p.factory_id === blkB.factory.id && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
              const intA = rcnA > 0 ? blkA.total / rcnA : 0;
              const intB = rcnB > 0 ? blkB.total / rcnB : 0;
              const intS1A = rcnA > 0 ? blkA.s1 / rcnA : 0;
              const intS1B = rcnB > 0 ? blkB.s1 / rcnB : 0;
              const maxInt = Math.max(intA, intB, 0.001);
              const maxIntS1 = Math.max(intS1A, intS1B, 0.001);

              return (
                <>
                  {/* Scope 1 Breakdown Side-by-Side */}
                  <div className="ov-compare-block">
                    <div className="ov-table-title" style={{color:'#E32314'}}>🔥 Scope 1 Breakdown — So sánh</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                      <thead>
                        <tr style={{borderBottom:'1px solid #eee'}}>
                          <th style={{textAlign:'left',padding:'3px 4px',color:'#888',fontWeight:600}}>Nguồn</th>
                          <th style={{textAlign:'right',padding:'3px 4px',color:colorA,fontWeight:700}}>{blkA.factory.name}</th>
                          <th style={{textAlign:'right',padding:'3px 4px',color:colorB,fontWeight:700}}>{blkB.factory.name}</th>
                          <th style={{textAlign:'right',padding:'3px 4px',color:'#aaa',fontWeight:600,fontSize:'9px'}}>Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCatKeys.map((key, ci) => {
                          const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                          const vA = getVal(blkA, key), vB = getVal(blkB, key);
                          const aA = getAct(blkA, key), aB = getAct(blkB, key);
                          const barA = maxS1Cat > 0 ? (vA / maxS1Cat * 100) : 0;
                          const barB = maxS1Cat > 0 ? (vB / maxS1Cat * 100) : 0;
                          const delta = vA - vB;
                          if (vA === 0 && vB === 0) return null;
                          return (
                            <tr key={key} style={{borderBottom:'1px solid #f5f5f5'}}>
                              <td style={{padding:'3px 4px'}}>
                                <span style={{marginRight:3}}>{def?.icon || '📊'}</span>
                                <span style={{color:'#555'}}>{def?.label?.replace(/ \(.*\)/,'') || key}</span>
                                {/* Activity data hint */}
                                {(aA > 0 || aB > 0) && (
                                  <div style={{fontSize:'8px',color:'#bbb',marginTop:'1px'}}>
                                    {aA > 0 ? `A: ${aA >= 1000 ? (aA/1000).toFixed(1)+'k' : aA.toFixed(0)} ${def?.unit || ''}` : '—'}
                                    {' vs '}
                                    {aB > 0 ? `B: ${aB >= 1000 ? (aB/1000).toFixed(1)+'k' : aB.toFixed(0)} ${def?.unit || ''}` : '—'}
                                  </div>
                                )}
                              </td>
                              <td style={{textAlign:'right',padding:'3px 4px'}}>
                                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                                  <span style={{fontWeight:700,color:colorA}}>{vA > 0 ? fmt(vA) : '—'}</span>
                                  {vA > 0 && <div style={{width:`${barA}%`,minWidth:barA>0?2:0,height:3,background:colorA,opacity:0.6,borderRadius:2,maxWidth:50}} />}
                                </div>
                              </td>
                              <td style={{textAlign:'right',padding:'3px 4px'}}>
                                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
                                  <span style={{fontWeight:700,color:colorB}}>{vB > 0 ? fmt(vB) : '—'}</span>
                                  {vB > 0 && <div style={{width:`${barB}%`,minWidth:barB>0?2:0,height:3,background:colorB,opacity:0.6,borderRadius:2,maxWidth:50}} />}
                                </div>
                              </td>
                              <td style={{textAlign:'right',padding:'3px 4px',fontWeight:600,fontSize:'9px',color:delta > 0 ? '#E32314' : delta < 0 ? '#27AE60' : '#aaa'}}>
                                {delta !== 0 ? (delta > 0 ? '+' : '') + fmt(delta) : '='}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total row */}
                        <tr style={{borderTop:'2px solid #eee',background:'#fafafa'}}>
                          <td style={{padding:'4px',fontWeight:700,fontSize:'11px'}}>🔥 S1 Total</td>
                          <td style={{textAlign:'right',padding:'4px',fontWeight:800,color:colorA,fontSize:'11px'}}>{fmt(blkA.s1)}</td>
                          <td style={{textAlign:'right',padding:'4px',fontWeight:800,color:colorB,fontSize:'11px'}}>{fmt(blkB.s1)}</td>
                          <td style={{textAlign:'right',padding:'4px',fontWeight:700,fontSize:'9px',color:blkA.s1-blkB.s1>0?'#E32314':'#27AE60'}}>
                            {blkA.s1 !== blkB.s1 ? (blkA.s1 > blkB.s1 ? '+' : '') + fmt(blkA.s1 - blkB.s1) : '='}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* RCN Intensity Comparison */}
                  <div className="ov-compare-block" style={{marginTop:6}}>
                    <div className="ov-table-title" style={{color:'#6366F1'}}>🥜 Intensity — tCO₂e / MT RCN</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                      {/* Scope 1+2 Total Intensity */}
                      <div style={{background:'#f9f9f9',borderRadius:6,padding:'6px 8px'}}>
                        <div style={{fontSize:'9px',color:'#888',fontWeight:600,marginBottom:4,textTransform:'uppercase'}}>Tổng S1+S2 / MT RCN</div>
                        <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'9px',color:colorA,fontWeight:700,marginBottom:2}}>{blkA.factory.name}</div>
                            <div style={{height:12,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                              <div style={{width:`${maxInt>0?(intA/maxInt*100):0}%`,height:'100%',background:colorA,opacity:0.8,transition:'width 0.4s'}} />
                            </div>
                            <div style={{fontSize:'11px',fontWeight:800,color:colorA,marginTop:2}}>{rcnA > 0 ? intA.toFixed(3) : 'N/A'}</div>
                            <div style={{fontSize:'8px',color:'#bbb'}}>RCN: {fmt(rcnA)} MT</div>
                          </div>
                          <div style={{fontSize:'13px',color:'#ccc',fontWeight:700,paddingBottom:14}}>vs</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'9px',color:colorB,fontWeight:700,marginBottom:2}}>{blkB.factory.name}</div>
                            <div style={{height:12,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                              <div style={{width:`${maxInt>0?(intB/maxInt*100):0}%`,height:'100%',background:colorB,opacity:0.8,transition:'width 0.4s'}} />
                            </div>
                            <div style={{fontSize:'11px',fontWeight:800,color:colorB,marginTop:2}}>{rcnB > 0 ? intB.toFixed(3) : 'N/A'}</div>
                            <div style={{fontSize:'8px',color:'#bbb'}}>RCN: {fmt(rcnB)} MT</div>
                          </div>
                        </div>
                        {rcnA > 0 && rcnB > 0 && (
                          <div style={{marginTop:4,fontSize:'9px',borderTop:'1px dashed #ddd',paddingTop:4,color: intA < intB ? '#27AE60' : '#E32314', fontWeight:700}}>
                            {blkA.factory.name} {intA < intB ? '✓ hiệu quả hơn' : '✗ phát thải cao hơn'} {Math.abs(((intA - intB) / intB) * 100).toFixed(1)}% vs {blkB.factory.name}
                          </div>
                        )}
                      </div>

                      {/* Scope 1 only intensity */}
                      <div style={{background:'#fff5f5',borderRadius:6,padding:'6px 8px',border:'1px solid #fce0e0'}}>
                        <div style={{fontSize:'9px',color:'#E32314',fontWeight:600,marginBottom:4,textTransform:'uppercase'}}>🔥 Scope 1 Only / MT RCN</div>
                        <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
                          <div style={{flex:1}}>
                            <div style={{height:8,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                              <div style={{width:`${maxIntS1>0?(intS1A/maxIntS1*100):0}%`,height:'100%',background:'#E32314',opacity:0.7,transition:'width 0.4s'}} />
                            </div>
                            <div style={{fontSize:'11px',fontWeight:800,color:'#E32314',marginTop:2}}>{rcnA > 0 ? intS1A.toFixed(3) : 'N/A'}</div>
                            <div style={{fontSize:'8px',color:colorA,fontWeight:700}}>{blkA.factory.name}</div>
                          </div>
                          <div style={{fontSize:'11px',color:'#ccc',fontWeight:700,paddingBottom:18}}>vs</div>
                          <div style={{flex:1}}>
                            <div style={{height:8,background:'#eee',borderRadius:3,overflow:'hidden'}}>
                              <div style={{width:`${maxIntS1>0?(intS1B/maxIntS1*100):0}%`,height:'100%',background:'#E32314',opacity:0.5,transition:'width 0.4s'}} />
                            </div>
                            <div style={{fontSize:'11px',fontWeight:800,color:'#E32314',marginTop:2}}>{rcnB > 0 ? intS1B.toFixed(3) : 'N/A'}</div>
                            <div style={{fontSize:'8px',color:colorB,fontWeight:700}}>{blkB.factory.name}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="ov-footer">
          <span>© {selectedYear} Intersnack Group — GHG Tracker</span>
          <span>SBTi Near-term · Base 2021: {fmt(data.baseS1S2)} tCO₂e · Target 2032: {fmt(data.targetS1S2)} tCO₂e (-50%)</span>
          <span>EF: {useCommonEF ? `${COMMON_EF}` : 'Country'} kg CO₂e/kWh</span>
        </div>
      </div>
    </div>
  );
}
