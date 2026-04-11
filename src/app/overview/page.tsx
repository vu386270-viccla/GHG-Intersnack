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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', flexShrink: 0, minWidth: size, minHeight: size }}>
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
  const [slideScale, setSlideScale] = useState(1);

  // Measure window size to scale 1536x864 native slide layout
  useEffect(() => {
    const calcScale = () => {
      const baseW = 1536;
      const baseH = 864;
      const controlsH = 58; // controls bar + gaps
      const maxW = window.innerWidth * 0.98;
      const maxH = (window.innerHeight - controlsH) * 0.97;
      const sW = maxW / baseW;
      const sH = maxH / baseH;
      setSlideScale(Math.min(sW, sH));
    };
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, []);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useCommonEF, setUseCommonEF] = useState(false);
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
  const calcS3 = (rows: RawRow[]) => rows.filter(e => e.scope === 'scope_3').reduce((s, e) => s + Number(e.emissions_tco2e), 0);

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
    const s3 = calcS3(fRows);
    return { factory: fac, s1, s2, s3, total: s1 + s2 + s3, kWh, s1ByCat, monthly };
  };

  /* ── Multi-year SBTi roadmap data ── (filters by selected factories) */
  const roadmapData = useMemo(() => {
    const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
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

    // Re-calc base with S3
    const baseTotalSelFull = calcS1(baseRowsSel) + calcS2(baseRowsSel, 2021) + calcS3(baseRowsSel);

    return years.map(yr => {
      const yrRows = allEmissions.filter(e => e.year === yr && selIds.includes(e.factory_id));
      const s1Total = calcS1(yrRows);
      const s2Total = calcS2(yrRows, yr);
      const s3Total = calcS3(yrRows);
      const actual = s1Total + s2Total + s3Total;
      // Linear SBTi target: from base → -50% by 2032 vs baseline 2021
      const target = baseTotalSelFull * (1 - 0.50 * ((yr - 2021) / 11));
      const monthsActive = new Set(yrRows.map(e => e.month)).size;

      // Per-factory breakdown (only selected)
      const perFactory = factories
        .filter(f => selIds.includes(f.id))
        .map(f => {
          const fData = yrRows.filter(e => e.factory_id === f.id);
          const s1 = calcS1(fData);
          const s2 = calcS2(fData, yr, f);
          const s3 = calcS3(fData);
          return { factory: f, s1, s2, s3, total: s1 + s2 + s3 };
        });

      // RCN for this year (selected factories)
      const yrRCN = prodData
        .filter(p => p.year === yr && selIds.includes(p.factory_id) && p.category === 'rcn_input')
        .reduce((s, p) => s + Number(p.quantity), 0);

      return { year: yr, actual, s1: s1Total, s2: s2Total, s3: s3Total, target, baseTotal: baseTotalSelFull, monthsActive, perFactory, onTrack: actual <= target, rcn: yrRCN };
    });
  }, [allEmissions, factories, viewMode, factoryA, factoryB, useCommonEF, prodData]);

  /* ── SINGLE mode: YoY insight analysis (intensity-based) ── */
  const singleInsight = useMemo(() => {
    if (viewMode !== 'SINGLE' || !factoryA) return null;
    const fac = factories.find(f => f.id === factoryA);
    if (!fac) return null;
    const prevYear = selectedYear - 1;
    const curRows  = allEmissions.filter(e => e.year === selectedYear && e.factory_id === factoryA);
    // Previous year: use ALL 12 months to get full-year benchmark
    const prevRows = allEmissions.filter(e => e.year === prevYear && e.factory_id === factoryA);

    // Months with current-year data (for avg/month calc)
    const activeMonths = Array.from(new Set(curRows.map(e => e.month)));
    const nMonthsCur   = activeMonths.length || 1;
    // Previous year distinct months (for avg/month)
    const prevMonths   = Array.from(new Set(prevRows.map(e => e.month)));
    const nMonthsPrev  = prevMonths.length || 1;

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

    const totalCur  = s1TotalCur  + s2EmCur;
    const totalPrev = s1TotalPrev + s2EmPrev;

    // Production — cur: YTD, prev: full year
    const rcnCur  = prodData.filter(p => p.year === selectedYear && p.factory_id === factoryA && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
    const rcnPrev = prodData.filter(p => p.year === prevYear    && p.factory_id === factoryA && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);

    // ── Metric 1: Intensity tCO₂e / MT RCN ──
    // YTD intensity vs full-year intensity of previous year (apples-to-apples on per-unit basis)
    const intTotCur   = rcnCur  > 0 ? totalCur   / rcnCur  : 0;
    const intTotPrev  = rcnPrev > 0 ? totalPrev  / rcnPrev : 0;   // full-year 2025 rate
    const intS1Cur    = rcnCur  > 0 ? s1TotalCur / rcnCur  : 0;
    const intS1Prev   = rcnPrev > 0 ? s1TotalPrev/ rcnPrev : 0;
    const intkWhCur   = rcnCur  > 0 ? kWhCur     / rcnCur  : 0;
    const intkWhPrev  = rcnPrev > 0 ? kWhPrev    / rcnPrev : 0;

    // ── Metric 2: Average tCO₂e per month (YTD avg vs full prev-year avg) ──
    const avgTotCur  = totalCur    / nMonthsCur;
    const avgTotPrev = totalPrev   / nMonthsPrev;   // full-year monthly avg (prev year)
    const avgS1Cur   = s1TotalCur  / nMonthsCur;
    const avgS1Prev  = s1TotalPrev / nMonthsPrev;
    const avgS2Cur   = s2EmCur     / nMonthsCur;
    const avgS2Prev  = s2EmPrev    / nMonthsPrev;

    // ── Latest month values (for vs-KPI comparison) ──
    const latestMonth = Math.max(...activeMonths, 0);
    const latestMonthRows = curRows.filter(e => e.month === latestMonth);
    const latestS1Em: Record<string, number> = {};
    const latestS1Act: Record<string, number> = {};
    latestMonthRows.filter(e => e.scope === 'scope_1').forEach(e => {
      latestS1Em[e.category]  = (latestS1Em[e.category]  || 0) + Number(e.emissions_tco2e);
      latestS1Act[e.category] = (latestS1Act[e.category] || 0) + Number(e.activity_data);
    });
    const latestS1Total = Object.values(latestS1Em).reduce((s, v) => s + v, 0);
    const latestKWh = latestMonthRows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    const latestS2Em = useCommonEF ? latestKWh * COMMON_EF / 1000 : latestKWh * efCur / 1000;
    const latestTotal = latestS1Total + latestS2Em;
    // RCN for the latest month
    const latestRCN = prodData.filter(p => p.year === selectedYear && p.factory_id === factoryA && p.month === latestMonth && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
    const latestIntTot = latestRCN > 0 ? latestTotal / latestRCN : 0;

    // Apply Top-down KPI Fixed by Management
    let topDownKpiTotal = 0;
    if (fac.name.includes('Long An')) topDownKpiTotal = 265;
    else if (fac.name.includes('Tây Ninh')) topDownKpiTotal = 304;
    else if (fac.name.includes('Phan Thiết')) topDownKpiTotal = 223;
    else if (fac.name.includes('Tuticorin')) topDownKpiTotal = 334;

    const kpiS1PerMonth = s1TotalPrev / nMonthsPrev;
    const kpiS2PerMonth = s2EmPrev / nMonthsPrev;
    // Fallback if not found in fixed list
    const kpiTotalPerMonth = topDownKpiTotal > 0 ? topDownKpiTotal : (kpiS1PerMonth + kpiS2PerMonth);

    // Average of previous months in the current year
    const prevMnthsCurYrRows = curRows.filter(e => e.month > 0 && e.month < latestMonth);
    const setPrevMnths = new Set(prevMnthsCurYrRows.map(e => e.month));
    const distPrevMnths = setPrevMnths.size;
    const s1PrevMnthsCurEm: Record<string, number> = {};
    prevMnthsCurYrRows.filter(e => e.scope === 'scope_1').forEach(e => {
      s1PrevMnthsCurEm[e.category] = (s1PrevMnthsCurEm[e.category] || 0) + Number(e.emissions_tco2e);
    });
    const s1TotalPrevMnthsCur = Object.values(s1PrevMnthsCurEm).reduce((s, v) => s + v, 0);
    const kWhPrevMnthsCur = prevMnthsCurYrRows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    const s2EmPrevMnthsCur = useCommonEF ? kWhPrevMnthsCur * COMMON_EF / 1000 : kWhPrevMnthsCur * efCur / 1000;
    const avgTotalPrevMnthsCur = distPrevMnths > 0 ? (s1TotalPrevMnthsCur + s2EmPrevMnthsCur) / distPrevMnths : null;

    // ── Scope 1 drivers: latest-month actual vs KPI (prev-year monthly avg) ──
    const allCatKeys = Array.from(new Set([...Object.keys(s1Cur.em), ...Object.keys(s1Prev.em)]));
    const s1Drivers = allCatKeys.map(key => {
      // Latest month value for this category
      const latestVal  = latestS1Em[key]  || 0;
      const latestAct  = latestS1Act[key] || 0;
      // KPI = prev-year monthly average for this category
      const kpiVal  = (s1Prev.em[key]  || 0) / nMonthsPrev;
      const kpiAct  = (s1Prev.act[key] || 0) / nMonthsPrev;
      // YTD avg (kept for reference)
      const ytdAvg  = (s1Cur.em[key]   || 0) / nMonthsCur;
      return { key, cur: latestVal, prev: kpiVal, delta: latestVal - kpiVal, actCur: latestAct, actPrev: kpiAct, ytdAvg };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : 0;

    return {
      prevYear, fac,
      s1TotalCur, s1TotalPrev, s1Drivers,
      kWhCur, kWhPrev, s2EmCur, s2EmPrev, efCur,
      rcnCur, rcnPrev,
      totalCur, totalPrev,
      nMonthsCur, nMonthsPrev,
      latestMonth,
      // Latest month actuals (for vs-KPI heading)
      latestS1Total, latestS2Em, latestTotal, latestRCN, latestIntTot,
      // Fixed Top-Down KPI
      kpiS1PerMonth, kpiS2PerMonth, kpiTotalPerMonth,
      // Intensity metrics (tCO₂e / MT RCN)
      intTotCur, intTotPrev, intS1Cur, intS1Prev, intkWhCur, intkWhPrev,
      // YTD monthly avg metrics — used for summary badges & chart header
      avgTotCur, avgTotPrev, avgS1Cur, avgS1Prev, avgS2Cur, avgS2Prev,
      avgTotalPrevMnthsCur,
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
    const targetS1S2 = baseS1S2 * 0.50; // −50% by 2032
    const currentPct = baseS1S2 > 0 ? ((baseS1S2 - allTotal) / baseS1S2 * 100) : 0;
    const expectedPct = ((selectedYear - 2021) / 11) * 50;
    const factoryBlocks = factories.map(f => buildFactoryBlock(f, emissions));
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
  const dispS3 = displayBlocks.reduce((s, b) => s + b.s3, 0);
  const maxMonthly = Math.max(...displayBlocks.flatMap(b => b.monthly.map(m => m.total)), 1);

  if (loading) return (
    <div className="overview-wrapper">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div className="loading-spinner" /><span style={{ color: '#999' }}>Loading…</span>
      </div>
    </div>
  );

  /* Roadmap SVG dimensions for the SBTi chart — 12 years (2021→2032) */
  const rmMaxVal = Math.max(...roadmapData.map(d => Math.max(d.actual, d.target, d.baseTotal)), 1) * 1.15;
  const rmW = 660, rmH = 165, rmPadL = 44, rmPadR = 12, rmPadT = 20, rmPadB = 30;
  const rmPlotW = rmW - rmPadL - rmPadR;
  const rmPlotH = rmH - rmPadT - rmPadB;
  // RCN secondary axis
  const rmMaxRCN = Math.max(...roadmapData.map(d => d.rcn), 1) * 1.2;
  const rmMaxInt = Math.max(...roadmapData.filter(d => d.rcn > 0).map(d => d.actual / d.rcn), 0) * 2.3 || 1;
  // Factory-specific 2032 target (SINGLE mode): 50% of 2021 base for that factory
  const singleFacTarget = viewMode === 'SINGLE' && roadmapData.length > 0
    ? (roadmapData[0].baseTotal > 0 ? roadmapData[0].baseTotal * 0.5 : null)
    : null;

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

      {/* Slide — wrapper sized to visual dimensions so overflow-x clipping doesn't cut the slide */}
      <div style={{ width: `${slideScale * 1536}px`, height: `${slideScale * 864}px`, flexShrink: 0, position: 'relative' }}>
      <div className="overview-slide" style={{ transform: `scale(${slideScale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
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
              <div className="ov-grand-label">TOTAL SCOPE 1+2+3 · {selectedYear} YTD</div>
              <div className="ov-grand-value">{fmt(dispTotal)}</div>
              <div className="ov-grand-unit">tCO₂e</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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
              <div className="ov-scope-card" style={{ background: 'rgba(140,185,45,0.04)', borderColor: 'rgba(140,185,45,0.15)' }}>
                <div className="ov-scope-header"><span className="ov-scope-icon">🌍</span> SCOPE 3</div>
                <div className="ov-scope-value" style={{ fontSize: 22 }}>{fmt(dispS3)}</div>
                <div className="ov-scope-sub">{dispTotal > 0 ? fmtPct(dispS3/dispTotal*100) : '0'}%</div>
              </div>
            </div>

            {/* Scope 1 + Scope 2 Donuts — side by side, no overlap */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {/* Scope 1 */}
              <div style={{ background: '#fff5f4', border: '1px solid #fce0e0', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: '#E32314', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>🔥 Scope 1</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <MiniDonut size={90} thickness={16} centerLabel={fmt(dispS1)} centerSub="tCO₂e"
                    segments={(() => {
                      const cats: Record<string, number> = {};
                      displayBlocks.forEach(b => b.s1ByCat.forEach(c => { cats[c.key] = (cats[c.key] || 0) + c.value; }));
                      return Object.entries(cats).sort(([,a],[,b]) => b - a).map(([key, val], i) => {
                        const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                        return { label: def?.label || key, value: val, color: S1_COLORS[i] };
                      });
                    })()} />
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(() => {
                      const cats: Record<string, { em: number }> = {};
                      displayBlocks.forEach(b => b.s1ByCat.forEach(c => {
                        if (!cats[c.key]) cats[c.key] = { em: 0 };
                        cats[c.key].em += c.value;
                      }));
                      const totalS1 = Object.values(cats).reduce((s, v) => s + v.em, 0);
                      return Object.entries(cats).sort(([,a],[,b]) => b.em - a.em).slice(0, 4).map(([key, v], i) => {
                        const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                        const pct = totalS1 > 0 ? (v.em / totalS1 * 100).toFixed(0) : '0';
                        return <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 2, background: S1_COLORS[i], flexShrink: 0, display: 'inline-block' }}/>
                          <span style={{ fontWeight: 700, color: S1_COLORS[i], minWidth: 20 }}>{pct}%</span>
                          <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def?.icon} {def?.label?.replace(/ \(.*\)/, '') || key}</span>
                        </div>;
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Scope 2 — 100% electricity */}
              <div style={{ background: '#fffbf0', border: '1px solid #ffe5a0', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>⚡ Scope 2</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <MiniDonut size={90} thickness={16} centerLabel={fmt(dispS2)} centerSub="tCO₂e"
                    segments={[{ label: 'Electricity', value: 1, color: '#F5A623' }]} />
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: '#F5A623', flexShrink: 0, display: 'inline-block' }}/>
                      <span style={{ fontWeight: 700, color: '#F5A623' }}>100%</span>
                      <span style={{ color: '#666' }}>⚡ Grid Electricity</span>
                    </div>
                    <div style={{ fontSize: 8, color: '#aaa', paddingLeft: 10 }}>
                      {(displayBlocks.reduce((s,b)=>s+b.kWh,0)/1000).toFixed(0)} MWh
                    </div>
                    <div style={{ fontSize: 8, color: '#aaa', paddingLeft: 10 }}>
                      EF: {useCommonEF ? COMMON_EF : 'Country'} kg/kWh
                    </div>
                  </div>
                </div>
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
            {/* ── SBTi ROADMAP — Single unified SVG: bars + intensity track ── */}
            <div className="ov-roadmap-full">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div className="ov-chart-title" style={{ margin: 0, flex: 1 }}>
                  🎯 SBTi Roadmap — Scope 1+2+3 · 2021 → 2032
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
                <div style={{ display: 'flex', gap: 10, fontSize: 8, color: '#aaa', alignItems: 'center', flexShrink: 0 }}>
                  {viewMode === 'ALL' && factories.map((f, i) => (
                    <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: FAC_COLORS[i % FAC_COLORS.length], display: 'inline-block' }} />
                      {f.name.split(' ')[0]}
                    </span>
                  ))}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ borderBottom: '2px dashed #8CB92D', width: 14, display: 'inline-block', verticalAlign: 'middle' }} />
                    SBTi −50%
                  </span>
                  {viewMode === 'SINGLE' && singleFacTarget !== null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ borderBottom: '1.5px dashed #E32314', width: 14, display: 'inline-block', verticalAlign: 'middle' }} />
                      Target
                    </span>
                  )}
                  <span>✓ OK · ✗ Over</span>
                </div>
              </div>

              {/* ── UNIFIED SVG: bars (top) + intensity track (bottom) ── */}
              {(() => {
                // Layout constants
                const W = 740;
                const PL = 52, PR = 14;
                const plotW = W - PL - PR;
                // Bar chart zone
                const BAR_T = 16, BAR_H = 130, BAR_B = 22;
                // Intensity zone (below bars)
                const INT_T = BAR_T + BAR_H + BAR_B + 8; // y-start of intensity strip
                const INT_H = 48; // height of intensity mini-chart
                const TOTAL_H = INT_T + INT_H + 12;
                const n = roadmapData.length;
                const maxVal = Math.max(...roadmapData.map(d => Math.max(d.actual, d.target, d.baseTotal)), 1) * 1.15;
                const actualWithRCN = roadmapData.filter(d => d.actual > 0 && d.rcn > 0);
                const maxInt = actualWithRCN.length > 0 ? Math.max(...actualWithRCN.map(d => d.actual / d.rcn)) * 1.2 : 1;
                const BAR_W = 28;

                // Shared x-position per year column
                const xOf = (i: number) => PL + (i / (n - 1)) * plotW;
                const xFuture = xOf(6);

                return (
                  <svg viewBox={`0 0 ${W} ${TOTAL_H}`} width="100%" height={TOTAL_H} style={{ overflow: 'visible', display: 'block' }}>
                    {/* ── BAR CHART ZONE ── */}
                    {/* Future zone bg */}
                    <rect x={xFuture} y={BAR_T} width={W - PR - xFuture} height={BAR_H} fill="#f5f5f0" rx={3} opacity={0.7} />
                    <text x={xFuture + (W - PR - xFuture) / 2} y={BAR_T + 10} textAnchor="middle" fontSize="8" fill="#ccc" fontWeight="600">PROJECTED</text>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p, gi) => (
                      <g key={gi}>
                        <line x1={PL} y1={BAR_T + BAR_H * (1 - p)} x2={W - PR} y2={BAR_T + BAR_H * (1 - p)}
                          stroke={p === 0 ? '#ccc' : '#efefef'} strokeWidth={p === 0 ? 1 : 0.7} />
                        <text x={PL - 5} y={BAR_T + BAR_H * (1 - p) + 3} textAnchor="end" fontSize="8" fill="#ccc" fontWeight="500">
                          {p > 0 ? fmt(maxVal * p) : ''}
                        </text>
                      </g>
                    ))}

                    {/* SBTi Pathway dashed line */}
                    {(() => {
                      const pts = roadmapData.map((d, i) => {
                        const x = xOf(i);
                        const y = BAR_T + BAR_H * (1 - d.target / maxVal);
                        return `${x},${y}`;
                      });
                      return <polyline points={pts.join(' ')} fill="none" stroke="#8CB92D" strokeWidth={2} strokeDasharray="6,3" opacity={0.9} />;
                    })()}

                    {/* 2032 target label */}
                    {(() => {
                      const last = roadmapData[roadmapData.length - 1];
                      const x = xOf(n - 1);
                      const y = BAR_T + BAR_H * (1 - last.target / maxVal);
                      return (
                        <g>
                          <circle cx={x} cy={y} r={4} fill="#8CB92D" opacity={0.9} />
                          <text x={x - 6} y={y - 6} textAnchor="end" fontSize="8" fill="#4A6E12" fontWeight="800">{fmt(last.target)}t −50%</text>
                        </g>
                      );
                    })()}

                    {/* Factory 2032 target line (SINGLE mode) */}
                    {singleFacTarget !== null && (() => {
                      const ty = BAR_T + BAR_H * (1 - singleFacTarget / maxVal);
                      return (
                        <g>
                          <line x1={PL} y1={ty} x2={W - PR} y2={ty} stroke="#E32314" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
                          <text x={PL + 4} y={ty - 3} fontSize="8.5" fill="#E32314" fontWeight="800">🎯 {Math.round(singleFacTarget)}t</text>
                        </g>
                      );
                    })()}

                    {/* Year bars */}
                    {roadmapData.map((d, i) => {
                      const x = xOf(i);
                      const bx = x - BAR_W / 2;
                      const isFuture = d.actual === 0 && d.year > new Date().getFullYear();
                      const isCurrent = d.year === selectedYear;
                      const onTrack = singleFacTarget !== null ? d.actual <= singleFacTarget : d.onTrack;
                      const targetY = BAR_T + BAR_H * (1 - d.target / maxVal);

                      return (
                        <g key={d.year}>
                          {/* Projected outline */}
                          {isFuture && (
                            <rect x={bx} y={targetY} width={BAR_W} height={Math.max(BAR_T + BAR_H - targetY, 1)}
                              rx={2} fill="none" stroke="#8CB92D" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.3} />
                          )}
                          {/* Actual stacked bars: S1 (bottom) + S2 (middle) + S3 (top) */}
                          {!isFuture && d.actual > 0 && (() => {
                            const S3_COLOR = '#8CB92D';
                            const stackLayers = [
                              { val: d.s1, colorSingle: '#E32314', colorTrack: 'S1' },
                              { val: d.s2, colorSingle: '#F5A623', colorTrack: 'S2' },
                              { val: d.s3, colorSingle: S3_COLOR,  colorTrack: 'S3' },
                            ];
                            let cumH = 0;
                            return stackLayers.map((layer, li) => {
                              if (layer.val <= 0) return null;
                              const h = maxVal > 0 ? (layer.val / maxVal) * BAR_H : 0;
                              const y = BAR_T + BAR_H - cumH - h;
                              cumH += h;
                              const fIdx = factories.findIndex(f => f.id === d.perFactory[0]?.factory.id);
                              const facCol = FAC_COLORS[(fIdx >= 0 ? fIdx : 0) % FAC_COLORS.length];
                              // In ALL/COMPARE mode use scope colors; in SINGLE mode w/ target use on-track
                              const col = viewMode === 'ALL' || viewMode === 'COMPARE'
                                ? (li === 0 ? '#E32314' : li === 1 ? '#F5A623' : S3_COLOR)
                                : (singleFacTarget !== null
                                    ? (d.actual > singleFacTarget ? '#E32314' : '#27AE60')
                                    : (li === 0 ? facCol : li === 1 ? '#F5A623' : S3_COLOR));
                              return (
                                <rect key={li} x={bx} y={y} width={BAR_W} height={Math.max(h, 0.5)}
                                  rx={li === stackLayers.length - 1 ? 2 : 0}
                                  fill={col} opacity={isCurrent ? 0.92 : 0.5}
                                  stroke={isCurrent ? 'rgba(0,0,0,0.15)' : 'none'} strokeWidth={0.5}
                                />
                              );
                            });
                          })()}
                          {/* Total label */}
                          {d.actual > 0 && (() => {
                            const totH = maxVal > 0 ? (d.actual / maxVal) * BAR_H : 0;
                            return (
                              <text x={x} y={BAR_T + BAR_H - totH - 3} textAnchor="middle"
                                fontSize={isCurrent ? 9 : 7.5} fontWeight={isCurrent ? 900 : 500}
                                fill={isCurrent ? '#E32314' : '#999'}>
                                {fmt(d.actual)}
                              </text>
                            );
                          })()}
                          {/* % vs baseline (current year only) */}
                          {isCurrent && d.actual > 0 && (() => {
                            const totH = maxVal > 0 ? (d.actual / maxVal) * BAR_H : 0;
                            const pct = d.baseTotal > 0 ? ((d.baseTotal - d.actual) / d.baseTotal * 100) : 0;
                            return (
                              <text x={x} y={BAR_T + BAR_H - totH - 14} textAnchor="middle"
                                fontSize="8" fontWeight="800"
                                fill={onTrack ? '#27AE60' : '#E32314'}>
                                {pct >= 0 ? '↓' : '↑'}{Math.abs(pct).toFixed(1)}%
                              </text>
                            );
                          })()}

                          {/* Year label */}
                          <text x={x} y={BAR_T + BAR_H + BAR_B - 10} textAnchor="middle"
                            fontSize={isCurrent ? 9.5 : 8.5}
                            fill={isCurrent ? '#E32314' : d.year === 2032 ? '#4A6E12' : isFuture ? '#ccc' : '#888'}
                            fontWeight={isCurrent || d.year === 2032 ? 800 : 400}>
                            {d.year}
                          </text>
                          {/* ✓/✗ */}
                          {d.actual > 0 && (
                            <text x={x} y={BAR_T + BAR_H + BAR_B - 1} textAnchor="middle"
                              fontSize="8" fontWeight="800"
                              fill={onTrack ? '#27AE60' : '#E32314'}>
                              {onTrack ? '✓' : '✗'}
                            </text>
                          )}

                          {/* ── INTENSITY TRACK (bottom zone) ── */}
                          {(() => {
                            const hasData = d.actual > 0 && d.rcn > 0;
                            const intensity = hasData ? d.actual / d.rcn : null;
                            const intBarH = intensity !== null ? Math.max((intensity / maxInt) * (INT_H - 20), 2) : 0;
                            const intBarTop = INT_T + (INT_H - 20) - intBarH;
                            return (
                              <g>
                                {/* Strip bg highlight for current */}
                                {isCurrent && (
                                  <rect x={bx - 3} y={INT_T} width={BAR_W + 6} height={INT_H + 4} rx={3}
                                    fill="#4338ca" opacity={0.06} />
                                )}
                                {/* Mini bar */}
                                {intensity !== null && (
                                  <rect x={x - 8} y={intBarTop} width={16} height={intBarH} rx={2}
                                    fill={isCurrent ? '#4f46e5' : '#a5b4fc'} opacity={isCurrent ? 0.9 : 0.6} />
                                )}
                                {/* Intensity number */}
                                <text x={x} y={INT_T + INT_H - 8} textAnchor="middle"
                                  fontSize={isCurrent ? 8.5 : 7.5} fontWeight={isCurrent ? 800 : 500}
                                  fill={intensity !== null ? (isCurrent ? '#3730a3' : '#818cf8') : '#ddd'}>
                                  {intensity !== null ? intensity.toFixed(2) : '—'}
                                </text>
                                {/* RCN volume */}
                                {d.rcn > 0 && (
                                  <text x={x} y={INT_T + INT_H + 3} textAnchor="middle"
                                    fontSize="6.5" fill={isCurrent ? '#6b7280' : '#ccc'} fontWeight={isCurrent ? 600 : 400}>
                                    {(d.rcn / 1000).toFixed(0)}k MT
                                  </text>
                                )}
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })}

                    {/* Intensity strip header */}
                    <text x={PL - 4} y={INT_T + 9} textAnchor="end" fontSize="7" fill="#818cf8" fontWeight="700">t/MT</text>
                    <line x1={PL} y1={INT_T - 3} x2={W - PR} y2={INT_T - 3} stroke="#e0e7ff" strokeWidth={1} />
                    <text x={PL - 4} y={INT_T + INT_H - 4} textAnchor="end" fontSize="6.5" fill="#c7d2fe">RCN</text>
                  </svg>
                );
              })()}

              {/* Legend row */}
              <div className="ov-roadmap-legend" style={{ marginTop: 4 }}>
                <span><span className="ov-legend-dot" style={{ background: '#E32314' }} />🔥 Scope 1</span>
                <span><span className="ov-legend-dot" style={{ background: '#F5A623' }} />⚡ Scope 2</span>
                <span><span className="ov-legend-dot" style={{ background: '#8CB92D' }} />🌍 Scope 3</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ borderBottom: '2px dashed #8CB92D', width: 14, display: 'inline-block', verticalAlign: 'middle' }} />
                  SBTi −50% by 2032
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  <span style={{ width: 10, height: 8, background: '#a5b4fc', borderRadius: 2, display: 'inline-block' }} />
                  tCO₂e/MT RCN
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>✓ On track · ✗ Over</span>
              </div>
            </div>

            {/* ── Monthly Emissions Split: Scope 1 & Scope 2 by Factory ── */}
            {viewMode !== 'SINGLE' && (() => {
              // Per-scope max values
              const maxS1 = Math.max(...displayBlocks.flatMap(b => b.monthly.map(m => m.s1)), 1);
              const maxS2 = Math.max(...displayBlocks.flatMap(b => b.monthly.map(m => m.s2)), 1);



              const renderScopeChart = (
                scopeKey: 's1' | 's2',
                maxVal: number,
                title: string,
                scopeColor: string,
                bgColor: string,
              ) => {
                const bW = 36, gap = (525 - 12 * bW) / 13;
                return (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div className="ov-chart-title" style={{ color: scopeColor, marginTop: 6 }}>{title}</div>
                    <div className="ov-chart" style={{ background: bgColor, borderRadius: 6, paddingTop: 4, flex: 1 }}>
                      <svg viewBox="0 0 560 130" width="100%" height="130">
                        {[0, 0.5, 1].map((pct, gi) => (
                          <g key={`g${gi}`}>
                            <line x1={30} y1={105 - pct * 80} x2={555} y2={105 - pct * 80} stroke="#f0f0f0" strokeWidth={0.5} />
                            <text x={28} y={108 - pct * 80} textAnchor="end" fontSize="8" fill="#ccc">{Math.round(maxVal * pct)}</text>
                          </g>
                        ))}
                        {Array.from({ length: 12 }, (_, mi) => {
                          const x0 = 32 + gap + mi * (bW + gap);
                          const barW = displayBlocks.length > 1 ? bW / displayBlocks.length - 1 : bW - 4;
                          return (
                            <g key={mi}>
                              {displayBlocks.map((fb, fi) => {
                                const val = fb.monthly[mi][scopeKey];
                                const h = maxVal > 0 ? (val / maxVal) * 80 : 0;
                                const bx = x0 + fi * (barW + 1);
                                const fIdx = factories.findIndex(f => f.id === fb.factory.id);
                                const colorIdx = fIdx >= 0 ? fIdx : fi;
                                const color = scopeKey === 's1' ? FAC_COLORS[colorIdx % FAC_COLORS.length] : FAC_COLORS_LIGHT[colorIdx % FAC_COLORS_LIGHT.length];
                                const centerX = bx + barW / 2;
                                return (
                                  <g key={fi}>
                                    <rect x={bx} y={105 - h} width={barW} height={Math.max(h, 0.5)} rx={1}
                                      fill={color} opacity={scopeKey === 's2' ? 0.8 : 0.9} />
                                    {/* Value label */}
                                    {val > 0 && (
                                      <text x={centerX} y={105 - h - 3} textAnchor="middle" fontSize="7.5"
                                        fontWeight="800" fill={color}>
                                        {Math.round(val)}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                              <text x={x0 + bW / 2} y={118} textAnchor="middle" fontSize="8.5" fill="#999" fontWeight="500">{MONTHS_VI[mi]}</text>
                            </g>
                          );
                        })}
                      </svg>

                    </div>
                  </div>
                );
              };

              return (
                <div style={{ display: 'flex', gap: '12px' }}>
                  {renderScopeChart('s1', maxS1, `🔥 Scope 1 — Phát thải trực tiếp ${selectedYear} (tCO₂e)`, '#E32314', '#fff8f8')}
                  {renderScopeChart('s2', maxS2, `⚡ Scope 2 — Điện lưới ${selectedYear} (tCO₂e)`, '#F5A623', '#fffcf0')}
                </div>
              );
            })()}



            {/* Factory table (when ALL or COMPARE) */}
            {displayBlocks.length > 1 && (() => {
              // Pre-compute RCN per factory for the table
              const tableRCN = displayBlocks.map(fb => ({
                id: fb.factory.id,
                rcn: prodData.filter(p => p.year === selectedYear && p.factory_id === fb.factory.id && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0),
              }));
              return (
              <div className="ov-factory-table compact">
                <div className="ov-table-title">Factory — {selectedYear} YTD</div>
                <table>
                  <thead><tr><th>Plant</th><th style={{textAlign:'right'}}>S1</th><th style={{textAlign:'right'}}>S2</th><th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>MWh</th><th style={{textAlign:'right',color:'#6366F1'}}>RCN (MT)</th><th style={{textAlign:'right',color:'#6366F1'}}>CO₂e/RCN</th><th style={{width:'60px'}}>Share</th></tr></thead>
                  <tbody>
                    {displayBlocks.map((fb, i) => {
                      const rcnMT = tableRCN.find(r => r.id === fb.factory.id)?.rcn ?? 0;
                      const intensity = rcnMT > 0 ? (fb.total / rcnMT) : null;
                      return (
                      <tr key={fb.factory.id}>
                        <td><span style={{color:FAC_COLORS[factories.findIndex(f=>f.id===fb.factory.id) % FAC_COLORS.length],fontWeight:700,marginRight:3}}>●</span>{fb.factory.country==='India'?'🇮🇳':'🇻🇳'} {fb.factory.name}</td>
                        <td style={{textAlign:'right',fontWeight:600}}>{fmt(fb.s1)}</td>
                        <td style={{textAlign:'right',fontWeight:600}}>{fmt(fb.s2)}</td>
                        <td style={{textAlign:'right',fontWeight:700}}>{fmt(fb.total)}</td>
                        <td style={{textAlign:'right',color:'#888'}}>{(fb.kWh/1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</td>
                        <td style={{textAlign:'right',color:'#6366F1',fontWeight:700}}>{rcnMT > 0 ? fmt(rcnMT) : '—'}</td>
                        <td style={{textAlign:'right',color:'#6366F1',fontWeight:700}}>{intensity !== null ? intensity.toFixed(3) : '—'}</td>
                        <td><div className="ov-share-bar"><div style={{width:`${dispTotal>0?(fb.total/dispTotal*100):0}%`,background:FAC_COLORS[factories.findIndex(f=>f.id===fb.factory.id) % FAC_COLORS.length]}}/></div></td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              );
            })()}

            {/* ── SINGLE MODE: Monthly Analysis + Scope Breakdown ── */}
            {viewMode === 'SINGLE' && singleInsight && (() => {
              const si = singleInsight;
              const { pct } = si;
              const facObj = factories.find(f => f.id === factoryA)!;

              // Build per-month rows
              const monthRows = Array.from({ length: 12 }, (_, mi) => {
                const mn = mi + 1;
                const cur = allEmissions.filter(e => e.year === selectedYear && e.factory_id === factoryA && e.month === mn);
                const s1 = calcS1(cur);
                const s2 = calcS2(cur, selectedYear, facObj);
                const rcn = prodData.filter(p => p.year === selectedYear && p.factory_id === factoryA && p.month === mn && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
                const total = s1 + s2;
                return { mn, s1, s2, total, rcn, int: rcn > 0 ? (total / rcn) : 0, hasData: total > 0 };
              });

              const latestMn = Math.max(...monthRows.filter(m => m.hasData).map(m => m.mn), 0);
              
              // Gauge Metrics
              const actGauge = si.latestTotal;
              const tgtGauge = si.kpiTotalPerMonth; // Prev year avg
              const prvGauge = si.avgTotalPrevMnthsCur; // Prev months avg
              const vsTgt = tgtGauge > 0 ? (actGauge - tgtGauge) / tgtGauge * 100 : 0;
              const vsPrv = prvGauge ? (actGauge - prvGauge) / prvGauge * 100 : 0;
              
              const dColor = (v: number) => v > 0 ? '#E32314' : v < 0 ? '#27AE60' : '#888';
              const dSign  = (v: number) => v > 0 ? '+' : '';
              const MN = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
              const maxMonthVal = Math.max(...monthRows.filter(m => m.hasData).map(m => m.total), tgtGauge * 1.5, 1);
              const maxIntVal = Math.max(...monthRows.filter(m => m.hasData).map(m => m.int), 0) * 1.5 || 1;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  
                  {/* TOP ROW: Monthly Chart & KPI Gauge */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    
                    {/* LEFT: Monthly Chart */}
                    <div className="ov-compare-block" style={{ flex: 1.5, marginBottom: 0, position: 'relative' }}>
                      <div className="ov-table-title">📅 Monthly Emissions & Intensity {selectedYear}</div>
                      <div style={{ position: 'absolute', top: 8, right: 10, fontSize: 8, display: 'flex', gap: 10, color: '#666' }}>
                          <span><span style={{color:'#27AE60'}}>■</span> Below KPI</span>
                          <span><span style={{color:'#E32314'}}>■</span> Over KPI</span>
                          <span><span style={{borderBottom:'1.5px dotted #6366F1', paddingBottom: 1, width: 10, display: 'inline-block'}}>&nbsp;</span> tCO₂e/MT RCN</span>
                      </div>
                      <svg viewBox="0 0 520 85" width="100%" height="85">
                        {[0, 0.5, 1].map((p, gi) => (
                          <g key={gi}>
                            <line x1={28} y1={12 + 58*(1-p)} x2={516} y2={12 + 58*(1-p)} stroke="#f0f0f0" strokeWidth={0.6}/>
                            <text x={26} y={12 + 58*(1-p) + 2} textAnchor="end" fontSize="7" fill="#ccc">{Math.round(maxMonthVal*p)}</text>
                            <text x={518} y={12 + 58*(1-p) + 2} textAnchor="start" fontSize="7" fill="#a5b4fc">{(maxIntVal*p).toFixed(2)}</text>
                          </g>
                        ))}
                        {/* Target Line */}
                        {tgtGauge > 0 && (() => {
                            const ty = 12 + 58 * (1 - tgtGauge / maxMonthVal);
                            return (
                                <g>
                                    <line x1={28} y1={ty} x2={516} y2={ty} stroke="#E32314" strokeWidth="1" strokeDasharray="3,2" opacity={0.6}/>
                                    <rect x={495} y={ty-9} width={18} height={9} fill="#E32314" rx={1} opacity={0.15}/>
                                    <text x={504} y={ty-2} fontSize="7" fill="#E32314" fontWeight="800" textAnchor="middle">KPI</text>
                                </g>
                            );
                        })()}
                        {/* Bars */}
                        {monthRows.map((m, idx) => {
                          const bW = 28, gap = (486 - 12*bW) / 13;
                          const bx = 30 + gap + idx * (bW + gap);
                          const isLatest = m.mn === latestMn;
                          if (!m.hasData) return <text key={`lbl-${idx}`} x={bx+bW/2} y={82} textAnchor="middle" fontSize="7.5" fill="#ccc">{MN[idx]}</text>;
                          const totH = maxMonthVal > 0 ? (m.total / maxMonthVal) * 58 : 0;
                          const s1H = maxMonthVal > 0 ? (m.s1 / maxMonthVal) * 58 : 0;
                          const s2H = totH - s1H;
                          const isOver = m.total > tgtGauge;
                          const fillS2 = isOver ? '#FF8A80' : '#A8D5BA';
                          const fillS1 = isOver ? '#E32314' : '#27AE60';
                          return (
                            <g key={`bar-${idx}`}>
                              <rect x={bx+2} y={70-totH+s1H} width={bW-4} height={Math.max(s2H, 0)} rx={1} fill={fillS2} opacity={0.85}/>
                              <rect x={bx+2} y={70-s1H} width={bW-4} height={Math.max(s1H, 0)} rx={s2H<0.5?1:0} fill={fillS1} opacity={0.9}/>
                              <text x={bx+bW/2} y={70-totH-3} textAnchor="middle" fontSize="7.5" fontWeight="800" fill={isOver ? '#E32314' : '#27AE60'}>{fmt(m.total)}</text>
                              <text x={bx+bW/2} y={82} textAnchor="middle" fontSize="8" fill={isLatest ? '#333' : '#999'} fontWeight={isLatest?800:500}>{MN[idx]}</text>
                            </g>
                          );
                        })}
                        {/* Intensity Line Overlay */}
                        {(() => {
                           const pts: string[] = [];
                           const dotPoints: {x: number, y: number, val: number}[] = [];
                           monthRows.forEach((m, idx) => {
                               if (m.hasData && m.int > 0) {
                                  const bW = 28, gap = (486 - 12*bW) / 13;
                                  const bx = 30 + gap + idx * (bW + gap) + bW/2;
                                  const cy = 12 + 58 * (1 - m.int / maxIntVal);
                                  pts.push(`${bx},${cy}`);
                                  dotPoints.push({x: bx, y: cy, val: m.int});
                               }
                           });
                           return (
                               <g>
                                   <polyline points={pts.join(' ')} fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="2,2"/>
                                   {dotPoints.map((d, i) => (
                                       <g key={`dot-${i}`}>
                                           <circle cx={d.x} cy={d.y} r="2.5" fill="#fff" stroke="#6366F1" strokeWidth="1.2"/>
                                           <rect x={d.x-10} y={d.y-12} width={20} height={8} fill="#e0e7ff" rx="2" opacity="0.8"/>
                                           <text x={d.x} y={d.y-6} textAnchor="middle" fontSize="6.5" fill="#4338ca" fontWeight="800">{d.val.toFixed(3)}</text>
                                       </g>
                                   ))}
                               </g>
                           );
                        })()}
                      </svg>
                    </div>

                    {/* RIGHT: KPI Gauge & Commentary */}
                    <div className="ov-compare-block" style={{ flex: 1, marginBottom: 0, background: '#fafafa', border: '1px solid #eee' }}>
                      <div className="ov-table-title" style={{ color: '#333' }}>🎯 Latest Month vs Top-Down KPI (M{latestMn})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: '#666', fontWeight: 600 }}>Total S1+S2</span>
                            <span style={{ fontSize: 13, color: actGauge <= tgtGauge ? '#27AE60' : '#E32314', fontWeight: 800 }}>{fmt(actGauge)} <span style={{fontSize:9,fontWeight:500}}>tCO₂e</span></span>
                        </div>
                        {/* Horizontal Bar Gauge */}
                        <div style={{ position: 'relative', height: 16, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                            {tgtGauge > 0 && (() => {
                                const maxG = Math.max(actGauge, tgtGauge) * 1.3;
                                const tPct = (tgtGauge / maxG) * 100;
                                const aPct = (actGauge / maxG) * 100;
                                return (
                                    <>
                                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${aPct}%`, background: actGauge <= tgtGauge ? '#27AE60' : '#E32314', opacity: 0.85, transition: 'width 0.5s' }} />
                                        <div style={{ position: 'absolute', top: 0, left: `${tPct}%`, height: '100%', borderLeft: '2px dashed #333', zIndex: 2 }} />
                                        <div style={{ position: 'absolute', top: 0, left: `calc(${tPct}% + 4px)`, fontSize: 8, fontWeight: 800, color: '#333', lineHeight: '16px', zIndex: 2 }}>KPI</div>
                                    </>
                                )
                            })()}
                        </div>
                        
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <div style={{ flex: 1.2, background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '6px 8px' }}>
                                <div style={{ fontSize: 8, color: '#888', textTransform: 'uppercase' }}>VS Absolute KPI</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: dColor(vsTgt), marginTop: 2 }}>
                                    {vsTgt > 0 ? '▲' : '▼'} {Math.abs(vsTgt).toFixed(1)}% <div style={{fontSize:9,color:'#aaa',fontWeight:500,display:'inline-block'}}>({dSign(actGauge-tgtGauge)}{fmt(actGauge-tgtGauge)}t)</div>
                                </div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: actGauge <= tgtGauge ? '#27AE60' : '#E32314', marginTop: 3 }}>
                                    {actGauge <= tgtGauge ? '✓ BELOW KPI' : '✗ OVER BUDGET'}
                                </div>
                            </div>
                            <div style={{ flex: 1.5, background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '6px 8px' }}>
                                <div style={{ fontSize: 8, color: '#888', textTransform: 'uppercase' }}>Intensity (M{latestMn})</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#6366F1', marginTop: 2 }}>
                                    {si.latestIntTot.toFixed(3)} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>tCO₂e/MT</span>
                                </div>
                                <div style={{ fontSize: 9, color: '#666', marginTop: 3 }}>
                                    RCN Processed: <b style={{color:'#333'}}>{fmt(si.latestRCN)} MT</b>
                                </div>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM ROW: S1 Drivers & S2 Stats */}
                  <div style={{ display: 'flex', gap: 10, minHeight: 180 }}>
                    
                    {/* SCOPE 1 */}
                    <div className="ov-compare-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div className="ov-table-title" style={{ color: '#E32314', marginBottom: 4 }}>🔥 Scope 1 Overview (YTD)</div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid #eee' }}>
                           <span style={{ fontSize: 11, fontWeight: 700, color: '#333' }}>Total YTD</span>
                           <span style={{ fontSize: 14, fontWeight: 800, color: '#E32314' }}>{fmt(si.s1TotalCur)} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>tCO₂e</span></span>
                        </div>
                        {si.s1Drivers.filter(d => d.ytdAvg > 0 || d.cur > 0).slice(0, 5).map((d, di) => {
                          const def = SCOPE_1_CATEGORIES.find(c => c.key === d.key);
                          const s1TotCurYd = d.ytdAvg * si.nMonthsCur;
                          const pctS1 = si.s1TotalCur > 0 ? (s1TotCurYd / si.s1TotalCur * 100) : 0;
                          return (
                            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #f9f9f9' }}>
                              <div style={{ fontSize: 14 }}>{def?.icon || '📊'}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#444' }}>{def?.label?.replace(/ \(.*\)/, '') || d.key}</div>
                              </div>
                              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#333', width: 40, textAlign: 'right' }}>{fmt(s1TotCurYd)}</div>
                                <div style={{ width: 40, height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}>
                                    <div style={{ width: `${pctS1}%`, height: '100%', background: '#E32314', opacity: 0.7 }} />
                                </div>
                                <div style={{ fontSize: 9, color: '#888', width: 22, textAlign: 'right', fontWeight: 600 }}>{pctS1.toFixed(0)}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SCOPE 2 & INTENSITY */}
                    <div className="ov-compare-block" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div className="ov-table-title" style={{ color: '#F5A623', marginBottom: 10 }}>⚡ Scope 2 & Production (YTD)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ flex: '1 1 45%', background: '#fffbf0', padding: '12px 16px', borderRadius: 8, border: '1px solid #ffe5a0' }}>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#F5A623', fontWeight: 800, marginBottom: 4 }}>Electricity Consumed</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#333' }}>{si.kWhCur >= 1000000 ? (si.kWhCur/1000000).toFixed(2) : (si.kWhCur/1000).toFixed(0)} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>{si.kWhCur >= 1000000 ? 'GWh' : 'MWh'}</span></div>
                        </div>
                        <div style={{ flex: '1 1 45%', background: '#fff5f5', padding: '12px 16px', borderRadius: 8, border: '1px solid #fce0e0' }}>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#E32314', fontWeight: 800, marginBottom: 4 }}>Scope 2 Emissions</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#333' }}>{fmt(si.s2EmCur)} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>tCO₂e</span></div>
                        </div>
                        <div style={{ flex: '1 1 45%', background: '#f5fbff', padding: '12px 16px', borderRadius: 8, border: '1px solid #c0dff5' }}>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6366F1', fontWeight: 800, marginBottom: 4 }}>RCN Processed</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#333' }}>{si.rcnCur > 0 ? fmt(si.rcnCur) : '—'} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>{si.rcnCur > 0 ? 'MT' : ''}</span></div>
                        </div>
                        <div style={{ flex: '1 1 45%', background: '#fafafa', padding: '12px 16px', borderRadius: 8, border: '1px solid #eee' }}>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#888', fontWeight: 800, marginBottom: 4 }}>Overall Intensity</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#E32314' }}>{si.rcnCur > 0 ? si.intTotCur.toFixed(3) : '—'} <span style={{fontSize:9,color:'#aaa',fontWeight:500}}>{si.rcnCur > 0 ? 'tCO₂e/MT' : ''}</span></div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* ── COMPARE MODE: Quick KPI Summary ── */}
            {viewMode === 'COMPARE' && displayBlocks.length === 2 && (() => {
              const [blkQA, blkQB] = displayBlocks;
              const colorQA = FAC_COLORS[factories.findIndex(f => f.id === blkQA.factory.id) % FAC_COLORS.length] || FAC_COLORS[0];
              const colorQB = FAC_COLORS[factories.findIndex(f => f.id === blkQB.factory.id) % FAC_COLORS.length] || FAC_COLORS[1];
              const rcnQA = prodData.filter(p => p.year === selectedYear && p.factory_id === blkQA.factory.id && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
              const rcnQB = prodData.filter(p => p.year === selectedYear && p.factory_id === blkQB.factory.id && p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
              const intQA = rcnQA > 0 ? blkQA.total / rcnQA : null;
              const intQB = rcnQB > 0 ? blkQB.total / rcnQB : null;
              const better = intQA !== null && intQB !== null ? (intQA < intQB ? 'A' : intQA > intQB ? 'B' : 'equal') : null;
              return (
                <div className="ov-compare-block" style={{ marginBottom: 6, background: 'linear-gradient(135deg, #f0f4ff 0%, #fafafa 100%)', border: '1px solid #e0e7ff' }}>
                  <div className="ov-table-title" style={{ color: '#6366F1', marginBottom: 8 }}>📊 Comparison Summary — {selectedYear} YTD</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                    {/* Factory A */}
                    <div style={{ background: '#fff', borderRadius: 6, padding: '8px 10px', border: `1.5px solid ${colorQA}22` }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: colorQA, marginBottom: 4, textTransform: 'uppercase' }}>{blkQA.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {blkQA.factory.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div style={{ background: '#f9f9f9', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#E32314', fontWeight: 700, textTransform: 'uppercase' }}>Scope 1</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#333' }}>{fmt(blkQA.s1)}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e</div>
                        </div>
                        <div style={{ background: '#f9f9f9', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#F5A623', fontWeight: 700, textTransform: 'uppercase' }}>Scope 2</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#333' }}>{fmt(blkQA.s2)}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e</div>
                        </div>
                        <div style={{ background: '#eef2ff', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase' }}>🥜 RCN</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#6366F1' }}>{rcnQA > 0 ? fmt(rcnQA) : '—'}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>MT</div>
                        </div>
                        <div style={{ background: better === 'A' ? '#f0fdf4' : better === 'B' ? '#fff5f5' : '#f9f9f9', borderRadius: 4, padding: '4px 6px', border: better === 'A' ? '1px solid #86efac' : better === 'B' ? '1px solid #fca5a5' : 'none' }}>
                          <div style={{ fontSize: 7, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase' }}>CO₂e/RCN</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: better === 'A' ? '#16a34a' : better === 'B' ? '#E32314' : '#6366F1' }}>{intQA !== null ? intQA.toFixed(3) : '—'}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e/MT {better === 'A' ? '✓' : better === 'B' ? '✗' : ''}</div>
                        </div>
                      </div>
                    </div>

                    {/* VS Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#999', padding: '4px 8px', background: '#f0f0f0', borderRadius: 20 }}>VS</div>
                      {better && better !== 'equal' && (
                        <div style={{ fontSize: 8, color: '#666', textAlign: 'center', maxWidth: 50, lineHeight: 1.4 }}>
                          {better === 'A' ? blkQA.factory.name : blkQB.factory.name}<br/>more<br/>efficient
                        </div>
                      )}
                    </div>

                    {/* Factory B */}
                    <div style={{ background: '#fff', borderRadius: 6, padding: '8px 10px', border: `1.5px solid ${colorQB}22` }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: colorQB, marginBottom: 4, textTransform: 'uppercase' }}>{blkQB.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {blkQB.factory.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <div style={{ background: '#f9f9f9', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#E32314', fontWeight: 700, textTransform: 'uppercase' }}>Scope 1</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#333' }}>{fmt(blkQB.s1)}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e</div>
                        </div>
                        <div style={{ background: '#f9f9f9', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#F5A623', fontWeight: 700, textTransform: 'uppercase' }}>Scope 2</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#333' }}>{fmt(blkQB.s2)}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e</div>
                        </div>
                        <div style={{ background: '#eef2ff', borderRadius: 4, padding: '4px 6px' }}>
                          <div style={{ fontSize: 7, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase' }}>🥜 RCN</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#6366F1' }}>{rcnQB > 0 ? fmt(rcnQB) : '—'}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>MT</div>
                        </div>
                        <div style={{ background: better === 'B' ? '#f0fdf4' : better === 'A' ? '#fff5f5' : '#f9f9f9', borderRadius: 4, padding: '4px 6px', border: better === 'B' ? '1px solid #86efac' : better === 'A' ? '1px solid #fca5a5' : 'none' }}>
                          <div style={{ fontSize: 7, color: '#6366F1', fontWeight: 700, textTransform: 'uppercase' }}>CO₂e/RCN</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: better === 'B' ? '#16a34a' : better === 'A' ? '#E32314' : '#6366F1' }}>{intQB !== null ? intQB.toFixed(3) : '—'}</div>
                          <div style={{ fontSize: 7, color: '#aaa' }}>tCO₂e/MT {better === 'B' ? '✓' : better === 'A' ? '✗' : ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Δ row */}
                  {intQA !== null && intQB !== null && (
                    <div style={{ marginTop: 6, padding: '5px 8px', background: '#fff', borderRadius: 5, border: '1px solid #eee', fontSize: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontWeight: 600 }}>Δ CO₂e/RCN</span>
                      <span style={{ fontWeight: 800, color: Math.abs(intQA - intQB) < 0.001 ? '#888' : '#6366F1' }}>
                        {intQA > intQB ? `+${(intQA - intQB).toFixed(3)} (${((intQA - intQB) / intQB * 100).toFixed(1)}%)` : `-${(intQB - intQA).toFixed(3)} (${((intQB - intQA) / intQA * 100).toFixed(1)}%)`}
                        {' '}<span style={{ color: '#aaa', fontWeight: 500 }}>tCO₂e/MT RCN — {blkQA.factory.name} vs {blkQB.factory.name}</span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── COMPARE MODE: Scope 1 Breakdown + RCN Intensity ── */}
            {viewMode === 'COMPARE' && displayBlocks.length === 2 && (() => {
              const [blkA, blkB] = displayBlocks;
              const colorA = FAC_COLORS[factories.findIndex(f => f.id === blkA.factory.id) % FAC_COLORS.length] || FAC_COLORS[0];
              const colorB = FAC_COLORS[factories.findIndex(f => f.id === blkB.factory.id) % FAC_COLORS.length] || FAC_COLORS[1];

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
                  {/* Scope 1 Breakdown Side-by-Side — COMPARE mode */}
                  <div className="ov-compare-block">
                    <div className="ov-table-title" style={{color:'#E32314'}}>🔥 Scope 1 Breakdown — Comparison</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'10px'}}>
                      <thead>
                        <tr style={{borderBottom:'1px solid #eee'}}>
                          <th style={{textAlign:'left',padding:'3px 4px',color:'#888',fontWeight:600}}>Source</th>
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

                  {/* RCN Intensity Comparison — COMPARE mode */}
                  <div className="ov-compare-block" style={{marginTop:6}}>
                    <div className="ov-table-title" style={{color:'#6366F1'}}>🥜 Intensity — tCO₂e / MT RCN</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                      {/* Total S1+S2 intensity */}
                      <div style={{background:'#f9f9f9',borderRadius:6,padding:'6px 8px'}}>
                        <div style={{fontSize:'9px',color:'#888',fontWeight:600,marginBottom:4,textTransform:'uppercase'}}>Total S1+S2 / MT RCN</div>
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
                            {blkA.factory.name} {intA < intB ? '✓ more efficient' : '✗ higher emissions'} by {Math.abs(((intA - intB) / intB) * 100).toFixed(1)}% vs {blkB.factory.name}
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
    </div>
  );
}
