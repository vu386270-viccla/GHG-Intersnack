'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { SCOPE_1_CATEGORIES, GRID_EMISSION_FACTORS, MONTHS_VI } from '@/lib/types';
import type { Factory } from '@/lib/types';

/* ── common EF for comparison ── */
const COMMON_EF = 0.8041; // kg CO₂e / kWh — Indirect emissions from imported electricity

interface RawRow {
  factory_id: string;
  year: number;
  month: number;
  scope: string;
  category: string;
  activity_data: number;
  emissions_tco2e: number;
}

export default function OverviewPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [emissions, setEmissions] = useState<RawRow[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [useCommonEF, setUseCommonEF] = useState(true);
  const [loading, setLoading] = useState(true);

  /* fetch */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [fRes, eRes] = await Promise.all([
        supabase.from('factories').select('*'),
        supabase.from('emissions_data')
          .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
          .eq('year', selectedYear),
      ]);
      setFactories((fRes.data || []) as Factory[]);
      setEmissions((eRes.data || []) as RawRow[]);
      setLoading(false);
    }
    load();
  }, [selectedYear]);

  /* ── computed data ── */
  const data = useMemo(() => {
    const filtered = selectedFactory === 'ALL'
      ? emissions
      : emissions.filter(e => e.factory_id === selectedFactory);

    const relevantFactories = selectedFactory === 'ALL'
      ? factories
      : factories.filter(f => f.id === selectedFactory);

    /* Scope 1 */
    const s1Total = filtered
      .filter(e => e.scope === 'scope_1')
      .reduce((s, e) => s + Number(e.emissions_tco2e), 0);

    const s1ByCat: Record<string, number> = {};
    filtered.filter(e => e.scope === 'scope_1').forEach(e => {
      s1ByCat[e.category] = (s1ByCat[e.category] || 0) + Number(e.emissions_tco2e);
    });

    /* Scope 2 — recalc with EF if useCommonEF */
    let s2Total = 0;
    const s2ByFactoryMonth: Record<string, number[]> = {};

    if (useCommonEF) {
      /* Use common EF for all: activity_data (kWh) * 0.8041 / 1000 = tCO₂e */
      filtered.filter(e => e.scope === 'scope_2').forEach(e => {
        const tco2e = (Number(e.activity_data) * COMMON_EF) / 1000;
        s2Total += tco2e;
        const key = e.factory_id;
        if (!s2ByFactoryMonth[key]) s2ByFactoryMonth[key] = Array(12).fill(0);
        s2ByFactoryMonth[key][e.month - 1] += tco2e;
      });
    } else {
      /* Use individual country EFs */
      filtered.filter(e => e.scope === 'scope_2').forEach(e => {
        const factory = factories.find(f => f.id === e.factory_id);
        const gridEF = GRID_EMISSION_FACTORS.find(
          ef => ef.country === factory?.country && ef.year === selectedYear
        );
        const tco2e = (Number(e.activity_data) * (gridEF?.factor || COMMON_EF)) / 1000;
        s2Total += tco2e;
        const key = e.factory_id;
        if (!s2ByFactoryMonth[key]) s2ByFactoryMonth[key] = Array(12).fill(0);
        s2ByFactoryMonth[key][e.month - 1] += tco2e;
      });
    }

    const grandTotal = s1Total + s2Total;

    /* monthly totals */
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mFiltered = filtered.filter(e => e.month === i + 1);
      const mS1 = mFiltered.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
      let mS2 = 0;
      if (useCommonEF) {
        mS2 = mFiltered.filter(e => e.scope === 'scope_2').reduce((s, e) => s + (Number(e.activity_data) * COMMON_EF / 1000), 0);
      } else {
        mFiltered.filter(e => e.scope === 'scope_2').forEach(e => {
          const factory = factories.find(f => f.id === e.factory_id);
          const gridEF = GRID_EMISSION_FACTORS.find(ef => ef.country === factory?.country && ef.year === selectedYear);
          mS2 += (Number(e.activity_data) * (gridEF?.factor || COMMON_EF)) / 1000;
        });
      }
      return { month: i + 1, s1: mS1, s2: mS2, total: mS1 + mS2 };
    });

    /* per-factory breakdown */
    const factoryBreakdown = relevantFactories.map(f => {
      const fData = filtered.filter(e => e.factory_id === f.id);
      const fS1 = fData.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
      let fS2 = 0;
      if (useCommonEF) {
        fS2 = fData.filter(e => e.scope === 'scope_2').reduce((s, e) => s + (Number(e.activity_data) * COMMON_EF / 1000), 0);
      } else {
        fData.filter(e => e.scope === 'scope_2').forEach(e => {
          const gridEF = GRID_EMISSION_FACTORS.find(ef => ef.country === f.country && ef.year === selectedYear);
          fS2 += (Number(e.activity_data) * (gridEF?.factor || COMMON_EF)) / 1000;
        });
      }
      const kWh = fData.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);
      return { factory: f, s1: fS1, s2: fS2, total: fS1 + fS2, kWh };
    }).sort((a, b) => b.total - a.total);

    /* electricity kWh total */
    const totalKWh = filtered.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.activity_data), 0);

    /* active EF label */
    const efLabel = useCommonEF
      ? `Common EF: ${COMMON_EF} kg CO₂e/kWh`
      : 'Country-specific Grid EF';

    /* last month with data */
    const lastMonth = Math.max(...filtered.map(e => e.month), 0);

    return { s1Total, s2Total, grandTotal, s1ByCat, monthly, factoryBreakdown, totalKWh, efLabel, lastMonth, relevantFactories };
  }, [emissions, factories, selectedFactory, selectedYear, useCommonEF]);

  const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');
  const fmtDec = (n: number) => n.toFixed(1);

  const currentFactory = factories.find(f => f.id === selectedFactory);
  const title = selectedFactory === 'ALL'
    ? 'Intersnack Group — All Factories'
    : `${currentFactory?.name || ''} Factory — ${currentFactory?.location || ''}`;
  const subtitle = selectedFactory === 'ALL'
    ? `4 Plants (3 Vietnam 🇻🇳 + 1 India 🇮🇳)`
    : `${currentFactory?.country === 'India' ? '🇮🇳 India' : '🇻🇳 Vietnam'}`;

  if (loading) {
    return (
      <div className="overview-slide">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
          <div className="loading-spinner" />
          <span style={{ color: '#999' }}>Loading data…</span>
        </div>
      </div>
    );
  }

  const s1Pct = data.grandTotal > 0 ? (data.s1Total / data.grandTotal * 100) : 0;
  const s2Pct = data.grandTotal > 0 ? (data.s2Total / data.grandTotal * 100) : 0;
  const maxMonthly = Math.max(...data.monthly.map(m => m.total), 1);
  const monthsWithData = data.monthly.filter(m => m.total > 0).length;

  return (
    <div className="overview-wrapper">
      {/* ── Controls (outside the slide) ── */}
      <div className="overview-controls">
        <select value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)} className="overview-select">
          <option value="ALL">🏭 Tất cả nhà máy (All Factories)</option>
          {factories.map(f => (
            <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name} — {f.location}</option>
          ))}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="overview-select">
          {[2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button
          className={`overview-ef-toggle ${useCommonEF ? 'common' : 'individual'}`}
          onClick={() => setUseCommonEF(!useCommonEF)}
        >
          {useCommonEF ? '🔗 Common EF (0.8041)' : '🏭 Individual Grid EF'}
        </button>
        <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
          {useCommonEF ? '⬅ Click to switch to country-specific EF for official reports' : '⬅ Click to switch to common EF for comparison'}
        </span>
      </div>

      {/* ── Slide 16:9 ── */}
      <div className="overview-slide">
        {/* Top bar */}
        <div className="ov-topbar">
          <div className="ov-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E32314" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span>INTERSNACK GROUP</span>
          </div>
          <div className="ov-topbar-title">GHG Emissions Overview — {selectedYear} YTD ({monthsWithData} months)</div>
          <div className="ov-ef-badge">
            {useCommonEF ? `⚡ EF = ${COMMON_EF}` : '⚡ Country Grid EF'} kg CO₂e/kWh
          </div>
        </div>

        {/* Main content row */}
        <div className="ov-body">
          {/* Left: KPI + Scope breakdown */}
          <div className="ov-left">
            <div className="ov-title-block">
              <div className="ov-plant-title">{title}</div>
              <div className="ov-plant-sub">{subtitle}</div>
            </div>

            {/* Grand total KPI */}
            <div className="ov-grand-kpi">
              <div className="ov-grand-value">{fmt(data.grandTotal)}</div>
              <div className="ov-grand-unit">tCO₂e</div>
              <div className="ov-grand-label">Total Scope 1 + 2 ({selectedYear})</div>
            </div>

            {/* Scope 1 + 2 cards */}
            <div className="ov-scope-row">
              <div className="ov-scope-card s1">
                <div className="ov-scope-header">
                  <span className="ov-scope-icon">🔥</span>
                  <span>SCOPE 1 — Direct</span>
                </div>
                <div className="ov-scope-value">{fmt(data.s1Total)}</div>
                <div className="ov-scope-sub">tCO₂e · {fmtDec(s1Pct)}%</div>
                <div className="ov-scope-bar"><div style={{ width: `${s1Pct}%`, background: '#E32314' }} /></div>
              </div>
              <div className="ov-scope-card s2">
                <div className="ov-scope-header">
                  <span className="ov-scope-icon">⚡</span>
                  <span>SCOPE 2 — Electricity</span>
                </div>
                <div className="ov-scope-value">{fmt(data.s2Total)}</div>
                <div className="ov-scope-sub">tCO₂e · {fmtDec(s2Pct)}%</div>
                <div className="ov-scope-bar"><div style={{ width: `${s2Pct}%`, background: '#F5A623' }} /></div>
              </div>
            </div>

            {/* Electricity detail */}
            <div className="ov-elec-detail">
              <div className="ov-elec-item">
                <span className="ov-elec-label">Total Consumption</span>
                <span className="ov-elec-val">{(data.totalKWh / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} MWh</span>
              </div>
              <div className="ov-elec-item">
                <span className="ov-elec-label">Emission Factor</span>
                <span className="ov-elec-val">{useCommonEF ? COMMON_EF : 'Country-specific'} kg CO₂e/kWh</span>
              </div>
            </div>
          </div>

          {/* Right: Chart + Factory table */}
          <div className="ov-right">
            {/* Monthly stacked bar chart */}
            <div className="ov-chart-title">Monthly Emissions (tCO₂e)</div>
            <div className="ov-chart">
              <svg viewBox={`0 0 540 160`} width="100%" height="160">
                {data.monthly.map((m, i) => {
                  const barW = 32;
                  const gap = (540 - 12 * barW) / 13;
                  const x = gap + i * (barW + gap);
                  const s1H = maxMonthly > 0 ? (m.s1 / maxMonthly) * 120 : 0;
                  const s2H = maxMonthly > 0 ? (m.s2 / maxMonthly) * 120 : 0;
                  const totalH = s1H + s2H;
                  return (
                    <g key={i}>
                      <rect x={x} y={130 - totalH} width={barW} height={s2H} rx={2} fill="#F5A623" opacity={0.85} />
                      <rect x={x} y={130 - s1H} width={barW} height={s1H} rx={s2H === 0 ? 2 : 0} fill="#E32314" opacity={0.85} />
                      {m.total > 0 && (
                        <text x={x + barW / 2} y={125 - totalH} textAnchor="middle" fontSize="7.5" fill="#333" fontWeight="600">
                          {Math.round(m.total)}
                        </text>
                      )}
                      <text x={x + barW / 2} y={148} textAnchor="middle" fontSize="8" fill="#999">{MONTHS_VI[i]}</text>
                    </g>
                  );
                })}
                {/* Y-axis guides */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <g key={`g-${i}`}>
                    <line x1={0} y1={130 - pct * 120} x2={540} y2={130 - pct * 120} stroke="#eee" strokeWidth={0.5} />
                    <text x={-2} y={133 - pct * 120} textAnchor="end" fontSize="7" fill="#bbb">{Math.round(maxMonthly * pct)}</text>
                  </g>
                ))}
              </svg>
              <div className="ov-chart-legend">
                <span><span className="ov-legend-dot" style={{ background: '#E32314' }} /> Scope 1</span>
                <span><span className="ov-legend-dot" style={{ background: '#F5A623' }} /> Scope 2</span>
              </div>
            </div>

            {/* Factory comparison table */}
            {data.factoryBreakdown.length > 1 && (
              <div className="ov-factory-table">
                <div className="ov-table-title">Factory Comparison</div>
                <table>
                  <thead>
                    <tr>
                      <th>Plant</th>
                      <th style={{ textAlign: 'right' }}>Scope 1</th>
                      <th style={{ textAlign: 'right' }}>Scope 2</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>MWh</th>
                      <th style={{ width: '100px' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.factoryBreakdown.map(fb => (
                      <tr key={fb.factory.id}>
                        <td>
                          <span className="ov-flag">{fb.factory.country === 'India' ? '🇮🇳' : '🇻🇳'}</span>
                          {fb.factory.name}
                        </td>
                        <td style={{ textAlign: 'right', color: '#E32314', fontWeight: 600 }}>{fmt(fb.s1)}</td>
                        <td style={{ textAlign: 'right', color: '#F5A623', fontWeight: 600 }}>{fmt(fb.s2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(fb.total)}</td>
                        <td style={{ textAlign: 'right', color: '#888' }}>{(fb.kWh / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
                        <td>
                          <div className="ov-share-bar">
                            <div style={{ width: `${data.grandTotal > 0 ? (fb.total / data.grandTotal * 100) : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Single factory Scope 1 breakdown */}
            {data.factoryBreakdown.length === 1 && (
              <div className="ov-factory-table">
                <div className="ov-table-title">Scope 1 Breakdown — {data.factoryBreakdown[0].factory.name}</div>
                <table>
                  <thead>
                    <tr><th>Source</th><th style={{ textAlign: 'right' }}>tCO₂e</th><th style={{ width: '120px' }}>Share</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.s1ByCat).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([cat, val]) => {
                      const def = SCOPE_1_CATEGORIES.find(c => c.key === cat);
                      return (
                        <tr key={cat}>
                          <td>{def?.icon} {def?.label || cat}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(val)}</td>
                          <td>
                            <div className="ov-share-bar s1">
                              <div style={{ width: `${data.s1Total > 0 ? (val / data.s1Total * 100) : 0}%` }} />
                            </div>
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
          <span>SBTi Near-term Targets Approved</span>
          <span>EF: {data.efLabel}</span>
        </div>
      </div>
    </div>
  );
}
