'use client';

import { useEffect, useState, useMemo } from 'react';
import { getScope3SummaryData } from '@/lib/data-service';
import type { Scope3YearRow } from '@/lib/data-service';

const FLAG_TARGET_PCT    = 36.4;
const NONFLAG_TARGET_PCT = 30.0;
const TARGET_YEAR        = 2032;
const BASE_YEAR          = 2021;
const GREEN              = '#68B52A';
const DARK_GREEN         = '#2F855A';

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function pct(current: number, base: number): number {
  if (!base) return 0;
  return Math.round(((base - current) / base) * 1000) / 10;
}

// ── Compact KPI box ──
function KBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Compact Progress Block ──
function ProgressBlock({
  label, sublabel, current, baseline, targetPct, color,
}: {
  label: string; sublabel: string; current: number; baseline: number; targetPct: number; color: string;
}) {
  const achieved  = pct(current, baseline);
  const progress  = Math.max(0, Math.min(100, (achieved / targetPct) * 100));
  const achColor  = achieved < 0 ? '#EF4444' : achieved >= targetPct ? '#10B981' : '#F59E0B';
  const target2032 = Math.round(baseline * (1 - targetPct / 100));

  return (
    <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sublabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: achColor, lineHeight: 1 }}>
            {achieved > 0 ? '−' : '+'}{Math.abs(achieved)}%
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>vs 2021</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>
          <span>Tiến độ → target −{targetPct}%</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 7, background: 'var(--color-border-light)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 4, transition: 'width 1s ease' }} />
        </div>
      </div>

      {/* 3 stats — compact */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { l: '2021 base', v: baseline },
          { l: 'Hiện tại', v: current, hi: true },
          { l: `${TARGET_YEAR} target`, v: target2032 },
        ].map(({ l, v, hi }) => (
          <div key={l} style={{ background: 'var(--color-card-bg)', borderRadius: 4, padding: '6px 8px', textAlign: 'center', border: hi ? `1px solid ${color}40` : 'none' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: hi ? color : 'var(--color-text)' }}>{fmt(v)}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compact Stacked Bar Chart ──
function StackedBarChart({ rows, baseline }: { rows: Scope3YearRow[]; baseline: Scope3YearRow | undefined }) {
  const W = 800, H = 200, PAD_L = 50, PAD_B = 30, PAD_T = 16, PAD_R = 16;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const maxVal = Math.max(...rows.map(r => r.total), 1);
  const cols   = [DARK_GREEN, '#4A9E8C', '#4A7A12', '#90BE6D'];
  const lbls   = ['Cat.1 Cashew', 'Cat.4 Vessel', 'Cat.4 Road', 'Cat.3 WTT'];
  const barW   = Math.floor(chartW / rows.length * 0.5);
  const barGap = chartW / rows.length;
  const ticks  = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid */}
        {ticks.map(t => {
          const y = PAD_T + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--color-border-light)" strokeWidth={0.8} strokeDasharray="4,4" />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--color-text-muted)">{fmt(t)}</text>
            </g>
          );
        })}

        {/* Baseline */}
        {baseline && (
          <>
            <line x1={PAD_L} x2={W - PAD_R}
              y1={PAD_T + chartH - (baseline.total / maxVal) * chartH}
              y2={PAD_T + chartH - (baseline.total / maxVal) * chartH}
              stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5,3" />
            <text x={W - PAD_R - 2} y={PAD_T + chartH - (baseline.total / maxVal) * chartH - 4}
              textAnchor="end" fontSize={8} fill="#EF4444">2021 base</text>
          </>
        )}

        {/* Bars */}
        {rows.map((r, idx) => {
          const x = PAD_L + barGap * idx + (barGap - barW) / 2;
          const segs = [r.cat1_cashew, r.cat4_vessel, r.cat4_road, r.cat3_wtt];
          let cumY = PAD_T + chartH;
          return (
            <g key={r.year}>
              {segs.map((seg, si) => {
                const segH = (seg / maxVal) * chartH;
                const y = cumY - segH;
                cumY = y;
                return (
                  <rect key={si} x={x} y={y} width={barW} height={segH} fill={cols[si]} rx={si === segs.length - 1 ? 2 : 0}>
                    <title>{lbls[si]}: {fmt(seg)} tCO₂e</title>
                  </rect>
                );
              })}
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)">{r.year}</text>
              <text x={x + barW / 2} y={PAD_T + chartH - (r.total / maxVal) * chartH - 4}
                textAnchor="middle" fontSize={8} fill="var(--color-text)" fontWeight={600}>{fmt(r.total)}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, paddingLeft: 50, flexWrap: 'wrap', marginTop: 2 }}>
        {lbls.map((l, i) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <span style={{ width: 8, height: 8, background: cols[i], display: 'inline-block', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-muted)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>Đang tải Scope 3...</span>
    </div>
  );

  if (error) return (
    <div style={{ color: GREEN, background: `${GREEN}15`, padding: 16, borderRadius: 8, margin: 16 }}>⚠️ {error}</div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: GREEN }}>🌍</span> Scope 3
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>Chuỗi giá trị</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            SBTi #40003759 · FLAG −36.4% · Non-FLAG −30% by {TARGET_YEAR}
          </div>
        </div>

        {/* Year pills */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {availYears.map(yr => (
            <button key={yr} onClick={() => setSelYear(yr)} style={{
              padding: '4px 12px', borderRadius: 16, border: '1.5px solid',
              borderColor: selYear === yr ? GREEN : 'var(--color-border)',
              background: selYear === yr ? GREEN : 'transparent',
              color: selYear === yr ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
            }}>{yr}</button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          <KBox label="Total Scope 3" value={fmt(selected.total)} color={GREEN} sub="tCO₂e" />
          <KBox label="🌿 Cat.1 FLAG — Cashew" value={fmt(selected.cat1_cashew)} color={DARK_GREEN} sub="at-farm LUC" />
          <KBox label="🚢 Cat.4 — Transport" value={fmt(selected.cat4_vessel + selected.cat4_road)} color="#4A9E8C" sub="ocean + road" />
          <KBox label="⚡ Cat.3 — WTT" value={fmt(selected.cat3_wtt)} color="#90BE6D" sub="diesel + LPG + điện" />
        </div>
      )}

      {/* ── SBTi Progress — 2 columns compact ── */}
      {baseline && selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <ProgressBlock
            label="🌿 FLAG — Cat.1 Cashew"
            sublabel="−36.4% by 2032 vs 2021"
            current={selected.totalFlag}
            baseline={baseline.totalFlag}
            targetPct={FLAG_TARGET_PCT}
            color={DARK_GREEN}
          />
          <ProgressBlock
            label="🏭 Non-FLAG — Cat.3 + Cat.4"
            sublabel="−30% by 2032 vs 2021"
            current={selected.totalNonFlag}
            baseline={baseline.totalNonFlag}
            targetPct={NONFLAG_TARGET_PCT}
            color={GREEN}
          />
        </div>
      )}

      {/* ── Stacked bar chart ── */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          Phát thải Scope 3 theo năm — Stacked (tCO₂e)
        </div>
        <StackedBarChart rows={rows} baseline={baseline} />
      </div>

      {/* ── Composition for selected year ── */}
      {selected && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Phân bổ Scope 3 — {selected.year}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'Cat.1 Cashew (FLAG)', value: selected.cat1_cashew, color: DARK_GREEN, note: 'at-farm LUC emission' },
              { label: 'Cat.4 Ocean Freight', value: selected.cat4_vessel, color: '#4A9E8C', note: 'vận tải biển thượng nguồn' },
              { label: 'Cat.4 Road Freight', value: selected.cat4_road, color: '#4A7A12', note: 'vận tải đường bộ' },
              { label: 'Cat.3 WTT Fuel', value: selected.cat3_wtt, color: '#90BE6D', note: 'diesel + LPG + điện upstream' },
            ].map(({ label, value, color, note }) => {
              const p = selected.total > 0 ? Math.round((value / selected.total) * 100) : 0;
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{note}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>{fmt(value)}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>{p}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-border-light)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Detail table — compact full-year view ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Chi tiết theo năm</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 16 }}>
            <span>🌿 FLAG target: −{FLAG_TARGET_PCT}% by {TARGET_YEAR}</span>
            <span>🏭 Non-FLAG: −{NONFLAG_TARGET_PCT}% by {TARGET_YEAR}</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                {['Năm', 'Cat.1 Cashew', 'Cat.4 Vessel', 'Cat.4 Road', 'Cat.3 WTT', 'FLAG', 'Non-FLAG', 'Tổng', 'vs 2021'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Năm' ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const diffPct = baseline ? pct(r.total, baseline.total) : 0;
                const isBase  = r.year === BASE_YEAR;
                const isSelected = r.year === selYear;
                return (
                  <tr key={r.year} style={{
                    background: isSelected ? `${GREEN}10` : undefined,
                    borderBottom: '1px solid var(--color-border-light)',
                    fontWeight: isBase ? 700 : 400,
                  }}>
                    <td style={{ padding: '7px 10px' }}>
                      {r.year}
                      {isBase && <span style={{ marginLeft: 5, fontSize: 9, color: GREEN, background: `${GREEN}20`, padding: '1px 5px', borderRadius: 8 }}>BASE</span>}
                      {isSelected && !isBase && <span style={{ marginLeft: 5, fontSize: 9, color: '#6366F1', background: '#6366F115', padding: '1px 5px', borderRadius: 8 }}>ACTIVE</span>}
                    </td>
                    {[r.cat1_cashew, r.cat4_vessel, r.cat4_road, r.cat3_wtt, r.totalFlag, r.totalNonFlag, r.total].map((v, vi) => (
                      <td key={vi} style={{ padding: '7px 10px', textAlign: 'right', color: vi >= 4 ? 'var(--color-text)' : 'var(--color-text-secondary)', fontWeight: vi >= 4 ? 600 : 400 }}>{fmt(v)}</td>
                    ))}
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: isBase ? 'var(--color-text-muted)' : diffPct > 0 ? '#10B981' : '#EF4444' }}>
                      {isBase ? '—' : `${diffPct > 0 ? '−' : '+'}${Math.abs(diffPct)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
