'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { SCOPE_1_CATEGORIES, GRID_EMISSION_FACTORS, MONTHS_VI } from '@/lib/types';
import type { Factory } from '@/lib/types';

const COMMON_EF = 0.8041;

interface RawRow {
  factory_id: string;
  year: number;
  month: number;
  scope: string;
  category: string;
  activity_data: number;
  emissions_tco2e: number;
}

type ViewMode = 'ALL' | 'SINGLE' | 'COMPARE';

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
        supabase.from('emissions_data')
          .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
          .eq('year', selectedYear),
        supabase.from('emissions_data')
          .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
          .eq('year', 2021),
      ]);
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      setEmissions((eRes.data || []) as RawRow[]);
      setBaseEmissions((bRes.data || []) as RawRow[]);
      if (facs.length >= 2 && !factoryA) {
        setFactoryA(facs[0].id);
        setFactoryB(facs[1].id);
      }
      setLoading(false);
    }
    load();
  }, [selectedYear]);

  /* ── helper: calc S2 with EF toggle ── */
  const calcS2 = (rows: RawRow[], fac?: Factory) => {
    return rows.filter(e => e.scope === 'scope_2').reduce((s, e) => {
      if (useCommonEF) return s + (Number(e.activity_data) * COMMON_EF / 1000);
      const f = fac || factories.find(ff => ff.id === e.factory_id);
      const gef = GRID_EMISSION_FACTORS.find(ef => ef.country === f?.country && ef.year === selectedYear);
      return s + (Number(e.activity_data) * (gef?.factor || COMMON_EF) / 1000);
    }, 0);
  };

  const calcS1 = (rows: RawRow[]) => rows.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);

  /* ── build per-factory data block ── */
  const buildFactoryBlock = (fac: Factory, allRows: RawRow[]) => {
    const rows = allRows.filter(e => e.factory_id === fac.id);
    const s1 = calcS1(rows);
    const s2 = calcS2(rows, fac);
    const total = s1 + s2;
    const kWh = rows.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);

    // S1 by category
    const s1ByCat: { key: string; label: string; icon: string; value: number }[] = [];
    const catMap: Record<string, number> = {};
    rows.filter(e => e.scope === 'scope_1').forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.emissions_tco2e);
    });
    Object.entries(catMap).sort(([, a], [, b]) => b - a).forEach(([key, val]) => {
      const def = SCOPE_1_CATEGORIES.find(c => c.key === key);
      s1ByCat.push({ key, label: def?.label || key, icon: def?.icon || '📊', value: val });
    });

    // Monthly
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mRows = rows.filter(e => e.month === i + 1);
      const ms1 = calcS1(mRows);
      const ms2 = calcS2(mRows, fac);
      return { month: i + 1, s1: ms1, s2: ms2, total: ms1 + ms2 };
    });

    return { factory: fac, s1, s2, total, kWh, s1ByCat, monthly };
  };

  /* ── computed ── */
  const data = useMemo(() => {
    const allS1 = calcS1(emissions);
    const allS2 = calcS2(emissions);
    const allTotal = allS1 + allS2;
    const lastMonth = Math.max(...emissions.map(e => e.month), 0);
    const monthsWithData = new Set(emissions.map(e => e.month)).size;

    // SBTi
    const baseS1S2 = calcS1(baseEmissions) + calcS2(baseEmissions);
    const targetS1S2 = baseS1S2 * 0.5; // -50% by 2032
    const currentPct = baseS1S2 > 0 ? ((baseS1S2 - allTotal) / baseS1S2 * 100) : 0;
    const yearsElapsed = selectedYear - 2021;
    const expectedPct = (yearsElapsed / 11) * 50; // linear pathway

    // Per-factory
    const factoryBlocks = factories.map(f => buildFactoryBlock(f, emissions)).sort((a, b) => b.total - a.total);

    return { allS1, allS2, allTotal, lastMonth, monthsWithData, baseS1S2, targetS1S2, currentPct, expectedPct, factoryBlocks };
  }, [emissions, baseEmissions, factories, useCommonEF, selectedYear]);

  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const fmtPct = (n: number) => n.toFixed(1);

  /* ── which blocks to show ── */
  const displayBlocks = useMemo(() => {
    if (viewMode === 'ALL') return data.factoryBlocks;
    if (viewMode === 'SINGLE') return data.factoryBlocks.filter(b => b.factory.id === factoryA);
    return data.factoryBlocks.filter(b => b.factory.id === factoryA || b.factory.id === factoryB);
  }, [viewMode, factoryA, factoryB, data.factoryBlocks]);

  const maxS1Cat = Math.max(...displayBlocks.flatMap(b => b.s1ByCat.map(c => c.value)), 1);
  const maxMonthly = Math.max(...displayBlocks.flatMap(b => b.monthly.map(m => m.total)), 1);

  if (loading) {
    return (
      <div className="overview-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
          <div className="loading-spinner" /><span style={{ color: '#999' }}>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-wrapper">
      {/* Controls */}
      <div className="overview-controls">
        <div className="ov-mode-tabs">
          {([['ALL', '🏭 All'], ['SINGLE', '1️⃣ Single'], ['COMPARE', '⚖️ Compare 2']] as [ViewMode, string][]).map(([mode, label]) => (
            <button key={mode} className={`ov-mode-tab ${viewMode === mode ? 'active' : ''}`} onClick={() => setViewMode(mode)}>{label}</button>
          ))}
        </div>
        {(viewMode === 'SINGLE' || viewMode === 'COMPARE') && (
          <select value={factoryA} onChange={e => setFactoryA(e.target.value)} className="overview-select">
            {factories.map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
          </select>
        )}
        {viewMode === 'COMPARE' && (
          <>
            <span style={{ color: '#F5A623', fontWeight: 700, fontSize: '14px' }}>vs</span>
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
        {/* Top bar */}
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
          {/* ── LEFT: KPIs + SBTi ── */}
          <div className="ov-left">
            {/* Grand total */}
            <div className="ov-grand-kpi">
              <div className="ov-grand-label">TOTAL SCOPE 1 + 2 · {selectedYear} YTD</div>
              <div className="ov-grand-value">{fmt(viewMode === 'ALL' ? data.allTotal : displayBlocks.reduce((s, b) => s + b.total, 0))}</div>
              <div className="ov-grand-unit">tCO₂e</div>
            </div>

            {/* Scope 1 vs 2 summary */}
            <div className="ov-scope-row">
              <div className="ov-scope-card s1">
                <div className="ov-scope-header"><span className="ov-scope-icon">🔥</span> SCOPE 1</div>
                <div className="ov-scope-value">{fmt(viewMode === 'ALL' ? data.allS1 : displayBlocks.reduce((s, b) => s + b.s1, 0))}</div>
                <div className="ov-scope-sub">tCO₂e · Direct emissions</div>
              </div>
              <div className="ov-scope-card s2">
                <div className="ov-scope-header"><span className="ov-scope-icon">⚡</span> SCOPE 2</div>
                <div className="ov-scope-value">{fmt(viewMode === 'ALL' ? data.allS2 : displayBlocks.reduce((s, b) => s + b.s2, 0))}</div>
                <div className="ov-scope-sub">tCO₂e · Electricity</div>
              </div>
            </div>

            {/* SBTi Progress */}
            <div className="ov-sbti-box">
              <div className="ov-sbti-title">🎯 SBTi Near-term Target (Scope 1+2)</div>
              <div className="ov-sbti-row">
                <div className="ov-sbti-item">
                  <div className="ov-sbti-label">Base 2021</div>
                  <div className="ov-sbti-val">{fmt(data.baseS1S2)}</div>
                </div>
                <div className="ov-sbti-arrow">→</div>
                <div className="ov-sbti-item current">
                  <div className="ov-sbti-label">{selectedYear} YTD</div>
                  <div className="ov-sbti-val">{fmt(data.allTotal)}</div>
                </div>
                <div className="ov-sbti-arrow">→</div>
                <div className="ov-sbti-item target">
                  <div className="ov-sbti-label">Target 2032</div>
                  <div className="ov-sbti-val">{fmt(data.targetS1S2)}</div>
                </div>
              </div>
              <div className="ov-sbti-bar-wrap">
                <div className="ov-sbti-bar-bg">
                  <div className="ov-sbti-bar-fill" style={{ width: `${Math.min(Math.max(data.currentPct, 0), 100)}%` }} />
                  <div className="ov-sbti-bar-expected" style={{ left: `${Math.min(data.expectedPct, 100)}%` }} />
                </div>
                <div className="ov-sbti-bar-labels">
                  <span>Reduced: <strong style={{ color: data.currentPct >= data.expectedPct ? '#2ECC71' : '#E32314' }}>{fmtPct(data.currentPct)}%</strong></span>
                  <span>Expected: {fmtPct(data.expectedPct)}%</span>
                  <span>Target: 50%</span>
                </div>
              </div>
            </div>

            {/* Electricity info */}
            <div className="ov-elec-detail">
              <div className="ov-elec-item">
                <span className="ov-elec-label">Total kWh</span>
                <span className="ov-elec-val">{(displayBlocks.reduce((s, b) => s + b.kWh, 0) / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} MWh</span>
              </div>
              <div className="ov-elec-item">
                <span className="ov-elec-label">EF Applied</span>
                <span className="ov-elec-val">{useCommonEF ? `${COMMON_EF} (common)` : 'Country-specific'}</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Charts + Factory detail ── */}
          <div className="ov-right">
            {/* Monthly chart */}
            <div className="ov-chart-title">Monthly Emissions by Factory (tCO₂e)</div>
            <div className="ov-chart">
              <svg viewBox="0 0 560 145" width="100%" height="145">
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <g key={`g-${i}`}>
                    <line x1={30} y1={125 - pct * 110} x2={560} y2={125 - pct * 110} stroke="#f0f0f0" strokeWidth={0.5} />
                    <text x={28} y={128 - pct * 110} textAnchor="end" fontSize="7" fill="#bbb">{Math.round(maxMonthly * pct)}</text>
                  </g>
                ))}
                {data.factoryBlocks[0]?.monthly.map((_, mi) => {
                  const barGroupW = 38;
                  const gap = (530 - 12 * barGroupW) / 13;
                  const x0 = 32 + gap + mi * (barGroupW + gap);
                  const barW = displayBlocks.length > 1 ? barGroupW / displayBlocks.length - 1 : barGroupW - 4;
                  return (
                    <g key={mi}>
                      {displayBlocks.map((fb, fi) => {
                        const m = fb.monthly[mi];
                        const h = maxMonthly > 0 ? (m.total / maxMonthly) * 110 : 0;
                        const s1h = maxMonthly > 0 ? (m.s1 / maxMonthly) * 110 : 0;
                        const s2h = h - s1h;
                        const bx = x0 + fi * (barW + 1);
                        const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                        const s2colors = ['#FF8A80', '#FFD180', '#B388FF', '#CCFF90'];
                        return (
                          <g key={fi}>
                            <rect x={bx} y={125 - h} width={barW} height={s2h} rx={1} fill={s2colors[fi]} opacity={0.7} />
                            <rect x={bx} y={125 - s1h} width={barW} height={s1h} rx={1} fill={colors[fi]} opacity={0.85} />
                          </g>
                        );
                      })}
                      <text x={x0 + barGroupW / 2} y={138} textAnchor="middle" fontSize="7" fill="#999">{MONTHS_VI[mi]}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="ov-chart-legend">
                {displayBlocks.map((fb, i) => {
                  const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                  return <span key={fb.factory.id}><span className="ov-legend-dot" style={{ background: colors[i] }} /> {fb.factory.name} ({fb.factory.country === 'India' ? '🇮🇳' : '🇻🇳'})</span>;
                })}
                <span style={{ marginLeft: 'auto', opacity: 0.6 }}>■ Dark = S1 · ■ Light = S2</span>
              </div>
            </div>

            {/* Scope 1 horizontal breakdown */}
            <div className="ov-chart-title" style={{ marginTop: '6px' }}>Scope 1 Breakdown by Source</div>
            <div className="ov-s1-breakdown">
              {(() => {
                // Collect all unique categories
                const allCats = new Set<string>();
                displayBlocks.forEach(b => b.s1ByCat.forEach(c => allCats.add(c.key)));
                const cats = Array.from(allCats);
                const maxVal = Math.max(...displayBlocks.flatMap(b => b.s1ByCat.map(c => c.value)), 1);

                return cats.map(catKey => {
                  const def = SCOPE_1_CATEGORIES.find(c => c.key === catKey);
                  return (
                    <div key={catKey} className="ov-s1-row">
                      <div className="ov-s1-label">{def?.icon} {def?.label || catKey}</div>
                      <div className="ov-s1-bars">
                        {displayBlocks.map((fb, fi) => {
                          const catVal = fb.s1ByCat.find(c => c.key === catKey)?.value || 0;
                          const pct = maxVal > 0 ? (catVal / maxVal * 100) : 0;
                          const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                          return (
                            <div key={fi} className="ov-s1-bar-row">
                              <div className="ov-s1-bar-track">
                                <div className="ov-s1-bar-fill" style={{ width: `${pct}%`, background: colors[fi] }} />
                              </div>
                              <span className="ov-s1-bar-val" style={{ color: colors[fi] }}>{catVal > 0 ? fmt(catVal) : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Factory totals comparison table (when ALL or COMPARE) */}
            {displayBlocks.length > 1 && (
              <div className="ov-factory-table">
                <div className="ov-table-title">Factory Comparison — YTD {selectedYear}</div>
                <table>
                  <thead>
                    <tr><th>Plant</th><th style={{ textAlign: 'right' }}>S1</th><th style={{ textAlign: 'right' }}>S2</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>MWh</th><th style={{ width: '90px' }}>Share</th></tr>
                  </thead>
                  <tbody>
                    {displayBlocks.map((fb, i) => {
                      const colors = ['#E32314', '#F5A623', '#6366F1', '#8CB92D'];
                      const dispTotal = displayBlocks.reduce((s, b) => s + b.total, 0);
                      return (
                        <tr key={fb.factory.id}>
                          <td><span style={{ color: colors[i], fontWeight: 700, marginRight: '4px' }}>●</span>{fb.factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {fb.factory.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fb.s1)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(fb.s2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(fb.total)}</td>
                          <td style={{ textAlign: 'right', color: '#888' }}>{(fb.kWh / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
                          <td>
                            <div className="ov-share-bar"><div style={{ width: `${dispTotal > 0 ? (fb.total / dispTotal * 100) : 0}%`, background: colors[i] }} /></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="ov-footer">
          <span>© {selectedYear} Intersnack Group — GHG Tracker</span>
          <span>SBTi Near-term Approved · Base Year 2021 · Target -50% by 2032</span>
          <span>EF: {useCommonEF ? `Common ${COMMON_EF}` : 'Country-specific'} kg CO₂e/kWh</span>
        </div>
      </div>
    </div>
  );
}
