'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getOpexReportData } from '@/lib/data-service';
import type { OpexAnnualData, OpexReportData, OpexScope1BreakYear, OpexScope3RegionalRow } from '@/lib/data-service';
import { downloadSvgAsPng } from '@/lib/chart-exports';

// ── Types ──────────────────────────────────────────────────
type AnnualData = OpexAnnualData;

// ── Colors matching the PPT slide exactly ──────────────────
const C = {
  baseline: '#8A8A8A',
  actual: '#C8281A',
  estimated: '#E8960E',
  target: '#3E7B3E',
  arrow: '#555555',
};

// ── Helpers ────────────────────────────────────────────────
function sbtiTarget(baseline: number, year: number): number {
  const BASE = 2021, END = 2031;
  if (year <= BASE) return baseline;
  if (year >= END) return baseline * 0.5;
  return baseline * (1 - 0.5 * (year - BASE) / (END - BASE));
}

function fmt(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(3).replace(/\./, ',');
  if (n >= 1000) return n.toLocaleString('de-DE');
  return Math.round(n).toString();
}

// Short format for INSIDE bars (avoids overflow in narrow bars)
function fmtBar(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000) return Math.round(n / 1000) + 'K';
  if (abs >= 10000) return (n / 1000).toFixed(1) + 'K';
  if (abs >= 1000) return n.toLocaleString('de-DE');
  return Math.round(n).toString();
}

function pctStr(val: number, base: number): string {
  if (!base) return '—';
  const p = Math.round(((val - base) / base) * 100);
  return (p >= 0 ? '+' : '') + p + '%';
}

// ── Waterfall Chart SVG ────────────────────────────────────
interface BarPoint {
  key: string;
  label: string[];
  actual?: number;
  target?: number;
  isTotal?: boolean;           // draw from baseline (0) to value
  isSplitSubtotal?: boolean;   // draw as actual/estimated stack
  isActualPlanSplit?: boolean; // 2-color bar: red Q1 actual (bottom), green Q2-Q4 plan (top)
  q1ActualRatio?: number;      // fraction of bar height that is actual (fallback, default 0.25)
  splitActualAbsVal?: number;  // absolute value of Q1 actual (used when isTotal=true)
}

interface Callout {
  fromCol: number;
  toCol: number;
  fromVal: number;
  toVal: number;
  text: string;
  level?: number;
}

function WaterfallChart({
  bars,
  callouts = [],
  title,
  legendOrder,
  downloadName,
}: {
  bars: BarPoint[];
  callouts?: Callout[];
  title: string;
  legendOrder?: ('baseline' | 'actual' | 'estimated' | 'target')[];
  downloadName?: string;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);

  // SVG dimensions — tall chart with generous top pad for callout brackets
  const W = 560, H = 400;
  const PL = 8, PR = 8, PT = 130, PB = 46;
  const cw = (W - PL - PR) / bars.length;
  const bw = Math.min(40, cw * 0.65);
  const chartH = H - PT - PB;

  // Y scale
  const rawMax = Math.max(...bars.map(b => b.actual ?? b.target ?? 0));
  const yMax = rawMax > 0 ? rawMax * 1.25 : 100;

  function py(val: number) {
    if (yMax === 0) return PT + chartH;
    return PT + chartH - (val / yMax) * chartH;
  }
  const ph = (v: number) => Math.max(chartH * v / yMax, 2);
  const cx = (i: number) => PL + cw * i + cw / 2;
  const bx = (i: number) => cx(i) - bw / 2;

  const legendItems = (legendOrder || ['baseline', 'actual', 'estimated', 'target']).map(k => ({
    baseline: { color: C.baseline, label: 'Baseline' },
    actual: { color: C.actual, label: 'Actual' },
    estimated: { color: C.estimated, label: 'Est. Emission' },
    target: { color: C.target, label: 'Target' },
  }[k] as { color: string; label: string }));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Chart title & Export row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#222', lineHeight: 1.3 }}
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {downloadName && (
          <button
            onClick={() => downloadSvgAsPng(svgRef.current, downloadName)}
            style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            title="Tải ảnh PNG độ phân giải cao"
          >
            <span>📸</span> HD
          </button>
        )}
      </div>
      {/* Legend — top right position matching PPT */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '2px', fontSize: '10.5px', alignItems: 'center', justifyContent: 'flex-end' }}>
        {legendItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '2px', flexShrink: 0 }} />
            <span style={{ color: '#444' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SVG chart — overflow visible so callout brackets show above viewBox */}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
        <defs>
          <marker id={`arwD-${title.replace(/\s+/g, '')}`} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0,0 8,4 0,8" fill="#555" />
          </marker>
          {/* Glow filter for bar hover */}
          <filter id={`glow-${title.replace(/\s+/g, '')}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Per-bar animated clipPaths — grow from baseline upward */}
          {bars.map((b, i) => (
            <clipPath key={`clip-${i}`} id={`clip-${title.replace(/\s+/g, '')}-${i}`}>
              <rect
                x={bx(i) - 2}
                y={PT}
                width={bw + 4}
                height={chartH}
                style={{
                  transformOrigin: `${cx(i)}px ${PT + chartH}px`,
                }}
              />
            </clipPath>
          ))}
        </defs>
        <style>{`
          @keyframes wfGrow {
            0%   { transform: scaleY(0); }
            100% { transform: scaleY(1); }
          }
          @keyframes pulse-dot {
            0%, 100% { r: 5; opacity: 1; }
            50% { r: 7.5; opacity: 0.6; }
          }
        `}</style>

        {/* Bottom axis line */}
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth="1.5" />

        {/* ── Bars ── */}
        {(() => {
          let prevValForBox = 0;
          const boxTops = bars.map(b => {
            const val = b.actual ?? b.target ?? 0;
            let bt = py(val);
            if (!b.isTotal && val !== 0) bt = py(Math.max(prevValForBox, val));
            if (val !== 0) prevValForBox = val;
            return Math.min(bt, py(val)); // guarantee visual top
          });

          let prevVal = 0;
          const renderedBars = bars.map((b, i) => {
            const isFloating = !b.isTotal;
            const isTargetMarker = b.target !== undefined && !b.actual;
            const color = b.key === 'base' ? C.baseline :
              (b.key === 'end' || isTargetMarker) ? C.target : C.actual;

            const val = b.actual ?? b.target ?? 0;
            if (val === 0) {
              prevVal = val;
              return null;
            }

            // Box dimensions
            let boxTop, boxBottom;
            if (b.isTotal) {
              boxTop = py(val);
              boxBottom = py(0);
            } else {
              const v1 = prevVal;
              const v2 = val;
              boxTop = py(Math.max(v1, v2)); // max val = lowest py = top Edge
              boxBottom = py(Math.min(v1, v2));
            }
            const boxH = Math.max(boxBottom - boxTop, 1);
            const boxY = boxTop;
            const delta = isFloating ? Math.abs(val - prevVal) : val;

            // Connector from previous column
            const connLine = i > 0 && (
              <line x1={cx(i - 1) + bw / 2} y1={py(prevVal)} x2={bx(i)} y2={py(prevVal)} stroke="#222" strokeWidth="1" />
            );

            const rawDelta = val - prevVal;
            const absDeltaStr = fmt(Math.abs(rawDelta));
            const deltaStr = isFloating ? (rawDelta > 0 ? `+${absDeltaStr}` : `-${absDeltaStr}`) : fmt(val);
            // Short version for INSIDE narrow bars
            const absDeltaShort = fmtBar(Math.abs(rawDelta));
            const deltaStrShort = isFloating ? (rawDelta > 0 ? `+${absDeltaShort}` : `-${absDeltaShort}`) : fmtBar(val);

            prevVal = val;

            return (
              <g key={b.key}>
                {connLine}

                {b.isSplitSubtotal ? (
                  <>
                    {/* Stacked 2025 bar (approx match PPT ~ 62.4% Est / 37.6% Act) */}
                    <rect x={bx(i)} y={py(val)} width={bw} height={py(val * 0.376) - py(val)} fill={C.estimated} />
                    <rect x={bx(i)} y={py(val * 0.376)} width={bw} height={py(0) - py(val * 0.376)} fill={C.actual} />
                    <text x={cx(i)} y={py(val) + (py(val * 0.376) - py(val)) / 2 + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill="#222">
                      {fmt(val * 0.624)}
                    </text>
                    <text x={cx(i)} y={py(val * 0.376) + (py(0) - py(val * 0.376)) / 2 + 4} textAnchor="middle" fontSize="15" fontWeight="800" fill="white">
                      {fmt(val * 0.376)}
                    </text>
                  </>
                ) : b.isActualPlanSplit ? (() => {
                  // 2026 TOTAL bar: stands from 0, split at Q1 actual value.
                  // RED (bottom) = Q1 actual emissions; GREEN (top) = Q2-Q4 plan
                  const planVal2026 = val; // full-year plan
                  const baseY = py(0);          // bottom axis
                  const topY = py(planVal2026); // top of bar
                  const totalH = baseY - topY;

                  // Compute absolute Q1 value (for split + labels)
                  const q1Abs = b.splitActualAbsVal && b.splitActualAbsVal > 0
                    ? b.splitActualAbsVal
                    : Math.round(planVal2026 * (b.q1ActualRatio ?? 0.25));
                  const planAbs = planVal2026 - q1Abs;

                  // Split geometry
                  const splitY = py(q1Abs);                   // Y coord of Q1/Plan boundary
                  const q1H = Math.max(baseY - splitY, 4); // red height (0 → q1Abs)
                  const planH = Math.max(splitY - topY, 4);  // green height (q1Abs → plan)

                  // Compact number formatter for inside-bar labels
                  const fv = (n: number) =>
                    n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` :
                      n >= 1e4 ? `${(n / 1e3).toFixed(0)}K` :
                        n >= 1000 ? `${(n / 1e3).toFixed(1)}K` :
                          n.toLocaleString();

                  return (
                    <>
                      {/* Connector from previous bar — drawn manually since isTotal suppresses auto connLine */}
                      {i > 0 && (
                        <line
                          x1={bx(i - 1) + bw} y1={py(prevVal)}
                          x2={bx(i)} y2={py(prevVal)}
                          stroke="#BBBBBB" strokeWidth={1} strokeDasharray="3,3"
                        />
                      )}
                      {/* Q2-Q4 plan = GREEN (top portion) */}
                      <rect x={bx(i)} y={topY} width={bw} height={planH} fill={C.target} rx={2} />
                      {/* Q1 actual = RED (bottom portion) */}
                      <rect x={bx(i)} y={splitY} width={bw} height={q1H} fill={C.actual} />
                      {/* Outline + white divider */}
                      <rect x={bx(i)} y={topY} width={bw} height={totalH} fill="none" stroke="#444" strokeWidth={0.8} rx={2} />
                      <line x1={bx(i)} y1={splitY} x2={bx(i) + bw} y2={splitY} stroke="white" strokeWidth={2.5} />
                      {/* Numbers only, no labels */}
                      {planH > 18 && (
                        <text x={cx(i)} y={topY + planH / 2 + 3.5} textAnchor="middle" fontSize={12} fontWeight="900" fill="white">{fv(planAbs)}</text>
                      )}
                      {q1H > 18 && (
                        <text x={cx(i)} y={splitY + q1H / 2 + 3.5} textAnchor="middle" fontSize={12} fontWeight="900" fill="white">{fv(q1Abs)}</text>
                      )}
                      {/* Total plan value above bar */}
                      <text x={cx(i)} y={topY - 6} textAnchor="middle" fontSize={13} fontWeight="900" fill={C.target}>{fv(planVal2026)}</text>
                    </>
                  );
                })() : (
                  <>
                    <rect x={bx(i)} y={boxY} width={bw} height={boxH} fill={color}
                      stroke={
                        color === C.actual ? '#8B1A10' :
                          color === C.target ? '#2E6B2E' :
                            '#555555'
                      }
                      strokeWidth="1.5" rx="2"
                      clipPath={`url(#clip-${title.replace(/\s+/g, '')}-${i})`}
                    />

                    {/* text delta: short format INSIDE bars, full format OUTSIDE */}
                    {boxH > 26 ? (
                      // Inside tall bar — use short K-format so text fits within bar width
                      <text x={cx(i)} y={boxY + boxH / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="white">
                        {deltaStrShort}
                      </text>
                    ) : (
                      // Outside small bar — always above bar, full format
                      <text x={cx(i)} y={boxY - 7} textAnchor="middle" fontSize="12.5" fontWeight="800" fill={color}>
                        {deltaStr}
                      </text>
                    )}
                  </>
                )}

                {/* Year labels below axis — no absolute value numbers, data is visible in bars */}
                {b.label.map((l, li) => (
                  <text key={li} x={cx(i)} y={PT + chartH + 18 + li * 15} textAnchor="middle" fontSize="12.5" fill="#555" fontWeight={600}>
                    {l}
                  </text>
                ))}
              </g>
            );
          });

          const renderedCallouts = callouts.map((cal, idx) => {
            const fromX = cx(cal.fromCol);
            const toX = cx(cal.toCol);
            const fromBarTopY = boxTops[cal.fromCol];     // Absolute physical top edge!
            const toBarTopY = boxTops[cal.toCol];       // Absolute physical top edge!

            // Bracket always sits ABOVE the chart area (y < PT) so it never overlaps bars
            const ovalRyLocal = 13;
            const computed = Math.min(fromBarTopY, toBarTopY) - 52 - ((cal.level || 0) * 36);
            const clampY = PT - ovalRyLocal - 6 - ((cal.level || 0) * 36);
            const bracketY = Math.min(computed, clampY);

            // Oval label center
            const midX = (fromX + toX) / 2;
            const ovalRx = 32, ovalRy = 13;

            const isGood = cal.toVal <= cal.fromVal; // reduction = green
            const clr = isGood ? '#2E6B2E' : '#C8281A';
            const lineColor = '#555';
            const dash = '5,4';

            return (
              <g key={idx}>
                {/* LEFT vertical drop — no arrow, baseline is the reference start point */}
                <line
                  x1={fromX} y1={bracketY}
                  x2={fromX} y2={fromBarTopY - (bars[cal.fromCol]?.isActualPlanSplit ? 20 : 2)}
                  stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash}
                />

                <line x1={fromX} y1={bracketY} x2={midX - ovalRx} y2={bracketY} stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash} />
                <line x1={midX + ovalRx} y1={bracketY} x2={toX} y2={bracketY} stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash} />

                {/* RIGHT vertical drop to physical bar top */}
                <line
                  x1={toX} y1={bracketY}
                  x2={toX} y2={toBarTopY - (bars[cal.toCol]?.isActualPlanSplit ? 20 : 6)}
                  stroke={lineColor} strokeWidth="1.3" strokeDasharray={dash}
                  markerEnd={`url(#arwD-${title.replace(/\s+/g, '')})`}
                />

                {/* Oval label */}
                <ellipse cx={midX} cy={bracketY} rx={ovalRx + 8} ry={ovalRy + 4} fill="white" stroke={clr} strokeWidth="2" />
                <text x={midX} y={bracketY + 5.5} textAnchor="middle" fontSize="15" fontWeight="900" fill={clr}>
                  {cal.text}
                </text>
              </g>
            );
          });

          return (
            <>
              {renderedBars}
              {renderedCallouts}
            </>
          );
        })()}
      </svg>
    </div>
  );
}


const FLAG_TGT_PCT = 36.4;
const NONFLAG_TGT_PCT = 30.0;
const S3_TARGET_YEAR = 2032;

// ── PT Solar Rooftop Project ─────────────────────────────────
// Source: Solar system feasibility report (Cân bằng phát thải CO₂ — hệ thống điện mặt trời)
// Operational: end-2026 (first full year of savings = 2027)
// System output: 1,614 MWh/year | Degradation: 1%/year
// EF used: 0.6592 tCO₂/kWh (national grid EF per solar report)
// Net annual CO₂ saving (Scope 2, year 1): 1,614 × 0.6592 ≈ 1,064 tCO₂e/year
// Applied only to Scope 2 target from 2027 onward for PT factory view AND all-VN view
const PT_SOLAR_ANNUAL_MWH = 1614;           // MWh/year (year-1 output)
const PT_SOLAR_EF_VN = 0.6592;         // tCO₂/kWh (per solar report)
const PT_SOLAR_DEGRADATION = 0.01;           // 1%/year panel degradation
const PT_SOLAR_ONLINE_YEAR = 2027;           // first full year of savings
/** tCO₂e saved by PT solar in a given year (0 before 2027) */
function ptSolarSaving(year: number): number {
  if (year < PT_SOLAR_ONLINE_YEAR) return 0;
  const age = year - PT_SOLAR_ONLINE_YEAR; // 0 in first full year
  const mwh = PT_SOLAR_ANNUAL_MWH * Math.pow(1 - PT_SOLAR_DEGRADATION, age);
  return Math.round(mwh * PT_SOLAR_EF_VN);
}

// ── OriginDetailTable sub-component ─────────────────────────
type ScaledRow = { origin: string; ef: number; color: string; qty: number; emS: number; pct: number; volPct: number };

function OriginDetailTable({
  scaledRows, maxEmS, scaledTotal, scaledHighEf,
}: { scaledRows: ScaledRow[]; maxEmS: number; scaledTotal: number; scaledHighEf: number }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #eee', color: '#666' }}>
          <th style={{ textAlign: 'left', padding: '2px 4px', fontWeight: 600, width: 80 }}>Origin</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 600, width: 46 }}>EF</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 600, width: 40 }}>Vol%</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 600, width: 40 }}>Em%</th>
          <th style={{ textAlign: 'right', padding: '2px 4px', fontWeight: 600, width: 65 }}>tCO₂e</th>
          <th style={{ padding: '2px 4px' }}>Risk bar</th>
        </tr>
      </thead>
      <tbody>
        {scaledRows.map(r => {
          const emPct = scaledTotal > 0 ? r.emS / scaledTotal * 100 : 0;
          const diff = emPct - r.volPct;
          const isEFDriven = diff > 3;
          const isVolDriven = diff < -3;
          const isSel = selected === r.origin;
          return (
            <React.Fragment key={r.origin}>
              <tr
                onClick={() => setSelected(isSel ? null : r.origin)}
                style={{ borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: isSel ? '#fff8f8' : 'transparent' }}
              >
                <td style={{ padding: '2px 4px', fontWeight: r.ef > 5 ? 700 : 400, color: r.color }}>{r.origin}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: r.color, fontWeight: 600 }}>{r.ef.toFixed(2)}</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: '#555' }}>{r.volPct.toFixed(1)}%</td>
                <td style={{ padding: '2px 4px', textAlign: 'right', color: isEFDriven ? '#C8281A' : isVolDriven ? '#3E7B3E' : '#555', fontWeight: isEFDriven || isVolDriven ? 700 : 400 }}>
                  {emPct.toFixed(1)}%
                </td>
                <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: r.ef > 5 ? 700 : 400, color: r.color }}>{r.emS.toLocaleString()}</td>
                <td style={{ padding: '2px 8px 2px 4px' }}>
                  <div style={{ height: 8, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${maxEmS > 0 ? (r.emS / maxEmS * 100) : 0}%`, background: r.color, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </td>
              </tr>
              {isSel && (
                <tr style={{ background: '#fff8f8' }}>
                  <td colSpan={6} style={{ padding: '4px 8px 6px', fontSize: '10px', color: '#444', borderBottom: '1px solid #fdd' }}>
                    {isEFDriven
                      ? <span>⬆️ <strong style={{ color: '#C8281A' }}>EF-driven:</strong> Em% ({emPct.toFixed(1)}%) &gt; Vol% ({r.volPct.toFixed(1)}%) bởi {diff.toFixed(1)}pp — emission cao vì EF cao ({r.ef} kgCO₂e/kg), không phải do mua nhiều. Giảm sourcing từ origin này hoặc tìm supplier có EF thấp hơn.</span>
                      : isVolDriven
                        ? <span>📦 <strong style={{ color: '#3E7B3E' }}>Volume-driven:</strong> Em% ({emPct.toFixed(1)}%) &lt; Vol% ({r.volPct.toFixed(1)}%) — EF thấp ({r.ef}), emission share hợp lý với lượng mua. Đây là nguồn an toàn.</span>
                        : <span>⚖️ <strong>Cân bằng:</strong> Em% ({emPct.toFixed(1)}%) ≈ Vol% ({r.volPct.toFixed(1)}%) — cả volume lẫn EF đều ảnh hưởng tương đương.</span>
                    }
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '1.5px solid #ddd', background: '#f9f9f9' }}>
          <td style={{ padding: '3px 4px', fontWeight: 700 }} colSpan={2}>TOTAL</td>
          <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>100%</td>
          <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>100%</td>
          <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: '#C8281A' }}>{scaledTotal.toLocaleString()}</td>
          <td style={{ padding: '3px 4px', fontSize: '10px', color: scaledHighEf / scaledTotal > 0.6 ? '#C8281A' : '#3E7B3E' }}>
            🔴 High-EF: {Math.round(scaledHighEf / scaledTotal * 100)}%
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── OriginDonut sub-component ─────────────────────────────────
function OriginDonut({ rows, scaledTotal }: { rows: ScaledRow[]; scaledTotal: number }) {
  const [mode, setMode] = React.useState<'em' | 'vol'>('em');
  const [hovered, setHovered] = React.useState<string | null>(null);
  const size = 150;
  const cx = size / 2, cy = size / 2, outerR = 58, innerR = 34;
  const total = mode === 'em' ? scaledTotal : rows.reduce((s, row) => s + row.qty, 0);
  let angle = -Math.PI / 2;
  const arcs = rows.map(row => {
    const val = mode === 'em' ? row.emS : row.qty;
    const pct = total > 0 ? val / total : 0;
    const span = pct * 2 * Math.PI;
    const a0 = angle;
    angle += span;
    const a1 = angle;
    const x0 = cx + outerR * Math.cos(a0), y0 = cy + outerR * Math.sin(a0);
    const x1 = cx + outerR * Math.cos(a1), y1 = cy + outerR * Math.sin(a1);
    const xi0 = cx + innerR * Math.cos(a0), yi0 = cy + innerR * Math.sin(a0);
    const xi1 = cx + innerR * Math.cos(a1), yi1 = cy + innerR * Math.sin(a1);
    const lg = span > Math.PI ? 1 : 0;
    const path = `M ${x0} ${y0} A ${outerR} ${outerR} 0 ${lg} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${lg} 0 ${xi0} ${yi0} Z`;
    return { ...row, path, pct };
  });
  const hovRow = arcs.find(a => a.origin === hovered);
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['em', 'vol'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: '2px 7px', borderRadius: 3, border: `1px solid ${mode === m ? '#C8281A' : '#ddd'}`, background: mode === m ? '#C8281A' : '#f9f9f9', color: mode === m ? '#fff' : '#555', cursor: 'pointer', fontWeight: mode === m ? 700 : 400, fontSize: '9.5px' }}>
            {m === 'em' ? '📊 Emission' : '⚖️ Volume'}
          </button>
        ))}
      </div>
      <svg width={size} height={size}>
        {arcs.map(a => (
          <path key={a.origin} d={a.path} fill={a.color}
            opacity={hovered && hovered !== a.origin ? 0.35 : 1}
            stroke="#fff" strokeWidth={1.5}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={() => setHovered(a.origin)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9} fill="#888">
          {hovRow ? hovRow.origin : (mode === 'em' ? 'Emission' : 'Volume')}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={12} fontWeight={700} fill={hovRow?.color || '#333'}>
          {hovRow ? `${(hovRow.pct * 100).toFixed(1)}%` : '% share'}
        </text>
      </svg>
      <div style={{ fontSize: '9px', color: '#777', textAlign: 'center' }}>
        {mode === 'em' ? 'By tCO₂e share' : 'By RCN volume (MTS)'}
      </div>
    </div>
  );
}

// ── Scope 1 Category Config ───────────────────────────────
const S1_CATS: { key: string; label: string; color: string }[] = [
  { key: 'wood_logs', label: 'Wood logs', color: '#C8281A' },
  { key: 'wastewater', label: 'Wastewater', color: '#8B1A10' },
  { key: 'lpg', label: 'LPG', color: '#E8960E' },
  { key: 'diesel', label: 'Diesel', color: '#4472C4' },
  { key: 'f_gas_fugitives_r134a', label: 'F Gas R134A', color: '#70AD47' },
  { key: 'f_gas_fugitives_r410a', label: 'F Gas R410A', color: '#7F7F7F' },
  { key: 'f_gas_fugitives_r404a', label: 'F Gas R404A', color: '#595959' },
  { key: 'co2_cylinder', label: 'CO₂ cylinder / tanks', color: '#333333' },
];

// ── Scope 1 Breakdown Chart ─────────────────────────────────
type S1BreakYear = OpexScope1BreakYear;

function Scope1BreakdownChart({
  years, breakdown, selectedFac,
}: {
  years: number[];
  breakdown: S1BreakYear[];
  selectedFac: string;
}) {
  const [hovYear, setHovYear] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const W = 540, H = 230;
  const PL = 6, PR = 6, PT = 14, PB = 50;
  const chartH = H - PT - PB;
  const cw = (W - PL - PR) / years.length;
  const bw = Math.min(38, cw * 0.72);

  const yMax = Math.max(...breakdown.map(b => b.total), 1) * 1.2;
  const py = (v: number) => PT + chartH - (v / yMax) * chartH;
  const ph = (v: number) => Math.max((v / yMax) * chartH, 0);
  const cx = (i: number) => PL + cw * i + cw / 2;
  const bx = (i: number) => cx(i) - bw / 2;

  // Only show cats that have > 0 across all years
  const activeCats = S1_CATS.filter(c =>
    breakdown.some(b => (b.cats[c.key] || 0) > 0)
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#C8281A' }}>
          🔥 Scope 1 — Breakdown by Fuel / Source (tCO₂e)
        </div>
        <button
          onClick={() => downloadSvgAsPng(svgRef.current, `Scope1_FuelBreakdown_${selectedFac}.png`)}
          style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          title="Tải ảnh PNG độ phân giải cao"
        >
          <span>📸</span> HD
        </button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
        {/* Gridlines */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const gv = yMax * f;
          const gy = py(gv);
          return (
            <g key={f}>
              <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="#eee" strokeWidth={1} />
              <text x={PL - 2} y={gy + 3.5} textAnchor="end" fontSize={8} fill="#bbb">
                {Math.round(gv)}
              </text>
            </g>
          );
        })}

        {/* Axis */}
        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth={1.5} />

        {/* Bars */}
        {years.map((yr, i) => {
          const bd = breakdown.find(b => b.year === yr);
          if (!bd || bd.total === 0) return null;
          const isHov = hovYear === yr;
          let stackY = py(0); // start from bottom
          const segs: React.ReactNode[] = [];

          // draw from bottom up in reverse order so first cat is on bottom
          const catsReversed = [...activeCats].reverse();
          for (const cat of catsReversed) {
            const val = bd.cats[cat.key] || 0;
            if (val <= 0) continue;
            const segH = ph(val);
            stackY -= segH;
            segs.push(
              <rect
                key={cat.key}
                x={bx(i)} y={stackY}
                width={bw} height={segH}
                fill={cat.color}
                opacity={isHov ? 1 : 0.88}
                stroke="white" strokeWidth={0.4}
              />
            );
            // Label inside segment if tall enough
            if (segH > 14) {
              segs.push(
                <text
                  key={cat.key + 'lbl'}
                  x={cx(i)} y={stackY + segH / 2 + 5}
                  textAnchor="middle" fontSize={segH > 28 ? 13 : 10.5}
                  fontWeight="900" fill="white"
                >
                  {Math.round(val)}
                </text>
              );
            }
          }

          // Total above bar
          const barTop = py(bd.total);
          return (
            <g
              key={yr}
              onMouseEnter={() => setHovYear(yr)}
              onMouseLeave={() => setHovYear(null)}
              style={{ cursor: 'default' }}
            >
              {segs}
              {/* outer border */}
              <rect
                x={bx(i)} y={barTop}
                width={bw} height={py(0) - barTop}
                fill="none"
                stroke={isHov ? '#333' : 'transparent'}
                strokeWidth={1.5}
                rx={1}
              />
              {/* Total label above bar */}
              <text x={cx(i)} y={barTop - 4} textAnchor="middle" fontSize={13} fontWeight="900" fill="#333">
                {Math.round(bd.total)}
              </text>
              {/* Year label below */}
              <text x={cx(i)} y={PT + chartH + 16} textAnchor="middle" fontSize={13} fill="#555" fontWeight={yr === 2026 ? 800 : 600}>
                {yr === 2026 ? "Q1'26" : yr.toString()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8, fontSize: '12px' }}>
        {activeCats.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, background: c.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: '#444', fontWeight: 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function OpexReportPage() {
  const { lang, t } = useI18n();
  const searchParams = useSearchParams();
  const showIntensity = searchParams.get('intensity') === '1';  // driven by Header toggle
  const showOrigin = searchParams.get('origin') === '1';  // driven by Header toggle

  const [loading, setLoading] = useState(true);
  const [targetEndYear, setTargetEndYear] = useState<number>(2028);
  const [selectedFac, setSelectedFac] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ops' | 'supply' | 'intensity'>('ops');
  const [selectedOriginYear, setSelectedOriginYear] = useState<number>(2025);
  const [reportData, setReportData] = useState<OpexReportData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await getOpexReportData();
        if (!active) return;
        setReportData(payload);
        setLoadError(null);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load Opex report data');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#C8281A', fontWeight: 700 }}>
        {loadError}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: '#666' }}>
        <div className="loading-spinner" />
        <span>Đang tải báo cáo OpEx...</span>
      </div>
    );
  }

  if (!reportData) return null;

  const factories = reportData.factories;
  const data: AnnualData[] = reportData.annualDataByFactory[selectedFac] || reportData.annualDataByFactory.ALL || [];
  const intensityData = reportData.intensityData;
  const scope1Breakdown: S1BreakYear[] = reportData.scope1BreakdownByFactory[selectedFac] || reportData.scope1BreakdownByFactory.ALL || [];
  const s3Data = reportData.scope3Data;
  const originData = reportData.originData;
  const scope3Regional: OpexScope3RegionalRow[] = reportData.scope3Regional || [];

  const get = (year: number) => data.find(d => d.year === year) || { year, scope1: 0, scope2: 0, rcn: 0 };
  const b1 = get(2021).scope1;  // Scope 1 baseline
  const b2 = get(2021).scope2;  // Scope 2 baseline
  const s1_2025 = get(2025).scope1;
  const s2_2025 = get(2025).scope2;

  // Compute required annual reduction so that we reach exactly 50% of baseline by 2031.
  // If 2025 actual is ALREADY below 50% baseline (SBTi target met early), we still continue
  // reducing — targeting an additional 25% from 2025 level by the end year.
  // This reflects the group strategy: strong-performing factories pull the overall portfolio
  // further below the 50% floor, creating headroom for peer facilities.
  const ultimateTargetYear = 2031;
  const yearsToTarget = ultimateTargetYear - 2025;

  // ── PT Solar helper logic ────────────────────────────────────────
  const selectedFactory = factories.find(f => f.id === selectedFac);
  function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  const facNameNorm = stripAccents(selectedFactory?.name || '');
  const isSolarFactory = selectedFac === 'ALL' ||
    facNameNorm.includes('phan thiet') ||
    facNameNorm.startsWith('pt') ||
    facNameNorm === 'pt';

  const cumulativeSolarSavingByYear = (year: number): number => {
    if (!isSolarFactory) return 0;
    let total = 0;
    for (let y = PT_SOLAR_ONLINE_YEAR; y <= year; y++) total += ptSolarSaving(y);
    return total;
  };

  // Helper to compute projection curves per factory.
  // When 'ALL' is selected, summing these up is mathematically correct (whereas curve(Sum(A)) != Sum(curve(A)))
  const getFacProj = (facId: string) => {
    const f_data = reportData.annualDataByFactory[facId] || [];
    const f_get = (y: number) => f_data.find(d => d.year === y) || { year: y, scope1: 0, scope2: 0, rcn: 0 };

    const f_b1 = f_get(2021).scope1;
    const f_b2 = f_get(2021).scope2;
    const f_s1_2025 = f_get(2025).scope1;
    const f_s2_2025 = f_get(2025).scope2;

    const f_s1FinalTarget = f_s1_2025 <= f_b1 * 0.5 ? f_s1_2025 * 0.75 : f_b1 * 0.5;
    const f_s1AnnualCut = yearsToTarget > 0 ? (f_s1_2025 - f_s1FinalTarget) / yearsToTarget : 0;

    const f_s2FinalTargetBase = f_s2_2025 <= f_b2 * 0.5 ? f_s2_2025 * 0.75 : f_b2 * 0.5;
    const f_s2AnnualCut = yearsToTarget > 0 ? (f_s2_2025 - f_s2FinalTargetBase) / yearsToTarget : 0;

    const f_obj = factories.find(f => f.id === facId);
    const fname = stripAccents(f_obj?.name || '');
    const isSolar = fname.includes('phan thiet') || fname.startsWith('pt') || fname === 'pt';

    return {
      s1AnnualCut: f_s1AnnualCut,
      s2AnnualCut: f_s2AnnualCut,
      s1Proj: (year: number) => Math.max(f_s1_2025 - f_s1AnnualCut * (year - 2025), isSolar ? 0 : 0),
      s2Proj: (year: number) => {
        const linearCut = f_s2_2025 - f_s2AnnualCut * (year - 2025);
        const solar = isSolar ? ptSolarSaving(year) : 0;
        return Math.max(linearCut - solar, f_b2 * 0.5);
      }
    };
  };

  const combinedProj = (() => {
    if (selectedFac === 'ALL') {
      const allProjs = factories.map(f => getFacProj(f.id));
      return {
        s1AnnualCut: allProjs.reduce((sum, p) => sum + p.s1AnnualCut, 0),
        s2AnnualCut: allProjs.reduce((sum, p) => sum + p.s2AnnualCut, 0),
        s1Proj: (year: number) => allProjs.reduce((sum, p) => sum + p.s1Proj(year), 0),
        s2Proj: (year: number) => allProjs.reduce((sum, p) => sum + p.s2Proj(year), 0),
      };
    }
    return getFacProj(selectedFac);
  })();

  const s1AnnualCut = combinedProj.s1AnnualCut;
  const s2AnnualCut = combinedProj.s2AnnualCut;
  const targetProj = (act2025: number, annualCut: number, year: number) => combinedProj.s1Proj(year);
  const s2Proj = (year: number) => Math.round(combinedProj.s2Proj(year));

  // Flags for contextual commentary (still globally aggregated)
  const s1BeyondTarget = s1_2025 <= b1 * 0.5;
  const s2BeyondTarget = s2_2025 <= b2 * 0.5;

  const end_s1 = Math.round(targetProj(s1_2025, s1AnnualCut, targetEndYear));
  const end_s2 = s2Proj(targetEndYear);

  const targetBarsS1: BarPoint[] = [];
  const targetBarsS2: BarPoint[] = [];
  // Q1 2026 actuals — used as the split point in the 2026 total bar
  const ytd26s1 = get(2026).scope1;
  const ytd26s2 = get(2026).scope2;
  for (let y = 2026; y <= targetEndYear; y++) {
    const split2026s1 = y === 2026
      ? { isActualPlanSplit: true, isTotal: true, splitActualAbsVal: ytd26s1 > 0 ? ytd26s1 : undefined }
      : {};
    const split2026s2 = y === 2026
      ? { isActualPlanSplit: true, isTotal: true, splitActualAbsVal: ytd26s2 > 0 ? ytd26s2 : undefined }
      : {};
    targetBarsS1.push({ key: y.toString(), label: [y === 2026 ? 'FC1,2026' : y.toString()], target: Math.round(targetProj(s1_2025, s1AnnualCut, y)), ...split2026s1 });
    targetBarsS2.push({ key: y.toString(), label: [y === 2026 ? 'FC1,2026' : y.toString()], target: s2Proj(y), ...split2026s2 });
  }

  // ── Scope 1 bars ──────────────────────────────────────────
  const req26_s1 = Math.round(targetProj(s1_2025, s1AnnualCut, 2026));
  const s1Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b1, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope1 },
    { key: '2023', label: ['2023'], actual: get(2023).scope1 },
    { key: '2024', label: ['2024'], actual: get(2024).scope1 },
    { key: '2025', label: ['2025'], actual: s1_2025 },
    { key: 'req_2026', label: ['Target', '2026'], target: req26_s1 },
    ...targetBarsS1,
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s1, isTotal: true },
  ];

  // ── Scope 1 callouts ──────────────────────────────────────
  // New bar indices: 0=base, 1=2022, 2=2023, 3=2024, 4=2025, 5..n=target, n+1=end
  const s1_2024 = get(2024).scope1;
  const s1Callouts: Callout[] = [
    b1 > 0 && get(2026).scope1 > 0 ? {
      // Baseline 2021 -> 2026 plan
      fromCol: 0, toCol: 6,
      fromVal: b1, toVal: Math.round(targetProj(s1_2025, s1AnnualCut, 2026)),
      text: pctStr(Math.round(targetProj(s1_2025, s1AnnualCut, 2026)), b1),
      level: 0
    } : null,
    end_s1 > 0 ? {
      // 2026 -> End (continuous bracket, text shows total reduction vs baseline)
      fromCol: 6, toCol: s1Bars.length - 1,
      fromVal: Math.round(targetProj(s1_2025, s1AnnualCut, 2026)), toVal: end_s1,
      text: pctStr(end_s1, b1),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[];

  // ── Scope 2 bars ──────────────────────────────────────────
  const req26_s2 = s2Proj(2026);
  const s2Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b2, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope2 },
    { key: '2023', label: ['2023'], actual: get(2023).scope2 },
    { key: '2024', label: ['2024'], actual: get(2024).scope2 },
    { key: '2025', label: ['2025'], actual: s2_2025 },
    { key: 'req_2026', label: ['Target', '2026'], target: req26_s2 },
    ...targetBarsS2,
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s2, isTotal: true },
  ];

  // ── Scope 2 callouts ──────────────────────────────────────
  const s2_2024 = get(2024).scope2;
  const s2Callouts: Callout[] = [
    b2 > 0 && get(2026).scope2 > 0 ? {
      // Baseline 2021 -> 2026 plan
      fromCol: 0, toCol: 6,
      fromVal: b2, toVal: s2Proj(2026),
      text: pctStr(s2Proj(2026), b2),
      level: 0
    } : null,
    end_s2 > 0 ? {
      // 2026 -> End (continuous bracket, text shows total reduction vs baseline)
      fromCol: 6, toCol: s2Bars.length - 1,
      fromVal: s2Proj(2026), toVal: end_s2,
      text: pctStr(end_s2, b2),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[];

  const pct1_vs_baseline = b1 > 0 ? Math.round(((s1_2025 - b1) / b1) * 100) : 0;
  const pct2_vs_baseline = b2 > 0 ? Math.round(((s2_2025 - b2) / b2) * 100) : 0;
  const s1Target2025 = Math.round(sbtiTarget(b1, 2025));
  const s2Target2025 = Math.round(sbtiTarget(b2, 2025));
  const pct1_vs_target = s1Target2025 > 0 ? Math.round(((s1_2025 - s1Target2025) / s1Target2025) * 100) : 0;
  const pct2_vs_target = s2Target2025 > 0 ? Math.round(((s2_2025 - s2Target2025) / s2Target2025) * 100) : 0;

  // ── RCN per year for intensity calc ────────────────────────
  const rcnByYear: Record<number, number> = {};
  for (const row of data) {
    rcnByYear[row.year] = row.rcn || 0;
  }
  // Q1 2026 fallback: if DB has no RCN for 2026, use RCN 2025 / 4 as proxy
  if (!rcnByYear[2026] || rcnByYear[2026] === 0) {
    rcnByYear[2026] = (rcnByYear[2025] || 0) / 4;
  }
  const fmtInt = (em: number, yr: number): string => {
    const rcn = rcnByYear[yr] || 0;
    if (rcn === 0) return '—';
    return (em / rcn).toFixed(3);
  };
  const fmtVal = (v: number | string, yr: number, isIntensity: boolean): string => {
    if (typeof v !== 'number') return v as string;
    return isIntensity ? fmtInt(v, yr) : fmt(v);
  };

  return (
    <div style={{
      fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
      background: '#ffffff',
      color: '#1a1a1a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── CSS Animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .opex-pill-btn {
          padding: 5px 13px;
          font-size: 12px;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          background: transparent;
          color: #666;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
          white-space: nowrap;
        }
        .opex-pill-btn.active-red {
          background: #fff;
          color: #C8281A;
          font-weight: 700;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
        .opex-pill-btn.active-green {
          background: #fff;
          color: #2E6B2E;
          font-weight: 700;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
        .opex-pill-btn:hover:not(.active-red):not(.active-green) {
          background: rgba(0,0,0,0.05);
          color: #333;
        }
        .opex-select {
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #dde1e7;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          color: #333;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          padding-right: 24px;
          transition: border-color 0.15s;
        }
        .opex-select:focus { outline: none; border-color: #C8281A; }
        .opex-divider { width: 1px; height: 20px; background: #ddd; flex-shrink: 0; }
      `}</style>

      {/* ── Slide Header ────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 20px 8px',
      }}>
        {/* Single unified control bar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '8px',
          marginBottom: '8px',
        }}>
          {/* LEFT: Title */}
          <h1 style={{ margin: 0, fontSize: 'clamp(15px, 2.5vw, 22px)', fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            <span style={{ color: '#C8281A' }}>{lang === 'vi' ? 'Giảm Phát thải CO₂' : 'Reduce CO₂'}</span>
            <span style={{ color: '#444', fontWeight: 500, fontSize: '0.75em', marginLeft: 6 }}>Annual 2025</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 8, background: '#FFF3CD', border: '1.5px solid #E8960E', borderRadius: 6, padding: '1px 8px', fontSize: '0.6em', fontWeight: 800, color: '#7a4f00', verticalAlign: 'middle', letterSpacing: 0.2 }}>Q1 2026 YTD</span>
          </h1>

          {/* CENTER: All controls inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

            {/* Scope tab switcher */}
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: '8px', padding: '3px', border: '1px solid #e2e2e2' }}>
              <button className={`opex-pill-btn${selectedScope === 'ops' ? ' active-red' : ''}`}
                onClick={() => setSelectedScope('ops')}>
                🔥 {lang === 'vi' ? 'Scope 1, 2' : 'Scope 1, 2'}
              </button>
              <button className={`opex-pill-btn${selectedScope === 'supply' ? ' active-green' : ''}`}
                onClick={() => setSelectedScope('supply')}>
                🌍 {lang === 'vi' ? 'Scope 3' : 'Scope 3'}
              </button>
              <button className={`opex-pill-btn${selectedScope === 'intensity' ? ' active-red' : ''}`}
                onClick={() => setSelectedScope('intensity')}>
                📊 {lang === 'vi' ? 'Cường độ CO₂' : 'CO₂ Intensity'}
              </button>
            </div>

            <div className="opex-divider" />

            {/* Target horizon switcher */}
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: '8px', padding: '3px', border: '1px solid #e2e2e2' }}>
              <button className={`opex-pill-btn${targetEndYear === 2028 ? ' active-red' : ''}`}
                onClick={() => setTargetEndYear(2028)}>
                2028
              </button>
              <button className={`opex-pill-btn${targetEndYear === 2031 ? ' active-red' : ''}`}
                onClick={() => setTargetEndYear(2031)}>
                2031
              </button>
            </div>

            <div className="opex-divider" />

            {/* Factory selector */}
            <select
              value={selectedFac}
              onChange={e => setSelectedFac(e.target.value)}
              className="opex-select"
            >
              <option value="ALL">🏭 Tất cả nhà máy</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

          </div>
        </div>

        {/* Subtitle / context line */}
        <div style={{
          fontSize: '12px', color: '#888', fontStyle: 'italic',
        }}>
          {selectedScope === 'ops'
            ? (lang === 'vi' ? '🎯 Mục tiêu: −50% Phát thải Vận hành so với năm cơ sở 2021 (SBTi Ngắn hạn)' : '🎯 Target: −50% Operations emissions vs 2021 baseline (SBTi Near-term)')
            : selectedScope === 'supply'
              ? (lang === 'vi' ? '🌿 Mục tiêu: −36.4% FLAG (Cat.1 Điều) | −7% Phi-FLAG đến 2032 (SBTi FLAG)' : '🌿 Target: −36.4% FLAG (Cat.1 Cashew) | −7% Non-FLAG by 2032 (SBTi FLAG)')
              : (lang === 'vi' ? '📊 Xu hướng Cường độ CO₂ & Sản lượng RCN (2021–2025) theo Nhà máy — Scope 1 & Scope 2' : '📊 CO₂ Intensity & RCN Production Trend (2021–2025) by Factory — Scope 1 & Scope 2')}
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid #C8281A', margin: '8px 0 0', opacity: 0.8 }} />
      </div>

      {/* ── Q1 2026 YTD Snapshot Banner ───────────────────────────────── */}
      {(() => {
        const ytd26s1 = get(2026).scope1;
        const ytd26s2 = get(2026).scope2;
        const s3_2026 = s3Data.find(d => d.year === 2026);
        // Q1 YTD = 3 months. Scope 3 cat1+cat4 are annual shipping totals (YTD)
        // so we show as-is (partial year)
        const ytd26s3 = s3_2026?.total || 0;
        const ytd26total = ytd26s1 + ytd26s2 + ytd26s3;
        // Annualise S1 & S2 for vs-target comparison (×4 quarters)
        const ann26s1 = ytd26s1 > 0 ? ytd26s1 * 4 : 0;
        const ann26s2 = ytd26s2 > 0 ? ytd26s2 * 4 : 0;
        // vs 2025 full-year pace (÷4 = Q1 expected)
        const q1pace25s1 = Math.round(s1_2025 / 4);
        const q1pace25s2 = Math.round(s2_2025 / 4);
        const deltaS1 = ytd26s1 - q1pace25s1;
        const deltaS2 = ytd26s2 - q1pace25s2;
        const hasQ1data = ytd26s1 > 0 || ytd26s2 > 0;
        if (!hasQ1data) return null;
        return (
          <div style={{
            margin: '0 12px 6px',
            borderRadius: 8,
            border: '1.5px solid #E8960E',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fff8e1 100%)',
            overflow: 'hidden',
          }}>
            {/* Banner header */}
            <div style={{ background: '#E8960E', color: '#fff', padding: '5px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.3 }}>📊 Q1 2026 YTD SNAPSHOT — Jan–Mar 2026</span>
              <span style={{ fontSize: 10, opacity: 0.9 }}>vs Q1 2025 pace (2025 ÷ 4)</span>
            </div>
            {/* Metrics row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, borderTop: '1px solid #fde68a' }}>
              {/* Scope 1 */}
              <div style={{ flex: '1 1 160px', padding: '8px 14px', borderRight: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 2 }}>🔥 SCOPE 1 (Direct)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', lineHeight: 1 }}>{fmt(ytd26s1)}<span style={{ fontSize: 11, fontWeight: 500, color: '#555', marginLeft: 4 }}>tCO₂e</span></div>
                <div style={{ marginTop: 3, fontSize: 10.5 }}>
                  <span style={{ color: '#666' }}>vs pace: </span>
                  <span style={{ fontWeight: 700, color: deltaS1 <= 0 ? '#2E6B2E' : '#C8281A' }}>
                    {deltaS1 > 0 ? '+' : ''}{fmt(deltaS1)} tCO₂e
                  </span>
                  <span style={{ color: '#888', marginLeft: 4 }}>({ann26s1 > 0 ? `~${fmt(ann26s1)} ann.` : '—'})</span>
                </div>
              </div>
              {/* Scope 2 */}
              <div style={{ flex: '1 1 160px', padding: '8px 14px', borderRight: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 2 }}>⚡ SCOPE 2 (Electricity)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', lineHeight: 1 }}>{fmt(ytd26s2)}<span style={{ fontSize: 11, fontWeight: 500, color: '#555', marginLeft: 4 }}>tCO₂e</span></div>
                <div style={{ marginTop: 3, fontSize: 10.5 }}>
                  <span style={{ color: '#666' }}>vs pace: </span>
                  <span style={{ fontWeight: 700, color: deltaS2 <= 0 ? '#2E6B2E' : '#C8281A' }}>
                    {deltaS2 > 0 ? '+' : ''}{fmt(deltaS2)} tCO₂e
                  </span>
                  <span style={{ color: '#888', marginLeft: 4 }}>({ann26s2 > 0 ? `~${fmt(ann26s2)} ann.` : '—'})</span>
                </div>
              </div>
              {/* Scope 3 */}
              <div style={{ flex: '1 1 160px', padding: '8px 14px', borderRight: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 2 }}>🌍 SCOPE 3 (Supply Chain)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', lineHeight: 1 }}>{fmt(ytd26s3)}<span style={{ fontSize: 11, fontWeight: 500, color: '#555', marginLeft: 4 }}>tCO₂e</span></div>
                <div style={{ marginTop: 3, fontSize: 10.5, color: '#888' }}>Cat.1 + Cat.4 partial-year shipping</div>
              </div>
              {/* Total */}
              <div style={{ flex: '1 1 140px', padding: '8px 14px', background: '#fff3e0' }}>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 700, marginBottom: 2 }}>📈 TOTAL ALL SCOPES</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#C8281A', lineHeight: 1 }}>{fmt(ytd26total)}<span style={{ fontSize: 11, fontWeight: 500, color: '#555', marginLeft: 4 }}>tCO₂e</span></div>
                <div style={{ marginTop: 3, fontSize: 10, color: '#92400e', fontStyle: 'italic' }}>Q1 combined — all scopes</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Two Charts — stack vertically on mobile ──────────────────── */}
      <div style={{
        display: selectedScope === 'ops' ? 'grid' : 'none',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '0',
        padding: '4px 12px',
        flex: 1,
      }}>
        {/* ── Scope 1 ── */}
        <div style={{ padding: '8px 16px 8px 8px', borderRight: '1.5px solid #e0e0e0' }}>
          <WaterfallChart
            bars={s1Bars}
            callouts={s1Callouts}
            title={`<strong>Scope 1 (reduce firewood usage)</strong> – ${showIntensity ? 'CO₂ Intensity (tCO₂e/tRCN)' : 'Absolute emissions (tCO₂e)'}`}
            legendOrder={['baseline', 'actual', 'estimated', 'target']}
            downloadName={`Scope1_Emissions_${selectedFac}.png`}
          />

          {/* ── Scope 1 mini-OGSM table ── */}
          {(() => {
            const years = [2021, 2022, 2023, 2024, 2025];
            const ytd26 = get(2026).scope1;
            const label = showIntensity ? 'CO₂ Intensity (tCO₂e/tRCN)' : 'tCO₂e';
            return (
              <div style={{ overflowX: 'auto', marginBottom: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#1a3d5c', color: 'white' }}>
                      <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700, minWidth: 130 }}>
                        Scope 1 — {label}
                      </th>
                      {years.map(y => <th key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{y}</th>)}
                      {ytd26 > 0 && <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#E8960E', whiteSpace: 'nowrap' }}>Q1'26*</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Total Scope 1', vals: years.map(y => get(y).scope1) },
                    ].map((row, ri) => (
                      <tr key={ri} style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '3px 6px', fontWeight: 700 }}>{row.label}</td>
                        {row.vals.map((v, vi) => (
                          <td key={vi} style={{
                            padding: '3px 6px', textAlign: 'right', fontWeight: 600,
                            color: showIntensity && vi > 0 ? (v / years[vi] < (row.vals[0] / years[0]) ? '#3E7B3E' : '#C8281A') : '#1a1a1a'
                          }}>
                            {fmtVal(v, years[vi], showIntensity)}
                          </td>
                        ))}
                        {ytd26 > 0 && (
                          <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#7a4f00', background: '#fff8e1', whiteSpace: 'nowrap' }}>
                            {fmtVal(ytd26, 2026, showIntensity)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* ── Scope 3 Regional Breakdown: VN vs India ── */}
          {scope3Regional.length > 0 && (() => {
            const VN_COLOR = '#C8281A';
            const IN_COLOR = '#9ab0c4';
            const YEARS_S3 = scope3Regional.filter(r => r.total > 0).map(r => r.year);
            const maxVal = Math.max(...scope3Regional.map(r => r.total)) * 1.15 || 1;
            const W = 340, H = 140;
            const PL = 44, PR = 10, PT = 28, PB = 24;
            const chartW = W - PL - PR;
            const chartH = H - PT - PB;
            const barW = Math.min(34, (chartW / YEARS_S3.length) * 0.62);
            const colW = chartW / YEARS_S3.length;
            const py = (v: number) => PT + chartH - (v / maxVal) * chartH;

            const SBT_TARGET = scope3Regional.find(r => r.year === 2021);
            const target2032 = SBT_TARGET ? Math.round(SBT_TARGET.total * 0.70) : 0;

            // Y axis ticks
            const tickCount = 4;
            const tickStep = Math.ceil(maxVal / tickCount / 100000) * 100000;
            const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep).filter(t => t <= maxVal * 1.2);

            return (
              <div style={{ marginTop: 12, background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: '11.5px', color: '#1a3d5c', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🌍 {lang === 'vi' ? 'Scope 3 — Phân bổ theo quốc gia (VN vs Ấn Độ)' : 'Scope 3 — Regional Split (Vietnam vs India)'}
                  <span style={{ fontSize: '10px', fontWeight: 400, color: '#888' }}>
                    {lang === 'vi' ? 'Cat.1 + Cat.3 + Cat.4 (tCO₂e)' : 'Cat.1 + Cat.3 + Cat.4 (tCO₂e)'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* Stacked bar chart */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => downloadSvgAsPng(document.getElementById('svg-s3-regional') as unknown as SVGSVGElement, 'Scope3_Regional_Breakdown.png')}
                      style={{ position: 'absolute', top: 0, right: 0, fontSize: '10px', padding: '2px 5px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 10 }}
                      title="Download PNG"
                    >📸 HD</button>
                    <svg id="svg-s3-regional" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto', display: 'block' }}>
                      {/* Y-axis ticks */}
                      {ticks.map(t => (
                        <g key={t}>
                          <line x1={PL} y1={py(t)} x2={W - PR} y2={py(t)} stroke="#eee" strokeWidth={1} />
                          <text x={PL - 4} y={py(t) + 3.5} textAnchor="end" fontSize={8} fill="#999">
                            {t >= 1000 ? `${Math.round(t / 1000)}K` : t}
                          </text>
                        </g>
                      ))}

                      {/* SBTi 2032 target line */}
                      {target2032 > 0 && (
                        <g>
                          <line x1={PL} x2={W - PR} y1={py(target2032)} y2={py(target2032)}
                            stroke="#3E7B3E" strokeWidth={1.2} strokeDasharray="4 3" />
                          <text x={W - PR - 2} y={py(target2032) - 3} textAnchor="end" fontSize={8} fill="#3E7B3E">SBTi 2032</text>
                        </g>
                      )}

                      {/* Stacked bars */}
                      {YEARS_S3.map((yr, i) => {
                        const row = scope3Regional.find(r => r.year === yr)!;
                        const cx = PL + i * colW + colW / 2 - barW / 2;
                        const vnH = (row.vn / maxVal) * chartH;
                        const inH = (row.india / maxVal) * chartH;
                        const totalH = vnH + inH;
                        const isYtd = yr >= 2026;
                        return (
                          <g key={yr}>
                            {/* India (bottom) */}
                            <rect x={cx} y={PT + chartH - inH} width={barW} height={inH}
                              fill={IN_COLOR} opacity={isYtd ? 0.7 : 1}
                              rx={1}>
                              <title>India {yr}: {row.india.toLocaleString()} tCO₂e</title>
                            </rect>
                            {/* Vietnam (top) */}
                            <rect x={cx} y={PT + chartH - totalH} width={barW} height={vnH}
                              fill={VN_COLOR} opacity={isYtd ? 0.7 : 1}
                              rx={1}>
                              <title>Vietnam {yr}: {row.vn.toLocaleString()} tCO₂e</title>
                            </rect>
                            {/* Total label */}
                            <text x={cx + barW / 2} y={PT + chartH - totalH - 4}
                              textAnchor="middle" fontSize={8} fontWeight={700} fill="#1a1a1a">
                              {Math.round(row.total / 1000)}K
                            </text>
                            {/* Year label */}
                            <text x={cx + barW / 2} y={H - PB + 11}
                              textAnchor="middle" fontSize={8.5} fill={isYtd ? '#E8960E' : '#555'} fontWeight={isYtd ? 700 : 400}>
                              {isYtd ? `Q1 '${String(yr).slice(-2)}` : yr}
                            </text>
                          </g>
                        );
                      })}

                      {/* Axis */}
                      <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth={1.5} />
                    </svg>
                  </div>

                  {/* Right column: summary table + key insights */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '10.5px' }}>
                    {/* Mini table */}
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ background: '#1a3d5c', color: 'white' }}>
                          <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>Year</th>
                          <th style={{ padding: '3px 6px', textAlign: 'right', color: '#fba4a4' }}>🇻🇳 VN</th>
                          <th style={{ padding: '3px 6px', textAlign: 'right', color: '#c8dce8' }}>🇮🇳 India</th>
                          <th style={{ padding: '3px 6px', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '3px 6px', textAlign: 'right' }}>VN %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scope3Regional.filter(r => r.total > 0).map((row, ri) => (
                          <tr key={row.year} style={{ background: ri % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '2px 6px', fontWeight: row.year >= 2026 ? 700 : 400, color: row.year >= 2026 ? '#7a4f00' : '#1a1a1a' }}>
                              {row.year >= 2026 ? `Q1 '26` : row.year}
                            </td>
                            <td style={{ padding: '2px 6px', textAlign: 'right', color: VN_COLOR, fontWeight: 600 }}>{row.vn.toLocaleString()}</td>
                            <td style={{ padding: '2px 6px', textAlign: 'right', color: '#5580a0', fontWeight: 600 }}>{row.india.toLocaleString()}</td>
                            <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: 700 }}>{row.total.toLocaleString()}</td>
                            <td style={{ padding: '2px 6px', textAlign: 'right', color: '#555' }}>
                              {row.total > 0 ? Math.round(row.vn / row.total * 100) + '%' : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 12, fontSize: '10px', color: '#555', marginTop: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: VN_COLOR, display: 'inline-block', borderRadius: 2 }} />🇻🇳 Vietnam (Long An · Phan Thiết · Tây Ninh)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: IN_COLOR, display: 'inline-block', borderRadius: 2 }} />🇮🇳 India (Tuticorin)</div>
                    </div>

                    {/* Key insight */}
                    {(() => {
                      const r2021 = scope3Regional.find(r => r.year === 2021);
                      const r2025 = scope3Regional.find(r => r.year === 2025);
                      const inPct2021 = r2021 && r2021.total > 0 ? Math.round(r2021.india / r2021.total * 100) : 0;
                      const inPct2025 = r2025 && r2025.total > 0 ? Math.round(r2025.india / r2025.total * 100) : 0;
                      const vnPct2025 = 100 - inPct2025;
                      return (
                        <div style={{ padding: '5px 8px', background: '#fff8e1', border: '1px solid #E8960E', borderRadius: 4, fontSize: '10px', color: '#7a4f00', lineHeight: '1.5' }}>
                          <strong>💡 {lang === 'vi' ? 'Nhận xét:' : 'Key Insight:'}</strong>{' '}
                          {lang === 'vi'
                            ? `Khối VN chiếm ${vnPct2025}% Scope 3 năm 2025 (tăng từ ${100 - inPct2021}% năm 2021). Tuticorin (India) từ ${inPct2021}% giảm xuống còn ${inPct2025}% — gánh nặng chuỗi cung ứng đang dồn về Việt Nam. Sử dụng số liệu này để giao KPI giảm phát thải cụ thể cho từng quốc gia.`
                            : `Vietnam accounts for ${vnPct2025}% of Scope 3 in 2025 (up from ${100 - inPct2021}% in 2021). India (Tuticorin) dropped from ${inPct2021}% to ${inPct2025}% — supply chain carbon burden is shifting toward Vietnam. Use this split to assign country-specific emission reduction KPIs.`}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Scope 1 Fuel Breakdown Chart ── */}
          <Scope1BreakdownChart
            years={[2021, 2022, 2023, 2024, 2025, 2026].filter(y => y < 2026 || get(2026).scope1 > 0)}
            breakdown={scope1Breakdown}
            selectedFac={selectedFac}
          />

          {/* Commentary — 100% data-driven from DB */}
          {(() => {
            const years = [2022, 2023, 2024, 2025];
            // YoY deltas for Scope 1
            const s1Deltas = years.map(y => ({
              year: y,
              delta: get(y).scope1 - (y === 2022 ? b1 : get(y - 1).scope1),
            }));
            const bestS1 = s1Deltas.reduce((a, b) => b.delta < a.delta ? b : a); // most negative = best
            const worstS1 = s1Deltas.reduce((a, b) => b.delta > a.delta ? b : a); // most positive = worst
            const yoy2025_s1 = get(2025).scope1 - get(2024).scope1;

            const rcn24 = data.find(d => d.year === 2024)?.rcn || 0;
            const rcn25 = data.find(d => d.year === 2025)?.rcn || 0;
            const int24 = rcn24 > 0 ? get(2024).scope1 / rcn24 : 0;
            const int25 = rcn25 > 0 ? get(2025).scope1 / rcn25 : 0;
            const rcnGrowth = rcn24 > 0 ? ((rcn25 - rcn24) / rcn24) * 100 : 0;
            const intGrowth = int24 > 0 ? ((int25 - int24) / int24) * 100 : 0;

            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                {/* Contextual header: highlight if already ahead of SBTi 2031 target */}
                {s1BeyondTarget && (
                  <p style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eaf5ea', borderLeft: '3px solid #3E7B3E', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong style={{ color: '#2E6B2E' }}>{lang === 'vi' ? '✅ Scope 1 — Đã đạt mục tiêu SBTi 2031!' : '✅ Scope 1 — SBTi 2031 target already achieved!'}</strong>{' '}
                    {lang === 'vi'
                      ? 'Tuy nhiên, cần tiếp tục giảm để tạo dư địa cho các nhà máy khác trong nhóm 4 nhà máy cùng chung mục tiêu 50%. Trajectory hiện tại hướng tới giảm thêm 25% từ mức 2025.'
                      : 'However, further reductions are needed to create headroom for the other factories in the group of 4 sharing the 50% target. Current trajectory aims for an additional 25% reduction from 2025 levels.'}
                  </p>
                )}
                <p style={{ margin: '0 0 5px' }}>
                  <strong>{s1BeyondTarget ? '🏆' : '📋'} {lang === 'vi' ? 'Hiệu suất SBTi Scope 1 (2025):' : 'Scope 1 SBTi Performance (2025):'}</strong> {lang === 'vi' ? 'Tổng khối lượng ở mức' : 'Total volume stands at'}{' '}
                  <strong style={{ color: s1BeyondTarget ? '#3E7B3E' : '#C8281A' }}>{fmt(s1_2025)} tCO₂e</strong>
                  {' '}({pct1_vs_baseline > 0 ? '+' : ''}{pct1_vs_baseline}% vs 2021 Base Year).
                  {' '}{lang === 'vi' ? 'Chênh lệch so với SBTi:' : 'SBTi Target Variance:'}{' '}
                  <span style={{ color: pct1_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct1_vs_target > 0 ? '+' : ''}{pct1_vs_target}%
                  </span>.
                  {' '}{lang === 'vi' ? 'Mức thay đổi YoY 2024→2025:' : 'YoY 2024→2025 Shift:'}{' '}
                  <strong style={{ color: yoy2025_s1 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s1 > 0 ? '+' : ''}{fmt(yoy2025_s1)} tCO₂e
                  </strong>.
                  {bestS1.delta < 0 && (
                    <> {lang === 'vi' ? 'Chu kỳ giảm mạnh nhất:' : 'Highest reduction cycle:'} <strong style={{ color: '#3E7B3E' }}>{bestS1.year}</strong> ({fmt(Math.abs(bestS1.delta))} {lang === 'vi' ? 'tCO₂e giảm' : 'tCO₂e drop'}).</>
                  )}
                  {worstS1.delta > 0 && (
                    <> {lang === 'vi' ? 'Đợt tăng phát thải cao điểm:' : 'Peak volume increase:'} <strong style={{ color: '#C8281A' }}>{worstS1.year}</strong> (+{fmt(worstS1.delta)} tCO₂e).</>
                  )}
                </p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                  <strong>📊 {lang === 'vi' ? 'Phân tích Cường độ (Scope 1/RCN):' : 'Intensity Analysis (Scope 1/RCN):'}</strong> 2024 ({int24.toFixed(3)}) → 2025 ({int25.toFixed(3)}).
                  {' '}{lang === 'vi' ? 'Biến động cường độ:' : 'Intensity shift:'}{' '}
                  <span style={{ color: intGrowth <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 600 }}>{intGrowth > 0 ? '+' : ''}{intGrowth.toFixed(1)}%</span>
                  {' '}{lang === 'vi' ? 'so với thay đổi sản lượng:' : 'vs Production shift:'}{' '}
                  <span style={{ fontWeight: 600 }}>{rcnGrowth > 0 ? '+' : ''}{rcnGrowth.toFixed(1)}%</span>.
                  {' '}<em>{intGrowth > 0 ? (lang === 'vi' ? 'Tăng phát thải vượt mức tăng sản lượng, cho thấy lò hơi đun sinh khối đun kém hiệu quả.' : 'Emissions outpaced production, indicating heat/boiler inefficiency.') : (lang === 'vi' ? 'Cải thiện hiệu suất bù đắp được mức tăng do sản lượng.' : 'Efficiency improvements offset production volume impacts.')}</em>
                </p>

                {selectedFac === 'ALL' && (
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                    <strong>🔍 {lang === 'vi' ? 'Phân rã Nguồn phát thải (2024 → 2025):' : 'Emission Source Breakdown (2024 → 2025):'}</strong>{' '}
                    {lang === 'vi' ? 'Động lực giảm Scope 1' : 'Scope 1 reduction was'}{' '}<strong>{lang === 'vi' ? 'KHÔNG' : 'NOT'}</strong>{' '}{lang === 'vi' ? 'đến từ củi đun hay dầu diesel —' : 'driven by firewood or diesel —'}{' '}
                    <span style={{ color: '#C8281A' }}>{lang === 'vi' ? 'Củi khúc +5% (+8.9 tCO₂e)' : 'Wood logs +5% (+8.9 tCO₂e)'}</span>,{' '}
                    <span style={{ color: '#C8281A' }}>{lang === 'vi' ? 'Diesel đi ngang (+0.6 tCO₂e)' : 'Diesel flat (+0.6 tCO₂e)'}</span>.{' '}
                    {lang === 'vi' ? 'Phần giảm thực tế đến từ việc' : 'The net decrease came from'}{' '}
                    <strong style={{ color: '#3E7B3E' }}>{lang === 'vi' ? 'loại bỏ dung môi lạnh R410a tại nhà máy Ấn Độ (−33 tCO₂e)' : 'R410a refrigerant phaseout at India factory (−33 tCO₂e)'}</strong>{' '}{lang === 'vi' ? 'và' : 'and'}{' '}
                    <span style={{ color: '#3E7B3E' }}>{lang === 'vi' ? 'R134a (−3.3 tCO₂e)' : 'R134a elimination (−3.3 tCO₂e)'}</span>.{' '}
                    <em>{lang === 'vi' ? 'Củi đốt vẫn là nguồn phát lớn nhất — cần tiếp tục giảm sử dụng sinh khối để giữ vững đà đạt Target.' : 'Firewood remains the largest source — ongoing biomass reduction is required to sustain the target trajectory.'}</em>
                  </p>
                )}

                <p style={{ margin: '0 0 4px', marginTop: '6px' }}><strong>{lang === 'vi' ? 'Kế hoạch Giảm thiểu Chiến lược:' : 'Strategic Mitigation Plan:'}</strong></p>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'Vietnam') && (
                    <li>
                      <strong>VICC Biomass Optimization</strong>: Restrict wood fuel consumption to align strictly with operational steam requirements.
                    </li>
                  )}
                  {(selectedFac === 'ALL' || factories.find(f => f.id === selectedFac)?.country === 'India') && (
                    <li>
                      <strong>India Refrigerant Management</strong>: Implement rigorous F-Gas leak monitoring and phase out high-GWP refrigerants (e.g., R410A).
                    </li>
                  )}
                </ul>
              </div>
            );
          })()}
        </div>

        {/* ── Scope 2 ── */}
        <div style={{ padding: '8px 8px 8px 16px' }}>
          <WaterfallChart
            bars={s2Bars}
            callouts={s2Callouts}
            title={`<strong>Scope 2 (grid electricity)</strong> – CO₂ eq ${showIntensity ? 'intensity tCO₂e/RCN' : 'absol. emission in ton'}`}
            legendOrder={['baseline', 'actual', 'estimated', 'target']}
            downloadName={`Scope2_Emissions_${selectedFac}.png`}
          />

          {/* ── Scope 2 mini-OGSM table ── */}
          {(() => {
            const years = [2021, 2022, 2023, 2024, 2025];
            const ytd26 = get(2026).scope2;
            const label = showIntensity ? 'CO₂ Intensity (tCO₂e/tRCN)' : 'tCO₂e';
            return (
              <div style={{ overflowX: 'auto', marginBottom: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#1a3d5c', color: 'white' }}>
                      <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700, minWidth: 130 }}>
                        Scope 2 — {label}
                      </th>
                      {years.map(y => <th key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{y}</th>)}
                      {ytd26 > 0 && <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#E8960E', whiteSpace: 'nowrap' }}>Q1'26*</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Total Scope 2', vals: years.map(y => get(y).scope2) },
                    ].map((row, ri) => (
                      <tr key={ri} style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '3px 6px', fontWeight: 700 }}>{row.label}</td>
                        {row.vals.map((v, vi) => (
                          <td key={vi} style={{
                            padding: '3px 6px', textAlign: 'right', fontWeight: 600,
                            color: showIntensity && vi > 0 ? (v / years[vi] < (row.vals[0] / years[0]) ? '#3E7B3E' : '#C8281A') : '#1a1a1a'
                          }}>
                            {fmtVal(v, years[vi], showIntensity)}
                          </td>
                        ))}
                        {ytd26 > 0 && (
                          <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#7a4f00', background: '#fff8e1', whiteSpace: 'nowrap' }}>
                            {fmtVal(ytd26, 2026, showIntensity)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Commentary — 100% data-driven from DB */}
          {(() => {
            const years = [2022, 2023, 2024, 2025];
            const s2Deltas = years.map(y => ({
              year: y,
              delta: get(y).scope2 - (y === 2022 ? b2 : get(y - 1).scope2),
            }));
            const bestS2 = s2Deltas.reduce((a, b) => b.delta < a.delta ? b : a);
            const worstS2 = s2Deltas.reduce((a, b) => b.delta > a.delta ? b : a);
            const yoy2025_s2 = get(2025).scope2 - get(2024).scope2;

            const rcn24 = data.find(d => d.year === 2024)?.rcn || 0;
            const rcn25 = data.find(d => d.year === 2025)?.rcn || 0;
            const int24 = rcn24 > 0 ? get(2024).scope2 / rcn24 : 0;
            const int25 = rcn25 > 0 ? get(2025).scope2 / rcn25 : 0;
            const rcnGrowth = rcn24 > 0 ? ((rcn25 - rcn24) / rcn24) * 100 : 0;
            const intGrowth = int24 > 0 ? ((int25 - int24) / int24) * 100 : 0;

            return (
              <div style={{ fontSize: '11.5px', lineHeight: '1.55', marginTop: '8px', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                {/* Contextual header: highlight if already ahead of SBTi 2031 target */}
                {s2BeyondTarget && (
                  <p style={{ margin: '0 0 6px', padding: '6px 10px', background: '#eaf5ea', borderLeft: '3px solid #3E7B3E', borderRadius: '4px', fontSize: '11.5px' }}>
                    <strong style={{ color: '#2E6B2E' }}>{lang === 'vi' ? '✅ Scope 2 — Đã đạt mục tiêu SBTi 2031!' : '✅ Scope 2 — SBTi 2031 target already achieved!'}</strong>{' '}
                    {lang === 'vi'
                      ? 'Tuy nhiên, cần tiếp tục giảm để tạo dư địa cho các nhà máy khác trong nhóm 4 nhà máy cùng chung mục tiêu 50%. Trajectory hiện tại hướng tới giảm thêm 25% từ mức 2025.'
                      : 'However, further reductions are needed to create headroom for the other factories in the group of 4 sharing the 50% target. Current trajectory aims for an additional 25% reduction from 2025 levels.'}
                  </p>
                )}
                {/* PT Solar announcement banner */}
                {isSolarFactory && (() => {
                  const cut = Math.round(s2AnnualCut);
                  const t26 = s2Proj(2026); const t27 = s2Proj(2027); const t28 = s2Proj(2028);
                  const delta27 = t27 - t26; // includes solar kink
                  return (
                    <div style={{ margin: '0 0 6px', padding: '7px 10px', background: '#f0fdf4', borderLeft: '3px solid #22c55e', borderRadius: '4px', fontSize: '11px', lineHeight: '1.6' }}>
                      <strong style={{ color: '#166534' }}>{lang === 'vi' ? '🌞 PT Rooftop Solar — online cuối 2026 (đã tích hợp vào target)' : '🌞 PT Rooftop Solar — online late 2026 (integrated into target)'}</strong>
                      <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <span>📉 {lang === 'vi' ? 'Giảm đều/năm (không solar):' : 'Linear reduction/yr (excl. solar):'} <strong>−{cut} tCO₂e</strong></span>
                        <span>⚡ {lang === 'vi' ? 'Solar từ 2027:' : 'Solar from 2027:'} <strong style={{ color: '#166534' }}>−{ptSolarSaving(2027).toLocaleString()} {lang === 'vi' ? 'tCO₂e/năm' : 'tCO₂e/yr'}</strong></span>
                      </div>
                      <div style={{ marginTop: '2px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span>2026: <strong>{t26.toLocaleString()} tCO₂e</strong></span>
                        <span>2027: <strong style={{ color: '#166534' }}>{t27.toLocaleString()} tCO₂e</strong>
                          {' '}<span style={{ color: '#166534', fontSize: '10px' }}>({delta27 > 0 ? '+' : ''}{delta27.toLocaleString()} incl. solar kink)</span>
                        </span>
                        <span>2028: <strong>{t28.toLocaleString()} tCO₂e</strong></span>
                      </div>
                      <div style={{ marginTop: '2px', fontSize: '10px', color: '#555' }}>
                        {lang === 'vi' ? 'Lũy kế solar đến' : 'Cumulative solar savings by'} {targetEndYear}: <strong style={{ color: '#166534' }}>−{cumulativeSolarSavingByYear(targetEndYear).toLocaleString()} tCO₂e</strong>{' '}
                        | {lang === 'vi' ? 'Mục tiêu' : 'Target'} {targetEndYear}: <strong>{end_s2.toLocaleString()} tCO₂e</strong>{' '}
                        (−{Math.round((1 - end_s2 / b2) * 100)}% vs baseline 2021)
                      </div>
                    </div>
                  );
                })()}
                <p style={{ margin: '0 0 5px' }}>
                  <strong>{s2BeyondTarget ? '🏆' : '⚠️'} {lang === 'vi' ? 'Hiệu suất SBTi Scope 2 (2025):' : 'Scope 2 SBTi Performance (2025):'}</strong> {lang === 'vi' ? 'Phát thải điện tiêu thụ ở mức' : 'Electricity-driven footprint recorded at'}{' '}
                  <strong style={{ color: s2BeyondTarget ? '#3E7B3E' : '#E8960E' }}>{fmt(s2_2025)} tCO₂e</strong>
                  {' '}({pct2_vs_baseline > 0 ? '+' : ''}{pct2_vs_baseline}% vs 2021 Base Year).
                  {' '}{lang === 'vi' ? 'Độ lệch mục tiêu SBTi:' : 'SBTi Target Variance:'}{' '}
                  <span style={{ color: pct2_vs_target <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>
                    {pct2_vs_target > 0 ? '+' : ''}{pct2_vs_target}%
                  </span>.
                  {' '}{lang === 'vi' ? 'Biến động 2024→2025:' : 'YoY 2024→2025 Shift:'}{' '}
                  <strong style={{ color: yoy2025_s2 <= 0 ? '#3E7B3E' : '#C8281A' }}>
                    {yoy2025_s2 > 0 ? '+' : ''}{fmt(Math.round(yoy2025_s2))} tCO₂e
                  </strong>.
                  {worstS2.delta > 0 && (
                    <> {lang === 'vi' ? 'Ghi nhận mức tăng mạnh vào ' : 'Critical escalation identified in '}<strong style={{ color: '#C8281A' }}>{worstS2.year}</strong> (+{fmt(Math.round(worstS2.delta))} tCO₂e){lang === 'vi' ? ', do phụ thuộc nhiều vào điện lưới.' : ', driven by expanded grid reliance.'}</>
                  )}
                  {bestS2.delta < 0 && (
                    <> {lang === 'vi' ? 'Xu hướng giảm mạnh nhất vào ' : 'Strongest reduction trend seen in '}<strong style={{ color: '#3E7B3E' }}>{bestS2.year}</strong> ({fmt(Math.abs(Math.round(bestS2.delta)))} {lang === 'vi' ? 'tCO₂e giảm' : 'tCO₂e drop'}).</>
                  )}
                </p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#444' }}>
                  <strong>📊 {lang === 'vi' ? 'Phân tích Cường độ (Scope 2/RCN):' : 'Intensity Analysis (Scope 2/RCN):'}</strong> 2024 ({int24.toFixed(3)}) → 2025 ({int25.toFixed(3)}).
                  {' '}{lang === 'vi' ? 'Thay đổi cường độ:' : 'Intensity shift:'}{' '}
                  <span style={{ color: intGrowth <= 0 ? '#3E7B3E' : '#C8281A', fontWeight: 600 }}>{intGrowth > 0 ? '+' : ''}{intGrowth.toFixed(1)}%</span>
                  {' '}{lang === 'vi' ? 'so với thay đổi sản lượng:' : 'vs Production shift:'}{' '}
                  <span style={{ fontWeight: 600 }}>{rcnGrowth > 0 ? '+' : ''}{rcnGrowth.toFixed(1)}%</span>.
                  {' '}<em>{intGrowth > 0 ? (lang === 'vi' ? "Mức sử dụng điện lưới đang tăng nhanh hơn mức tăng trưởng sản lượng. Cần ưu tiên can thiệp." : "Grid power usage is scaling worse than production growth. Priority intervention required.") : (lang === 'vi' ? "Hiệu suất điện lưới được cải thiện so với sản lượng." : "Grid efficiency improved relative to production throughput.")}</em>
                </p>

                <p style={{ margin: '0 0 4px', marginTop: '6px' }}><strong>{lang === 'vi' ? 'Kế hoạch Giảm thiểu Chiến lược:' : 'Strategic Mitigation Plan:'}</strong></p>
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {/* PT Solar — chỉ hiện khi ALL hoặc Phan Thiet */}
                  {isSolarFactory && (
                    <li>
                      <strong>{lang === 'vi' ? '🌞 PT Rooftop Solar (Scope 2 — từ 2027):' : '🌞 PT Rooftop Solar (Scope 2 — from 2027):'}</strong>{' '}
                      {lang === 'vi' ? 'Hệ thống điện mặt trời áp mái công suất 1,614 MWh/năm tại nhà máy PT dự kiến vận hành cuối năm 2026.' : '1,614 MWh/yr rooftop solar system at PT factory expected to go online by late 2026.'}{' '}
                      {lang === 'vi' ? 'Tiết kiệm ước tính' : 'Estimated savings of'} <strong style={{ color: '#3E7B3E' }}>~{ptSolarSaving(2027).toLocaleString()} {lang === 'vi' ? 'tCO₂e/năm' : 'tCO₂e/yr'}</strong>{' '}
                      {lang === 'vi' ? '(năm đầu, 2027) theo EF lưới VN' : '(first year, 2027) based on VN grid EF'} {PT_SOLAR_EF_VN} tCO₂/kWh.{' '}
                      {lang === 'vi' ? 'Lũy kế đến' : 'Cumulative by'} {targetEndYear}:{' '}
                      <strong style={{ color: '#3E7B3E' }}>~{cumulativeSolarSavingByYear(targetEndYear).toLocaleString()} tCO₂e</strong> {lang === 'vi' ? 'tích lũy, góp phần đưa Scope 2 xuống' : 'contributing to pulling Scope 2 down to'} <strong>{fmt(end_s2)} tCO₂e</strong> {lang === 'vi' ? 'vào năm' : 'in'} {targetEndYear}.
                    </li>
                  )}
                  {/* VICC RE Transition — cho tất cả VN factories */}
                  {(selectedFac === 'ALL' || selectedFactory?.country === 'Vietnam') && (
                    <li>
                      <strong>VICC RE Transition</strong>: {lang === 'vi' ? 'Tiếp tục mở rộng các giải pháp năng lượng tái tạo và khai thác REC để bù phần lưới còn lại.' : 'Continue to expand renewable energy solutions and procure RECs to offset the remaining grid footprint.'}
                    </li>
                  )}
                  {(selectedFac === 'ALL' || selectedFactory?.country === 'India') && (
                    <li>
                      <strong>India Operations</strong>: {lang === 'vi' ? 'Áp dụng tiêu chuẩn năng lượng ISO 50001 để giảm phụ thuộc điện lưới giờ cao điểm và chuyển đổi sang cơ sở hệ thống điện mặt trời.' : 'Enforce ISO 50001 energy standards to flatten peak-load grid dependency and transition to solar infrastructure.'}
                    </li>
                  )}
                </ul>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Scope 3 Supply Chain Section ──────────────────── */}
      {selectedScope === 'supply' && (() => {
        const s3Base = s3Data.find(d => d.year === 2021);
        const s3Cur = s3Data.find(d => d.year === 2025);
        const s3_2022 = s3Data.find(d => d.year === 2022);
        const s3_2023 = s3Data.find(d => d.year === 2023);
        const s3_2024 = s3Data.find(d => d.year === 2024);
        if (!s3Base || !s3Cur) return <div style={{ padding: 24, color: '#888' }}>Loading Scope 3 data...</div>;

        // Targets
        const flagBase = s3Base.cat1;
        const nonflagBase = s3Base.cat4v + s3Base.cat4r + s3Base.cat3;
        const flagTarget2032 = Math.round(flagBase * (1 - FLAG_TGT_PCT / 100));
        const nonflagTarget2032 = Math.round(nonflagBase * (1 - NONFLAG_TGT_PCT / 100));
        const totalTarget2032 = flagTarget2032 + nonflagTarget2032;
        const cur2032Gap = s3Cur.total - totalTarget2032;
        const annualCutNeeded = Math.round(cur2032Gap / (S3_TARGET_YEAR - 2025));

        // Actual Cat.1 per year (for scaling Origin breakdown)
        const cat1ByYear: Record<number, number> = {
          2021: s3Base.cat1,
          2022: s3_2022?.cat1 || 0,
          2023: s3_2023?.cat1 || 0,
          2024: s3_2024?.cat1 || 0,
          2025: s3Cur.cat1,
        };

        // Linear plan 2026-targetEndYear
        const totalCur = s3Cur.total;
        const annualCut = (totalCur - totalTarget2032) / (S3_TARGET_YEAR - 2025);
        const planYears: number[] = [];
        for (let y = 2026; y <= Math.min(targetEndYear, S3_TARGET_YEAR); y++) planYears.push(y);
        const planVal = (y: number) => Math.round(totalCur - annualCut * (y - 2025));

        const pctVsBase = Math.round(((s3Cur.total - s3Base.total) / s3Base.total) * 100);
        const pctFlagVsBase = Math.round(((s3Cur.cat1 - flagBase) / flagBase) * 100);
        const peakYear = s3Data.reduce((a, b) => b.total > a.total ? b : a);
        const bestYear = s3Data.slice(1).reduce((a, b) => b.total < a.total ? b : a);

        // Waterfall bars for scope 3
        // 2025: plain delta bar; seq: +req2026 delta bar -> 2026 total bar split.
        const s3_2026ytd_val = s3Data.find(d => d.year === 2026)?.total || 0;
        const s3Bars: BarPoint[] = [
          { key: 'base', label: ['Baseline', '2021'], actual: s3Base.total, isTotal: true },
          { key: '2022', label: ['2022'], actual: s3_2022?.total || 0 },
          { key: '2023', label: ['2023'], actual: s3_2023?.total || 0 },
          { key: '2024', label: ['2024'], actual: s3_2024?.total || 0 },
          { key: '2025', label: ['2025'], actual: s3Cur.total },
          { key: 'req_2026', label: ['Target', '2026'], target: planVal(2026) },
          ...planYears.map(y => ({
            key: y.toString(), label: [y === 2026 ? 'FC1,2026' : y.toString()], target: planVal(y),
            ...(y === 2026 ? {
              isActualPlanSplit: true,
              isTotal: true,
              // S3 data for 2026 is a FULL-YEAR estimate (not quarterly actual),
              // so we use planVal * 25% as Q1 proxy to give a realistic visual split.
              splitActualAbsVal: Math.round(planVal(y) * 0.25),
            } : {})
          })),
          { key: 'end', label: ['by End', targetEndYear.toString()], target: planVal(targetEndYear), isTotal: true },
        ];

        const s3Callouts: Callout[] = [
          s3Base.total > 0 && planVal(2026) > 0 ? {
            // Baseline 2021 -> 2026
            fromCol: 0, toCol: 6,
            fromVal: s3Base.total, toVal: planVal(2026),
            text: pctStr(planVal(2026), s3Base.total), level: 0
          } : null,
          planVal(targetEndYear) > 0 ? {
            // 2026 -> End (continuous bracket, text shows total reduction vs baseline)
            fromCol: 6, toCol: s3Bars.length - 1,
            fromVal: planVal(2026), toVal: planVal(targetEndYear),
            text: pctStr(planVal(targetEndYear), s3Base.total), level: 0
          } : null,
        ].filter(Boolean) as Callout[];

        // Q1 2026 Scope 3 YTD
        const s3_2026ytd = s3Data.find(d => d.year === 2026);

        // OGSM rows
        const ogsm = [
          {
            label: 'Scope 3 — absol. CO₂eq (tCO₂e)', vals: [
              s3Base.total, s3_2022?.total || 0, s3_2023?.total || 0, s3_2024?.total || 0,
              s3Cur.total,
              s3_2026ytd ? s3_2026ytd.total : '—',
              planYears[0] ? planVal(planYears[0]) : '—',
              planYears[1] ? planVal(planYears[1]) : '—',
            ]
          },
          {
            label: '  ↳ Cat.1 Cashew (FLAG)', vals: [
              s3Base.cat1, s3_2022?.cat1 || 0, s3_2023?.cat1 || 0, s3_2024?.cat1 || 0,
              s3Cur.cat1, s3_2026ytd ? s3_2026ytd.cat1 : '—', '—', '—',
            ]
          },
          {
            label: '  ↳ Cat.3 WTT Fuel & Energy', vals: [
              s3Base.cat3, s3_2022?.cat3 || 0, s3_2023?.cat3 || 0, s3_2024?.cat3 || 0,
              s3Cur.cat3, s3_2026ytd ? s3_2026ytd.cat3 : '—', '—', '—',
            ]
          },
          {
            label: '  ↳ Cat.4 Transport', vals: [
              s3Base.cat4v + s3Base.cat4r, (s3_2022?.cat4v || 0) + (s3_2022?.cat4r || 0),
              (s3_2023?.cat4v || 0) + (s3_2023?.cat4r || 0), (s3_2024?.cat4v || 0) + (s3_2024?.cat4r || 0),
              s3Cur.cat4v + s3Cur.cat4r,
              s3_2026ytd ? s3_2026ytd.cat4v + s3_2026ytd.cat4r : '—', '—', '—',
            ]
          },
        ];

        const oKeys = ['2021', '2022', '2023', '2024', '2025', 'Q1 2026*', '2026 Plan', '2027 Plan'];
        const oYears = [2021, 2022, 2023, 2024, 2025, 2026, 2026, 2027]; // year index per column for intensity
        const s3IntLabel = showIntensity ? 'tCO₂e/RCN' : 'tCO₂e';

        return (
          <div style={{ padding: '4px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* OGSM Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#1a3d5c', color: 'white' }}>
                    <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, minWidth: 220 }}>
                      OGSM — {s3IntLabel}
                    </th>
                    {oKeys.map((k, ki) => (
                      <th key={k} style={{
                        padding: '5px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
                        background: k.includes('2026*') ? '#E8960E' : undefined,
                      }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ogsm.map((row, ri) => (
                    <tr key={ri} style={{ background: ri === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '4px 8px', fontWeight: ri === 0 ? 700 : 400, color: ri === 0 ? '#1a1a1a' : '#555' }}>{row.label}</td>
                      {row.vals.map((v, vi) => (
                        <td key={vi} style={{
                          padding: '4px 8px', textAlign: 'right',
                          fontWeight: vi === 5 ? 800 : ri === 0 ? 600 : 400,
                          color: vi >= 6 ? '#777' : vi === 5 ? '#7a4f00' : ri === 0 ? '#1a1a1a' : '#555',
                          background: vi === 5 ? '#fff8e1' : undefined,
                        }}>
                          {typeof v === 'number'
                            ? (showIntensity && vi < 5 ? fmtInt(v, oYears[vi]) : fmt(v))
                            : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart + Commentary side by side */}
            <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
              {/* Chart */}
              <div style={{ flex: '0 0 55%', minWidth: 0 }}>
                <WaterfallChart
                  bars={s3Bars}
                  callouts={s3Callouts}
                  title={`<strong>Scope 3 — Supply Chain</strong> – CO₂ eq absol. emission in ton`}
                  legendOrder={['baseline', 'actual', 'target']}
                  downloadName="Scope3_Emissions.png"
                />
                {/* Target callout box */}
                <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: '10px', color: '#555' }}>
                  <div style={{ padding: '4px 8px', background: '#eaf5ea', border: '1px solid #3E7B3E', borderRadius: 4 }}>
                    🎯 <strong>FLAG −{FLAG_TGT_PCT}%</strong>: {fmt(flagBase)} → {fmt(flagTarget2032)} tCO₂e by 2032
                  </div>
                  <div style={{ padding: '4px 8px', background: '#eaf5ea', border: '1px solid #3E7B3E', borderRadius: 4 }}>
                    🎯 <strong>Non-FLAG −{NONFLAG_TGT_PCT}%</strong>: {fmt(nonflagBase)} → {fmt(nonflagTarget2032)} tCO₂e by 2032
                  </div>
                </div>

                {/* ── Overall Scope 3 Commentary ── */}
                <div style={{ marginTop: 10, fontSize: '11px', lineHeight: '1.55', color: '#333' }}>
                  <p style={{ margin: '0 0 4px', padding: '6px 10px', background: pctVsBase <= 0 ? '#f0fdf4' : '#fff5f5', borderLeft: `3px solid ${pctVsBase <= 0 ? '#3E7B3E' : '#C8281A'}`, borderRadius: '4px' }}>
                    <strong style={{ color: pctVsBase <= 0 ? '#3E7B3E' : '#C8281A' }}>
                      {lang === 'vi' ? '📊 Hiệu suất Tổng thể Scope 3:' : '📊 Scope 3 Overall Performance:'}
                    </strong>{' '}
                    {lang === 'vi' ? 'Tổng phát thải chuỗi cung ứng hiện tại ghi nhận ở mức ' : 'Total supply chain footprint currently sits at '}
                    <strong>{fmt(s3Cur.total)} tCO₂e</strong> ({pctVsBase > 0 ? '+' : ''}{pctVsBase}% {lang === 'vi' ? 'so với năm cơ sở 2021' : 'vs 2021 baseline'}).{' '}
                    {pctVsBase <= 0
                      ? (lang === 'vi' ? 'Đang đi đúng hướng so với mục tiêu dài hạn SBTi (2032).' : 'Currently tracking positively against long-term SBTi objectives (2032).')
                      : (lang === 'vi' ? 'Cần tăng tốc giảm phát thải từ nguồn mua sắm (Cat.1) và vận chuyển (Cat.4) để đưa quỹ đạo về sát mục tiêu FLAG.' : 'Accelerated reductions in procurement (Cat.1) and transport (Cat.4) are required to realign with the FLAG trajectory.')}
                  </p>
                </div>

                {/* ── Origin Risk Analysis Panel ── */}
                {showOrigin && (() => {
                  const selOD = originData.find(d => d.year === selectedOriginYear);
                  const baseOD = originData.find(d => d.year === 2021);
                  if (!selOD) return null;

                  // Scale emissions to match actual Cat.1 from DB
                  const actualCat1 = cat1ByYear[selectedOriginYear] || 0;
                  const rawTotal = selOD.totalEm;
                  const scale = rawTotal > 0 && actualCat1 > 0 ? actualCat1 / rawTotal : 1;
                  const scaledRows = selOD.rows.map(r => ({ ...r, emS: Math.round(r.em * scale), volPct: selOD.totalQty > 0 ? r.qty / selOD.totalQty * 100 : 0 }));
                  const maxEmS = Math.max(...scaledRows.map(r => r.emS));
                  const scaledTotal = Math.round(selOD.totalEm * scale);
                  const scaledHighEf = Math.round(selOD.highEfEm * scale);

                  return (
                    <div style={{ marginTop: 10, border: '1.5px solid #C8281A', borderRadius: 6, overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ background: '#C8281A', color: 'white', padding: '5px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>🌍 Cat.1 Origin Risk Analysis</span>
                        <span style={{ fontWeight: 400, opacity: 0.85, fontSize: '10px' }}>
                          Avg EF: {selOD.weightedAvgEF.toFixed(2)} tCO₂e/MT
                          {baseOD ? ` (2021: ${baseOD.weightedAvgEF.toFixed(2)})` : ''}
                        </span>
                      </div>

                      <div style={{ padding: '8px', background: '#fff' }}>
                        {/* Year selector — CLICKABLE */}
                        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                          {[2021, 2022, 2023, 2024, 2025].map(oyr => {
                            const od = originData.find(d => d.year === oyr);
                            if (!od) return null;
                            const actCat1 = cat1ByYear[oyr] || 0;
                            const sc = od.totalEm > 0 && actCat1 > 0 ? actCat1 / od.totalEm : 1;
                            const highPct = od.totalEm > 0 ? Math.round(od.highEfEm / od.totalEm * 100) : 0;
                            const isSel = oyr === selectedOriginYear;
                            return (
                              <button
                                key={oyr}
                                onClick={() => setSelectedOriginYear(oyr)}
                                style={{
                                  fontSize: '10.5px', padding: '4px 9px',
                                  border: `1.5px solid ${isSel ? '#C8281A' : '#ddd'}`,
                                  borderRadius: 4, cursor: 'pointer',
                                  background: isSel ? '#C8281A' : '#f9f9f9',
                                  color: isSel ? '#fff' : '#444',
                                  fontWeight: isSel ? 700 : 400,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <strong>{oyr}</strong> &nbsp;
                                🔴 {highPct}% high-EF
                              </button>
                            );
                          })}
                        </div>

                        {/* Table + Donut side by side */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <OriginDetailTable
                              scaledRows={scaledRows}
                              maxEmS={maxEmS}
                              scaledTotal={scaledTotal}
                              scaledHighEf={scaledHighEf}
                            />
                          </div>
                          <OriginDonut rows={scaledRows} scaledTotal={scaledTotal} />
                        </div>

                        {/* YoY Decomposition */}
                        {(() => {
                          const prevOD = originData.find(d => d.year === selectedOriginYear - 1);
                          if (!prevOD || selectedOriginYear <= 2021) return null;
                          const prevActual = cat1ByYear[selectedOriginYear - 1] || 0;
                          const delta = actualCat1 - prevActual;
                          const volumeEffect = Math.round((selOD.totalQty - prevOD.totalQty) * prevOD.weightedAvgEF);
                          const mixEffect = Math.round(delta - volumeEffect);
                          const absMax = Math.max(Math.abs(volumeEffect), Math.abs(mixEffect), 1);
                          return (
                            <div style={{ marginTop: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 5, border: '1px solid #eee' }}>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#333', marginBottom: 4 }}>
                                📊 YoY Decomposition {selectedOriginYear - 1}→{selectedOriginYear}: {delta >= 0 ? '+' : ''}{fmt(delta)} tCO₂e
                              </div>
                              {([['📦 Volume effect', volumeEffect], ['🎯 Mix/EF effect', mixEffect]] as [string, number][]).map(([label, val]) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: '9.5px', width: 100, color: '#555', flexShrink: 0 }}>{label}</span>
                                  <div style={{ flex: 1, height: 10, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.abs(val) / absMax * 100}%`, background: val > 0 ? '#C8281A' : '#3E7B3E', borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: val > 0 ? '#C8281A' : '#3E7B3E', width: 70, textAlign: 'right', flexShrink: 0 }}>
                                    {val > 0 ? '+' : ''}{fmt(val)} tCO₂e
                                  </span>
                                </div>
                              ))}
                              <div style={{ marginTop: 3, fontSize: '9px', color: '#777', fontStyle: 'italic' }}>
                                {Math.abs(mixEffect) > Math.abs(volumeEffect)
                                  ? (lang === 'vi' ? '⚠️ Thay đổi chủ yếu do SOURCING MIX (chuyển sang origin EF cao hơn), không phải do mua nhiều hơn.' : '⚠️ Change primarily driven by SOURCING MIX (shift to higher EF origin), not by volume.')
                                  : (lang === 'vi' ? '📦 Thay đổi chủ yếu do VOLUME (mua nhiều/ít hơn), không phải do thay đổi nguồn.' : '📦 Change primarily driven by VOLUME (purchasing more/less), not by origin shift.')}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Avg EF trend */}
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '10px', color: '#555' }}>
                          <strong style={{ color: '#1a1a1a' }}>Weighted Avg EF trend:</strong>
                          {originData.map(od => {
                            const prev = originData.find(d => d.year === od.year - 1);
                            const improving = prev ? od.weightedAvgEF < prev.weightedAvgEF : true;
                            return (
                              <span key={od.year} style={{ color: improving ? '#3E7B3E' : '#C8281A', fontWeight: 600 }}>
                                {od.year}: {od.weightedAvgEF.toFixed(2)}{prev ? (improving ? '▼' : '▲') : ''}
                              </span>
                            );
                          })}
                        </div>
                        <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                          {lang === 'vi' ? '⚠️ Data based on SBTi FLAG EF methodology. Click row để xem phân tích EF-driven vs Volume-driven.' : '⚠️ Data based on SBTi FLAG EF methodology. Click row to view EF-driven vs Volume-driven analysis.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Enhanced Scope 3 Analysis Panel ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ── Note banner ── */}
                <div style={{ padding: '6px 10px', background: '#fffbeb', border: '1px solid #E8960E', borderRadius: 5, fontSize: '10.5px', color: '#7a4f00' }}>
                  {lang === 'vi' ? (
                    <>ℹ️ <strong style={{ display: 'inline-flex', alignItems: 'center' }}>Scope 3 Overview & EF Analysis
                      <span title="Khối phân tích dùng EF (tCO₂e/tấn RCN) làm thước đo chính để bóc tách:&#10;Sự tăng/giảm phát thải năm nay là do quy mô kinh doanh thay đổi (Volume), hay do chuỗi cung ứng đang kém/tốt đi (Sourcing Mix / Mua từ vùng có EF cao)?&#10;Các biểu đồ bên dưới sẽ bóc tách yếu tố Volume, chỉ đánh giá thuần túy hiệu suất Carbon (EF) để đưa ra định hướng Action Plan." style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, background: '#E8960E', color: 'white', borderRadius: '50%', fontSize: '9px', marginLeft: 6, fontWeight: 'bold' }}>?</span>
                    </strong> — Phân tích <em>overview tổng thể</em> vì dữ liệu Scope 3 chưa phân theo nhà máy. EF (tCO₂e / tRCN) giúp đánh giá hiệu quả phát thải.<br /><span style={{ opacity: 0.85, fontSize: '9.5px' }}>* Rê chuột vào dấu (?) trên tiêu đề để xem nguyên lý phân tích.</span></>
                  ) : (
                    <>ℹ️ <strong style={{ display: 'inline-flex', alignItems: 'center' }}>Scope 3 Overview & EF Analysis
                      <span title="This analysis uses EF (tCO₂e/tonne RCN) to isolate:&#10;Are emission changes due to business scale (Volume) or actual supply chain efficiency (Sourcing Mix)?&#10;The charts below strip away the Volume factor to evaluate pure Carbon efficiency, generating targeted Action Plans." style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, background: '#E8960E', color: 'white', borderRadius: '50%', fontSize: '9px', marginLeft: 6, fontWeight: 'bold' }}>?</span>
                    </strong> — <em>Aggregated overview</em> logic applied as Scope 3 is not yet allocated per factory. EF (tCO₂e / tRCN) evaluates emissions efficiency.<br /><span style={{ opacity: 0.85, fontSize: '9.5px' }}>* Hover over the (?) icon in the title to view analysis rationale.</span></>
                  )}
                </div>

                {/* ── EF Trend — all years ── */}
                {(() => {
                  const efYears = [2021, 2022, 2023, 2024, 2025].map(y => {
                    const s3y = s3Data.find(d => d.year === y);
                    const rcn = rcnByYear[y] || 0;
                    const ef = rcn > 0 && s3y ? s3y.total / rcn : 0;
                    const cat1 = rcn > 0 && s3y ? s3y.cat1 / rcn : 0;
                    const cat3 = rcn > 0 && s3y ? s3y.cat3 / rcn : 0;
                    const cat4 = rcn > 0 && s3y ? (s3y.cat4v + s3y.cat4r) / rcn : 0;
                    return { y, ef, cat1, cat3, cat4, total: s3y?.total || 0, rcn };
                  }).filter(d => d.rcn > 0);

                  if (efYears.length < 2) return null;

                  const W = 520, H = 200, PL = 38, PR = 12, PT = 22, PB = 36;
                  const cW = (W - PL - PR) / efYears.length;
                  const SUB_CATS = [
                    { key: 'cat1' as const, color: '#2F855A', label: 'Cat.1' },
                    { key: 'cat3' as const, color: '#90BE6D', label: 'Cat.3' },
                    { key: 'cat4' as const, color: '#4A9E8C', label: 'Cat.4' },
                  ];
                  const subW = Math.min(cW / (SUB_CATS.length + 0.6), 34);
                  const maxEF = Math.max(...efYears.map(d => d.ef)) * 1.3 || 1;
                  const chartH = H - PB - PT;
                  const py = (v: number) => PT + chartH - (v / maxEF) * chartH;
                  const ph = (v: number) => Math.max((v / maxEF) * chartH, 1);
                  const groupX = (i: number) => PL + cW * i + (cW - subW * SUB_CATS.length) / 2;

                  return (
                    <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#333' }}>
                          {lang === 'vi' ? '📊 EF Scope 3 — tCO₂e per tonne RCN (tất cả các năm)' : '📊 Scope 3 EF — tCO₂e per tonne RCN (all years)'}
                        </div>
                        <button
                          onClick={() => downloadSvgAsPng(document.getElementById('svg-s3-ef') as unknown as SVGSVGElement, 'Scope3_EF_Trend.png')}
                          style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          title="Tải ảnh PNG độ phân giải cao"
                        >
                          <span>📸</span> HD
                        </button>
                      </div>
                      <svg id="svg-s3-ef" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                        {[0.25, 0.5, 0.75, 1].map(f => {
                          const gv = +(maxEF * f).toFixed(2);
                          const gy = py(maxEF * f);
                          return (
                            <g key={f}>
                              <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="#eee" strokeWidth={0.8} />
                              <text x={PL - 3} y={gy + 3.5} textAnchor="end" fontSize={8} fill="#aaa">{gv}</text>
                            </g>
                          );
                        })}
                        <line x1={PL} y1={PT + chartH} x2={W - PR} y2={PT + chartH} stroke="#bbb" strokeWidth={1.2} />
                        {efYears.map((d, i) => {
                          const gx = groupX(i);
                          const prev = efYears[i - 1];
                          const delta = prev ? d.ef - prev.ef : 0;
                          const isUp = delta > 0.001;
                          const isDn = delta < -0.001;
                          return (
                            <g key={d.y}>
                              {SUB_CATS.map((cat, si) => {
                                const val = d[cat.key];
                                const bx = gx + si * subW;
                                const bh = ph(val);
                                const by = py(val);
                                return (
                                  <g key={cat.key}>
                                    <rect x={bx} y={by} width={subW - 1} height={bh} fill={cat.color} rx={1} opacity={0.88} />
                                    {bh > 14 && (
                                      <text x={bx + subW / 2 - 0.5} y={by + bh / 2 + 3.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="white">
                                        {val.toFixed(2)}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                              <text x={gx + subW * SUB_CATS.length / 2} y={py(d.ef) - 5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#333">
                                {d.ef.toFixed(2)}
                              </text>
                              {i > 0 && (isUp || isDn) && (
                                <text x={gx + subW * SUB_CATS.length / 2} y={py(d.ef) - 14} textAnchor="middle" fontSize={8.5} fontWeight={800}
                                  fill={isUp ? '#C8281A' : '#3E7B3E'}>
                                  {isUp ? '▲' : '▼'}{Math.abs(delta).toFixed(2)}
                                </text>
                              )}
                              <text x={gx + subW * SUB_CATS.length / 2} y={H - 6} textAnchor="middle" fontSize={10} fontWeight={d.y === 2025 ? 800 : 600} fill="#444">
                                {d.y}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: '10px' }}>
                        {SUB_CATS.map(c => (
                          <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, background: c.color, display: 'inline-block', borderRadius: 2 }} />
                            <span style={{ color: '#555' }}>{c.label}</span>
                          </span>
                        ))}
                        <span style={{ color: '#888', marginLeft: 4 }}>{lang === 'vi' ? '▲▼ = YoY delta EF' : '▲▼ = EF YoY delta'}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Category % Chart — all years ── */}
                {(() => {
                  const catYears = [2021, 2022, 2023, 2024, 2025]
                    .map(y => s3Data.find(d => d.year === y))
                    .filter(Boolean) as typeof s3Data;
                  if (catYears.length === 0) return null;
                  const W = 520, H = 130, PL = 50, PR = 10, PT = 14, PB = 28;
                  const chartW = W - PL - PR;
                  const rowH = (H - PT - PB) / catYears.length;
                  const cats = [
                    { key: 'cat1', label: 'Cat.1 Cashew', color: '#2F855A' },
                    { key: 'cat3', label: 'Cat.3 WTT', color: '#90BE6D' },
                    { key: 'cat4', label: 'Cat.4 Transport', color: '#4A9E8C' },
                  ];
                  return (
                    <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 6, padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#333' }}>
                          {lang === 'vi' ? '🥧 Tỷ trọng % Category Scope 3 — qua các năm' : '🥧 Scope 3 Category Breakdown (%) — YoY'}
                        </div>
                        <button
                          onClick={() => downloadSvgAsPng(document.getElementById('svg-s3-cat') as unknown as SVGSVGElement, 'Scope3_Category_Percentage.png')}
                          style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          title="Tải ảnh PNG độ phân giải cao"
                        >
                          <span>📸</span> HD
                        </button>
                      </div>
                      <svg id="svg-s3-cat" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                        {catYears.map((row, i) => {
                          const total = row.total || 1;
                          const segs = [row.cat1, row.cat3, row.cat4v + row.cat4r];
                          const y = PT + i * rowH;
                          let curX = PL;
                          return (
                            <g key={row.year}>
                              <text x={PL - 4} y={y + rowH / 2 + 4} textAnchor="end" fontSize={9.5} fontWeight={row.year === 2025 ? 800 : 600} fill="#444">
                                {row.year}
                              </text>
                              {segs.map((val, si) => {
                                const pct = val / total;
                                const sw = chartW * pct;
                                const bx = curX;
                                curX += sw;
                                return (
                                  <g key={si}>
                                    <rect x={bx} y={y + 1} width={sw} height={rowH - 3} fill={cats[si].color} rx={1} opacity={0.85} />
                                    {sw > 28 && (
                                      <text x={bx + sw / 2} y={y + rowH / 2 + 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="white">
                                        {Math.round(pct * 100)}%
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                        {[0, 0.25, 0.5, 0.75, 1].map(f => (
                          <g key={f}>
                            <line x1={PL + chartW * f} y1={PT} x2={PL + chartW * f} y2={H - PB + 4} stroke="#ddd" strokeWidth={0.8} />
                            <text x={PL + chartW * f} y={H - PB + 14} textAnchor="middle" fontSize={8} fill="#aaa">{Math.round(f * 100)}%</text>
                          </g>
                        ))}
                      </svg>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2, fontSize: '10px' }}>
                        {cats.map(c => (
                          <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 10, height: 10, background: c.color, display: 'inline-block', borderRadius: 2 }} />
                            <span style={{ color: '#555' }}>{c.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Smart YoY Commentary ── */}
                {(() => {
                  const allYrs = [2021, 2022, 2023, 2024, 2025].map(y => {
                    const s3y = s3Data.find(d => d.year === y);
                    const rcn = rcnByYear[y] || 0;
                    return {
                      y, ef: rcn > 0 && s3y ? s3y.total / rcn : 0,
                      total: s3y?.total || 0, rcn,
                      cat1Pct: s3y && s3y.total > 0 ? Math.round(s3y.cat1 / s3y.total * 100) : 0,
                      cat4Pct: s3y && s3y.total > 0 ? Math.round((s3y.cat4v + s3y.cat4r) / s3y.total * 100) : 0,
                    };
                  }).filter(d => d.rcn > 0);
                  if (allYrs.length < 2) return null;
                  const rows = allYrs.slice(1).map((cur, i) => {
                    const prev = allYrs[i];
                    const delta = cur.ef - prev.ef;
                    const pctChg = prev.ef > 0 ? (delta / prev.ef) * 100 : 0;
                    const absDelta = cur.total - prev.total;
                    return {
                      from: prev.y, to: cur.y, delta, pctChg, absDelta, curEf: cur.ef, prevEf: prev.ef,
                      cat1Pct: cur.cat1Pct, cat4Pct: cur.cat4Pct
                    };
                  });
                  const latestRow = rows[rows.length - 1];
                  return (
                    <div style={{ fontSize: '11px', lineHeight: '1.65', borderTop: '1px solid #eee', paddingTop: 8 }}>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1a3d5c' }}>
                        {lang === 'vi' ? `✏️ So sánh EF Scope 3 — Năm qua Năm (${allYrs[0].y}–${allYrs[allYrs.length - 1].y})` : `✏️ Scope 3 EF Comparison — Year over Year (${allYrs[0].y}–${allYrs[allYrs.length - 1].y})`}
                      </p>
                      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                          <thead>
                            <tr style={{ background: '#1a3d5c', color: 'white' }}>
                              <th style={{ padding: '3px 6px', textAlign: 'left' }}>{lang === 'vi' ? 'Giai đoạn' : 'Period'}</th>
                              <th style={{ padding: '3px 6px', textAlign: 'right' }}>{lang === 'vi' ? 'EF trước' : 'Prev EF'}</th>
                              <th style={{ padding: '3px 6px', textAlign: 'right' }}>{lang === 'vi' ? 'EF hiện tại' : 'Cur EF'}</th>
                              <th style={{ padding: '3px 6px', textAlign: 'right' }}>Δ EF</th>
                              <th style={{ padding: '3px 6px', textAlign: 'right' }}>Δ Emission</th>
                              <th style={{ padding: '3px 6px', textAlign: 'left' }}>{lang === 'vi' ? 'Nhận xét' : 'Remarks'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(r => {
                              const isUp = r.delta > 0.005;
                              const isDn = r.delta < -0.005;
                              const remark = isUp
                                ? (lang === 'vi' ? 'EF tăng → nguồn carbon cao hơn hoặc logistics kém hiệu quả' : 'EF increased → higher carbon source or inefficient logistics')
                                : isDn
                                  ? (lang === 'vi' ? 'EF giảm → tối ưu logistics hoặc nguồn carbon thấp hơn' : 'EF decreased → logistics optimized or lower carbon source')
                                  : (lang === 'vi' ? 'EF ổn định' : 'Stable EF');
                              return (
                                <tr key={r.to} style={{ borderBottom: '1px solid #eee', background: isUp ? '#fff5f5' : isDn ? '#f0fdf4' : '#fff' }}>
                                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>{r.from}→{r.to}</td>
                                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{r.prevEf.toFixed(3)}</td>
                                  <td style={{
                                    padding: '3px 6px', textAlign: 'right', fontWeight: 700,
                                    color: isUp ? '#C8281A' : isDn ? '#3E7B3E' : '#333'
                                  }}>
                                    {r.curEf.toFixed(3)}
                                  </td>
                                  <td style={{
                                    padding: '3px 6px', textAlign: 'right', fontWeight: 800,
                                    color: isUp ? '#C8281A' : isDn ? '#3E7B3E' : '#555'
                                  }}>
                                    {isUp ? '+' : ''}{r.delta.toFixed(3)} ({r.pctChg > 0 ? '+' : ''}{r.pctChg.toFixed(1)}%)
                                  </td>
                                  <td style={{
                                    padding: '3px 6px', textAlign: 'right',
                                    color: r.absDelta > 0 ? '#C8281A' : '#3E7B3E', fontWeight: 600
                                  }}>
                                    {r.absDelta > 0 ? '+' : ''}{Math.round(r.absDelta).toLocaleString()}
                                  </td>
                                  <td style={{ padding: '3px 6px', color: isUp ? '#C8281A' : isDn ? '#3E7B3E' : '#777', fontSize: '10px' }}>
                                    {isUp ? '⬆️' : isDn ? '⬇️' : '↔️'} {remark}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {latestRow.delta > 0.005 ? (
                        <div style={{ padding: '7px 10px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 5, marginBottom: 6 }}>
                          <strong style={{ color: '#C8281A' }}>⬆️ {lang === 'vi' ? `D. Nguyên nhân EF tăng (${latestRow.from}→${latestRow.to}):` : `D. Causes of EF Increase (${latestRow.from}→${latestRow.to}):`}</strong>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                            {latestRow.cat4Pct > 30 && <li>📦 {lang === 'vi' ? <span>Tăng tỷ trọng <strong>vận chuyển dài/hàng không</strong> — Cat.4 chiếm {latestRow.cat4Pct}% Scope 3</span> : <span>Increased ratio of <strong>long-haul/air freight</strong> — Cat.4 accounts for {latestRow.cat4Pct}% of Scope 3</span>}</li>}
                            <li>✈️ {lang === 'vi' ? <span>Tăng <strong>đi lại nhân sự</strong> và chi phí di chuyển</span> : <span>Increased <strong>business travel</strong> and commuting</span>}</li>
                            <li>⛽ {lang === 'vi' ? <span>Nguồn cung <strong>nhiên liệu carbon cao</strong> tăng</span> : <span>Increased supply of <strong>high-carbon fuel</strong></span>}</li>
                            {latestRow.cat1Pct > 60 && <li>🌍 {lang === 'vi' ? <span>Tăng <strong>mua sắm từ nguồn emission cao</strong> — Cat.1 chiếm {latestRow.cat1Pct}% Scope 3</span> : <span>Increased <strong>procurement from high-emission sources</strong> — Cat.1 accounts for {latestRow.cat1Pct}% of Scope 3</span>}</li>}
                          </ul>
                        </div>
                      ) : latestRow.delta < -0.005 ? (
                        <div style={{ padding: '7px 10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 5, marginBottom: 6 }}>
                          <strong style={{ color: '#3E7B3E' }}>⬇️ {lang === 'vi' ? `D. Nguyên nhân EF giảm (${latestRow.from}→${latestRow.to}):` : `D. Causes of EF Decrease (${latestRow.from}→${latestRow.to}):`}</strong>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                            <li>🌿 {lang === 'vi' ? <span>Chuyển <strong>nhà cung cấp carbon thấp hơn</strong> (Nigeria, Benin, Cambodia)</span> : <span>Shifted to <strong>lower-carbon suppliers</strong> (Nigeria, Benin, Cambodia)</span>}</li>
                            <li>🚢 {lang === 'vi' ? <span>Tối ưu <strong>lộ trình và phương tiện vận tải</strong></span> : <span>Optimized <strong>routes and transport modes</strong></span>}</li>
                            <li>💻 {lang === 'vi' ? <span>Giảm travel, <strong>tăng họp trực tuyến</strong></span> : <span>Reduced travel, <strong>increased virtual meetings</strong></span>}</li>
                            <li>📈 {lang === 'vi' ? <span>Cải thiện <strong>hiệu suất sử dụng nguyên liệu</strong></span> : <span>Improved <strong>material utilization efficiency</strong></span>}</li>
                          </ul>
                        </div>
                      ) : (
                        <div style={{ padding: '6px 10px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 5, marginBottom: 6, fontSize: '10.5px', color: '#555' }}>
                          ↔️ {lang === 'vi' ? 'EF ổn định trong năm gần nhất — tiếp tục duy trì.' : 'EF stable in recent year — maintain performance.'}
                        </div>
                      )}
                      <div style={{ padding: '7px 10px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 5 }}>
                        <strong style={{ color: '#0369a1', display: 'flex', alignItems: 'center' }}>
                          🎯 {lang === 'vi' ? 'Đề xuất hành động — 2 category ưu tiên:' : 'Action Plan — 2 priority categories:'}
                          <span title={lang === 'vi' ? "❗ KẾT LUẬN CHIẾN LƯỢC TỪ DỮ LIỆU:&#10;1. Sinh mệnh nằm ở phòng Thu Mua: Cat.1 (nguyên liệu RCN) chiếm 98% Scope 3. Việc đạt target phụ thuộc hoàn toàn vào quyết định của Purchasing.&#10;2. Lỗi Sourcing mang tính thời vụ: EF nhảy múa (tăng/giảm thất thường) cho thấy chúng ta đang mua theo giá rẻ thay vì vùng có lượng carbon thấp.&#10;3. Công thức thành công (Dựa trên data 2025): Chuyển hướng mua hàng sang Tây Phi (Nigeria, Benin, Cambodia) thay vì vùng thâm canh cao (Indonesia/Việt Nam).&#10;👉 Hành động: Bắt buộc đưa EF của vùng trồng vào ma trận thầu thu mua từ 2026." : "❗ STRATEGIC EXECUTIVE SUMMARY:&#10;1. Survival lies in Procurement: Cat.1 (RCN) accounts for 98% of Scope 3. Target achievement depends almost entirely on Purchasing decisions.&#10;2. Opportunistic Sourcing: The wildly fluctuating EF shows we buy based on price rather than prioritizing low-carbon origin regions.&#10;3. The Blueprint (based on 2025 data): Directing sourcing volumes toward West Africa/Cambodia instead of highly intensified regions natively drops EF.&#10;👉 Action: The Origin Emission Factor MUST be integrated into the procurement bidding KPI matrix starting 2026."} style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, background: '#C8281A', color: 'white', borderRadius: '50%', fontSize: '10px', marginLeft: 8, fontWeight: 'bold', boxShadow: '0 0 4px rgba(200,40,26,0.4)' }}>!</span>
                        </strong>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                          <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', border: '1px solid #e0f2fe' }}>
                            <div style={{ fontWeight: 700, color: '#4A9E8C', marginBottom: 3, fontSize: '10.5px' }}>🚢 {lang === 'vi' ? 'Vận chuyển' : 'Transport'} (Cat.4)</div>
                            <ul style={{ margin: 0, paddingLeft: 14, fontSize: '10px', color: '#444' }}>
                              <li>{lang === 'vi' ? 'Gom đơn hàng → giảm số chuyến' : 'Consolidate orders → reduce trips'}</li>
                              <li>{lang === 'vi' ? 'Vessel thay thế road freight cho hàng xa' : 'Use vessel over road freight for long hauls'}</li>
                              <li>{lang === 'vi' ? 'Load factor target ≥85%' : 'Load factor target ≥85%'}</li>
                            </ul>
                          </div>
                          <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', border: '1px solid #e0f2fe' }}>
                            <div style={{ fontWeight: 700, color: '#2F855A', marginBottom: 3, fontSize: '10.5px' }}>🌍 {lang === 'vi' ? 'Mua sắm' : 'Procurement'} (Cat.1)</div>
                            <ul style={{ margin: 0, paddingLeft: 14, fontSize: '10px', color: '#444' }}>
                              <li>{lang === 'vi' ? 'Ưu tiên Nigeria/Benin/Cambodia (EF thấp)' : 'Prioritize Nigeria/Benin/Cambodia (low EF)'}</li>
                              <li>{lang === 'vi' ? 'Giảm Indonesia/Vietnam (EF cao)' : 'Reduce Indonesia/Vietnam (high EF)'}</li>
                              <li>{lang === 'vi' ? 'Yêu cầu RA/ASC supplier certification' : 'Demand RA/ASC supplier certification'}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: '10.5px', color: '#555', lineHeight: '1.55' }}>
                        <strong>{lang === 'vi' ? 'Lộ trình:' : 'Roadmap:'}</strong> {targetEndYear}: <strong style={{ color: '#3E7B3E' }}>{fmt(planVal(targetEndYear))} tCO₂e</strong> →{' '}
                        SBTi 2032: <strong style={{ color: '#3E7B3E' }}>{fmt(totalTarget2032)} tCO₂e</strong>{' '}
                        (run-rate: ~<strong>{fmt(annualCutNeeded)} {lang === 'vi' ? 'tCO₂e/năm' : 'tCO₂e/yr'}</strong>).
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          </div>
        );
      })()}

      {selectedScope === 'intensity' && (() => {
        const S1_COLOR = C.actual;          // #C8281A — đỏ (Scope 1)
        const S2_COLOR = '#9ab0c4';         // xanh xám nhạt — Scope 2
        const HDR_COLOR = '#1a3d5c';        // navy — factory headers
        const ACCENT = C.actual;            // #C8281A
        // ── RCN line chart ─────────────────────────────────────────
        function RcnChart({ yrs, svgId, facId }: { yrs: { year: number; rcn: number }[]; svgId: string; facId: string }) {
          const W = 300, H = 170;
          const PL = 38, PR = 38, PT = 36, PB = 24;
          const n = yrs.length;
          const step = (W - PL - PR) / (n - 1);
          const maxV = Math.max(...yrs.map(d => d.rcn)) * 1.22 || 1;
          const px = (i: number) => PL + i * step;
          const py = (v: number) => PT + (H - PT - PB) * (1 - v / maxV);
          const pts = yrs.map((d, i) => `${px(i)},${py(d.rcn)}`).join(' ');
          return (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => downloadSvgAsPng(document.getElementById(svgId) as unknown as SVGSVGElement, `RCN_Production_Trend_${facId}.png`)}
                style={{ position: 'absolute', top: 0, right: 0, fontSize: '10px', padding: '2px 5px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                title="Tải ảnh PNG độ phân giải cao"
              >
                <span>📸</span> HD
              </button>
              <svg id={svgId} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* baseline rule */}
                <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#ddd" strokeWidth={1} />
                <polyline points={pts} fill="none" stroke={S1_COLOR} strokeWidth={2.2} strokeLinejoin="round" />
                {yrs.map((d, i) => {
                  const cx = px(i);
                  const cy = py(d.rcn);
                  // stagger label: even indices go above, odd below — prevents overlap
                  const labelY = i % 2 === 0 ? cy - 9 : cy + 17;
                  return (
                    <g key={d.year}>
                      <circle cx={cx} cy={cy} r={4} fill={S1_COLOR} stroke="white" strokeWidth={1} />
                      <text x={cx} y={Math.min(Math.max(labelY, 12), H - PB - 3)}
                        textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#1a1a1a">
                        {d.rcn.toLocaleString()}
                      </text>
                      <text x={cx} y={H - 5} textAnchor="middle" fontSize={9} fill="#666">{d.year}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        }

        // ── Intensity stacked bar chart ─────────────────────────────
        function IntChart({ yrs, svgId, facId }: { yrs: { year: number; s1Int: number; s2Int: number; totalInt: number }[]; svgId: string; facId: string }) {
          const W = 300, H = 190;
          const PL = 10, PR = 10, PT = 26, PB = 38;
          const n = yrs.length;
          const cw = (W - PL - PR) / n;
          const bw = Math.min(cw * 0.68, 48);
          const bx = (i: number) => PL + i * cw + (cw - bw) / 2;
          const cx = (i: number) => PL + i * cw + cw / 2;
          const chartH = H - PT - PB;
          const maxV = Math.max(...yrs.map(d => d.totalInt)) * 1.26 || 1;
          const py = (v: number) => PT + chartH * (1 - v / maxV);
          const ph = (v: number) => Math.max(chartH * v / maxV, 1);
          const s1BoxH = 14, s1BoxY = H - PB + 5, yrY = H - 5;

          return (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => downloadSvgAsPng(document.getElementById(svgId) as unknown as SVGSVGElement, `Emission_Intensity_${facId}.png`)}
                style={{ position: 'absolute', top: -14, right: 0, fontSize: '10px', padding: '2px 5px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                title="Tải ảnh PNG độ phân giải cao"
              >
                <span>📸</span> HD
              </button>
              <svg id={svgId} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* horizontal grid */}
                {[0.25, 0.5, 0.75, 1].map(f => (
                  <line key={f} x1={PL} y1={py(maxV * f / 1.26)} x2={W - PR} y2={py(maxV * f / 1.26)}
                    stroke="#eee" strokeWidth={1} strokeDasharray="3,3" />
                ))}
                {yrs.map((d, i) => {
                  const s2H = ph(d.s2Int);
                  const s1H = ph(d.s1Int);
                  const topY = py(d.totalInt);
                  const s1StartY = topY + s2H;
                  return (
                    <g key={d.year}>
                      {/* S2 gray bar */}
                      <rect x={bx(i)} y={topY} width={bw} height={s2H} fill={S2_COLOR} rx={1} />
                      {/* S1 dark red bar */}
                      <rect x={bx(i)} y={s1StartY} width={bw} height={s1H} fill={S1_COLOR} rx={1} />
                      {/* Total label above bar */}
                      <text x={cx(i)} y={topY - 5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#111">
                        {d.totalInt.toFixed(1)}
                      </text>
                      {/* S2 value inside gray bar */}
                      {s2H > 20 && (
                        <text x={cx(i)} y={topY + s2H / 2 + 4} textAnchor="middle" fontSize={9} fontWeight={600} fill="#333">
                          {d.s2Int.toFixed(1)}
                        </text>
                      )}
                      {/* S1 box + label below bars */}
                      <rect x={bx(i)} y={s1BoxY} width={bw} height={s1BoxH} rx={2} fill={S1_COLOR} />
                      <text x={cx(i)} y={s1BoxY + s1BoxH - 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="white">
                        {d.s1Int.toFixed(1)}
                      </text>
                      {/* Year */}
                      <text x={cx(i)} y={yrY} textAnchor="middle" fontSize={9.5} fill="#555">{d.year}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        }

        // ── Commentary: auto-computed insights ────────────────────────
        const YEARS5 = [2021, 2022, 2023, 2024, 2025];
        const facCols = intensityData.filter(c => c.fac.id !== 'TOTAL');
        const totalCol = intensityData.find(c => c.fac.id === 'TOTAL');
        const get5 = (col: typeof intensityData[0], yr: number) => col.years.find(y => y.year === yr)!;

        // Best factory 2025 (lowest total intensity)
        const best25 = [...facCols].sort((a, b) => get5(a, 2025).totalInt - get5(b, 2025).totalInt)[0];
        const worst25 = [...facCols].sort((a, b) => get5(b, 2025).totalInt - get5(a, 2025).totalInt)[0];
        const totalInt21 = totalCol ? get5(totalCol, 2021).totalInt : 0;
        const totalInt25 = totalCol ? get5(totalCol, 2025).totalInt : 0;
        const totalPct = totalInt21 > 0 ? Math.round(((totalInt25 - totalInt21) / totalInt21) * 100) : 0;
        const totalRcn25 = totalCol ? get5(totalCol, 2025).rcn : 0;
        const totalRcn21 = totalCol ? get5(totalCol, 2021).rcn : 0;
        const rcnPct = totalRcn21 > 0 ? Math.round(((totalRcn25 - totalRcn21) / totalRcn21) * 100) : 0;
        const s2Share25 = totalInt25 > 0 && totalCol ? Math.round(get5(totalCol, 2025).s2Int / totalInt25 * 100) : 0;

        return (
          <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Slide-style wrapper — natural height, no aspect-ratio constraint */}
            <div style={{
              width: '100%',
              background: '#fff',
              border: `1.5px solid #b8ccd9`,
              borderRadius: 8,
              boxShadow: '0 3px 16px rgba(26,61,92,0.10)',
              overflow: 'hidden',
            }}>
              {/* ── Slide title bar ── */}
              <div style={{ padding: '8px 16px 6px', borderBottom: `2.5px solid ${ACCENT}`, background: '#fff' }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#111', lineHeight: 1.2 }}>
                  CO₂ Intensity &amp; RCN Production Trend (2021–2025)
                </div>
                <div style={{ fontSize: 12, color: '#555', fontWeight: 600, marginTop: 2 }}>
                  Scope 1 &amp; Scope 2 — {lang === 'vi' ? 'theo Nhà máy và Tổng' : 'by Factory and Total'}
                </div>
              </div>

              {/* ── Main body: charts left + commentary right ── */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>

                {/* LEFT: 5-col chart grid (~76%) */}
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #d0dde8' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${intensityData.length}, minmax(0,1fr))`,
                  }}>
                    {intensityData.map((col, ci) => (
                      <div key={col.fac.id} style={{
                        borderLeft: ci > 0 ? '1px solid #e0e0e0' : 'none',
                        display: 'flex', flexDirection: 'column',
                      }}>
                        {/* Factory header */}
                        <div style={{
                          background: HDR_COLOR, color: 'white',
                          textAlign: 'center', padding: '5px 4px',
                          fontSize: 11, fontWeight: 800, lineHeight: 1.2,
                        }}>
                          {col.fac.id === 'TOTAL'
                            ? (lang === 'vi' ? 'Tổng – Tất cả NM' : 'Total – All Factories')
                            : col.fac.name}
                        </div>

                        {/* RCN chart */}
                        <div style={{ borderBottom: '1px solid #eee', padding: '4px 2px 0' }}>
                          <div style={{ fontSize: 9, color: '#666', fontWeight: 600, textAlign: 'center' }}>
                            RCN {lang === 'vi' ? 'Đầu vào (tấn)' : 'Input (t)'}
                          </div>
                          <RcnChart yrs={col.years} svgId={`svg-rcn-${col.fac.id}`} facId={col.fac.id} />
                        </div>

                        {/* Intensity chart */}
                        <div style={{ padding: '4px 2px 0' }}>
                          <div style={{ fontSize: 9, color: '#666', fontWeight: 600, textAlign: 'center' }}>
                            CO₂ Intensity (kg CO₂e / t RCN)
                          </div>
                          <IntChart yrs={col.years} svgId={`svg-int-${col.fac.id}`} facId={col.fac.id} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend + footnote */}
                  <div style={{ padding: '6px 10px', background: '#f0f4f8', borderTop: '1px solid #c8d8e8', marginTop: 'auto' }}>
                    <div style={{ fontSize: 10, color: '#444', lineHeight: 1.5 }}>
                      <strong>SCOPE DEFINITION:&nbsp;</strong>
                      <span style={{ color: S1_COLOR, fontWeight: 700 }}>■ Scope 1 (Dark Red)</span>
                      {lang === 'vi' ? ': Phát thải trực tiếp từ đốt nhiên liệu tại chỗ.' : ': Direct emissions from on-site fuel combustion (firewood, diesel, LPG…).'}
                      {'  '}
                      <span style={{ color: S2_COLOR, fontWeight: 700 }}>■ Scope 2 (Blue-gray)</span>
                      {lang === 'vi' ? ': Phát thải gián tiếp từ điện lưới mua vào.' : ': Indirect emissions from purchased electricity.'}
                    </div>
                    <div style={{ fontSize: 9, color: '#999', fontStyle: 'italic', marginTop: 2 }}>
                      {lang === 'vi'
                        ? 'Cường độ CO₂ = kg CO₂e / tấn RCN đầu vào. Scope 1 = đốt nhiên liệu | Scope 2 = điện mua vào.'
                        : 'CO₂ intensity = kg CO₂e per metric ton of RCN input. Scope 1 = direct fuel combustion | Scope 2 = purchased electricity only.'}
                    </div>
                  </div>
                </div>

                {/* RIGHT: Commentary panel — fixed 220px */}
                <div style={{
                  width: 220, flexShrink: 0,
                  background: 'linear-gradient(180deg,#edf2f7 0%,#dde8f0 100%)',
                  display: 'flex', flexDirection: 'column',
                  padding: '10px 10px 10px',
                  gap: 7,
                }}>
                  <div style={{ fontSize: 'clamp(8px,0.85vw,11px)', fontWeight: 800, color: HDR_COLOR, borderBottom: `1.5px solid ${HDR_COLOR}`, paddingBottom: 3, marginBottom: 2 }}>
                    {lang === 'vi' ? '📋 Nhận xét' : '📋 Key Observations'}
                  </div>

                  {/* Bullet items */}
                  {[
                    {
                      icon: '📈',
                      title: lang === 'vi' ? 'Sản lượng RCN' : 'RCN Production',
                      body: lang === 'vi'
                        ? `Tổng sản lượng 2025: ${totalRcn25.toLocaleString()} t (${rcnPct > 0 ? '+' : ''}${rcnPct}% so với 2021). Xu hướng tăng ổn định qua các năm.`
                        : `Total 2025: ${totalRcn25.toLocaleString()} t (${rcnPct > 0 ? '+' : ''}${rcnPct}% vs 2021). Stable upward production trend.`,
                    },
                    {
                      icon: totalPct <= 0 ? '✅' : '⚠️',
                      title: lang === 'vi' ? 'Cường độ Tổng (2021→2025)' : 'Overall Intensity Trend',
                      body: lang === 'vi'
                        ? `Cường độ CO₂ tổng thể ${totalPct <= 0 ? 'giảm' : 'tăng'} ${Math.abs(totalPct)}% từ ${totalInt21.toFixed(1)} → ${totalInt25.toFixed(1)} kg CO₂e/t RCN. ${totalPct <= 0 ? 'Cải thiện hiệu quả phát thải trên sản lượng.' : 'Cần chú ý kiểm soát phát thải.'}`
                        : `Group CO₂ intensity ${totalPct <= 0 ? 'decreased' : 'increased'} ${Math.abs(totalPct)}% from ${totalInt21.toFixed(1)} → ${totalInt25.toFixed(1)} kg CO₂e/t RCN. ${totalPct <= 0 ? 'Emission efficiency improved.' : 'Emission control attention needed.'}`,
                    },
                    {
                      icon: '🏆',
                      title: lang === 'vi' ? 'Nhà máy tốt nhất 2025' : 'Best Factory 2025',
                      body: lang === 'vi'
                        ? `${best25.fac.name}: ${get5(best25, 2025).totalInt.toFixed(1)} kg CO₂e/t RCN — cường độ thấp nhất trong nhóm. Là benchmark cho các nhà máy còn lại.`
                        : `${best25.fac.name}: ${get5(best25, 2025).totalInt.toFixed(1)} kg CO₂e/t RCN — lowest intensity in the group. Sets the internal benchmark.`,
                    },
                    {
                      icon: '🔴',
                      title: lang === 'vi' ? 'Nhà máy cần cải thiện' : 'Factory to Watch',
                      body: lang === 'vi'
                        ? `${worst25.fac.name}: ${get5(worst25, 2025).totalInt.toFixed(1)} kg CO₂e/t RCN — cường độ cao nhất 2025. Ưu tiên tối ưu tiêu thụ điện và nhiên liệu.`
                        : `${worst25.fac.name}: ${get5(worst25, 2025).totalInt.toFixed(1)} kg CO₂e/t RCN — highest intensity in 2025. Priority: optimize electricity & fuel use.`,
                    },
                    {
                      icon: '⚡',
                      title: lang === 'vi' ? 'Scope 2 chiếm ưu thế' : 'Scope 2 Dominates',
                      body: lang === 'vi'
                        ? `Scope 2 (điện) chiếm ~${s2Share25}% cường độ CO₂ năm 2025. Chuyển sang điện tái tạo hoặc lắp đặt solar là đòn bẩy giảm phát thải chính.`
                        : `Scope 2 (electricity) accounts for ~${s2Share25}% of CO₂ intensity in 2025. Renewable energy transition or solar installation is the primary lever.`,
                    },
                  ].map((item, idx) => (
                    <div key={idx} style={{
                      background: '#fff',
                      borderRadius: 4,
                      borderLeft: `3px solid ${HDR_COLOR}`,
                      boxShadow: '0 1px 3px rgba(26,61,92,0.08)',
                      padding: '5px 8px 5px 7px',
                      fontSize: 'clamp(7px,0.72vw,9.5px)',
                      lineHeight: 1.45,
                    }}>
                      <div style={{ fontWeight: 800, color: HDR_COLOR, marginBottom: 2, fontSize: 'clamp(7.5px,0.78vw,10px)' }}>
                        {item.icon} {item.title}
                      </div>
                      <div style={{ color: '#444' }}>{item.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── NEW: 5-Panel Scope 3 Regional Slide ───────────────── */}
      {(() => {
        if (!scope3Regional.length) return null;

        // Target calculations
        const tBase = scope3Regional.find(row => row.year === 2021)?.total || 0;
        const target2032 = Math.round(tBase * 0.7); // 30% reduction SBTi
        const v2024 = scope3Regional.find(row => row.year === 2024)?.total || 0;
        const v2025 = scope3Regional.find(row => row.year === 2025)?.total || 0;
        const r2024Str = tBase ? `~${Math.round((tBase - v2024) / tBase * 100)}% reduction` : '';

        const maxTot = Math.max(tBase, v2024, v2025, 1) * 1.35;

        // Colors matching slide
        const CVN = '#9A0000'; // Dark red
        const CIN = '#8A8A8A'; // Grey

        return (
          <div style={{ padding: '24px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              width: '100%',
              background: '#F0EFEF', // Light gray background of slide
              border: `1.5px solid #dcdcdc`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              fontFamily: 'Inter, sans-serif'
            }}>
              {/* Slide Title */}
              <div style={{ padding: '16px 20px 10px', borderBottom: '1px solid #ccc' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#111', lineHeight: 1.1 }}>
                  Total Scope 3 Emissions – Vietnam &amp; India (2021–2025)
                </div>
                <div style={{ fontSize: 13, color: '#555', fontWeight: 500, marginTop: 4 }}>
                  Transportation | Fuel &amp; Energy | Purchase of Goods
                </div>
              </div>

              {/* Main Body Grid */}
              <div style={{ display: 'flex', padding: 12, gap: 12 }}>

                {/* LEFT: Panel 1 (Trend & Target) */}
                <div style={{ flex: '1.2' }}>
                  <div style={{
                    background: '#9A0000', color: 'white', padding: '4px 10px', fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', borderRadius: '4px 4px 0 0'
                  }}>
                    <div style={{
                      background: 'white', color: '#9A0000', width: 18, height: 18, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, fontSize: 11
                    }}>1</div>
                    TOTAL SCOPE 3 TREND &amp; TARGET
                  </div>
                  <div style={{ background: 'white', padding: '8px 16px 8px', border: '1px solid #ccc', borderTop: 'none', height: 300, position: 'relative' }}>

                    {/* SVG Stacked Chart -- viewBox expanded upward for annotation room */}
                    <svg viewBox="0 -65 580 285" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <marker id="s3-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                          <polygon points="0,0 8,4 0,8" fill="#9A0000" />
                        </marker>
                      </defs>

                      {/* Grid lines */}
                      {[0.25, 0.5, 0.75, 1].map(f => (
                        <line key={f} x1="0" x2="600" y1={210 - f * 210} y2={210 - f * 210} stroke="#eee" strokeWidth="1" />
                      ))}

                      {/* Bars — show 2021-2026 YTD, tight spacing */}
                      {scope3Regional.filter(r => r.year <= 2026).map((r, i) => {
                        const hIn = (r.india / maxTot) * 210;
                        const hVn = (r.vn / maxTot) * 210;
                        const x = 10 + i * 72;
                        return (
                          <g key={r.year}>
                            <rect x={x} y={210 - hIn} width={52} height={hIn} fill={CIN} />
                            {hIn > 20 && <text x={x + 26} y={210 - hIn / 2 + 4} textAnchor="middle" fill="white" fontSize="10">India</text>}
                            <rect x={x} y={210 - hIn - hVn} width={52} height={hVn} fill={CVN} />
                            {hVn > 20 && <text x={x + 26} y={210 - hIn - hVn / 2 + 4} textAnchor="middle" fill="white" fontSize="10">Vietnam</text>}
                            <text x={x + 26} y={210 - hIn - hVn - 5} textAnchor="middle" fill="#000" fontSize="11" fontWeight="800">
                              {r.total.toLocaleString()}
                            </text>
                            <text x={x + 26} y={226} textAnchor="middle" fill="#000" fontSize="11" fontWeight="600">
                              {r.year}{r.year === 2026 ? '*' : ''}
                            </text>
                          </g>
                        );
                      })}

                      {/* 2032 Target Bar -- placed far right after 2026 */}
                      <g>
                        <rect x={448} y={210 - (target2032 * 0.35 / maxTot) * 210} width={52} height={(target2032 * 0.35 / maxTot) * 210} fill={CIN} opacity={0.8} />
                        <rect x={448} y={210 - (target2032 / maxTot) * 210} width={52} height={(target2032 * 0.65 / maxTot) * 210} fill={CVN} opacity={0.8} />
                        <text x={474} y={210 - (target2032 / maxTot) * 210 - 5} textAnchor="middle" fill="#000" fontSize="11" fontWeight="800">
                          {target2032.toLocaleString()}
                        </text>
                        <text x={474} y={226} textAnchor="middle" fill="#000" fontSize="10" fontWeight="600">2032 Target</text>
                        <line x1={435} x2={515} y1={210} y2={210} stroke="#000" strokeWidth="2" strokeDasharray="4,4" />
                      </g>

                      {/* --- Callout annotations placed ABOVE the chart (y = -65 to 0 zone) --- */}
                      {/* Callout 1 (2024 reduction) - left top */}
                      <g>
                        <rect x={2} y={-62} width={148} height={42} fill="#fff8f8" stroke="#9A0000" strokeWidth="0.8" rx="3" />
                        <text x={8} y={-48} fontSize="10" fontWeight="700" fill="#9A0000">{r2024Str}</text>
                        <text x={8} y={-36} fontSize="10" fill="#555">achieved 2024 vs 2021</text>
                        <text x={8} y={-24} fontSize="10" fill="#555">baseline (Cat.1 mix shift)</text>
                        {/* Straight arrow pointing down toward 2024 bar (i=3, x=10+3*72=226, center=252) */}
                        <line x1={76} y1={-20} x2={252} y2={2} stroke="#9A0000" strokeWidth="1" markerEnd="url(#s3-arrow)" />
                      </g>

                      {/* Callout 2 (2025 note) - right top */}
                      <g>
                        <rect x={295} y={-62} width={155} height={42} fill="#fff8f8" stroke="#9A0000" strokeWidth="0.8" rx="3" />
                        <text x={301} y={-48} fontSize="10" fontWeight="700" fill="#9A0000">2025 rebound ↑</text>
                        <text x={301} y={-36} fontSize="10" fill="#555">Higher RCN procurement</text>
                        <text x={301} y={-24} fontSize="10" fill="#555">volume, still ~17% below '21</text>
                        {/* Straight arrow pointing down toward 2025 bar (i=4, x=10+4*72=298, center=324) */}
                        <line x1={370} y1={-20} x2={324} y2={2} stroke="#9A0000" strokeWidth="1" markerEnd="url(#s3-arrow)" />
                      </g>

                      {/* SBTi target label near target bar */}
                      <g>
                        <text x={474} y={210 - (target2032 / maxTot) * 210 - 25} textAnchor="middle" fontSize="9" fill="#9A0000" fontWeight="700">SBTi</text>
                        <text x={474} y={210 - (target2032 / maxTot) * 210 - 15} textAnchor="middle" fontSize="9" fill="#9A0000">-42% by</text>
                        <text x={474} y={210 - (target2032 / maxTot) * 210 - 5} textAnchor="middle" fontSize="9" fill="#9A0000">2032</text>
                      </g>

                      {/* Bottom line */}
                      <line x1="5" x2="510" y1="210" y2="210" stroke="#000" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* RIGHT: Panel 2 (Detailed Breakdown) */}
                <div style={{ flex: '0.8', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    background: '#9A0000', color: 'white', padding: '4px 10px', fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', borderRadius: '4px 4px 0 0'
                  }}>
                    <div style={{
                      background: 'white', color: '#9A0000', width: 18, height: 18, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, fontSize: 11
                    }}>2</div>
                    DETAILED BREAKDOWN BY CATEGORY &amp; COUNTRY (2021–2025)
                  </div>
                  <div style={{ background: 'transparent', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, padding: '4px 0' }}>

                    {[
                      { title: 'TRANSPORTATION (tCO₂e)', kIn: 'cat4_in', kVn: 'cat4_vn' },
                      { title: 'FUEL & ENERGY RELATED ACTIVITIES (tCO₂e)', kIn: 'cat3_in', kVn: 'cat3_vn' },
                      { title: 'PURCHASE OF GOODS & SERVICES (RCN) (tCO₂e)', kIn: 'cat1_in', kVn: 'cat1_vn' },
                    ].map((sec, sid) => {
                      const sectionMax = Math.max(...scope3Regional.map(r => r[sec.kIn as keyof typeof r] as number + (r[sec.kVn as keyof typeof r] as number)), 1) * 1.35;
                      return (
                        <div key={sid} style={{ background: 'white', border: '1px solid #ccc', padding: '4px 8px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, textAlign: 'center', color: '#333', background: '#eaeaea', padding: '2px 0', marginBottom: 6 }}>
                            {sec.title}
                          </div>
                          <div style={{ position: 'relative', flex: 1 }}>
                            {sid === 0 && (
                              <div style={{ position: 'absolute', top: -16, right: 0, display: 'flex', gap: 8, fontSize: 9, fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, background: CVN }} />Vietnam</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, background: CIN }} />India</div>
                              </div>
                            )}
                            <svg viewBox="0 0 400 90" width="100%" height="90" style={{ overflow: 'visible' }}>
                              <line x1="0" x2="400" y1="75" y2="75" stroke="#aaa" strokeWidth="1" />
                              {scope3Regional.map((r, i) => {
                                const vI = r[sec.kIn as keyof typeof r] as number;
                                const vV = r[sec.kVn as keyof typeof r] as number;
                                const hI = (vI / sectionMax) * 75;
                                const hV = (vV / sectionMax) * 75;
                                const x = 20 + i * (380 / 5);
                                return (
                                  <g key={r.year}>
                                    <rect x={x} y={75 - hI} width={36} height={hI} fill={CIN} />
                                    {hI > 17 && <text x={x + 18} y={75 - hI / 2 + 3} textAnchor="middle" fill="white" fontSize="9" fontWeight="600">{vI.toLocaleString()}</text>}

                                    <rect x={x} y={75 - hI - hV} width={36} height={hV} fill={CVN} />
                                    {hV > 17 && <text x={x + 18} y={75 - hI - hV / 2 + 3} textAnchor="middle" fill="white" fontSize="9" fontWeight="600">{vV.toLocaleString()}</text>}

                                    <text x={x + 18} y={75 - hI - hV - 4} textAnchor="middle" fill="#000" fontSize="10" fontWeight="800">{(vI + vV).toLocaleString()}</text>
                                    <text x={x + 18} y={87} textAnchor="middle" fill="#000" fontSize="9">{r.year}</text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Bottom Row Grids */}
              <div style={{ display: 'flex', padding: '0 12px 12px', gap: 12 }}>

                {/* Panel 3: Summary table */}
                <div style={{ flex: '0.6', border: '1px solid #ccc', background: 'white' }}>
                  <div style={{ background: '#9A0000', color: 'white', padding: '3px 8px', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'white', color: '#9A0000', width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6, fontSize: 9 }}>3</div>
                    TOTAL SCOPE 3 BY COUNTRY (SUMMARY)
                  </div>
                  <div style={{ display: 'flex', padding: '6px 12px', fontSize: 11 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#333', marginBottom: 4 }}>🇻🇳 Vietnam</div>
                      {scope3Regional.map(r => (
                        <div key={r.year} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                          <span style={{ color: '#666' }}>• {r.year}:</span>
                          <span style={{ fontWeight: 600 }}>{r.vn.toLocaleString()} tCO₂e</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: '#333', marginBottom: 4 }}>🇮🇳 India</div>
                      {scope3Regional.map(r => (
                        <div key={r.year} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                          <span style={{ color: '#666' }}>• {r.year}:</span>
                          <span style={{ fontWeight: 600 }}>{r.india.toLocaleString()} tCO₂e</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Panel 4: Insights */}
                <div style={{ flex: '1', border: '1px solid #ccc', background: 'white' }}>
                  <div style={{ background: '#9A0000', color: 'white', padding: '3px 8px', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'white', color: '#9A0000', width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6, fontSize: 9 }}>4</div>
                    KEY INSIGHTS, DRIVERS &amp; NEXT ACTIONS
                  </div>
                  <div style={{ padding: '6px 12px', fontSize: 10, lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>Trends &amp; Drivers</div>
                    <ul style={{ paddingLeft: 14, margin: '0 0 6px 0', color: '#444' }}>
                      <li>Strong downward trend from 2021 to 2024 driven by reduced RCN volumes and sourcing changes</li>
                      <li>2025 increase mainly due to higher RCN procurement volume</li>
                      <li>Emissions in 2025 remain significantly below 2021 baseline (~17% lower)</li>
                      <li>Changes in RCN sourcing profile (not only volume) play a critical role in overall Scope 3 performance</li>
                    </ul>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>Category Insight</div>
                    <ul style={{ paddingLeft: 14, margin: 0, color: '#444' }}>
                      <li>Purchase of Goods &amp; Services (RCN) dominates Scope 3 emissions (&gt;90%)</li>
                      <li>Emission intensity is influenced by: Agricultural practices, Processing methods, Distance from sourcing origin to factories</li>
                    </ul>
                  </div>
                </div>

                {/* Panel 5: Strategy */}
                <div style={{ flex: '0.8', border: '1px solid #ccc', background: 'white' }}>
                  <div style={{ background: '#9A0000', color: 'white', padding: '3px 8px', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'white', color: '#9A0000', width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6, fontSize: 9 }}>5</div>
                    NEXT ACTIONS &amp; LONG-TERM STRATEGY (2032)
                  </div>
                  <div style={{ padding: '6px 12px', fontSize: 10, lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>RCN Sourcing Strategy</div>
                    <ul style={{ paddingLeft: 14, margin: '0 0 6px 0', color: '#444' }}>
                      <li>Prioritize low-emission-factor (low EF) RCN suppliers</li>
                      <li>Increase sourcing from geographically closer origins to reduce transport-related emissions</li>
                      <li>Gradually integrate sustainability criteria into RCN supplier selection</li>
                    </ul>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>Fuel &amp; Energy Strategy</div>
                    <ul style={{ paddingLeft: 14, margin: '0 0 6px 0', color: '#444' }}>
                      <li>Evaluate increased use of biomass and alternative fuels with lower emission factors</li>
                      <li>Continue improving fuel efficiency and monitoring energy-related Scope 3 impacts</li>
                    </ul>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>Overall Focus</div>
                    <ul style={{ paddingLeft: 14, margin: '0 0 0 0', color: '#444' }}>
                      <li>Shift Scope 3 reduction approach from volume-driven to supply-chain optimization</li>
                      <li>Align sourcing, logistics, and fuel strategy to achieve 2032 SBTi-aligned target</li>
                    </ul>
                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Slide Footer ─────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '10px 32px 14px',
        borderTop: '1px solid #ccc',
        fontSize: '11px', color: '#888',
        marginTop: 'auto',
      }}>
        <span style={{ fontStyle: 'italic' }}>FC1 – OpEx Report · Updated Q1 2026 (Jan–Mar) · *Q1 figures are partial-year actuals</span>
        <span style={{ fontWeight: 700, color: '#555' }}>Intersnack Cashew Company</span>
      </div>
    </div>
  );
}
