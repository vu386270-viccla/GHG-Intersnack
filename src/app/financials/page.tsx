'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────
interface Row {
  factory_id: string;
  year: number;
  month: number;
  category: string;
  cost_usd: number | null;
  activity_data: number;
  emissions_tco2e: number;
  notes?: string;
}

interface RCN {
  factory_id: string;
  year: number;
  quantity: number;
}

interface Factory {
  id: string;
  name: string;
  code: string;
  country: string;
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (n: number, d = 0) =>
  n != null && !isNaN(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
    : 'N/A';

const $$ = (v: number) => (v > 0 ? '$' + fmt(v, 0) : v === 0 ? '$0' : '-');

// Palette indexed by load order — works regardless of factory name/code
const FAC_PALETTE = ['#C8281A', '#E8960E', '#3E7B3E', '#4A90E2', '#8B5CF6', '#14B8A6'];
let _facColorMap: Record<string, string> = {};
function getFacColor(factories: Factory[], id: string): string {
  if (Object.keys(_facColorMap).length !== factories.length) {
    _facColorMap = Object.fromEntries(
      factories.map((f, i) => [f.id, FAC_PALETTE[i % FAC_PALETTE.length]])
    );
  }
  return _facColorMap[id] || '#999';
}

// ── SVG Line Chart ────────────────────────────────────────────────
function LineChart({ data, years, lines, title, yUnit }: {
  data: Record<number, any>;
  years: number[];
  lines: { key: string; label: string; color: string }[];
  title: string;
  yUnit?: string;
}) {
  const W = 580, H = 240;
  const PT = 30, PB = 44, PL = 62, PR = 20;
  const cw = W - PL - PR, ch = H - PT - PB;

  let globalMax = 0;
  for (const l of lines) {
    for (const y of years) {
      if ((data[y]?.[l.key] ?? 0) > globalMax) globalMax = data[y][l.key];
    }
  }
  const yMax = Math.ceil((globalMax || 100) / 10) * 10 * 1.15;

  const getX = (i: number) => PL + (cw / Math.max(1, years.length - 1)) * i;
  const getY = (v: number) => PT + ch - (v / yMax) * ch;

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 20px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto">
        {/* Y-axis grid + labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const val = yMax * pct;
          const yy = getY(val);
          return (
            <g key={pct}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#f0f0f0" strokeWidth="1" />
              <text x={PL - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#aaa">
                {val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val.toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* Y unit label */}
        {yUnit && (
          <text x={PL - 6} y={PT - 10} textAnchor="end" fontSize="9" fill="#bbb">{yUnit}</text>
        )}
        {/* Bottom axis */}
        <line x1={PL} y1={PT + ch} x2={W - PR} y2={PT + ch} stroke="#ddd" strokeWidth="1.5" />

        {/* X-axis labels */}
        {years.map((y, i) => (
          <text key={y} x={getX(i)} y={PT + ch + 18} textAnchor="middle" fontSize="11" fill="#666" fontWeight="600">{y}</text>
        ))}

        {/* Lines + dots */}
        {lines.map(l => {
          const pts = years.map((y, i) => {
            const v = data[y]?.[l.key];
            return v != null ? `${getX(i)},${getY(v)}` : '';
          }).filter(Boolean);
          if (pts.length === 0) return null;
          return (
            <g key={l.key}>
              <polyline points={pts.join(' ')} fill="none" stroke={l.color} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" className="chart-line-draw" />
              {years.map((y, i) => {
                const v = data[y]?.[l.key];
                if (v == null) return null;
                return <circle key={i} cx={getX(i)} cy={getY(v)} r="3.5" fill="#fff" stroke={l.color} strokeWidth="2" />;
              })}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
        {lines.map(l => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
            <div style={{ width: '10px', height: '10px', background: l.color, borderRadius: '50%' }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scatter Plot ──────────────────────────────────────────────────
function ScatterPlot({ rows, title }: { rows: Row[]; title: string }) {
  const W = 580, H = 240;
  const PT = 30, PB = 44, PL = 58, PR = 20;
  const cw = W - PL - PR, ch = H - PT - PB;

  const valid = rows.filter(r => r.emissions_tco2e > 0 && (r.cost_usd ?? 0) > 0);
  const maxX = (Math.max(...valid.map(r => r.emissions_tco2e), 1)) * 1.1;
  const maxY = (Math.max(...valid.map(r => r.cost_usd!), 1)) * 1.1;

  const getX = (v: number) => PL + (v / maxX) * cw;
  const getY = (v: number) => PT + ch - (v / maxY) * ch;

  const cats = [...new Set(valid.map(r => r.category))];
  const colors = ['#E8960E', '#4A90E2', '#3E7B3E', '#C8281A', '#8B5CF6', '#14B8A6'];

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 20px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#333' }}>{title}</h3>
      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#999' }}>
        Mỗi điểm = 1 nguồn nhiên liệu/tháng của 1 nhà máy
      </p>
      {valid.length === 0 ? (
        <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: '13px' }}>
          Chưa có dữ liệu chi phí cho năm này
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto">
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const valY = maxY * pct;
            const yy = getY(valY);
            return (
              <g key={'y' + pct}>
                <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#f0f0f0" strokeWidth="1" />
                <text x={PL - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#aaa">
                  {valY >= 1000 ? '$' + (valY / 1000).toFixed(0) + 'k' : '$' + valY.toFixed(0)}
                </text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const valX = maxX * pct;
            const xx = getX(valX);
            return (
              <g key={'x' + pct}>
                <line x1={xx} y1={PT} x2={xx} y2={PT + ch} stroke="#f5f5f5" strokeWidth="1" />
                <text x={xx} y={PT + ch + 15} textAnchor="middle" fontSize="10" fill="#aaa">
                  {fmt(valX)}
                </text>
              </g>
            );
          })}
          <line x1={PL} y1={PT + ch} x2={W - PR} y2={PT + ch} stroke="#ddd" strokeWidth="1.5" />
          <line x1={PL} y1={PT} x2={PL} y2={PT + ch} stroke="#ddd" strokeWidth="1.5" />
          <text x={W - PR + 8} y={PT + ch + 4} textAnchor="start" fontSize="9" fill="#ccc">tCO₂e →</text>
          <text x={PL} y={PT - 12} textAnchor="middle" fontSize="9" fill="#ccc">↑ USD</text>

          {valid.map((r, i) => {
            const col = colors[cats.indexOf(r.category) % colors.length];
            return (
              <circle key={i} cx={getX(r.emissions_tco2e)} cy={getY(r.cost_usd!)} r="4"
                fill={col} opacity={0.7} stroke="#fff" strokeWidth="1">
                <title>{r.category} | {fmt(r.emissions_tco2e, 1)} tCO₂e | {$$(r.cost_usd!)}</title>
              </circle>
            );
          })}
        </svg>
      )}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
        {cats.map((c, i) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#555' }}>
            <div style={{ width: '9px', height: '9px', background: colors[i % colors.length], borderRadius: '50%', opacity: 0.8 }} />
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function FinancialsPage() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{ emissions: Row[]; rcn: RCN[]; factories: Factory[] } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const fetchPaged = async (table: string, query: string, chain?: (q: any) => any) => {
        let all: any[] = [];
        let from = 0;
        const PAGE = 1000;
        while (true) {
          let q = supabase.from(table).select(query).range(from, from + PAGE - 1);
          if (chain) q = chain(q);
          const { data } = await q;
          all = all.concat(data || []);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };

      const [facRes, emsAll, rcnAll] = await Promise.all([
        supabase.from('factories').select('id, name, code, country'),
        fetchPaged('emissions_data', 'id,factory_id,year,month,category,cost_usd,activity_data,emissions_tco2e,notes', q => q.gte('year', 2018)),
        fetchPaged('production_data', 'id,factory_id,year,quantity,category', q => q.eq('category', 'rcn_input').gte('year', 2018)),
      ]);

      const factories: Factory[] = facRes.data || [];
      const emissions: Row[] = emsAll;
      const rcn: RCN[] = rcnAll;

      const years = [...new Set(emissions.map(r => r.year))].sort();
      const defaultYear = years.includes(new Date().getFullYear()) ? new Date().getFullYear() : years[years.length - 1];
      setSelectedYear(defaultYear || null);
      setRawData({ factories, emissions, rcn });
      setLoading(false);
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    if (!rawData || !selectedYear) return null;
    const { emissions, rcn, factories } = rawData;

    const years = [...new Set(emissions.map(r => r.year))].sort() as number[];
    const withCost = emissions.filter(r => (r.cost_usd ?? 0) > 0);
    const coveragePct = emissions.length > 0 ? Math.round(withCost.length / emissions.length * 100) : 0;

    // Aggregation dicts
    const costY: Record<number, number> = {};
    const costYF: Record<string, number> = {};
    const rcnYF: Record<string, number> = {};
    const co2YF: Record<string, number> = {};

    for (const r of withCost) {
      costY[r.year] = (costY[r.year] || 0) + r.cost_usd!;
      const k = `${r.year}|${r.factory_id}`;
      costYF[k] = (costYF[k] || 0) + r.cost_usd!;
    }
    for (const r of emissions) {
      const k = `${r.year}|${r.factory_id}`;
      co2YF[k] = (co2YF[k] || 0) + (r.emissions_tco2e || 0);
    }
    for (const r of rcn) {
      const k = `${r.year}|${r.factory_id}`;
      rcnYF[k] = (rcnYF[k] || 0) + r.quantity;
    }

    // Efficiency trend chart ($/tRCN per factory per year)
    const effChartData: Record<number, any> = {};
    for (const y of years) {
      effChartData[y] = {};
      for (const f of factories) {
        const k = `${y}|${f.id}`;
        const c = costYF[k] || 0;
        const r = rcnYF[k] || 0;
        if (r > 0) effChartData[y][f.name] = parseFloat((c / r).toFixed(2));
      }
    }

    // Ranking for selected year
    const ranking = factories.map(f => {
      const k = `${selectedYear}|${f.id}`;
      const c = costYF[k] || 0;
      const r = rcnYF[k] || 0;
      const co2 = co2YF[k] || 0;
      return {
        id: f.id,
        name: f.name,
        code: f.code,
        cost: c,
        rcn: r,
        co2,
        eff: r > 0 ? c / r : 0,
        carb: co2 > 0 ? c / co2 : 0,
      };
    }).sort((a, b) => b.eff - a.eff);

    const latestYear = years[years.length - 1] || selectedYear;
    const prevYear = latestYear - 1;
    const ytdCost = costY[latestYear] || 0;
    const prevYtdCost = costY[prevYear] || 0;
    const yoyPct = prevYtdCost > 0 ? (ytdCost - prevYtdCost) / prevYtdCost * 100 : null;

    const totalCo2ForYear = ranking.reduce((s, r) => s + r.co2, 0);
    const totalCostForYear = ranking.reduce((s, r) => s + r.cost, 0);

    return {
      years, costY, effChartData, ranking,
      coveragePct, withCostCount: withCost.length, totalCount: emissions.length,
      latestYear, ytdCost, yoyPct, totalCo2ForYear, totalCostForYear,
    };
  }, [rawData, selectedYear]);

  if (loading || !metrics || !rawData) {
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#222' }}>Financials — Chi phí & Carbon</h1>
        <div className="loading-spinner" style={{ alignSelf: 'center', marginTop: '60px' }} />
      </div>
    );
  }

  const facLines = rawData.factories.map(f => ({
    key: f.name,
    label: f.name,
    color: getFacColor(rawData.factories, f.id),
  }));

  const ratingLabel = (eff: number) => {
    if (eff <= 0) return { text: 'Chưa có dữ liệu', bg: '#f5f5f5', fg: '#aaa' };
    if (eff > 35) return { text: 'Chi phí cao', bg: '#fee2e2', fg: '#991b1b' };
    if (eff > 25) return { text: 'Trung bình', bg: '#fef3c7', fg: '#92400e' };
    return { text: 'Hiệu quả', bg: '#dcfce7', fg: '#166534' };
  };

  return (
    <div className="page-enter" style={{ padding: '28px 32px', maxWidth: '1240px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
            Phân tích Tài chính
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
            Chi phí năng lượng · Hiệu suất USD/tRCN · Rủi ro thuế carbon
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Cost data coverage badge */}
          <div style={{
            background: metrics.coveragePct >= 80 ? '#f0fdf4' : metrics.coveragePct >= 40 ? '#fffbeb' : '#fef2f2',
            border: `1px solid ${metrics.coveragePct >= 80 ? '#bbf7d0' : metrics.coveragePct >= 40 ? '#fde68a' : '#fecaca'}`,
            color: metrics.coveragePct >= 80 ? '#166534' : metrics.coveragePct >= 40 ? '#92400e' : '#991b1b',
            padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span>{metrics.coveragePct >= 80 ? '✅' : metrics.coveragePct >= 40 ? '⚠️' : '❌'}</span>
            Dữ liệu chi phí: {metrics.coveragePct}% ({metrics.withCostCount}/{metrics.totalCount} records)
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>

        {/* Card 1: Total energy cost */}
        <div className="animate-fade-in-up" style={{ background: '#fff', padding: '22px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #111' }}>
          <div style={{ color: '#888', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Tổng chi phí Năng lượng ({metrics.latestYear})
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#111', letterSpacing: '-0.8px' }}>
            {metrics.ytdCost > 1_000_000
              ? `$${(metrics.ytdCost / 1_000_000).toFixed(2)}M`
              : $$(metrics.ytdCost)}
          </div>
          {metrics.yoyPct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '12px' }}>
              <span style={{
                color: metrics.yoyPct > 0 ? '#991b1b' : '#166534',
                background: metrics.yoyPct > 0 ? '#fee2e2' : '#dcfce7',
                padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
              }}>
                {metrics.yoyPct > 0 ? '▲' : '▼'} {Math.abs(metrics.yoyPct).toFixed(1)}%
              </span>
              <span style={{ color: '#aaa' }}>so với {metrics.latestYear - 1}</span>
            </div>
          )}
        </div>

        {/* Card 2: Carbon liability */}
        <div className="animate-fade-in-up" style={{ background: '#fff', padding: '22px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #3E7B3E' }}>
          <div style={{ color: '#888', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Nợ thuế carbon ước tính ({selectedYear})
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#111', letterSpacing: '-0.8px' }}>
            {$$(metrics.totalCo2ForYear * 25)}
          </div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#aaa', lineHeight: 1.5 }}>
            {fmt(metrics.totalCo2ForYear, 0)} tCO₂e × $25/t
            <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#166534', borderRadius: '4px', padding: '1px 6px', marginLeft: '6px', fontWeight: 600 }}>
              @EU ETS ref.
            </span>
          </div>
        </div>

        {/* Card 3: Worst performer */}
        <div className="animate-fade-in-up" style={{ background: '#fff', padding: '22px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderLeft: '4px solid #C8281A' }}>
          <div style={{ color: '#888', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Hiệu suất kém nhất ({selectedYear})
          </div>
          {metrics.ranking[0]?.eff > 0 ? (
            <>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#111', letterSpacing: '-0.3px' }}>
                {metrics.ranking[0]?.name}
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '20px', fontWeight: 800, color: '#C8281A',
                  background: '#fee2e2', padding: '3px 12px', borderRadius: '6px',
                }}>
                  ${metrics.ranking[0]?.eff.toFixed(1)}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#C8281A', marginLeft: '4px' }}>/tRCN</span>
                </span>
                <span style={{ fontSize: '12px', color: '#aaa' }}>(đắt nhất)</span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '15px', color: '#ccc', marginTop: '10px' }}>Chưa có dữ liệu</div>
          )}
        </div>
      </div>

      {/* ── CHARTS ── */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <LineChart
          title="Hiệu suất chi phí theo nhà máy ($/tRCN)"
          data={metrics.effChartData}
          years={metrics.years}
          lines={facLines}
          yUnit="$/tRCN"
        />
        <ScatterPlot
          title={`Tương quan Chi phí vs Phát thải (${selectedYear})`}
          rows={rawData.emissions.filter(e => e.year === selectedYear)}
        />
      </div>

      {/* ── RANKING TABLE ── */}
      <div className="animate-fade-in-up" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Table header bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#222' }}>
            Bảng xếp hạng Hiệu quả Tài chính
          </h3>

          {/* Year selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>Năm:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {metrics.years.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  style={{
                    padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: selectedYear === y ? '#111' : '#f0f0f0',
                    color: selectedYear === y ? '#fff' : '#666',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#fff', borderBottom: '1.5px solid #f0f0f0' }}>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#aaa', textAlign: 'left', width: '40px' }}>#</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'left' }}>Nhà máy</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'right' }}>Tổng Chi phí</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'right' }}>Sản lượng (tRCN)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'right' }}>Phát thải (tCO₂e)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'right' }}>USD/tRCN</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#aaa', textAlign: 'right' }}>USD/tCO₂e</th>
              <th style={{ padding: '12px 20px', fontWeight: 600, color: '#aaa', textAlign: 'center' }}>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {metrics.ranking.map((r, i) => {
              const rating = ratingLabel(r.eff);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f8f8f8', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Rank */}
                  <td style={{ padding: '14px 20px', color: i === 0 ? '#C8281A' : '#ccc', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}>
                    {i + 1}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getFacColor(rawData.factories, r.id), flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#111', fontSize: '13px' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: '#bbb' }}>{r.code}</div>
                      </div>
                    </div>
                  </td>
                  {/* Cost */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#333', fontSize: '13px' }}>
                    {r.cost > 0 ? $$(r.cost) : <span style={{ color: '#ddd' }}>—</span>}
                  </td>
                  {/* RCN */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#555' }}>
                    {r.rcn > 0 ? fmt(r.rcn) : <span style={{ color: '#ddd' }}>—</span>}
                  </td>
                  {/* CO2 */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#555' }}>
                    {r.co2 > 0 ? fmt(r.co2, 0) : <span style={{ color: '#ddd' }}>—</span>}
                  </td>
                  {/* USD/tRCN */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px',
                    color: r.eff > 35 ? '#C8281A' : r.eff > 25 ? '#d97706' : r.eff > 0 ? '#3E7B3E' : '#ddd' }}>
                    {r.eff > 0 ? `$${r.eff.toFixed(1)}` : '—'}
                  </td>
                  {/* USD/tCO2e */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#888', fontSize: '13px' }}>
                    {r.carb > 0 ? `$${r.carb.toFixed(1)}` : <span style={{ color: '#ddd' }}>—</span>}
                  </td>
                  {/* Rating */}
                  <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                      background: rating.bg, color: rating.fg,
                    }}>
                      {rating.text}
                    </span>
                  </td>
                </tr>
              );
            })}
            {metrics.ranking.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>
                  Không có dữ liệu cho năm {selectedYear}
                </td>
              </tr>
            )}
          </tbody>
          {/* Footer totals */}
          {metrics.ranking.some(r => r.cost > 0) && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #f0f0f0', background: '#fafafa' }}>
                <td colSpan={2} style={{ padding: '12px 20px', fontWeight: 700, color: '#555', fontSize: '12px' }}>
                  TỔNG ({selectedYear})
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
                  {metrics.totalCostForYear > 1_000_000
                    ? `$${(metrics.totalCostForYear / 1_000_000).toFixed(2)}M`
                    : $$(metrics.totalCostForYear)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#555', fontWeight: 600 }}>
                  {fmt(metrics.ranking.reduce((s, r) => s + r.rcn, 0))}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#555', fontWeight: 600 }}>
                  {fmt(metrics.totalCo2ForYear, 0)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
