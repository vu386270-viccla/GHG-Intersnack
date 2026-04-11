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
const fmt = (n: number, d=0) => n != null && !isNaN(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'N/A';
const $$ = (v: number) => v > 0 ? '$' + fmt(v, 0) : '-';

const FAC_COLORS: Record<string, string> = {
  'Phan Thiet': '#3E7B3E',  // Green
  'Tay Ninh': '#C8281A',    // Red
  'Long An': '#E8960E',     // Orange
  'Tuticorin': '#4A90E2',   // Blue
};

// SVG Line Chart Component
function LineChart({ data, years, lines, title }: any) {
  const W = 600, H = 250;
  const PT = 30, PB = 40, PL = 50, PR = 20;
  const cw = W - PL - PR, ch = H - PT - PB;

  // Find overall max
  let globalMax = 0;
  for (const l of lines) {
    for (const y of years) {
      if (data[y]?.[l.key] > globalMax) globalMax = data[y][l.key];
    }
  }
  const yMax = Math.ceil((globalMax || 100) / 10) * 10 * 1.1; // Add 10% headroom

  const getX = (i: number) => PL + (cw / Math.max(1, years.length - 1)) * i;
  const getY = (v: number) => PT + ch - (v / yMax) * ch;

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#222' }}>{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto">
        {/* Y-axis grids */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const val = yMax * pct;
          const yy = getY(val);
          return (
            <g key={pct}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eee" strokeWidth="1" />
              <text x={PL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#888">${fmt(val)}</text>
            </g>
          );
        })}
        {/* Bottom axis line */}
        <line x1={PL} y1={PT + ch} x2={W - PR} y2={PT + ch} stroke="#ccc" strokeWidth="1.5" />

        {/* X-axis labels */}
        {years.map((y: any, i: number) => (
          <text key={y} x={getX(i)} y={PT + ch + 20} textAnchor="middle" fontSize="11" fill="#666" fontWeight="600">{y}</text>
        ))}

        {/* Lines */}
        {lines.map((l: any) => {
          const pts = years.map((y: any, i: number) => {
            const v = data[y]?.[l.key];
            return v != null ? `${getX(i)},${getY(v)}` : '';
          }).filter(Boolean);
          
          if (pts.length === 0) return null;

          return (
            <g key={l.key}>
              <polyline points={pts.join(' ')} fill="none" stroke={l.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {years.map((y: any, i: number) => {
                const v = data[y]?.[l.key];
                if (v == null) return null;
                return (
                  <circle key={i} cx={getX(i)} cy={getY(v)} r="4" fill="#fff" stroke={l.color} strokeWidth="2" />
                );
              })}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '10px' }}>
        {lines.map((l: any) => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#555' }}>
            <div style={{ width: '12px', height: '12px', background: l.color, borderRadius: '50%' }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Scatter Plot Component
function ScatterPlot({ rows, title }: any) {
  const W = 600, H = 250;
  const PT = 30, PB = 40, PL = 55, PR = 20;
  const cw = W - PL - PR, ch = H - PT - PB;

  const valid = rows.filter((r: any) => r.emissions_tco2e > 0 && r.cost_usd > 0);
  const maxX = Math.max(...valid.map((r: any) => r.emissions_tco2e)) * 1.1 || 100;
  const maxY = Math.max(...valid.map((r: any) => r.cost_usd)) * 1.1 || 100;

  const getX = (v: number) => PL + (v / maxX) * cw;
  const getY = (v: number) => PT + ch - (v / maxY) * ch;

  const cats = [...new Set(valid.map((r: any) => r.category))];
  const colors = ['#E8960E', '#4A90E2', '#3E7B3E', '#C8281A', '#8B5CF6'];

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#222' }}>{title}</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#666' }}>Mỗi điểm là 1 nguồn nhiên liệu/tháng của 1 nhà máy.</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto">
        {/* Grids */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const valY = maxY * pct;
          const yy = getY(valY);
          return (
            <g key={'y'+pct}>
              <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eee" strokeWidth="1" />
              <text x={PL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#888">{valY >= 1000 ? '$'+(valY/1000).toFixed(0)+'k' : $$(valY)}</text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const valX = maxX * pct;
          const xx = getX(valX);
          return (
            <g key={'x'+pct}>
               <line x1={xx} y1={PT} x2={xx} y2={PT + ch} stroke="#f5f5f5" strokeWidth="1" />
               <text x={xx} y={PT + ch + 15} textAnchor="middle" fontSize="10" fill="#888">{fmt(valX)} t</text>
            </g>
          );
        })}
        
        <line x1={PL} y1={PT + ch} x2={W - PR} y2={PT + ch} stroke="#ccc" strokeWidth="1.5" />
        <line x1={PL} y1={PT} x2={PL} y2={PT + ch} stroke="#ccc" strokeWidth="1.5" />
        {/* Axis labels */}
        <text x={W - PR + 10} y={PT + ch + 4} textAnchor="start" fontSize="10" fill="#bbb">tCO₂e</text>
        <text x={PL} y={PT - 10} textAnchor="middle" fontSize="10" fill="#bbb">USD</text>

        {/* Dots */}
        {valid.map((r: any, i: number) => {
          const cx = getX(r.emissions_tco2e);
          const cy = getY(r.cost_usd);
          const cIdx = cats.indexOf(r.category);
          const col = colors[cIdx % colors.length];
          return (
            <circle key={i} cx={cx} cy={cy} r="4.5" fill={col} opacity={0.65} stroke="#fff" strokeWidth="1">
              <title>{r.category} | Phát thải: {fmt(r.emissions_tco2e)} | Chi phí: {$$(r.cost_usd)}</title>
            </circle>
          )
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
        {cats.map((c: any, i) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#555' }}>
             <div style={{ width: '10px', height: '10px', background: colors[i % colors.length], borderRadius: '50%', opacity: 0.8 }} />
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
  const [data, setData] = useState<{ emissions: Row[], rcn: RCN[], factories: Factory[] } | null>(null);

  useEffect(() => {
    async function load() {
      // Setup paginated fetchers
      const fetchPaged = async (table: string, query: string, extraChain?: (q: any) => any) => {
        let all: any[] = [];
        let from = 0;
        const PAGE = 1000;
        while (true) {
          let q = supabase.from(table).select(query).range(from, from + PAGE - 1);
          if (extraChain) q = extraChain(q);
          const { data } = await q;
          all = all.concat(data || []);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };

      const [facRes, emsAll, rcnAll] = await Promise.all([
        supabase.from('factories').select('id, name, code, country'),
        fetchPaged('emissions_data', 'id,factory_id,year,month,category,cost_usd,activity_data,emissions_tco2e,notes', q => q.gte('year', 2021)),
        fetchPaged('production_data', 'id,factory_id,year,quantity,category', q => q.eq('category', 'rcn_input').gte('year', 2021)),
      ]);

      setData({
        factories: facRes.data || [],
        emissions: emsAll,
        rcn: rcnAll
      });
      setLoading(false);
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    if (!data) return null;
    const { emissions, rcn, factories } = data;
    
    // Process dictionaries
    const facName = (id: string) => factories.find(f => f.id === id)?.name || 'Unknown';
    const years = [...new Set(emissions.map(r => r.year))].sort();
    
    // Only rows with cost
    const withCost = emissions.filter(r => (r.cost_usd ?? 0) > 0);
    const imputedCount = emissions.filter(r => r.notes?.includes('imputed')).length;

    // Aggregators
    const costY  = {} as Record<number, number>;
    const costYF = {} as Record<string, number>;
    const rcnYF  = {} as Record<string, number>;
    const co2YF  = {} as Record<string, number>;

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

    // Efficiency data for line chart
    const effChartData = {} as Record<number, any>;
    for (const y of years) {
      effChartData[y] = {};
      for (const f of factories) {
        const k = `${y}|${f.id}`;
        const c = costYF[k] || 0;
        const r = rcnYF[k] || 0;
        if (r > 0) effChartData[y][f.name] = parseFloat((c / r).toFixed(2));
      }
    }

    // Factory Ranking (Target year: 2024 or max available)
    const targetYr = years.includes(2024) ? 2024 : years[years.length - 1];
    const ranking = factories.map(f => {
      const k = `${targetYr}|${f.id}`;
      const c = costYF[k] || 0;
      const r = rcnYF[k] || 0;
      const co2 = co2YF[k] || 0;
      return {
        id: f.id,
        name: f.name,
        cost: c,
        rcn: r,
        eff: r > 0 ? c / r : 0,
        carb: co2 > 0 ? c / co2 : 0,
      };
    }).sort((a,b) => b.eff - a.eff); // Sort highest cost per ton first

    const latestYear = years[years.length - 1] || 2024;
    const prevYear = latestYear - 1;
    const ytdCost = costY[latestYear] || 0;
    const prevYtdCost = costY[prevYear] || 0;
    const yoyPct = prevYtdCost > 0 ? (ytdCost - prevYtdCost) / prevYtdCost * 100 : 0;

    return { years, costY, effChartData, ranking, imputedCount, latestYear, ytdCost, yoyPct, targetYr };
  }, [data]);

  if (loading || !metrics) {
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#222' }}>Phân tích Chi phí (Financials)</h1>
        <div className="loading-spinner" style={{ alignSelf: 'center', marginTop: '60px' }} />
      </div>
    );
  }

  const lines = data?.factories.map(f => ({
    key: f.name,
    label: f.name,
    color: FAC_COLORS[f.name] || '#333'
  })) || [];

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--font-sans)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Phân tích Chi phí (OpEx)
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Toàn cảnh chi phí năng lượng và hiệu suất USD/tRCN.
          </p>
        </div>
        
        {metrics.imputedCount > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>Data Warning: {metrics.imputedCount} records auto-infilled</span>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '30px' }}>
        
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', borderTop: '4px solid #111' }}>
          <div style={{ color: '#666', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
            Tổng chi phí Năng lượng ({metrics.latestYear})
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#111', letterSpacing: '-1px' }}>
            {metrics.ytdCost > 1000000 ? `$${(metrics.ytdCost/1000000).toFixed(2)}M` : $$(metrics.ytdCost)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '13px', fontWeight: 600 }}>
            <span style={{ color: metrics.yoyPct > 0 ? '#C8281A' : '#3E7B3E', background: metrics.yoyPct > 0 ? '#fee2e2' : '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
              {metrics.yoyPct > 0 ? '📈' : '📉'} {Math.abs(metrics.yoyPct).toFixed(1)}%
            </span>
            <span style={{ color: '#888' }}>so với năm trước</span>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', borderTop: '4px solid #3E7B3E' }}>
          <div style={{ color: '#666', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px' }}>
            Cường độ carbon Liability ({metrics.targetYr})
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#111', letterSpacing: '-1px' }}>
            <span style={{ fontSize: '20px', color: '#666', verticalAlign: 'middle', marginRight: '4px' }}>@$25/tCO2e: </span>
            {(() => {
              const carbTotal = metrics.ranking.reduce((s,r) => s + (r.cost / (r.carb || 1)), 0);
              return $$(carbTotal * 25);
            })()}
          </div>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#888', lineHeight: 1.4 }}>
            Dự kiến nợ thuế carbon hàng năm nếu áp dụng mức giá $25/tCO₂e cho Scope 1+2.
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)', padding: '24px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: '#fff' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '10px', opacity: 0.9 }}>
            Hiệu năng chi phí tệ nhất ({metrics.targetYr})
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px' }}>
            {metrics.ranking[0]?.name}
          </div>
          <div style={{ marginTop: '10px', fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: '6px' }}>
              ${metrics.ranking[0]?.eff.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 400 }}>/ tRCN</span>
            </span>
            <span style={{ opacity: 0.8 }}>(Đắt nhất)</span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '30px' }}>
        <LineChart 
          title="Xu hướng Chi phí trên mỗi tấn RCN (USD/tRCN)" 
          data={metrics.effChartData} 
          years={metrics.years} 
          lines={lines} 
        />
        <ScatterPlot 
          title={`Biểu đồ Tán xạ: Tương quan Chi phí vs Phát thải (${metrics.targetYr})`}
          rows={data?.emissions.filter(e => e.year === metrics.targetYr) || []} 
        />
      </div>

      {/* TABLE */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#222' }}>Bảng xếp hạng Hiệu quả Tài chính - {metrics.targetYr}</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#fff', color: '#888', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '16px 24px', fontWeight: 600 }}>Nhà máy (Factory)</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Tổng Chi phí (USD)</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Sản lượng (tRCN)</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>USD / tRCN</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>Đơn giá Carbon (USD/tCO2e)</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'center' }}>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {metrics.ranking.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={{ padding: '16px 24px', fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: FAC_COLORS[r.name] || '#ccc' }} />
                  {r.name}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right', color: '#555', fontFamily: 'monospace', fontSize: '15px' }}>{$$(r.cost)}</td>
                <td style={{ padding: '16px 24px', textAlign: 'right', color: '#555' }}>{fmt(r.rcn)}</td>
                <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: r.eff > 35 ? '#C8281A' : '#3E7B3E', fontSize: '15px' }}>
                  ${r.eff.toFixed(1)}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right', color: '#666' }}>
                  ${r.carb.toFixed(1)}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                    background: r.eff > 35 ? '#fee2e2' : r.eff > 25 ? '#fef3c7' : '#dcfce7',
                    color: r.eff > 35 ? '#991b1b' : r.eff > 25 ? '#92400e' : '#166534'
                  }}>
                    {r.eff > 35 ? 'HIGH RISK' : r.eff > 25 ? 'ACCEPTABLE' : 'OPTIMAL'}
                  </span>
                </td>
              </tr>
            ))}
            {metrics.ranking.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                  Không có dữ liệu cho năm {metrics.targetYr}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
