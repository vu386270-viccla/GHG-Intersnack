'use client';

import { useEffect, useState, useMemo } from 'react';
import { getScope3SummaryData } from '@/lib/data-service';
import type { Scope3YearRow } from '@/lib/data-service';

// SBTi targets
const FLAG_TARGET_PCT    = 36.4;   // vs 2021 baseline
const NONFLAG_TARGET_PCT = 30.0;   // vs 2021 baseline
const TARGET_YEAR        = 2032;
const BASE_YEAR          = 2021;

function fmt(n: number, decimals = 0) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(decimals > 0 ? decimals : 1) + 'K';
  return n.toLocaleString();
}

function pct(current: number, base: number): number {
  if (!base) return 0;
  return Math.round(((base - current) / base) * 1000) / 10;
}

interface ProgressBarProps {
  label: string;
  current: number;
  baseline: number;
  targetPct: number;
  color: string;
  sublabel: string;
}

function ProgressBlock({ label, current, baseline, targetPct, color, sublabel }: ProgressBarProps) {
  const achieved = pct(current, baseline);
  const progress = Math.max(0, Math.min(100, (achieved / targetPct) * 100));
  const onTrack  = achieved >= 0;
  const achColor = achieved < 0 ? '#e74c3c' : achieved >= targetPct ? '#2ecc71' : '#f39c12';

  return (
    <div className="card animate-fade-in-up" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{sublabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: achColor }}>
            {achieved > 0 ? '-' : '+'}{Math.abs(achieved)}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>vs 2021 baseline</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          <span>Progress toward -{targetPct}% target</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 10, background: 'var(--color-border-light)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 5, transition: 'width 1s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Target: {TARGET_YEAR}</span>
        </div>
      </div>

      {/* Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        {[
          { l: '2021 Baseline', v: baseline },
          { l: 'Current', v: current, highlight: true },
          { l: `2032 Target`, v: Math.round(baseline * (1 - targetPct / 100)) },
        ].map(({ l, v, highlight }) => (
          <div key={l} style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: highlight ? color : 'var(--color-text)' }}>{fmt(v)}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini stacked bar chart (SVG)
function StackedBarChart({ rows, baseline }: { rows: Scope3YearRow[]; baseline: Scope3YearRow | undefined }) {
  const W = 800, H = 220, PAD_L = 60, PAD_B = 36, PAD_T = 20, PAD_R = 20;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const maxVal = Math.max(...rows.map(r => r.total), 1);
  const cols = ['#2F855A', '#68B52A', '#A8D770'];
  const labels = ['Cat.1 Cashew (FLAG)', 'Cat.4 Transport', 'Cat.3 WTT'];

  const barW = Math.floor(chartW / rows.length * 0.55);
  const barGap = chartW / rows.length;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid */}
      {ticks.map(t => {
        const y = PAD_T + chartH - (t / maxVal) * chartH;
        return (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--color-border-light)" strokeWidth={1} strokeDasharray="4,4" />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">{fmt(t)}</text>
          </g>
        );
      })}

      {/* 2021 baseline line */}
      {baseline && (
        <>
          <line
            x1={PAD_L} x2={W - PAD_R}
            y1={PAD_T + chartH - (baseline.total / maxVal) * chartH}
            y2={PAD_T + chartH - (baseline.total / maxVal) * chartH}
            stroke="#e74c3c" strokeWidth={1.5} strokeDasharray="6,3"
          />
          <text x={W - PAD_R - 4} y={PAD_T + chartH - (baseline.total / maxVal) * chartH - 4} textAnchor="end" fontSize={9} fill="#e74c3c">2021 baseline</text>
        </>
      )}

      {/* Bars */}
      {rows.map((r, idx) => {
        const x = PAD_L + barGap * idx + (barGap - barW) / 2;
        const segments = [r.cat1_cashew, r.cat4_vessel + r.cat4_road, r.cat3_wtt];
        let cumY = PAD_T + chartH;
        return (
          <g key={r.year}>
            {segments.map((seg, si) => {
              const segH = (seg / maxVal) * chartH;
              const y = cumY - segH;
              cumY = y;
              return (
                <rect key={si} x={x} y={y} width={barW} height={segH} fill={cols[si]} rx={si === segments.length - 1 ? 3 : 0}>
                  <title>{labels[si]}: {fmt(seg)} tCO2e</title>
                </rect>
              );
            })}
            {/* Year label */}
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-text-secondary)">{r.year}</text>
            {/* Total */}
            <text x={x + barW / 2} y={PAD_T + chartH - (r.total / maxVal) * chartH - 5} textAnchor="middle" fontSize={9} fill="var(--color-text)" fontWeight={600}>{fmt(r.total)}</text>
          </g>
        );
      })}

      {/* Legend */}
      {labels.map((l, i) => (
        <g key={l} transform={`translate(${PAD_L + i * 200}, ${H - 4})`}>
          <rect x={0} y={-10} width={10} height={10} fill={cols[i]} rx={2} />
          <text x={14} y={-1} fontSize={9} fill="var(--color-text-muted)">{l}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Scope3Page() {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [rows,    setRows]     = useState<Scope3YearRow[]>([]);
  const [baseline, setBaseline] = useState<Scope3YearRow | undefined>();
  const [selYear, setSelYear]  = useState<number>(new Date().getFullYear());

  useEffect(() => {
    getScope3SummaryData()
      .then(({ rows, baseline2021 }) => {
        setRows(rows);
        setBaseline(baseline2021);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  const availYears = useMemo(() => rows.map(r => r.year), [rows]);
  const selected   = useMemo(() => rows.find(r => r.year === selYear) || rows[rows.length - 1], [rows, selYear]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>Đang tải Scope 3...</span>
    </div>
  );

  if (error) return (
    <div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 24, borderRadius: 8, margin: 24 }}>⚠️ {error}</div>
  );

  const green = '#68B52A';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <span style={{ color: green }}>🌍</span> Scope 3 <span className="page-title-accent">Chuỗi giá trị</span>
        </div>
        <div className="page-subtitle">
          SBTi ID: 40003759 · Non-FLAG −30% · FLAG −36.4% by {TARGET_YEAR} vs {BASE_YEAR}
        </div>
      </div>

      {/* Year picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {availYears.map(yr => (
          <button
            key={yr}
            onClick={() => setSelYear(yr)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: '1.5px solid',
              borderColor: selYear === yr ? green : 'var(--color-border)',
              background: selYear === yr ? green : 'transparent',
              color: selYear === yr ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >{yr}</button>
        ))}
      </div>

      {/* KPI cards — 4 */}
      {selected && (
        <div className="grid-4 stagger-children mb-xl">
          {[
            { label: 'Total Scope 3', value: selected.total, sub: 'tCO₂e', color: green },
            { label: '🌿 Cat.1 FLAG — Cashew', value: selected.cat1_cashew, sub: 'at-farm emissions', color: '#2F855A' },
            { label: '🚢 Cat.4 — Transport', value: selected.cat4_vessel + selected.cat4_road, sub: 'ocean + road', color: '#4A7A12' },
            { label: '⚡ Cat.3 — WTT', value: selected.cat3_wtt, sub: 'fuel & energy upstream', color: '#90BE6D' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card kpi-card animate-fade-in-up">
              <div className="kpi-card-value" style={{ color }}>{fmt(value)}</div>
              <div className="kpi-card-label">{label}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* SBTi Progress — FLAG + Non-FLAG side by side */}
      {baseline && selected && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <ProgressBlock
            label="🌿 FLAG Target — Cat.1 Cashew"
            sublabel="Scope 3 FLAG GHG · −36.4% by 2032"
            current={selected.totalFlag}
            baseline={baseline.totalFlag}
            targetPct={FLAG_TARGET_PCT}
            color="#2F855A"
          />
          <ProgressBlock
            label="🏭 Non-FLAG Target — Cat.3 + Cat.4"
            sublabel="Purchased goods, WTT, Transport · −30% by 2032"
            current={selected.totalNonFlag}
            baseline={baseline.totalNonFlag}
            targetPct={NONFLAG_TARGET_PCT}
            color={green}
          />
        </div>
      )}

      {/* Year-by-year stacked chart */}
      <div className="card animate-fade-in-up mb-xl">
        <div className="card-header">
          <div className="card-title">Phát thải Scope 3 theo năm (tCO₂e)</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Stacked: Cat.1 Cashew + Cat.4 Transport + Cat.3 WTT
          </div>
        </div>
        <StackedBarChart rows={rows} baseline={baseline} />
      </div>

      {/* Detail table */}
      <div className="card animate-fade-in-up mb-xl">
        <div className="card-header"><div className="card-title">Chi tiết theo năm</div></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Năm', 'Cat.1 Cashew (FLAG)', 'Cat.4 Vessel', 'Cat.4 Road', 'Cat.3 WTT', 'FLAG Total', 'Non-FLAG Total', 'Grand Total', 'vs 2021'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Năm' ? 'left' : 'right', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diffPct = baseline ? pct(r.total, baseline.total) : 0;
                const isBase  = r.year === BASE_YEAR;
                return (
                  <tr key={r.year} style={{
                    background: r.year === selYear ? `${green}11` : i % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)',
                    borderBottom: '1px solid var(--color-border-light)',
                    fontWeight: isBase ? 700 : 400,
                  }}>
                    <td style={{ padding: '10px 12px' }}>
                      {r.year}{isBase && <span style={{ marginLeft: 6, fontSize: 10, color: green, background: `${green}22`, padding: '1px 6px', borderRadius: 10 }}>BASE</span>}
                    </td>
                    {[r.cat1_cashew, r.cat4_vessel, r.cat4_road, r.cat3_wtt, r.totalFlag, r.totalNonFlag, r.total].map((v, vi) => (
                      <td key={vi} style={{ padding: '10px 12px', textAlign: 'right', color: (vi === 4 || vi === 5 || vi === 6) ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                        {fmt(v)}
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: isBase ? 'var(--color-text-muted)' : diffPct > 0 ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>
                      {isBase ? '—' : `${diffPct > 0 ? '−' : '+'}${Math.abs(diffPct)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 24 }}>
          <span>🌿 <strong>FLAG target</strong>: Cat.1 cashew −{FLAG_TARGET_PCT}% by {TARGET_YEAR}</span>
          <span>🏭 <strong>Non-FLAG target</strong>: Cat.3+Cat.4 −{NONFLAG_TARGET_PCT}% by {TARGET_YEAR}</span>
          <span>📋 <strong>SBTi ID</strong>: 40003759 · Base year: {BASE_YEAR}</span>
        </div>
      </div>

      {/* Scope 3 composition for selected year */}
      {selected && (
        <div className="card animate-fade-in-up">
          <div className="card-header"><div className="card-title">Phân bổ Scope 3 — {selected.year}</div></div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Simple proportion bars */}
            {[
              { label: 'Cat.1 Cashew (FLAG)', value: selected.cat1_cashew, color: '#2F855A', note: 'at-farm LUC' },
              { label: 'Cat.4 Ocean Freight', value: selected.cat4_vessel, color: '#4A9E8C', note: 'upstream transport' },
              { label: 'Cat.4 Road Freight', value: selected.cat4_road, color: '#4A7A12', note: 'upstream transport' },
              { label: 'Cat.3 WTT Fuel', value: selected.cat3_wtt, color: '#90BE6D', note: 'diesel + LPG + electricity' },
            ].map(({ label, value, color, note }) => (
              <div key={label} style={{ flex: 1, minWidth: 150 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{note}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{fmt(value)}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{selected.total > 0 ? Math.round((value / selected.total) * 100) : 0}%</div>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--color-border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${selected.total > 0 ? (value / selected.total) * 100 : 0}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
