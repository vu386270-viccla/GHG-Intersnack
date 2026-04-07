'use client';

import { useEffect, useState, useMemo } from 'react';
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
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [factoryA, setFactoryA] = useState('');
  const [factoryB, setFactoryB] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useCommonEF, setUseCommonEF] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [fRes, eRes] = await Promise.all([
        supabase.from('factories').select('*'),
        supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e'),
      ]);
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      setAllEmissions((eRes.data || []) as RawRow[]);
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
    const s1ByCat: { key: string; label: string; icon: string; value: number }[] = [];
    const catMap: Record<string, number> = {};
    fRows.filter(e => e.scope === 'scope_1').forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.emissions_tco2e); });
    Object.entries(catMap).sort(([, a], [, b]) => b - a).forEach(([key, val]) => {
      const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
      s1ByCat.push({ key, label: def?.label || key, icon: def?.icon || '📊', value: val });
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mRows = fRows.filter(e => e.month === i + 1);
      return { month: i + 1, s1: calcS1(mRows), s2: calcS2(mRows, selectedYear, fac), total: calcS1(mRows) + calcS2(mRows, selectedYear, fac) };
    });
    return { factory: fac, s1, s2, total: s1 + s2, kWh, s1ByCat, monthly };
  };

  /* ── Multi-year SBTi roadmap data ── */
  const roadmapData = useMemo(() => {
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    const baseRows = allEmissions.filter(e => e.year === 2021);
    const baseTotal = calcS1(baseRows) + calcS2(baseRows, 2021);
    
    return years.map(yr => {
      const yrRows = allEmissions.filter(e => e.year === yr);
      const actual = calcS1(yrRows) + calcS2(yrRows, yr);
      const target = baseTotal * (1 - (50 / 11) * (yr - 2021) / 100);
      const monthsActive = new Set(yrRows.map(e => e.month)).size;

      // Per-factory breakdown
      const perFactory = factories.map(f => {
        const fData = yrRows.filter(e => e.factory_id === f.id);
        const s1 = calcS1(fData);
        const s2 = calcS2(fData, yr, f);
        return { factory: f, s1, s2, total: s1 + s2 };
      });

      return { year: yr, actual, target, baseTotal, monthsActive, perFactory, onTrack: actual <= target };
    });
  }, [allEmissions, factories, useCommonEF]);

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
  const rmMaxVal = Math.max(...roadmapData.map(d => Math.max(d.actual, d.target, d.baseTotal)), 1) * 1.12;
  const rmW = 540, rmH = 155, rmPadL = 38, rmPadR = 30, rmPadT = 18, rmPadB = 28;
  const rmPlotW = rmW - rmPadL - rmPadR;
  const rmPlotH = rmH - rmPadT - rmPadB;

  return (
    <div className="overview-wrapper">
      {/* Controls */}
      <div className="overview-controls">
        <div className="ov-mode-tabs">
          {([['ALL', '🏭 All'], ['SINGLE', '1️⃣ Single'], ['COMPARE', '⚖️ Compare']] as [ViewMode, string][]).map(([mode, lb]) => (
            <button key={mode} className={`ov-mode-tab ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>{lb}</button>
          ))}
        </div>
        {(viewMode === 'SINGLE' || viewMode === 'COMPARE') && (
          <select value={factoryA} onChange={e => setFactoryA(e.target.value)} className="overview-select">
            {factories.map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
          </select>
        )}
        {viewMode === 'COMPARE' && <>
          <span style={{ color: '#F5A623', fontWeight: 700, fontSize: 14 }}>vs</span>
          <select value={factoryB} onChange={e => setFactoryB(e.target.value)} className="overview-select">
            {factories.filter(f => f.id !== factoryA).map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
          </select>
        </>}
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
          <div className="ov-topbar-title">GHG Emissions Report — {selectedYear} YTD ({data.monthsWithData} months, Jan–{MONTHS_VI[data.lastMonth - 1] || 'N/A'})</div>
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

            {/* Scope 1 Donut */}
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
                  const cats: Record<string, number> = {};
                  displayBlocks.forEach(b => b.s1ByCat.forEach(c => { cats[c.key] = (cats[c.key] || 0) + c.value; }));
                  return Object.entries(cats).sort(([,a],[,b]) => b - a).slice(0, 5).map(([key, val], i) => {
                    const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
                    return <div key={key} className="ov-dls-item"><span className="ov-legend-dot" style={{ background: S1_COLORS[i] }}/>{def?.icon} {fmt(val)}</div>;
                  });
                })()}
              </div>
            </div>

            <div className="ov-elec-detail">
              <div className="ov-elec-item"><span className="ov-elec-label">Electricity</span><span className="ov-elec-val">{(displayBlocks.reduce((s,b)=>s+b.kWh,0)/1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')} MWh</span></div>
              <div className="ov-elec-item"><span className="ov-elec-label">EF</span><span className="ov-elec-val">{useCommonEF ? `${COMMON_EF}` : 'Country'} kg CO₂e/kWh</span></div>
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
              <div className="ov-chart-title">🎯 SBTi Roadmap — Scope 1+2 Actual vs Target Pathway (2021 → 2032)</div>
              <svg viewBox={`0 0 ${rmW} ${rmH}`} width="100%" height={rmH}>
                {/* Grid */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                  <g key={`rg${i}`}>
                    <line x1={rmPadL} y1={rmPadT + rmPlotH*(1-p)} x2={rmW-rmPadR} y2={rmPadT + rmPlotH*(1-p)} stroke="#f5f5f5" strokeWidth={0.5}/>
                    <text x={rmPadL-3} y={rmPadT + rmPlotH*(1-p)+3} textAnchor="end" fontSize="6.5" fill="#ccc">{fmt(rmMaxVal*p)}</text>
                  </g>
                ))}
                
                {/* Target pathway line (dashed green) */}
                {(() => {
                  const pts = roadmapData.map((d, i) => {
                    const x = rmPadL + (i / (roadmapData.length - 1)) * rmPlotW;
                    const y = rmPadT + rmPlotH * (1 - d.target / rmMaxVal);
                    return `${x},${y}`;
                  });
                  // Extend to 2032
                  const x2032 = rmPadL + rmPlotW + 0;
                  const y2032 = rmPadT + rmPlotH * (1 - (roadmapData[0]?.baseTotal * 0.5 || 0) / rmMaxVal);
                  return <polyline points={[...pts, `${x2032},${y2032}`].join(' ')} fill="none" stroke="#8CB92D" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7}/>;
                })()}

                {/* Stacked bars per year — 4 factories */}
                {roadmapData.map((d, i) => {
                  const x = rmPadL + (i / (roadmapData.length - 1)) * rmPlotW;
                  const barW = 22;
                  const barX = x - barW / 2;
                  let cumH = 0;
                  const targetY = rmPadT + rmPlotH * (1 - d.target / rmMaxVal);

                  return (
                    <g key={d.year}>
                      {d.perFactory.sort((a,b) => b.total - a.total).map((pf, fi) => {
                        const h = rmMaxVal > 0 ? (pf.total / rmMaxVal) * rmPlotH : 0;
                        const y = rmPadT + rmPlotH - cumH - h;
                        cumH += h;
                        const fIdx = factories.findIndex(f => f.id === pf.factory.id);
                        return <rect key={fi} x={barX} y={y} width={barW} height={Math.max(h, 0.5)} rx={1}
                          fill={FAC_COLORS[fIdx >= 0 ? fIdx : fi]} opacity={d.year === selectedYear ? 0.9 : 0.55}
                          stroke={d.year === selectedYear ? '#333' : 'none'} strokeWidth={d.year === selectedYear ? 0.8 : 0}/>;
                      })}
                      {/* Actual value above bar */}
                      {d.actual > 0 && (
                        <text x={x} y={rmPadT + rmPlotH - cumH - 4} textAnchor="middle" fontSize="7" fontWeight="700"
                          fill={d.year === selectedYear ? '#E32314' : '#555'}>
                          {fmt(d.actual)}
                        </text>
                      )}
                      {/* Target dot on pathway */}
                      <circle cx={x} cy={targetY} r={2.5} fill="#8CB92D" opacity={0.6}/>
                      {/* Year + status label */}
                      <text x={x} y={rmH - 8} textAnchor="middle" fontSize="8"
                        fill={d.year === selectedYear ? '#E32314' : '#888'}
                        fontWeight={d.year === selectedYear ? 700 : 400}>
                        {d.year}
                      </text>
                      {d.actual > 0 && (
                        <text x={x} y={rmH - 0} textAnchor="middle" fontSize="6.5"
                          fill={d.onTrack ? '#2ECC71' : '#E32314'} fontWeight="600">
                          {d.onTrack ? '✓ On track' : '✗ Over'}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 2032 target marker */}
                {(() => {
                  const x = rmW - rmPadR + 5;
                  const t2032 = roadmapData[0]?.baseTotal * 0.5 || 0;
                  const y = rmPadT + rmPlotH * (1 - t2032 / rmMaxVal);
                  return <g>
                    <circle cx={x} cy={y} r={5} fill="none" stroke="#8CB92D" strokeWidth={2}/>
                    <circle cx={x} cy={y} r={2} fill="#8CB92D"/>
                    <text x={x} y={y - 8} textAnchor="middle" fontSize="7" fill="#5A7A1C" fontWeight="700">{fmt(t2032)}</text>
                    <text x={x} y={rmH - 8} textAnchor="middle" fontSize="8" fill="#8CB92D" fontWeight="700">2032</text>
                    <text x={x} y={rmH - 0} textAnchor="middle" fontSize="6.5" fill="#5A7A1C" fontWeight="600">-50%</text>
                  </g>;
                })()}
              </svg>
              <div className="ov-roadmap-legend">
                {factories.map((f, i) => (
                  <span key={f.id}><span className="ov-legend-dot" style={{ background: FAC_COLORS[i] }} />{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</span>
                ))}
                <span style={{ marginLeft: 'auto' }}><span style={{ color: '#8CB92D' }}>- -</span> SBTi Target Pathway</span>
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
