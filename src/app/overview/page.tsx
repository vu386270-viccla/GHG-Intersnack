'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { SCOPE_1_CATEGORIES, GRID_EMISSION_FACTORS, MONTHS_VI } from '@/lib/types';
import type { Factory } from '@/lib/types';

const COMMON_EF = 0.8041;
const S1_COLORS = ['#E32314', '#FF6B35', '#F5A623', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72CF', '#FF6B9D'];

interface RawRow {
  factory_id: string; year: number; month: number; scope: string;
  category: string; activity_data: number; emissions_tco2e: number;
}

type ViewMode = 'ALL' | 'SINGLE' | 'COMPARE';

/* ── SVG Donut ── */
function MiniDonut({ segments, size = 120, thickness = 24, centerLabel, centerSub }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerSub?: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let cumAngle = -90;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total;
        const dashLen = pct * circumference;
        const dashGap = circumference - dashLen;
        const rotation = cumAngle;
        cumAngle += pct * 360;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dashLen} ${dashGap}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.5s' }}
          />
        );
      })}
      {centerLabel && (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="800" fill="#333" fontFamily="'Caveat', cursive">{centerLabel}</text>
          {centerSub && <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#999" fontWeight="600">{centerSub}</text>}
        </>
      )}
    </svg>
  );
}

export default function OverviewPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [emissions, setEmissions] = useState<RawRow[]>([]);
  const [baseEmissions, setBaseEmissions] = useState<RawRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [factoryA, setFactoryA] = useState('');
  const [factoryB, setFactoryB] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useCommonEF, setUseCommonEF] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [fRes, eRes, bRes] = await Promise.all([
        supabase.from('factories').select('*'),
        supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e').eq('year', selectedYear),
        supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e').eq('year', 2021),
      ]);
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      setEmissions((eRes.data || []) as RawRow[]);
      setBaseEmissions((bRes.data || []) as RawRow[]);
      if (facs.length >= 2 && !factoryA) { setFactoryA(facs[0].id); setFactoryB(facs[1].id); }
      setLoading(false);
    }
    load();
  }, [selectedYear]);

  const calcS2 = (rows: RawRow[], fac?: Factory) =>
    rows.filter(e => e.scope === 'scope_2').reduce((s, e) => {
      if (useCommonEF) return s + (Number(e.activity_data) * COMMON_EF / 1000);
      const f = fac || factories.find(ff => ff.id === e.factory_id);
      const gef = GRID_EMISSION_FACTORS.find(ef => ef.country === f?.country && ef.year === selectedYear);
      return s + (Number(e.activity_data) * (gef?.factor || COMMON_EF) / 1000);
    }, 0);

  const calcS1 = (rows: RawRow[]) => rows.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);

  const buildFactoryBlock = (fac: Factory, allRows: RawRow[]) => {
    const rows = allRows.filter(e => e.factory_id === fac.id);
    const s1 = calcS1(rows);
    const s2 = calcS2(rows, fac);
    const kWh = rows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
    const s1ByCat: { key: string; label: string; icon: string; value: number }[] = [];
    const catMap: Record<string, number> = {};
    rows.filter(e => e.scope === 'scope_1').forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.emissions_tco2e); });
    Object.entries(catMap).sort(([, a], [, b]) => b - a).forEach(([key, val]) => {
      const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
      s1ByCat.push({ key, label: def?.label || key, icon: def?.icon || '📊', value: val });
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mRows = rows.filter(e => e.month === i + 1);
      return { month: i + 1, s1: calcS1(mRows), s2: calcS2(mRows, fac), total: calcS1(mRows) + calcS2(mRows, fac) };
    });
    return { factory: fac, s1, s2, total: s1 + s2, kWh, s1ByCat, monthly };
  };

  const data = useMemo(() => {
    const allS1 = calcS1(emissions);
    const allS2 = calcS2(emissions);
    const allTotal = allS1 + allS2;
    const lastMonth = Math.max(...emissions.map(e => e.month), 0);
    const monthsWithData = new Set(emissions.map(e => e.month)).size;
    const baseS1S2 = calcS1(baseEmissions) + calcS2(baseEmissions);
    const targetS1S2 = baseS1S2 * 0.5;
    const currentPct = baseS1S2 > 0 ? ((baseS1S2 - allTotal) / baseS1S2 * 100) : 0;
    const expectedPct = ((selectedYear - 2021) / 11) * 50;
    const factoryBlocks = factories.map(f => buildFactoryBlock(f, emissions)).sort((a, b) => b.total - a.total);
    return { allS1, allS2, allTotal, lastMonth, monthsWithData, baseS1S2, targetS1S2, currentPct, expectedPct, factoryBlocks };
  }, [emissions, baseEmissions, factories, useCommonEF, selectedYear]);

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
  const isSingle = displayBlocks.length === 1;

  if (loading) return (
    <div className="overview-wrapper">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div className="loading-spinner" /><span style={{ color: '#999' }}>Loading…</span>
      </div>
    </div>
  );

  /* SBTi Roadmap milestones */
  const roadmap = [
    { year: 2021, label: 'Base Year', val: fmt(data.baseS1S2), color: '#888', active: selectedYear >= 2021 },
    { year: 2023, label: 'First Report', val: '', color: '#aaa', active: selectedYear >= 2023 },
    { year: selectedYear, label: `${selectedYear} YTD`, val: fmt(dispTotal), color: '#E32314', active: true, isCurrent: true },
    { year: 2027, label: 'Mid-term', val: fmt(data.baseS1S2 * 0.75), color: '#F5A623', active: selectedYear >= 2027 },
    { year: 2032, label: 'Target -50%', val: fmt(data.targetS1S2), color: '#8CB92D', active: selectedYear >= 2032 },
  ];

  return (
    <div className="overview-wrapper">
      {/* Controls */}
      <div className="overview-controls">
        <div className="ov-mode-tabs">
          {([['ALL', '🏭 All'], ['SINGLE', '1️⃣ Single'], ['COMPARE', '⚖️ Compare 2']] as [ViewMode, string][]).map(([mode, lb]) => (
            <button key={mode} className={`ov-mode-tab ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>{lb}</button>
          ))}
        </div>
        {(viewMode === 'SINGLE' || viewMode === 'COMPARE') && (
          <select value={factoryA} onChange={e => setFactoryA(e.target.value)} className="overview-select">
            {factories.map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
          </select>
        )}
        {viewMode === 'COMPARE' && (
          <>
            <span style={{ color: '#F5A623', fontWeight: 700, fontSize: 14 }}>vs</span>
            <select value={factoryB} onChange={e => setFactoryB(e.target.value)} className="overview-select">
              {factories.filter(f => f.id !== factoryA).map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
            </select>
          </>
        )}
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="overview-select">
          {[2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className={`overview-ef-toggle ${useCommonEF ? 'common' : 'individual'}`} onClick={() => setUseCommonEF(!useCommonEF)}>
          {useCommonEF ? `🔗 Common EF (${COMMON_EF})` : '🏭 Individual Grid EF'}
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
            GHG Emissions Report — {selectedYear} YTD ({data.monthsWithData} months, Jan–{MONTHS_VI[data.lastMonth - 1] || 'N/A'})
          </div>
          <div className="ov-ef-badge">{useCommonEF ? `EF = ${COMMON_EF}` : 'Country Grid EF'} kg CO₂e/kWh</div>
        </div>

        <div className="ov-body">
          {/* ── LEFT ── */}
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
                <div className="ov-scope-sub">tCO₂e · {dispTotal > 0 ? fmtPct(dispS1 / dispTotal * 100) : '0'}%</div>
              </div>
              <div className="ov-scope-card s2">
                <div className="ov-scope-header"><span className="ov-scope-icon">⚡</span> SCOPE 2</div>
                <div className="ov-scope-value">{fmt(dispS2)}</div>
                <div className="ov-scope-sub">tCO₂e · {dispTotal > 0 ? fmtPct(dispS2 / dispTotal * 100) : '0'}%</div>
              </div>
            </div>

            {/* SBTi compact */}
            <div className="ov-sbti-box">
              <div className="ov-sbti-title">🎯 SBTi Near-term (S1+2)</div>
              <div className="ov-sbti-row">
                <div className="ov-sbti-item"><div className="ov-sbti-label">Base 2021</div><div className="ov-sbti-val">{fmt(data.baseS1S2)}</div></div>
                <div className="ov-sbti-arrow">→</div>
                <div className="ov-sbti-item current"><div className="ov-sbti-label">{selectedYear} YTD</div><div className="ov-sbti-val">{fmt(data.allTotal)}</div></div>
                <div className="ov-sbti-arrow">→</div>
                <div className="ov-sbti-item target"><div className="ov-sbti-label">2032</div><div className="ov-sbti-val">{fmt(data.targetS1S2)}</div></div>
              </div>
              <div className="ov-sbti-bar-wrap">
                <div className="ov-sbti-bar-bg">
                  <div className="ov-sbti-bar-fill" style={{ width: `${Math.min(Math.max(data.currentPct, 0), 100)}%` }} />
                  <div className="ov-sbti-bar-expected" style={{ left: `${Math.min(data.expectedPct, 100)}%` }} />
                </div>
                <div className="ov-sbti-bar-labels">
                  <span>Reduced: <strong style={{ color: data.currentPct >= data.expectedPct ? '#2ECC71' : '#E32314' }}>{fmtPct(data.currentPct)}%</strong></span>
                  <span>Target: 50%</span>
                </div>
              </div>
            </div>

            <div className="ov-elec-detail">
              <div className="ov-elec-item"><span className="ov-elec-label">Total kWh</span><span className="ov-elec-val">{(displayBlocks.reduce((s, b) => s + b.kWh, 0) / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} MWh</span></div>
              <div className="ov-elec-item"><span className="ov-elec-label">EF Applied</span><span className="ov-elec-val">{useCommonEF ? `${COMMON_EF} (common)` : 'Country-specific'}</span></div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="ov-right">
            {/* Waterfall chart */}
            <div className="ov-chart-title">Waterfall — Monthly Cumulative Emissions (tCO₂e)</div>
            <div className="ov-chart">
              <svg viewBox="0 0 570 150" width="100%" height="150">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <g key={`g${i}`}>
                    <line x1={35} y1={125 - pct * 105} x2={565} y2={125 - pct * 105} stroke="#f0f0f0" strokeWidth={0.5} />
                    <text x={33} y={128 - pct * 105} textAnchor="end" fontSize="6.5" fill="#ccc">{Math.round(maxMonthly * pct)}</text>
                  </g>
                ))}
                {displayBlocks[0]?.monthly.map((_, mi) => {
                  const barGroupW = 36;
                  const gap = (530 - 12 * barGroupW) / 13;
                  const x0 = 37 + gap + mi * (barGroupW + gap);
                  const barW = displayBlocks.length > 1 ? barGroupW / displayBlocks.length - 1 : barGroupW - 4;

                  return (
                    <g key={mi}>
                      {displayBlocks.map((fb, fi) => {
                        const m = fb.monthly[mi];
                        const h = maxMonthly > 0 ? (m.total / maxMonthly) * 105 : 0;
                        const s1h = maxMonthly > 0 ? (m.s1 / maxMonthly) * 105 : 0;
                        const s2h = h - s1h;
                        const bx = x0 + fi * (barW + 1);
                        const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                        const s2colors = ['#FF8A80', '#FFD180', '#B388FF', '#CCFF90'];
                        return (
                          <g key={fi}>
                            <rect x={bx} y={125 - h} width={barW} height={s2h} rx={1.5} fill={s2colors[fi]} opacity={0.7} />
                            <rect x={bx} y={125 - s1h} width={barW} height={s1h} rx={s2h === 0 ? 1.5 : 0} fill={colors[fi]} opacity={0.85} />
                            {m.total > 0 && displayBlocks.length <= 2 && (
                              <text x={bx + barW / 2} y={120 - h} textAnchor="middle" fontSize="6" fill="#666" fontWeight="600">{Math.round(m.total)}</text>
                            )}
                          </g>
                        );
                      })}
                      {/* Waterfall connector */}
                      {mi < 11 && (() => {
                        const currTotal = displayBlocks.reduce((s, fb) => s + fb.monthly[mi].total, 0);
                        const nextTotal = displayBlocks.reduce((s, fb) => s + fb.monthly[mi + 1].total, 0);
                        if (currTotal === 0 && nextTotal === 0) return null;
                        const currH = maxMonthly > 0 ? (currTotal / maxMonthly) * 105 : 0;
                        const nextX = 37 + gap + (mi + 1) * (barGroupW + gap);
                        return <line x1={x0 + barGroupW - 2} y1={125 - currH} x2={nextX} y2={125 - currH} stroke="#ddd" strokeWidth={0.5} strokeDasharray="2,2" />;
                      })()}
                      <text x={x0 + barGroupW / 2} y={137} textAnchor="middle" fontSize="7" fill="#999">{MONTHS_VI[mi]}</text>
                    </g>
                  );
                })}
                {/* Cumulative line */}
                {(() => {
                  let cum = 0;
                  const points = displayBlocks[0]?.monthly.map((_, mi) => {
                    cum += displayBlocks.reduce((s, fb) => s + fb.monthly[mi].total, 0);
                    const barGroupW = 36;
                    const gap = (530 - 12 * barGroupW) / 13;
                    const x = 37 + gap + mi * (barGroupW + gap) + barGroupW / 2;
                    const maxCum = displayBlocks.reduce((s, fb) => s + fb.monthly.reduce((ss, m) => ss + m.total, 0), 0);
                    const y = maxCum > 0 ? 125 - (cum / maxCum) * 105 : 125;
                    return `${x},${y}`;
                  }) || [];
                  if (points.length === 0) return null;
                  return (
                    <>
                      <polyline points={points.join(' ')} fill="none" stroke="#6366F1" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.5} />
                      {points.map((p, i) => {
                        const [x, y] = p.split(',').map(Number);
                        return <circle key={i} cx={x} cy={y} r={2} fill="#6366F1" opacity={cum > 0 ? 0.6 : 0} />;
                      })}
                    </>
                  );
                })()}
              </svg>
              <div className="ov-chart-legend">
                {displayBlocks.map((fb, i) => {
                  const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                  return <span key={fb.factory.id}><span className="ov-legend-dot" style={{ background: colors[i] }} /> {fb.factory.name}</span>;
                })}
                <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: '9px' }}>■ Dark=S1 · Light=S2 · - - Cumulative</span>
              </div>
            </div>

            {/* ── Donuts + Table (bottom section) ── */}
            <div className="ov-bottom-section">
              {/* Scope 1 Donut */}
              <div className="ov-donut-block">
                <div className="ov-donut-title">Scope 1 Breakdown</div>
                <div className="ov-donut-wrapper">
                  <MiniDonut
                    size={isSingle ? 130 : 110}
                    thickness={isSingle ? 22 : 18}
                    segments={(() => {
                      const allCats: Record<string, number> = {};
                      displayBlocks.forEach(b => b.s1ByCat.forEach(c => { allCats[c.key] = (allCats[c.key] || 0) + c.value; }));
                      return Object.entries(allCats).sort(([, a], [, b]) => b - a).map(([key, val], i) => {
                        const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                        return { label: def?.label || key, value: val, color: S1_COLORS[i % S1_COLORS.length] };
                      });
                    })()}
                    centerLabel={fmt(dispS1)}
                    centerSub="tCO₂e"
                  />
                </div>
                <div className="ov-donut-legend">
                  {(() => {
                    const allCats: Record<string, number> = {};
                    displayBlocks.forEach(b => b.s1ByCat.forEach(c => { allCats[c.key] = (allCats[c.key] || 0) + c.value; }));
                    return Object.entries(allCats).sort(([, a], [, b]) => b - a).map(([key, val], i) => {
                      const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                      const pct = dispS1 > 0 ? (val / dispS1 * 100).toFixed(0) : '0';
                      return (
                        <div key={key} className="ov-donut-legend-item">
                          <span className="ov-legend-dot" style={{ background: S1_COLORS[i % S1_COLORS.length] }} />
                          <span className="ov-legend-text">{def?.icon} {def?.label || key}</span>
                          <span className="ov-legend-val">{fmt(val)} ({pct}%)</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Scope 2 Donut */}
              <div className="ov-donut-block">
                <div className="ov-donut-title">Scope 2 Breakdown</div>
                <div className="ov-donut-wrapper">
                  <MiniDonut
                    size={isSingle ? 130 : 110}
                    thickness={isSingle ? 22 : 18}
                    segments={[{ label: 'Điện lưới', value: dispS2, color: '#F5A623' }]}
                    centerLabel={fmt(dispS2)}
                    centerSub="tCO₂e"
                  />
                </div>
                <div className="ov-donut-legend">
                  <div className="ov-donut-legend-item">
                    <span className="ov-legend-dot" style={{ background: '#F5A623' }} />
                    <span className="ov-legend-text">⚡ Điện lưới mua</span>
                    <span className="ov-legend-val">100%</span>
                  </div>
                  <div className="ov-donut-legend-item" style={{ opacity: 0.6 }}>
                    <span className="ov-legend-dot" style={{ background: 'transparent' }} />
                    <span className="ov-legend-text" style={{ fontSize: '8px' }}>{(displayBlocks.reduce((s, b) => s + b.kWh, 0) / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} MWh consumed</span>
                    <span className="ov-legend-val"></span>
                  </div>
                </div>
              </div>

              {/* Factory table OR SBTi Roadmap (fill the space) */}
              <div className="ov-bottom-right">
                {displayBlocks.length > 1 ? (
                  /* Factory comparison */
                  <div className="ov-factory-table compact">
                    <div className="ov-table-title">Factory — YTD {selectedYear}</div>
                    <table>
                      <thead><tr><th>Plant</th><th style={{ textAlign: 'right' }}>S1</th><th style={{ textAlign: 'right' }}>S2</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ width: '70px' }}>Share</th></tr></thead>
                      <tbody>
                        {displayBlocks.map((fb, i) => {
                          const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                          return (
                            <tr key={fb.factory.id}>
                              <td><span style={{ color: colors[i], fontWeight: 700, marginRight: 3 }}>●</span>{fb.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fb.factory.name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fb.s1)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fb.s2)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(fb.total)}</td>
                              <td><div className="ov-share-bar"><div style={{ width: `${dispTotal > 0 ? (fb.total / dispTotal * 100) : 0}%`, background: colors[i] }} /></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* SBTi Roadmap for single factory */
                  <div className="ov-roadmap">
                    <div className="ov-table-title">SBTi Roadmap — Scope 1+2</div>
                    <div className="ov-roadmap-track">
                      <div className="ov-roadmap-line" />
                      {roadmap.map((m, i) => (
                        <div key={i} className={`ov-roadmap-node ${m.isCurrent ? 'current' : ''} ${m.active ? 'active' : ''}`}
                          style={{ left: `${((m.year - 2021) / (2032 - 2021)) * 100}%` }}>
                          <div className="ov-roadmap-dot" style={{ background: m.color }} />
                          <div className="ov-roadmap-label">{m.year}</div>
                          <div className="ov-roadmap-desc">{m.label}</div>
                          {m.val && <div className="ov-roadmap-val" style={{ color: m.color }}>{m.val}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="ov-roadmap-footer">
                      <span>2021 Base → {selectedYear} Progress → 2032 Target (-50%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="ov-footer">
          <span>© {selectedYear} Intersnack Group — GHG Tracker</span>
          <span>SBTi Near-term Approved · Base Year 2021 · Target -50% by 2032</span>
          <span>EF: {useCommonEF ? `Common ${COMMON_EF}` : 'Country-specific'} kg CO₂e/kWh</span>
        </div>
      </div>
    </div>
  );
}
