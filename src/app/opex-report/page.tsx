'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { getOpexReportData } from '@/lib/data-service';
import type { OpexAnnualData, OpexReportData, OpexScope1BreakYear, OpexScope3RegionalRow } from '@/lib/data-service';
import { downloadSvgAsPng } from '@/lib/chart-exports';
import { ORIGIN_EF, ROUTE_KM } from '@/lib/scope3-data';

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
  if (n == null) return '';
  return Math.round(n).toLocaleString('de-DE');
}

// Short format for INSIDE bars (avoids overflow in narrow bars)
// Updated to use the same consistent format but with smaller font sizes in rendering instead of 'K' text.
function fmtBar(n: number): string {
  if (n == null) return '';
  return Math.round(n).toLocaleString('de-DE');
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
  marker?: number;             // overlay target line on a bar (useful for showing target on a prediction bar)
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
  compact = false,
}: {
  bars: BarPoint[];
  callouts?: Callout[];
  title: string;
  legendOrder?: ('baseline' | 'actual' | 'estimated' | 'target')[];
  downloadName?: string;
  compact?: boolean;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);

  // SVG dimensions — keep Opex waterfall executive-sized instead of filling the viewport.
  const W = 560, H = compact ? 260 : 320;
  const PL = 8, PR = 8, PT = compact ? 74 : 104, PB = compact ? 34 : 42;
  const cw = (W - PL - PR) / bars.length;
  const bw = Math.min(compact ? 34 : 34, cw * (compact ? 0.58 : 0.58));
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
        <div style={{ fontSize: compact ? '11.5px' : '12.5px', fontWeight: 700, color: '#222', lineHeight: 1.25 }}
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
      <div style={{ display: 'flex', gap: compact ? '8px' : '12px', marginBottom: compact ? '0px' : '2px', fontSize: compact ? '9.5px' : '10.5px', alignItems: 'center', justifyContent: 'flex-end' }}>
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
            const isEstGap = b.key.includes('fc2026_gap');
            const color = b.key === 'base' ? C.baseline :
              (b.key === 'end' || isTargetMarker) ? C.target :
                isEstGap ? C.estimated : C.actual;

            const val = b.actual ?? b.target ?? 0;
            if (val === 0) {
              // eslint-disable-next-line react-hooks/immutability -- local SVG accumulator inside render-only chart mapping.
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

            // eslint-disable-next-line react-hooks/immutability -- local SVG accumulator inside render-only chart mapping.
            prevVal = val;

            return (
              <g key={b.key}>
                {connLine}

                {b.isSplitSubtotal ? (
                  <>
                    {/* Stacked 2025 bar (approx match PPT ~ 62.4% Est / 37.6% Act) */}
                    <rect x={bx(i)} y={py(val)} width={bw} height={py(val * 0.376) - py(val)} fill={C.estimated} />
                    <rect x={bx(i)} y={py(val * 0.376)} width={bw} height={py(0) - py(val * 0.376)} fill={C.actual} />
                    <text x={cx(i)} y={py(val) + (py(val * 0.376) - py(val)) / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#222">
                      {fmt(val * 0.624)}
                    </text>
                    <text x={cx(i)} y={py(val * 0.376) + (py(0) - py(val * 0.376)) / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="white">
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

                  const isFC = b.key === 'fc2026';
                  const topColor = isFC ? C.estimated : C.target;

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
                      {/* Q2-Q4 plan/est = top portion */}
                      <rect x={bx(i)} y={topY} width={bw} height={planH} fill={topColor} rx={2} />
                      {/* Q1 actual = RED (bottom portion) */}
                      <rect x={bx(i)} y={splitY} width={bw} height={q1H} fill={C.actual} />
                      {/* Outline + white divider */}
                      <rect x={bx(i)} y={topY} width={bw} height={totalH} fill="none" stroke={isFC ? '#b45309' : '#444'} strokeWidth={0.8} rx={2} />
                      <line x1={bx(i)} y1={splitY} x2={bx(i) + bw} y2={splitY} stroke="white" strokeWidth={2.5} />
                      {/* Numbers only, no labels */}
                      {planH > 18 && (
                        <text x={cx(i)} y={topY + planH / 2 + 3.5} textAnchor="middle" fontSize={11} fontWeight="800" fill="white">{fmt(planAbs)}</text>
                      )}
                      {q1H > 18 && (
                        <text x={cx(i)} y={splitY + q1H / 2 + 3.5} textAnchor="middle" fontSize={11} fontWeight="800" fill="white">{fmt(q1Abs)}</text>
                      )}
                      {/* Total plan value above bar */}
                      <text x={cx(i)} y={topY - 6} textAnchor="middle" fontSize={11.5} fontWeight="800" fill={topColor}>{fmt(planVal2026)}</text>
                      {/* Optional Target Marker Overlay */}
                      {b.marker !== undefined && (
                        <g>
                          <line x1={bx(i) - 6} y1={py(b.marker)} x2={bx(i) + bw + 6} y2={py(b.marker)} stroke={C.target} strokeWidth={2.5} strokeDasharray="4,2" />
                        </g>
                      )}
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
                      // Inside tall bar — use strict format so text fits within bar width
                      <text x={cx(i)} y={boxY + boxH / 2 + 4.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="white">
                        {deltaStrShort}
                      </text>
                    ) : (
                      // Outside small bar — always above bar, full format
                      <text x={cx(i)} y={boxY - 6} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={color}>
                        {deltaStr}
                      </text>
                    )}
                  </>
                )}

                {/* Year labels below axis — no absolute value numbers, data is visible in bars */}
                {b.label.map((l, li) => (
                  <text key={li} x={cx(i)} y={PT + chartH + 18 + li * 15} textAnchor="middle" fontSize="12" fill="#555" fontWeight={600}>
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

// ── MTC (Months To Come) Purchasing Plan (from user's pivot table for REST OF 2026) ────────
// Origins mapped to ORIGIN_EF keys; BISSAU = Guinea-B; IVC = C.Ivory; CONAKRY = Guinea
export const MTC_2026_ORIGIN_MIX: Record<string, number> = {
  'Guinea-B': 3220 + 5648 + 3896 + 8011,   // BISSAU
  'C.Ivory': 4720 + 5852 + 2992 + 2100,     // IVC
  'Tanzania': 1800 + 1600 + 1760 + 0,       // TANZANIA (Tuticorin has 0 MTC, 4476 was all YTD)
  'Indonesia': 1685,                        // INDONESIA (Tay Ninh)
  'Cambodia': 1430,                         // CAMBODIA (Tay Ninh)
  'Senegal': 1610 + 1496,                   // SENEGAL
  'Ghana': 2860 + 6400,                     // GHANA
  'Guinea': 2992 + 1955,                    // CONAKRY
};

// Factory-level MTC totals (remaining plan only)
export const MTC_2026_FACTORIES: Record<string, { total: number; origins: Record<string, number> }> = {
  'Tay Ninh': { total: 14465, origins: { 'Guinea-B': 3220, 'Cambodia': 1430, 'Indonesia': 1685, 'C.Ivory': 4720, 'Senegal': 1610, 'Tanzania': 1800 } },
  'Long An': { total: 14596, origins: { 'Guinea-B': 5648, 'C.Ivory': 5852, 'Senegal': 1496, 'Tanzania': 1600 } },
  'Phan Thiet': { total: 14500, origins: { 'Guinea-B': 3896, 'Guinea': 2992, 'Ghana': 2860, 'C.Ivory': 2992, 'Tanzania': 1760 } },
  'Tuticorin': { total: 18466, origins: { 'Guinea-B': 8011, 'Guinea': 1955, 'Ghana': 6400, 'C.Ivory': 2100 } },
};

const MTC_2026_TOTAL_QTY = Object.values(MTC_2026_ORIGIN_MIX).reduce((s, v) => s + v, 0); // 62,027

// For 2026 forecast (using user's procurement plan)
export const PLAN_2026_ORIGIN_MIX: Record<string, number> = {
  'Guinea-B': 3220 + 6449 + 4596 + 10069,   // BISSAU
  'C.Ivory': 4720 + 5852 + 2992 + 2100,     // IVC
  'Tanzania': 2705 + 1800 + 4003 + 4260 + 4476, // TANZANIA (Added 2705 Tay Ninh YTD)
  'Indonesia': 830 + 1685,                      // INDONESIA (Tay Ninh: YTD 830 + MTC 1685)
  'Cambodia': 1430,                            // CAMBODIA (Tay Ninh only)
  'Senegal': 1610 + 1496,                    // SENEGAL
  'Ghana': 2860 + 6400,                    // GHANA
  'Guinea': 2992 + 1955,                    // CONAKRY
};

export const PLAN_2026_FACTORIES: Record<string, { total: number; origins: Record<string, number> }> = {
  'Tay Ninh': { total: 18000, origins: { 'Guinea-B': 3220, 'Cambodia': 1430, 'Indonesia': 830 + 1685, 'C.Ivory': 4720, 'Senegal': 1610, 'Tanzania': 2705 + 1800 } },
  'Long An': { total: 17800, origins: { 'Guinea-B': 6449, 'C.Ivory': 5852, 'Senegal': 1496, 'Tanzania': 4003 } },
  'Phan Thiet': { total: 17700, origins: { 'Guinea-B': 4596, 'Guinea': 2992, 'Ghana': 2860, 'C.Ivory': 2992, 'Tanzania': 4260 } },
  'Tuticorin': { total: 25000, origins: { 'Guinea-B': 10069, 'Guinea': 1955, 'Ghana': 6400, 'C.Ivory': 2100, 'Tanzania': 4476 } },
};

const PLAN_2026_TOTAL_QTY = Object.values(PLAN_2026_ORIGIN_MIX).reduce((s, v) => s + v, 0); // 78,500

/** Compute 2026 forecast Cat.1 (tCO₂e) purely for the MTC (Months to Come) */
function forecast2026Cat1_MTC(): number {
  let total = 0;
  for (const [origin, qty] of Object.entries(MTC_2026_ORIGIN_MIX)) {
    const ef = ORIGIN_EF[origin]?.ef ?? 2.5;
    total += qty * ef;
  }
  return total;
}

/** Compute 2026 forecast Cat.4 transport (tCO₂e).
 *  Uses actual per-route vessel + road distances (user-provided, Apr 2026).
 *  Tuticorin factory = ':IN' routes; all VN factories = ':VN' routes.
 *  EF: vessel = 0.01604 g CO₂e/t-km → 0.00001604 t/t-km
 *      road   = 0.07547 g CO₂e/t-km → 0.00007547 t/t-km
 */
function forecast2026Cat4_MTC(): { vessel: number; road: number; total: number; detail: { factory: string; origin: string; vesselTkm: number; roadTkm: number; co2: number }[] } {
  const EF_VESSEL = 0.01604 / 1000; // tCO₂e per tonne-km
  const EF_ROAD = 0.07547 / 1000;

  let totalVessel = 0;
  let totalRoad = 0;
  const detail: { factory: string; origin: string; vesselTkm: number; roadTkm: number; co2: number }[] = [];

  for (const [factory, { origins }] of Object.entries(MTC_2026_FACTORIES)) {
    const region = factory === 'Tuticorin' ? 'IN' : 'VN';
    for (const [origin, qty] of Object.entries(origins)) {
      const routeKey = `${origin}:${region}`;
      const route = ROUTE_KM[routeKey];
      if (!route) continue; // skip if no route data (e.g. Cambodia road-only to VN still works)
      const vesselTkm = qty * route.vessel;
      const roadTkm = qty * route.road;
      const co2 = vesselTkm * EF_VESSEL + roadTkm * EF_ROAD;
      totalVessel += vesselTkm * EF_VESSEL;
      totalRoad += roadTkm * EF_ROAD;
      detail.push({ factory, origin, vesselTkm, roadTkm, co2 });
    }
  }

  return {
    vessel: Math.round(totalVessel),
    road: Math.round(totalRoad),
    total: Math.round(totalVessel + totalRoad),
    detail,
  };
}

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
    // eslint-disable-next-line react-hooks/immutability -- local SVG angle accumulator for donut arc geometry.
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
  years, breakdown, selectedFac, compact = false,
}: {
  years: number[];
  breakdown: S1BreakYear[];
  selectedFac: string;
  compact?: boolean;
}) {
  const [hovYear, setHovYear] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const W = 540, H = compact ? 170 : 230;
  const PL = 6, PR = 6, PT = compact ? 10 : 14, PB = compact ? 34 : 50;
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
    <div style={{ marginTop: compact ? 4 : 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: compact ? '10.5px' : '11px', fontWeight: 700, color: '#C8281A' }}>
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
                  x={cx(i)} y={stackY + segH / 2 + 4.5}
                  textAnchor="middle" fontSize={compact ? 8.5 : segH > 28 ? 11 : 10}
                  fontWeight="800" fill="white"
                >
                  {Math.round(val).toLocaleString('de-DE')}
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
              <text x={cx(i)} y={barTop - 4} textAnchor="middle" fontSize={compact ? 9.5 : 11.5} fontWeight="800" fill="#333">
                {Math.round(bd.total).toLocaleString('de-DE')}
              </text>
              {/* Year label below */}
              <text x={cx(i)} y={PT + chartH + (compact ? 13 : 16)} textAnchor="middle" fontSize={compact ? 10.5 : 13} fill="#555" fontWeight={yr === 2026 ? 800 : 600}>
                {yr === 2026 ? "Q1'26" : yr.toString()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? '4px 10px' : '8px 16px', marginTop: compact ? 3 : 8, fontSize: compact ? '10px' : '12px' }}>
        {activeCats.map(c => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: compact ? 10 : 14, height: compact ? 10 : 14, background: c.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: '#444', fontWeight: 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


type ScopeMenuItem = {
  id: string;
  label: string;
  question: string;
  answerHint?: string;
  icon?: string;
};

function ScopeTOC({ title, items, accent = '#C8281A' }: { title: string; items: ScopeMenuItem[]; accent?: string }) {
  const [activeId, setActiveId] = useState(items[0]?.id || '');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    const sectionIds = new Set(items.map(item => item.id));
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top - 120) - Math.abs(b.boundingClientRect.top - 120));
        if (visible[0]?.target.id && sectionIds.has(visible[0].target.id)) {
          setActiveId(visible[0].target.id);
        }
      },
      { root: null, rootMargin: '-110px 0px -55% 0px', threshold: [0.08, 0.2, 0.4] }
    );

    items.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    const onScroll = () => {
      const els = items
        .map(item => document.getElementById(item.id))
        .filter(Boolean) as HTMLElement[];
      if (!els.length) return;
      const first = els[0].offsetTop;
      const last = els[els.length - 1].offsetTop + els[els.length - 1].offsetHeight;
      const y = window.scrollY + 140;
      setProgress(Math.max(0, Math.min(100, ((y - first) / Math.max(last - first, 1)) * 100)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [items]);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <aside style={{
      position: 'sticky', top: 74, alignSelf: 'start',
      border: '1px solid #dbe3ea', borderRadius: 12, overflow: 'hidden',
      background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 26px rgba(15,23,42,0.08)',
      backdropFilter: 'blur(10px)', zIndex: 20,
    }}>
      <div style={{ padding: '9px 11px', background: `linear-gradient(135deg, ${accent}, #111827)`, color: '#fff' }}>
        <div style={{ fontSize: 10, opacity: 0.78, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Menu động</div>
        <div style={{ fontSize: 13, fontWeight: 950, marginTop: 2 }}>{title}</div>
        <div style={{ height: 3, background: 'rgba(255,255,255,.22)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#fff', borderRadius: 99, transition: 'width .16s ease' }} />
        </div>
      </div>
      <nav style={{ padding: 8, display: 'grid', gap: 5 }} aria-label={`${title} section navigation`}>
        {items.map((item, idx) => {
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpTo(item.id)}
              style={{
                textAlign: 'left', cursor: 'pointer', borderRadius: 9, border: active ? `1.5px solid ${accent}` : '1px solid transparent',
                background: active ? `${accent}12` : 'transparent', padding: '8px 9px',
                display: 'grid', gridTemplateColumns: '20px 1fr', gap: 7, alignItems: 'start',
                boxShadow: active ? `0 5px 14px ${accent}20` : 'none', transition: 'all .18s ease',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: active ? accent : '#eef2f7', color: active ? '#fff' : '#475569', fontSize: 10, fontWeight: 950,
              }}>{item.icon || idx + 1}</span>
              <span>
                <span style={{ display: 'block', fontSize: 11.2, fontWeight: 900, color: active ? accent : '#1f2937', lineHeight: 1.15 }}>{item.label}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: '#64748b', lineHeight: 1.25 }}>{item.question}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function QuestionCard({
  id, item, accent = '#C8281A', children, defaultOpen = true,
}: {
  id: string;
  item: ScopeMenuItem;
  accent?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 92, marginBottom: 12 }}>
      <details open={defaultOpen} style={{ border: '1px solid #dbe3ea', borderRadius: 12, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 22px rgba(15,23,42,0.055)' }}>
        <summary style={{
          cursor: 'pointer', listStyle: 'none', padding: '9px 12px',
          background: `linear-gradient(135deg, ${accent}10, #f8fafc)`,
          borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: accent, color: '#fff', fontWeight: 950, flexShrink: 0,
          }}>{item.icon || '❓'}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.05em' }}>Câu hỏi cần trả lời</span>
            <span style={{ display: 'block', fontSize: 14, color: '#0f172a', fontWeight: 950, lineHeight: 1.25 }}>{item.question}</span>
            {item.answerHint && <span style={{ display: 'block', marginTop: 2, fontSize: 10.5, color: '#475569' }}>{item.answerHint}</span>}
          </span>
        </summary>
        <div style={{ padding: '10px 12px' }}>
          {children}
        </div>
      </details>
    </section>
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
  const [selectedScope, setSelectedScope] = useState<'scope1' | 'scope2' | 'supply' | 'intensity'>('scope1');
  const [showForecast, setShowForecast] = useState(false);
  const [selectedOriginYear, setSelectedOriginYear] = useState<number>(2026);
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
      s1Proj: (year: number) => Math.max(f_s1_2025 - f_s1AnnualCut * (year - 2025), f_s1FinalTarget),
      s2Proj: (year: number) => {
        const linearCut = f_s2_2025 - f_s2AnnualCut * (year - 2025);
        const solar = isSolar ? ptSolarSaving(year) : 0;
        return Math.max(linearCut - solar, f_s2FinalTargetBase);
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

  // ── FC 2026 Forecast values (always computed, shown when toggle ON) ──
  const ytd26rcn = get(2026).rcn;
  const hasQ1data = ytd26s1 > 0 || ytd26s2 > 0;

  // Resolve MTC for current factory selection (processing MTC, not procurement MTC)
  // MTC_2026_FACTORIES keys: 'Tay Ninh' | 'Long An' | 'Phan Thiet' | 'Tuticorin'
  const facMtcQty = (() => {
    if (selectedFac === 'ALL') return MTC_2026_TOTAL_QTY; // 62,027
    const facName = selectedFactory?.name || '';
    const normName = facName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normName.includes('tay ninh') || normName.includes('tay-ninh')) return MTC_2026_FACTORIES['Tay Ninh'].total;
    if (normName.includes('long an')) return MTC_2026_FACTORIES['Long An'].total;
    if (normName.includes('phan thiet') || normName.includes('phan-thiet') || normName.startsWith('pt')) return MTC_2026_FACTORIES['Phan Thiet'].total;
    if (normName.includes('tuti') || normName.includes('india')) return MTC_2026_FACTORIES['Tuticorin'].total;
    return MTC_2026_TOTAL_QTY;
  })();

  // Forecast based on YTD Actuals + (Intensity x MTC_QTY)
  // Scope 1 & 2 use factory-specific Processing MTC
  const int_s1 = ytd26rcn > 0 ? ytd26s1 / ytd26rcn : s1_2025 / get(2025).rcn;
  const int_s2 = ytd26rcn > 0 ? ytd26s2 / ytd26rcn : s2_2025 / get(2025).rcn;
  const mtc_s1 = int_s1 * facMtcQty;
  const mtc_s2 = int_s2 * facMtcQty;

  const calculatedFcS1 = Math.round(hasQ1data ? ytd26s1 + mtc_s1 : s1_2025);
  const calculatedFcS2 = Math.round(hasQ1data ? ytd26s2 + mtc_s2 : s2_2025);

  // FC1 2026 values from the Opex spreadsheet/comment thread are the reporting source of truth.
  // Keep the calculated values above only as a methodology reference, not as chart totals.
  const OPEX_FC1_2026_ALL = { scope1: 325, scope2: 12176 } as const;
  const fcS1 = selectedFac === 'ALL' ? OPEX_FC1_2026_ALL.scope1 : calculatedFcS1;
  const fcS2 = selectedFac === 'ALL' ? OPEX_FC1_2026_ALL.scope2 : calculatedFcS2;

  // Scope 3 Uses Procurement MTC (~62k) + YTD Actuals
  const s3Data2026 = s3Data.find(d => d.year === 2026);
  const ytd26_s3cat1 = s3Data2026?.cat1 || 0;
  const ytd26_s3cat4 = (s3Data2026?.cat4v || 0) + (s3Data2026?.cat4r || 0);

  const fcS3Cat1 = Math.round(ytd26_s3cat1 + forecast2026Cat1_MTC());
  const fcS3Cat4 = Math.round(ytd26_s3cat4 + forecast2026Cat4_MTC().total);

  const s3_2025_data = s3Data.find(d => d.year === 2025);
  const ytd26_s3cat3 = s3Data2026?.cat3 || 0;

  // Cat.3 estimation based on Q1 YTD Intensity (tCO2e/tRCN) applied to MTC volume (62,027) - consistent with S1/S2
  const int_s3cat3 = ytd26rcn > 0 ? ytd26_s3cat3 / ytd26rcn : (s3_2025_data ? s3_2025_data.cat3 / get(2025).rcn : 0);
  const fcS3Cat3 = Math.round(ytd26_s3cat3 + (int_s3cat3 * MTC_2026_TOTAL_QTY));
  const fcS3Total = fcS3Cat1 + fcS3Cat3 + fcS3Cat4;
  const fcTotal = fcS1 + fcS2 + fcS3Total;

  // Compute Targets for EST Gap Calculations
  const req26_s1 = Math.round(targetProj(s1_2025, s1AnnualCut, 2026));
  const req26_s2 = s2Proj(2026);
  let req26_s3 = 0;
  const s3BaseForTgt = s3Data.find(d => d.year === 2021);
  if (s3BaseForTgt && s3_2025_data) {
    const flagTarget2032 = Math.round(s3BaseForTgt.cat1 * (1 - FLAG_TGT_PCT / 100));
    const nonflagTarget2032 = Math.round((s3BaseForTgt.cat4v + s3BaseForTgt.cat4r + s3BaseForTgt.cat3) * (1 - NONFLAG_TGT_PCT / 100));
    const totalTarget2032 = flagTarget2032 + nonflagTarget2032;
    const annualCutS3 = (s3_2025_data.total - totalTarget2032) / (S3_TARGET_YEAR - 2025);
    req26_s3 = Math.round(s3_2025_data.total - annualCutS3 * 1);
  }

  // Deltas for Banner
  const s1delta = fcS1 - req26_s1;
  const s2delta = fcS2 - req26_s2;
  const s3delta = fcS3Total - req26_s3;

  // ── Executive layer metrics ───────────────────────────────
  const executiveRisks = [
    { scope: 'Scope 1', delta: s1delta, fc: fcS1, target: req26_s1, color: '#C8281A' },
    { scope: 'Scope 2', delta: s2delta, fc: fcS2, target: req26_s2, color: '#4472C4' },
    { scope: 'Scope 3', delta: s3delta, fc: fcS3Total, target: req26_s3, color: '#3E7B3E' },
  ].sort((a, b) => b.delta - a.delta);
  const topRisk = executiveRisks[0];
  const totalTarget26 = req26_s1 + req26_s2 + req26_s3;
  const totalGap26 = fcTotal - totalTarget26;

  const scope1ResidualRanking = factories.map(f => {
    const proj = getFacProj(f.id);
    const residual = Math.round(proj.s1Proj(2026));
    const base = (reportData.annualDataByFactory[f.id] || []).find(d => d.year === 2021)?.scope1 || 0;
    const status = base > 0 && residual <= base * 0.5 ? 'Ahead of 50%' : 'Watch';
    return { name: f.name, residual, base, share: fcS1 > 0 ? residual / fcS1 * 100 : 0, status };
  }).filter(r => r.residual > 0).sort((a, b) => b.residual - a.residual);
  const topResidualFactory = scope1ResidualRanking[0];

  const rcn2025 = get(2025).rcn || 0;
  const full26rcnForOps = ytd26rcn + facMtcQty;
  const s2Intensity2025 = rcn2025 > 0 ? s2_2025 / rcn2025 : 0;
  const productionMovementS2 = Math.round((full26rcnForOps - rcn2025) * s2Intensity2025);
  const solarReductionS2 = Math.round(cumulativeSolarSavingByYear(2026));
  const residualGridS2 = Math.max(fcS2, 0);
  const withoutSolarS2 = Math.max(fcS2 + solarReductionS2, 0);

  const s3_2025_total = s3_2025_data?.total || 0;
  const s3_2025_rcn = get(2025).rcn || 0;
  const s3FcRcn = (get(2026).rcn || 0) + MTC_2026_TOTAL_QTY;
  const s3Ef2025 = s3_2025_rcn > 0 ? s3_2025_total / s3_2025_rcn : 0;
  const s3EfFc2026 = s3FcRcn > 0 ? fcS3Total / s3FcRcn : 0;
  const s3VolumeEffect26 = Math.round((s3FcRcn - s3_2025_rcn) * s3Ef2025);
  const s3MixEffect26 = Math.round((s3EfFc2026 - s3Ef2025) * s3FcRcn);
  const s3DriverLabel = Math.abs(s3MixEffect26) > Math.abs(s3VolumeEffect26) ? 'EF / Origin Mix' : 'Volume / MTC';

  const actionRows = [
    {
      priority: 'High', scope: 'Scope 3', issue: 'High EF origin mix / Cat.1 sourcing risk',
      action: 'Add origin EF into procurement bidding matrix; prioritize lower-EF origins.', owner: 'Procurement', impact: 'Very High', timing: '2026 buying cycle'
    },
    {
      priority: s2delta > 0 ? 'High' : 'Medium', scope: 'Scope 2', issue: 'Residual grid dependency after solar impact',
      action: 'Accelerate solar PPA / rooftop rollout and lock renewable electricity procurement.', owner: 'Engineering / Energy', impact: 'High', timing: 'Q2–Q4 2026'
    },
    {
      priority: 'Medium', scope: 'Scope 1', issue: `${topResidualFactory?.name || 'Top factory'} residual direct emissions`,
      action: 'Keep biomass / boiler efficiency trajectory and target highest residual factories first.', owner: 'Factory Ops', impact: 'Medium', timing: 'Monthly review'
    },
  ];

  const scope1Menu: ScopeMenuItem[] = [
    { id: 's1-overview', label: 'Trend & target', icon: '1', question: 'Scope 1 đã thật sự giảm bền vững chưa?', answerHint: 'So sánh baseline, actual, FC 2026 và target trajectory.' },
    { id: 's1-breakdown', label: 'Fuel breakdown', icon: '2', question: 'Nguồn nào đang kéo Scope 1 lên?', answerHint: 'Tách wood, LPG/diesel, F-gas để thấy driver thật.' },
    { id: 's1-calc', label: 'FC 2026 calculation', icon: '3', question: 'Con số FC 2026 này lấy từ đâu?', answerHint: 'Phân biệt approved FC1 và internal Q1×MTC reference.' },
    { id: 's1-actions', label: 'So what?', icon: '4', question: 'Vậy nhà máy cần làm gì tiếp?', answerHint: 'Kết luận hành động và rủi ro còn lại.' },
  ];
  const scope2Menu: ScopeMenuItem[] = [
    { id: 's2-overview', label: 'Trend & target', icon: '1', question: 'Điện lưới còn là rủi ro lớn không?', answerHint: 'Nhìn Scope 2 từ baseline tới FC 2026.' },
    { id: 's2-calc', label: 'FC 2026 calculation', icon: '2', question: 'FC Scope 2 đang dựa trên gì?', answerHint: 'Q1 actual, MTC volume, grid EF và FC1 source.' },
    { id: 's2-actions', label: 'Solar & grid bridge', icon: '3', question: 'Solar có cứu được quỹ đạo không?', answerHint: 'Xem residual grid dependency và timing PT solar.' },
  ];
  const scope3Menu: ScopeMenuItem[] = [
    { id: 's3-overview', label: 'Scope 3 target path', icon: '1', question: 'Scope 3 có đang đi đúng đường SBTi không?', answerHint: 'Waterfall từ baseline tới FC 2026 và target.' },
    { id: 's3-origin', label: 'Cat.1 origin mix', icon: '2', question: 'Vì sao cùng mua RCN nhưng phát thải khác nhau?', answerHint: 'Origin EF và mix vùng mua là driver chính.' },
    { id: 's3-transport', label: 'Cat.4 logistics', icon: '3', question: 'Vận chuyển đóng góp bao nhiêu và route nào nặng nhất?', answerHint: 'Vessel + road theo route map.' },
    { id: 's3-regional', label: 'VN / India split', icon: '4', question: 'Gánh nặng Scope 3 đang nằm ở quốc gia nào?', answerHint: 'Slide 5-panel chia theo Vietnam và India.' },
    { id: 's3-calc', label: 'FC 2026 calculation', icon: '5', question: 'FC Scope 3 cộng từ những mảnh nào?', answerHint: 'Cat.1 + Cat.3 + Cat.4 reconciliation.' },
  ];
  const intensityMenu: ScopeMenuItem[] = [
    { id: 'intensity-overview', label: 'Intensity overview', icon: '1', question: 'Nhà máy nào đang phát thải hiệu quả nhất?', answerHint: 'So sánh kgCO₂e/tRCN và RCN trend.' },
    { id: 'intensity-factory', label: 'Factory panels', icon: '2', question: 'Sản lượng tăng có làm intensity xấu đi không?', answerHint: 'Đọc chung trend RCN và Scope 1/2 intensity.' },
  ];

  // ── Scope 1 bars ──────────────────────────────────────
  const s1Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b1, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope1 },
    { key: '2023', label: ['2023'], actual: get(2023).scope1 },
    { key: '2024', label: ['2024'], actual: get(2024).scope1 },
    { key: '2025', label: ['2025'], actual: s1_2025 },
    ...(showForecast ? [
      { key: 'fc2026_gap', label: ['Est gap', '25 & 26'], actual: fcS1 },
      {
        key: 'fc2026',
        label: ['2026 FC'],
        actual: fcS1,
        isTotal: true,
        isActualPlanSplit: true,
        splitActualAbsVal: ytd26s1 > 0 ? ytd26s1 : undefined,
        marker: req26_s1
      },
      ...targetBarsS1.slice(1)
    ] : [
      { key: 'req_2026', label: ['Target', '2026'], target: req26_s1 },
      ...targetBarsS1
    ]),
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s1, isTotal: true },
  ];

  // ── Scope 1 callouts ──────────────────────────────────
  const s1_2024 = get(2024).scope1;
  const s1Callouts: Callout[] = showForecast ? [
    b1 > 0 ? {
      // Delta from Baseline to 2026 Est.
      fromCol: 0, toCol: 6,
      fromVal: b1, toVal: fcS1,
      text: pctStr(fcS1, b1),
      level: 1
    } : null,
    end_s1 > 0 ? {
      fromCol: 6, toCol: s1Bars.length - 1,
      fromVal: fcS1, toVal: end_s1,
      text: pctStr(end_s1, b1),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[] : [
    b1 > 0 && get(2026).scope1 > 0 ? {
      fromCol: 0, toCol: 6,
      fromVal: b1, toVal: Math.round(targetProj(s1_2025, s1AnnualCut, 2026)),
      text: pctStr(Math.round(targetProj(s1_2025, s1AnnualCut, 2026)), b1),
      level: 0
    } : null,
    end_s1 > 0 ? {
      fromCol: 6, toCol: s1Bars.length - 1,
      fromVal: Math.round(targetProj(s1_2025, s1AnnualCut, 2026)), toVal: end_s1,
      text: pctStr(end_s1, b1),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[];

  // ── Scope 2 bars ──────────────────────────────────────
  const s2Bars: BarPoint[] = [
    { key: 'base', label: ['Baseline', '2021'], actual: b2, isTotal: true },
    { key: '2022', label: ['2022'], actual: get(2022).scope2 },
    { key: '2023', label: ['2023'], actual: get(2023).scope2 },
    { key: '2024', label: ['2024'], actual: get(2024).scope2 },
    { key: '2025', label: ['2025'], actual: s2_2025 },
    ...(showForecast ? [
      { key: 'fc2026_gap', label: ['Est gap', '25 & 26'], actual: fcS2 },
      {
        key: 'fc2026',
        label: ['2026 FC'],
        actual: fcS2,
        isTotal: true,
        isActualPlanSplit: true,
        splitActualAbsVal: ytd26s2 > 0 ? ytd26s2 : undefined,
        marker: req26_s2
      },
      ...targetBarsS2.slice(1)
    ] : [
      { key: 'req_2026', label: ['Target', '2026'], target: req26_s2 },
      ...targetBarsS2
    ]),
    { key: 'end', label: ['by End', targetEndYear.toString()], actual: end_s2, isTotal: true },
  ];

  // ── Scope 2 callouts ──────────────────────────────────
  const s2_2024 = get(2024).scope2;
  const s2Callouts: Callout[] = showForecast ? [
    b2 > 0 ? {
      fromCol: 0, toCol: 6,
      fromVal: b2, toVal: fcS2,
      text: pctStr(fcS2, b2),
      level: 1
    } : null,
    end_s2 > 0 ? {
      fromCol: 6, toCol: s2Bars.length - 1,
      fromVal: fcS2, toVal: end_s2,
      text: pctStr(end_s2, b2),
      level: 0
    } : null,
  ].filter(Boolean) as Callout[] : [
    b2 > 0 && get(2026).scope2 > 0 ? {
      fromCol: 0, toCol: 6,
      fromVal: b2, toVal: s2Proj(2026),
      text: pctStr(s2Proj(2026), b2),
      level: 0
    } : null,
    end_s2 > 0 ? {
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
              <button className={`opex-pill-btn${selectedScope === 'scope1' ? ' active-red' : ''}`}
                onClick={() => setSelectedScope('scope1')}>
                🔥 {lang === 'vi' ? 'Scope 1' : 'Scope 1'}
              </button>
              <button className={`opex-pill-btn${selectedScope === 'scope2' ? ' active-red' : ''}`}
                onClick={() => setSelectedScope('scope2')}>
                ⚡ {lang === 'vi' ? 'Scope 2' : 'Scope 2'}
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

            {/* FC 2026 Toggle */}
            <button
              onClick={() => setShowForecast(v => !v)}
              style={{
                padding: '5px 13px', fontSize: 12, fontWeight: showForecast ? 800 : 500,
                border: showForecast ? '2px solid #1a3d5c' : '1.5px dashed #999',
                borderRadius: 8, cursor: 'pointer',
                background: showForecast ? 'linear-gradient(135deg, #1a3d5c, #2d6a9f)' : '#f8f8f8',
                color: showForecast ? '#fff' : '#666',
                transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                boxShadow: showForecast ? '0 2px 8px rgba(26,61,92,0.3)' : 'none',
              }}
            >
              🔮 {showForecast ? (lang === 'vi' ? 'FC 2026 ✔' : 'FC 2026 ✔') : (lang === 'vi' ? 'Dự báo 2026' : 'FC 2026')}
            </button>

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
          {selectedScope === 'scope1'
            ? (lang === 'vi' ? '🔥 Scope 1: Phát thải trực tiếp — biomass, LPG/diesel, F-gas và residual emission theo nhà máy' : '🔥 Scope 1: Direct emissions — biomass, LPG/diesel, F-gas and factory residual emissions')
            : selectedScope === 'scope2'
              ? (lang === 'vi' ? '⚡ Scope 2: Điện lưới, solar/RE và driver bridge cho phụ thuộc điện còn lại' : '⚡ Scope 2: Grid electricity, solar/RE and driver bridge for residual grid dependency')
              : selectedScope === 'supply'
                ? (lang === 'vi' ? '🌿 Mục tiêu: −36.4% FLAG (Cat.1 Điều) | −7% Phi-FLAG đến 2032 (SBTi FLAG)' : '🌿 Target: −36.4% FLAG (Cat.1 Cashew) | −7% Non-FLAG by 2032 (SBTi FLAG)')
                : (lang === 'vi' ? '📊 Xu hướng Cường độ CO₂ & Sản lượng RCN (2021–2025) theo Nhà máy — Scope 1 & Scope 2' : '📊 CO₂ Intensity & RCN Production Trend (2021–2025) by Factory — Scope 1 & Scope 2')}
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid #C8281A', margin: '8px 0 0', opacity: 0.8 }} />
      </div>

      {/* ── Executive Summary & Action Priority ───────────────────────── */}
      <div style={{ margin: '0 12px 8px', display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 10 }}>
        <div style={{ border: '1px solid #dbe3ea', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.05)' }}>
          <div style={{ padding: '7px 12px', background: 'linear-gradient(135deg,#0f172a,#1a3d5c)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 12.5 }}>🏛️ Executive Summary — FC 2026</strong>
            <span style={{ fontSize: 10, opacity: 0.85 }}>Target vs forecast management view</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0 }}>
            {[
              { label: 'Total FC 2026', value: `${fmt(fcTotal)} tCO₂e`, sub: `Target gap ${totalGap26 > 0 ? '+' : ''}${fmt(totalGap26)}`, color: totalGap26 > 0 ? '#C8281A' : '#3E7B3E' },
              { label: 'Main risk', value: topRisk.scope, sub: `${topRisk.delta > 0 ? '+' : ''}${fmt(topRisk.delta)} vs target`, color: topRisk.delta > 0 ? '#C8281A' : '#3E7B3E' },
              { label: 'Key driver', value: s3DriverLabel, sub: `S3 mix ${s3MixEffect26 > 0 ? '+' : ''}${fmt(s3MixEffect26)} tCO₂e`, color: Math.abs(s3MixEffect26) > Math.abs(s3VolumeEffect26) ? '#C8281A' : '#E8960E' },
              { label: 'Best lever', value: 'Procurement EF', sub: 'Origin mix + supplier criteria', color: '#1a3d5c' },
            ].map(card => (
              <div key={card.label} style={{ padding: '10px 12px', borderRight: '1px solid #edf2f7' }}>
                <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{card.label}</div>
                <div style={{ marginTop: 3, fontSize: 17, fontWeight: 900, color: card.color, lineHeight: 1.05 }}>{card.value}</div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: '#475569' }}>{card.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '7px 12px', background: '#f8fafc', borderTop: '1px solid #edf2f7', fontSize: 11, color: '#334155', lineHeight: 1.45 }}>
            <strong>Board message:</strong> {lang === 'vi'
              ? `FC 2026 cho thấy rủi ro lớn nhất nằm ở ${topRisk.scope}; để khóa quỹ đạo giảm phát thải, ưu tiên cao nhất là đưa EF vùng mua hàng vào quyết định procurement và kiểm soát điện lưới còn lại.`
              : `FC 2026 shows the largest delivery risk in ${topRisk.scope}; protecting the decarbonization trajectory requires embedding origin EF into procurement decisions and controlling residual grid electricity.`}
          </div>
        </div>

        <div style={{ border: '1px solid #dbe3ea', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.05)' }}>
          <div style={{ padding: '7px 10px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#9a3412', fontWeight: 900, fontSize: 12 }}>
            🎯 Action Priority Matrix
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.2 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569' }}>
                <th style={{ padding: '5px 6px', textAlign: 'left' }}>Priority</th>
                <th style={{ padding: '5px 6px', textAlign: 'left' }}>Scope</th>
                <th style={{ padding: '5px 6px', textAlign: 'left' }}>Action</th>
                <th style={{ padding: '5px 6px', textAlign: 'left' }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {actionRows.map((r, idx) => (
                <tr key={`${r.scope}-${idx}`} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: '5px 6px', fontWeight: 900, color: r.priority === 'High' ? '#C8281A' : '#E8960E' }}>{r.priority}</td>
                  <td style={{ padding: '5px 6px', fontWeight: 800 }}>{r.scope}</td>
                  <td style={{ padding: '5px 6px', color: '#334155', lineHeight: 1.25 }} title={r.issue}>{r.action}</td>
                  <td style={{ padding: '5px 6px', color: '#475569' }}>{r.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {/* ── Scope 1 / Scope 2 — dedicated full-width tabs ──────────────────── */}
      <div style={{
        display: selectedScope === 'scope1' || selectedScope === 'scope2' ? 'grid' : 'none',
        gridTemplateColumns: '1fr',
        gap: '12px',
        padding: '4px 12px',
        flex: 1,
      }}>
        {/* ── Scope 1 ── */}
        <div style={{ display: selectedScope === 'scope1' ? 'block' : 'none', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.04)' }}>
          <ScopeTOC title="🔥 Scope 1 — Direct" items={scope1Menu} accent="#C8281A" />
          <QuestionCard id="s1-overview" item={scope1Menu[0]} accent="#C8281A">
            <WaterfallChart
              bars={s1Bars}
              callouts={s1Callouts}
              title={`<strong>Scope 1 (reduce firewood usage)</strong> – ${showIntensity ? 'CO₂ Intensity (tCO₂e/tRCN)' : 'Absolute emissions (tCO₂e)'}`}
              legendOrder={['baseline', 'actual', 'estimated', 'target']}
              downloadName={`Scope1_Emissions_${selectedFac}.png`}
              compact
            />
          </QuestionCard>

          {/* ── Scope 1 Fuel Breakdown Chart ── */}
          <QuestionCard id="s1-breakdown" item={scope1Menu[1]} accent="#C8281A">
            <Scope1BreakdownChart
              years={[2021, 2022, 2023, 2024, 2025, 2026].filter(y => y < 2026 || get(2026).scope1 > 0)}
              breakdown={scope1Breakdown}
              selectedFac={selectedFac}
              compact
            />
          </QuestionCard>

          {/* ── Scope 1 mini-OGSM table ── */}
          {(() => {
            const years = [2021, 2022, 2023, 2024, 2025];
            const ytd26 = get(2026).scope1;
            const ytd26rcn = get(2026).rcn;
            const full26rcn = ytd26rcn + facMtcQty;
            const br26 = scope1Breakdown.find(b => b.year === 2026);
            const activeCats = S1_CATS.filter(c =>
              scope1Breakdown.some(b => (b.cats[c.key] || 0) > 0)
            );
            return (
              <div style={{ overflowX: 'auto', marginBottom: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#1a3d5c', color: 'white' }}>
                      <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700, minWidth: 160 }}>Scope 1</th>
                      {years.map(y => <th key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{y}</th>)}
                      {ytd26 > 0 && <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#E8960E', whiteSpace: 'nowrap' }}>Q1&apos;26*</th>}
                      <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#C8281A', whiteSpace: 'nowrap' }}>FC&apos;26</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total row */}
                    <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700 }}>Total Emissions (tCO₂e)</td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{Math.round(get(y).scope1).toLocaleString()}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#7a4f00', background: '#fff8e1' }}>{Math.round(ytd26).toLocaleString()}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#C8281A', background: '#fef2f2' }}>{Math.round(fcS1).toLocaleString()}</td>
                    </tr>
                    {/* Intensity row */}
                    <tr style={{ background: '#fff', borderBottom: '2px solid #cbd5e1' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700, color: '#666' }}>Intensity (tCO₂e/tRCN)</td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600, color: '#666' }}>{(get(y).scope1 / get(y).rcn).toFixed(4)}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#88641a', background: '#fff8e1' }}>{(ytd26 / ytd26rcn).toFixed(4)}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#b91c1c', background: '#fef2f2' }}>{(fcS1 / full26rcn).toFixed(4)}</td>
                    </tr>
                    {/* Per-fuel breakdown sub-rows */}
                    {activeCats.map(cat => {
                      const br26val = br26 ? (br26.cats[cat.key] || 0) : null;
                      return (
                        <tr key={cat.key} style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 6px', color: '#555', paddingLeft: 16 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cat.color, marginRight: 5 }} />
                            {cat.label}
                          </td>
                          {years.map(y => {
                            const bd = scope1Breakdown.find(b => b.year === y);
                            const v = bd ? (bd.cats[cat.key] || 0) : 0;
                            return <td key={y} style={{ padding: '3px 6px', textAlign: 'right', color: '#555' }}>{v > 0 ? Math.round(v).toLocaleString() : '—'}</td>;
                          })}
                          {ytd26 > 0 && (
                            <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: '#7a4f00', background: '#fff8e1' }}>
                              {br26val != null && br26val > 0 ? Math.round(br26val).toLocaleString() : '—'}
                            </td>
                          )}
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: '#aaa', background: '#fef2f2' }}>—</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}


          {/* ── FC 2026 Calculation Detail ─ Scope 1 ── */}
          <QuestionCard id="s1-calc" item={scope1Menu[2]} accent="#C8281A">
            {(() => {
              const HIST = [2021, 2022, 2023, 2024, 2025];
              const ytdRCN = get(2026).rcn;
              const ytdEm = get(2026).scope1;
              const iYTD = ytdRCN > 0 ? ytdEm / ytdRCN : 0;
              const mtcEst = Math.round(iYTD * facMtcQty);
              return (
                <details open style={{ marginBottom: 8, border: '1.5px solid #C8281A', borderRadius: 8, overflow: 'hidden', fontSize: '10.5px' }}>
                  <summary style={{ background: '#C8281A', color: 'white', padding: '5px 12px', fontWeight: 800, cursor: 'pointer', listStyle: 'none' }}>
                    📐 FC 2026 Calculation Detail — Scope 1 (Direct Combustion)
                  </summary>
                  <div style={{ background: '#fff9f9', padding: '8px 12px' }}>
                    {selectedFac === 'ALL' ? (
                      <div style={{ background: '#fef2f2', border: '2px solid #C8281A', borderRadius: 6, padding: '6px 14px', marginBottom: 8, fontSize: 11, color: '#7f1d1d' }}>
                        <div style={{ fontFamily: 'monospace', textAlign: 'center', fontWeight: 800, fontSize: 12 }}>
                          ✅ Source: <span style={{ color: '#9A0000' }}>Approved Opex FC1 2026 Spreadsheet</span> — <span style={{ color: '#C8281A' }}>{fcS1.toLocaleString()} tCO₂e</span>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 3 }}>
                          This value is locked to the board-approved Opex budget (FC1,2026). The dynamic model (below) is kept as an <em>internal operational reference</em> only.
                        </div>
                        <div style={{ background: '#fff8f8', border: '1px dashed #fca5a5', borderRadius: 4, padding: '4px 10px', marginTop: 5, fontFamily: 'monospace', fontSize: 10, color: '#999', textAlign: 'center' }}>
                          [Reference only — not used for chart] Dynamic model: {ytdEm.toLocaleString()} + ({iYTD.toFixed(4)} × {facMtcQty.toLocaleString()}) = {calculatedFcS1.toLocaleString()} tCO₂e
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 12px', marginBottom: 8, fontFamily: 'monospace', fontSize: 11, color: '#7f1d1d', textAlign: 'center' }}>
                        FC 2026 = YTD Q1 + (Intensityʸʸʵ × MTC Remaining)
                        <span style={{ display: 'block', marginTop: 3, fontWeight: 800, fontSize: 12 }}>
                          = {ytdEm.toLocaleString()} + ({iYTD.toFixed(4)} × {facMtcQty.toLocaleString()}) = <span style={{ color: '#C8281A' }}>{fcS1.toLocaleString()} tCO₂e</span>
                        </span>
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#1a3d5c', color: 'white' }}>
                          <th style={{ padding: '3px 8px', textAlign: 'left', minWidth: 180 }}>Parameter</th>
                          {HIST.map(y => <th key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{y}</th>)}
                          <th style={{ padding: '3px 8px', textAlign: 'right', background: '#E8960E' }}>Q1 &apos;26</th>
                          <th style={{ padding: '3px 8px', textAlign: 'right', background: '#9A0000' }}>FC &apos;26</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 700 }}>RCN Volume (tRCN)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{get(y).rcn.toLocaleString()}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{ytdRCN.toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', background: '#fef2f2', color: '#888' }}>{(ytdRCN + facMtcQty).toLocaleString()}*</td>
                        </tr>
                        <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 700 }}>Emissions (tCO₂e)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{Math.round(get(y).scope1).toLocaleString()}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{Math.round(ytdEm).toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fef2f2', color: '#C8281A' }}>{fcS1.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: '#fdf4f4', borderBottom: '2px solid #C8281A' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 800, color: '#7f1d1d' }}>Intensity (tCO₂e / tRCN) [← coefficient]</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#555' }}>{(get(y).scope1 / get(y).rcn).toFixed(4)}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, color: '#C8281A', background: '#fff8e1' }}>{iYTD.toFixed(4)} ← FC</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', background: '#fef2f2', color: '#aaa' }}>—</td>
                        </tr>
                        <tr style={{ background: 'white' }}>
                          <td style={{ padding: '3px 8px', paddingLeft: 18, color: '#555' }}>MTC Remaining Volume (tRCN)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#ccc' }}>—</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fff8e1' }}>{facMtcQty.toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fef2f2' }}>{mtcEst.toLocaleString()} est.</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 5 }}>* Full-year = YTD Q1 {ytdRCN.toLocaleString()} + MTC {facMtcQty.toLocaleString()} tRCN</div>
                  </div>
                </details>
              );
            })()}
          </QuestionCard>

          {/* Commentary — 100% data-driven from DB */}
          <QuestionCard id="s1-actions" item={scope1Menu[3]} accent="#C8281A">
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

                  <p style={{ margin: '0 0 4px', marginTop: '6px', fontSize: '11.5px', color: '#2d3748', background: '#f8fafc', padding: '6px 8px', borderLeft: '3px solid #cbd5e1', borderRadius: '4px' }}>
                    <strong>🔮 {lang === 'vi' ? 'Dự phóng 2026 (FC 2026) & Phương pháp luận:' : '2026 Forecast (FC 2026) & Methodology:'}</strong>{' '}
                    {lang === 'vi'
                      ? `Dự phóng phát thải cuối năm 2026 đạt khoảng `
                      : `Year-end 2026 emissions are projected at `}
                    <strong style={{ color: '#b91c1c' }}>{Math.round(fcS1).toLocaleString()} tCO₂e</strong>.
                    <br />
                    <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '11px', color: '#4a5568' }}>
                      {selectedFac === 'ALL'
                        ? (lang === 'vi'
                          ? 'Giá trị FC1 cho Scope 1 đang lấy theo bảng Opex đã duyệt. Mô hình Q1 intensity × MTC được giữ làm tham chiếu nội bộ, không dùng làm tổng chart.'
                          : 'The Scope 1 FC1 value is sourced from the approved Opex spreadsheet. The Q1 intensity × MTC model is retained as an internal reference, not the chart total.')
                        : (lang === 'vi'
                          ? 'Dự báo được tính toán động, kết hợp hiệu suất thực tế Quý 1 với Kế hoạch sản xuất các tháng còn lại (MTC). Công thức:'
                          : 'The forecast employs dynamic modeling, compounding Q1 actual performance with the remaining production plan (MTC). Formula:')}
                      <br />
                      <span style={{ fontFamily: 'monospace', color: '#88641a', display: 'inline-block', margin: '2px 0 4px' }}>{selectedFac === 'ALL' ? 'FC1 source = approved Opex spreadsheet value; calculated model kept as reference only' : 'Est. Total = Actual YTD + (YTD Intensity × MTC Volume)'}</span>
                      <br />
                      {selectedFac === 'ALL'
                        ? (lang === 'vi'
                          ? 'Cách này đảm bảo số chart khớp bảng tính FC1,2026 và phần Apr–Dec = FC1 trừ actual YTD.'
                          : 'This keeps the chart aligned to FC1,2026 and makes Apr–Dec equal FC1 minus actual YTD.')
                        : (lang === 'vi'
                          ? 'Cách tiếp cận trực tiếp nắn chỉnh dự phóng theo mức độ tối ưu năng lượng hiện thời (YTD Intensity), triệt tiêu sai lệch so với ấn định tĩnh ban đầu.'
                          : 'This aligns the year-end estimate with the current operational energy efficiency factor (YTD Intensity), neutralizing static estimation drift.')}
                    </span>
                  </p>

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
          </QuestionCard>
        </div>

        {/* ── Scope 2 ── */}
        <div style={{ display: selectedScope === 'scope2' ? 'block' : 'none', padding: '10px 14px', border: '1px solid #dbeafe', borderRadius: 10, background: '#fff', boxShadow: '0 4px 14px rgba(15,23,42,0.04)' }}>
          <ScopeTOC title="⚡ Scope 2 — Grid" items={scope2Menu} accent="#4472C4" />
          <QuestionCard id="s2-overview" item={scope2Menu[0]} accent="#4472C4">
            <WaterfallChart
              bars={s2Bars}
              callouts={s2Callouts}
              title={`<strong>Scope 2 (grid electricity)</strong> – CO₂ eq ${showIntensity ? 'intensity tCO₂e/RCN' : 'absol. emission in ton'}`}
              legendOrder={['baseline', 'actual', 'estimated', 'target']}
              downloadName={`Scope2_Emissions_${selectedFac}.png`}
            />
          </QuestionCard>

          {/* ── Scope 2 mini-OGSM table ── */}
          {(() => {
            const years = [2021, 2022, 2023, 2024, 2025];
            const ytd26 = get(2026).scope2;
            const ytd26rcn = get(2026).rcn;
            const full26rcn = ytd26rcn + facMtcQty;
            const GRID_EF = 0.8928; // kgCO2e/kWh (HCMC grid 2022-2023)
            const toMwh = (tco2e: number) => tco2e > 0 ? Math.round(tco2e / GRID_EF * 1000) : 0;
            return (
              <div style={{ overflowX: 'auto', marginBottom: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                  <thead>
                    <tr style={{ background: '#1a3d5c', color: 'white' }}>
                      <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700, minWidth: 160 }}>Scope 2</th>
                      {years.map(y => <th key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>{y}</th>)}
                      {ytd26 > 0 && <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#E8960E', whiteSpace: 'nowrap' }}>Q1&apos;26*</th>}
                      <th style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, background: '#4472C4', whiteSpace: 'nowrap' }}>FC&apos;26</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total Emissions */}
                    <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700 }}>Total Emissions (tCO₂e)</td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>{Math.round(get(y).scope2).toLocaleString()}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#7a4f00', background: '#fff8e1' }}>{Math.round(ytd26).toLocaleString()}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#4472C4', background: '#eff6ff' }}>{Math.round(fcS2).toLocaleString()}</td>
                    </tr>
                    {/* Intensity */}
                    <tr style={{ background: '#fff', borderBottom: '2px solid #cbd5e1' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 700, color: '#666' }}>Intensity (tCO₂e/tRCN)</td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600, color: '#666' }}>{(get(y).scope2 / get(y).rcn).toFixed(4)}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#88641a', background: '#fff8e1' }}>{(ytd26 / ytd26rcn).toFixed(4)}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8', background: '#eff6ff' }}>{(fcS2 / full26rcn).toFixed(4)}</td>
                    </tr>
                    {/* RCN Production */}
                    <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 6px', color: '#555', paddingLeft: 16 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4472C4', marginRight: 5 }} />
                        RCN Production (tRCN)
                      </td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', color: '#555' }}>{get(y).rcn.toLocaleString()}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: '#7a4f00', background: '#fff8e1' }}>{ytd26rcn.toLocaleString()}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: '#555', background: '#eff6ff' }}>{full26rcn.toLocaleString()}</td>
                    </tr>
                    {/* Implied kWh */}
                    <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '3px 6px', color: '#555', paddingLeft: 16 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#70AD47', marginRight: 5 }} />
                        Implied Electricity (MWh)
                      </td>
                      {years.map(y => <td key={y} style={{ padding: '3px 6px', textAlign: 'right', color: '#555' }}>{toMwh(get(y).scope2).toLocaleString()}</td>)}
                      {ytd26 > 0 && <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700, color: '#7a4f00', background: '#fff8e1' }}>{toMwh(ytd26).toLocaleString()}</td>}
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: '#555', background: '#eff6ff' }}>{toMwh(fcS2).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* ── FC 2026 Calculation Detail ─ Scope 2 ── */}
          <section id="s2-calc" style={{ scrollMarginTop: 92 }}>
            {(() => {
              const HIST = [2021, 2022, 2023, 2024, 2025];
              const ytdRCN = get(2026).rcn;
              const ytdEm = get(2026).scope2;
              const GRID_EF = 0.8928;
              const iYTD = ytdRCN > 0 ? ytdEm / ytdRCN : 0;
              const mtcEst = Math.round(iYTD * facMtcQty);
              return (
                <details open style={{ marginBottom: 8, border: '1.5px solid #4472C4', borderRadius: 8, overflow: 'hidden', fontSize: '10.5px' }}>
                  <summary style={{ background: '#4472C4', color: 'white', padding: '5px 12px', fontWeight: 800, cursor: 'pointer', listStyle: 'none' }}>
                    📐 FC 2026 Calculation Detail — Scope 2 (Grid Electricity, EF = {GRID_EF} kgCO₂e/kWh)
                  </summary>
                  <div style={{ background: '#f0f7ff', padding: '8px 12px' }}>
                    {selectedFac === 'ALL' ? (
                      <div style={{ background: '#eff6ff', border: '2px solid #4472C4', borderRadius: 6, padding: '6px 14px', marginBottom: 8, fontSize: 11, color: '#1e3a5f' }}>
                        <div style={{ fontFamily: 'monospace', textAlign: 'center', fontWeight: 800, fontSize: 12 }}>
                          ✅ Source: <span style={{ color: '#1d4ed8' }}>Approved Opex FC1 2026 Spreadsheet</span> — <span style={{ color: '#4472C4' }}>{fcS2.toLocaleString()} tCO₂e</span>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: 3 }}>
                          This value is locked to the board-approved Opex budget (FC1,2026). Apr–Dec remainder = FC1 minus Q1 actual ({ytdEm.toLocaleString()}). Dynamic model is reference only.
                        </div>
                        <div style={{ background: '#f0f7ff', border: '1px dashed #93c5fd', borderRadius: 4, padding: '4px 10px', marginTop: 5, fontFamily: 'monospace', fontSize: 10, color: '#999', textAlign: 'center' }}>
                          [Reference only — not used for chart] Dynamic model: {ytdEm.toLocaleString()} + ({iYTD.toFixed(4)} × {facMtcQty.toLocaleString()}) = {calculatedFcS2.toLocaleString()} tCO₂e
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 6, padding: '6px 12px', marginBottom: 8, fontFamily: 'monospace', fontSize: 11, color: '#1e3a5f', textAlign: 'center' }}>
                        FC 2026 = YTD Q1 + (Intensityᴴᵀᴰ × MTC Remaining)
                        <span style={{ display: 'block', marginTop: 3, fontWeight: 800, fontSize: 12 }}>
                          = {ytdEm.toLocaleString()} + ({iYTD.toFixed(4)} × {facMtcQty.toLocaleString()}) = <span style={{ color: '#4472C4' }}>{fcS2.toLocaleString()} tCO₂e</span>
                        </span>
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#1a3d5c', color: 'white' }}>
                          <th style={{ padding: '3px 8px', textAlign: 'left', minWidth: 180 }}>Parameter</th>
                          {HIST.map(y => <th key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{y}</th>)}
                          <th style={{ padding: '3px 8px', textAlign: 'right', background: '#E8960E' }}>Q1 &apos;26</th>
                          <th style={{ padding: '3px 8px', textAlign: 'right', background: '#4472C4' }}>FC &apos;26</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 700 }}>RCN Volume (tRCN)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{get(y).rcn.toLocaleString()}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{ytdRCN.toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', background: '#eff6ff', color: '#888' }}>{(ytdRCN + facMtcQty).toLocaleString()}*</td>
                        </tr>
                        <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 700 }}>Emissions (tCO₂e)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{Math.round(get(y).scope2).toLocaleString()}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{Math.round(ytdEm).toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#eff6ff', color: '#4472C4' }}>{fcS2.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 700 }}>Grid EF applied (kgCO₂e/kWh)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#555' }}>{GRID_EF}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fff8e1' }}>{GRID_EF}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#eff6ff' }}>{GRID_EF}</td>
                        </tr>
                        <tr style={{ background: '#f0f7ff', borderBottom: '2px solid #4472C4' }}>
                          <td style={{ padding: '3px 8px', fontWeight: 800, color: '#1e3a8a' }}>Intensity (tCO₂e / tRCN) [← coefficient]</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#555' }}>{(get(y).scope2 / get(y).rcn).toFixed(4)}</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, color: '#4472C4', background: '#fff8e1' }}>{iYTD.toFixed(4)} ← FC</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', background: '#eff6ff', color: '#aaa' }}>—</td>
                        </tr>
                        <tr style={{ background: 'white' }}>
                          <td style={{ padding: '3px 8px', paddingLeft: 18, color: '#555' }}>MTC Remaining Volume (tRCN)</td>
                          {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#ccc' }}>—</td>)}
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fff8e1' }}>{facMtcQty.toLocaleString()}</td>
                          <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#eff6ff' }}>{mtcEst.toLocaleString()} est.</td>
                        </tr>
                      </tbody>
                    </table>
                    <div style={{ fontSize: 10, color: '#888', marginTop: 5 }}>* Full-year = YTD Q1 {ytdRCN.toLocaleString()} + MTC {facMtcQty.toLocaleString()} tRCN</div>
                  </div>
                </details>
              );
            })()}
          </section>

          {/* Commentary — 100% data-driven from DB */}
          <section id="s2-actions" style={{ scrollMarginTop: 92 }}>
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
                        <strong style={{ color: '#166534' }}>{lang === 'vi' ? '🌞 PT Rooftop Solar — online Q4/cuối 2026; savings tính từ 2027' : '🌞 PT Rooftop Solar — online Q4/late 2026; savings from 2027'}</strong>
                        <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <span>📉 {lang === 'vi' ? 'Giảm đều/năm (không solar):' : 'Linear reduction/yr (excl. solar):'} <strong>−{cut} tCO₂e</strong></span>
                          <span>⚡ {lang === 'vi' ? 'Solar từ 2027:' : 'Solar from 2027:'} <strong style={{ color: '#166534' }}>−{ptSolarSaving(2027).toLocaleString()} {lang === 'vi' ? 'tCO₂e/năm' : 'tCO₂e/yr'}</strong></span>
                        </div>
                        <div style={{ marginTop: '2px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span>2026: <strong>{t26.toLocaleString()} tCO₂e</strong></span>
                          <span>2027: <strong style={{ color: '#166534' }}>{t27.toLocaleString()} tCO₂e</strong>
                            {' '}<span style={{ color: '#166534', fontSize: '10px' }}>({delta27 > 0 ? '+' : ''}{delta27.toLocaleString()} incl. first solar saving year)</span>
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

                  <p style={{ margin: '0 0 4px', marginTop: '6px', fontSize: '11.5px', color: '#2d3748', background: '#f8fafc', padding: '6px 8px', borderLeft: '3px solid #cbd5e1', borderRadius: '4px' }}>
                    <strong>🔮 {lang === 'vi' ? 'Dự phóng 2026 (FC 2026) & Phương pháp luận:' : '2026 Forecast (FC 2026) & Methodology:'}</strong>{' '}
                    {lang === 'vi'
                      ? `Phát thải điện cuối 2026 dự phóng ở mức `
                      : `Year-end 2026 grid emissions are projected at `}
                    <strong style={{ color: '#4472C4' }}>{Math.round(fcS2).toLocaleString()} tCO₂e</strong>.
                    <br />
                    <span style={{ display: 'inline-block', marginTop: '3px', fontSize: '11px', color: '#4a5568' }}>
                      {selectedFac === 'ALL'
                        ? (lang === 'vi'
                          ? 'Giá trị FC1 cho Scope 2 đang lấy theo bảng Opex đã duyệt. Mô hình Q1 intensity × MTC được giữ làm tham chiếu nội bộ, không dùng làm tổng chart.'
                          : 'The Scope 2 FC1 value is sourced from the approved Opex spreadsheet. The Q1 intensity × MTC model is retained as an internal reference, not the chart total.')
                        : (lang === 'vi'
                          ? 'Tương tự Scope 1, dự báo Scope 2 dựa trên Cường độ tiêu thụ điện năng thực tế Quý 1 nhân với Khối lượng sản xuất MTC. Công thức:'
                          : 'Similar to Scope 1, the Scope 2 forecast applies Q1 actual grid power intensity to the outstanding MTC production volume. Formula:')}
                      <br />
                      <span style={{ fontFamily: 'monospace', color: '#4472C4', display: 'inline-block', margin: '2px 0 4px' }}>{selectedFac === 'ALL' ? 'FC1 source = approved Opex spreadsheet value; calculated model kept as reference only' : 'Est. Total = Actual YTD + (YTD Intensity × MTC Volume)'}</span>
                      <br />
                      {selectedFac === 'ALL'
                        ? (lang === 'vi'
                          ? 'Cách này đảm bảo số chart khớp bảng tính FC1,2026 và phần Apr–Dec = FC1 trừ actual YTD.'
                          : 'This keeps the chart aligned to FC1,2026 and makes Apr–Dec equal FC1 minus actual YTD.')
                        : (lang === 'vi'
                          ? 'Giúp điều chỉnh lại các dự báo trước đây, tự động phản ánh sự cải thiện (hoặc suy giảm) hiệu suất do lưới điện hoặc thiết bị, giúp theo dõi sát sao lượng tiêu thụ điện còn lại.'
                          : 'This recalibrates projected emissions, natively capturing improvements (or degradation) in machine efficiency or grid usage patterns relative to remaining production load.')}
                    </span>
                  </p>

                  <p style={{ margin: '0 0 4px', marginTop: '6px' }}><strong>{lang === 'vi' ? 'Kế hoạch Giảm thiểu Chiến lược:' : 'Strategic Mitigation Plan:'}</strong></p>
                  <ul style={{ margin: 0, paddingLeft: '18px' }}>
                    {/* PT Solar — chỉ hiện khi ALL hoặc Phan Thiet */}
                    {isSolarFactory && (
                      <li>
                        <strong>{lang === 'vi' ? '🌞 PT Rooftop Solar (Scope 2 — từ 2027):' : '🌞 PT Rooftop Solar (Scope 2 — from 2027):'}</strong>{' '}
                        {lang === 'vi' ? 'Hệ thống điện mặt trời áp mái công suất 1,614 MWh/năm tại nhà máy PT dự kiến vận hành Q4/cuối năm 2026; không ghi nhận giảm Scope 2 full-year trong FC 2026.' : '1,614 MWh/yr rooftop solar system at PT factory expected to go online in Q4/late 2026; no full-year Scope 2 reduction is recognized in FC 2026.'}{' '}
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
          </section>
        </div>
      </div>

      <div style={{ display: selectedScope === 'scope1' || selectedScope === 'scope2' ? 'grid' : 'none', gridTemplateColumns: '1fr', gap: 10, margin: '0 12px 8px' }}>
        <div style={{ display: selectedScope === 'scope1' ? 'block' : 'none', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '6px 10px', background: '#fef2f2', color: '#991b1b', fontWeight: 900, fontSize: 12 }}>
            🔥 Scope 1 Residual Emissions by Factory — FC 2026
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead><tr style={{ background: '#f8fafc', color: '#475569' }}>
              <th style={{ padding: '5px 7px', textAlign: 'left' }}>Factory</th>
              <th style={{ padding: '5px 7px', textAlign: 'right' }}>Residual</th>
              <th style={{ padding: '5px 7px', textAlign: 'right' }}>Share</th>
              <th style={{ padding: '5px 7px', textAlign: 'left' }}>Status</th>
            </tr></thead>
            <tbody>{scope1ResidualRanking.map(r => (
              <tr key={r.name} style={{ borderTop: '1px solid #eef2f7' }}>
                <td style={{ padding: '5px 7px', fontWeight: 700 }}>{r.name}</td>
                <td style={{ padding: '5px 7px', textAlign: 'right', fontWeight: 800 }}>{fmt(r.residual)} tCO₂e</td>
                <td style={{ padding: '5px 7px', textAlign: 'right' }}>{r.share.toFixed(0)}%</td>
                <td style={{ padding: '5px 7px', color: r.status.includes('Ahead') ? '#3E7B3E' : '#C8281A', fontWeight: 700 }}>{r.status}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div style={{ display: selectedScope === 'scope2' ? 'block' : 'none', border: '1px solid #dbeafe', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', background: '#eff6ff', color: '#1d4ed8', fontWeight: 900, fontSize: 12 }}>
            ⚡ Scope 2 Driver Bridge — Solar / Production / Grid
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 10 }}>
            {[
              { label: 'Emission reduction by solar', value: `-${fmt(solarReductionS2)}`, color: '#3E7B3E', sub: 'abatement embedded in FC' },
              { label: 'Movement by production growth', value: `${productionMovementS2 > 0 ? '+' : ''}${fmt(productionMovementS2)}`, color: productionMovementS2 > 0 ? '#C8281A' : '#3E7B3E', sub: 'vs 2025 volume base' },
              { label: 'Residual grid dependency', value: fmt(residualGridS2), color: '#1d4ed8', sub: `without solar ~${fmt(withoutSolarS2)}` },
            ].map(d => <div key={d.label} style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 9px', background: '#f8fafc' }}>
              <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 800 }}>{d.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: d.color, marginTop: 3 }}>{d.value}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{d.sub}</div>
            </div>)}
          </div>
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
          2026: fcS3Cat1,
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
        const s3_2026ytd = s3Data.find(d => d.year === 2026);
        const s3Bars: BarPoint[] = [
          { key: 'base', label: ['Baseline', '2021'], actual: s3Base.total, isTotal: true },
          { key: '2022', label: ['2022'], actual: s3_2022?.total || 0 },
          { key: '2023', label: ['2023'], actual: s3_2023?.total || 0 },
          { key: '2024', label: ['2024'], actual: s3_2024?.total || 0 },
          { key: '2025', label: ['2025'], actual: s3Cur.total },
          ...(showForecast ? [
            { key: 'fc2026_gap', label: ['Est gap', '25 & 26'], actual: fcS3Total },
            {
              key: 'fc2026',
              label: ['2026 FC'],
              actual: fcS3Total,
              isTotal: true,
              isActualPlanSplit: true,
              splitActualAbsVal: s3_2026ytd?.total && s3_2026ytd.total > 0 ? s3_2026ytd.total : undefined,
              marker: planVal(2026)
            },
            ...planYears.slice(1).map(y => ({
              key: y.toString(), label: [y.toString()], target: planVal(y)
            }))
          ] : [
            { key: 'req_2026', label: ['Target', '2026'], target: planVal(2026) },
            ...planYears.map(y => ({
              key: y.toString(), label: [y === 2026 ? 'FC1,2026' : y.toString()], target: planVal(y),
              ...(y === 2026 ? {
                isActualPlanSplit: true,
                isTotal: true,
                splitActualAbsVal: s3_2026ytd?.total && s3_2026ytd.total > 0 ? s3_2026ytd.total : undefined,
              } : {})
            }))
          ]),
          { key: 'end', label: ['by End', targetEndYear.toString()], target: planVal(targetEndYear), isTotal: true },
        ];

        const s3Callouts: Callout[] = showForecast ? [
          s3Base.total > 0 ? {
            fromCol: 0, toCol: 6,
            fromVal: s3Base.total, toVal: fcS3Total,
            text: pctStr(fcS3Total, s3Base.total), level: 1
          } : null,
          planVal(targetEndYear) > 0 ? {
            fromCol: 6, toCol: s3Bars.length - 1,
            fromVal: fcS3Total, toVal: planVal(targetEndYear),
            text: pctStr(planVal(targetEndYear), s3Base.total), level: 0
          } : null,
        ].filter(Boolean) as Callout[] : [
          s3Base.total > 0 && planVal(2026) > 0 ? {
            fromCol: 0, toCol: 6,
            fromVal: s3Base.total, toVal: planVal(2026),
            text: pctStr(planVal(2026), s3Base.total), level: 0
          } : null,
          planVal(targetEndYear) > 0 ? {
            fromCol: 6, toCol: s3Bars.length - 1,
            fromVal: planVal(2026), toVal: planVal(targetEndYear),
            text: pctStr(planVal(targetEndYear), s3Base.total), level: 0
          } : null,
        ].filter(Boolean) as Callout[];

        // Q1 2026 Scope 3 YTD (already defined above)

        // OGSM rows
        const ogsm = [
          {
            label: 'Scope 3 — absol. CO₂eq (tCO₂e)', vals: [
              s3Base.total, s3_2022?.total || 0, s3_2023?.total || 0, s3_2024?.total || 0,
              s3Cur.total,
              s3_2026ytd ? s3_2026ytd.total : '—',
              fcS3Total,
            ]
          },
          {
            label: '  ↳ Cat.1 Cashew (FLAG)', vals: [
              s3Base.cat1, s3_2022?.cat1 || 0, s3_2023?.cat1 || 0, s3_2024?.cat1 || 0,
              s3Cur.cat1, s3_2026ytd ? s3_2026ytd.cat1 : '—', fcS3Cat1,
            ]
          },
          {
            label: '  ↳ Cat.3 WTT Fuel & Energy', vals: [
              s3Base.cat3, s3_2022?.cat3 || 0, s3_2023?.cat3 || 0, s3_2024?.cat3 || 0,
              s3Cur.cat3, s3_2026ytd ? s3_2026ytd.cat3 : '—', fcS3Cat3,
            ]
          },
          {
            label: '  ↳ Cat.4 Transport', vals: [
              s3Base.cat4v + s3Base.cat4r, (s3_2022?.cat4v || 0) + (s3_2022?.cat4r || 0),
              (s3_2023?.cat4v || 0) + (s3_2023?.cat4r || 0), (s3_2024?.cat4v || 0) + (s3_2024?.cat4r || 0),
              s3Cur.cat4v + s3Cur.cat4r,
              s3_2026ytd ? s3_2026ytd.cat4v + s3_2026ytd.cat4r : '—',
              fcS3Cat4,
            ]
          },
        ];

        // RCN per year for intensity
        const rcnByYear: Record<number, number> = {
          2021: s3Data.find(d => d.year === 2021) ? get(2021).rcn : 0,
          2022: get(2022).rcn,
          2023: get(2023).rcn,
          2024: get(2024).rcn,
          2025: get(2025).rcn,
        };
        const ytd26rcn_s3 = get(2026).rcn;
        const full26rcn_s3 = ytd26rcn_s3 + MTC_2026_TOTAL_QTY;

        const oKeys = ['2021', '2022', '2023', '2024', '2025', 'Q1 2026*', 'FC 2026'];
        const s3IntLabel = showIntensity ? 'tCO₂e/RCN' : 'tCO₂e';

        return (
          <div style={{ padding: '6px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ScopeTOC title="🌿 Scope 3 — Supply Chain" items={scope3Menu} accent="#3E7B3E" />

            {/* Executive two-column canvas: left = main trajectory, right = analysis stack */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '14px', alignItems: 'start' }}>
              {/* Left column — trajectory + origin risk */}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <QuestionCard id="s3-overview" item={scope3Menu[0]} accent="#3E7B3E">
                  <WaterfallChart
                    bars={s3Bars}
                    callouts={s3Callouts}
                    title={`<strong>Scope 3 — Supply Chain</strong> – CO₂ eq absol. emission in ton`}
                    legendOrder={['baseline', 'actual', 'target']}
                    downloadName="Scope3_Emissions.png"
                  />
                </QuestionCard>
                {/* Target callout box */}
                <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: '10px', color: '#555' }}>
                  <div style={{ padding: '4px 8px', background: '#eaf5ea', border: '1px solid #3E7B3E', borderRadius: 4 }}>
                    🎯 <strong>FLAG −{FLAG_TGT_PCT}%</strong>: {fmt(flagBase)} → {fmt(flagTarget2032)} tCO₂e by 2032
                  </div>
                  <div style={{ padding: '4px 8px', background: '#eaf5ea', border: '1px solid #3E7B3E', borderRadius: 4 }}>
                    🎯 <strong>Non-FLAG −{NONFLAG_TGT_PCT}%</strong>: {fmt(nonflagBase)} → {fmt(nonflagTarget2032)} tCO₂e by 2032
                  </div>
                </div>

                {/* ── Executive Scope 3 Commentary ── */}
                <div style={{
                  marginTop: 8,
                  display: 'grid',
                  gridTemplateColumns: '1.05fr 0.95fr',
                  gap: 8,
                  alignItems: 'stretch',
                }}>
                  <div style={{
                    padding: '9px 11px',
                    background: pctVsBase <= 0 ? 'linear-gradient(135deg,#f0fdf4,#ffffff)' : 'linear-gradient(135deg,#fff5f5,#ffffff)',
                    border: `1px solid ${pctVsBase <= 0 ? '#86efac' : '#fecaca'}`,
                    borderLeft: `4px solid ${pctVsBase <= 0 ? '#3E7B3E' : '#C8281A'}`,
                    borderRadius: 8,
                    boxShadow: '0 6px 16px rgba(15,23,42,0.05)',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: 3 }}>
                      Executive insight
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#1f2937' }}>
                      <strong style={{ color: pctVsBase <= 0 ? '#2E6B2E' : '#C8281A' }}>
                        {lang === 'vi' ? 'Scope 3 đang là điểm nghẽn chính.' : 'Scope 3 is the primary pressure point.'}
                      </strong>{' '}
                      {lang === 'vi' ? 'Tổng phát thải chuỗi cung ứng hiện tại đạt ' : 'Current supply-chain footprint is '}
                      <strong>{fmt(s3Cur.total)} tCO₂e</strong> ({pctVsBase > 0 ? '+' : ''}{pctVsBase}% vs 2021).
                    </div>
                  </div>
                  <div style={{
                    padding: '9px 11px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 6px 16px rgba(15,23,42,0.05)',
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    color: '#334155',
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: 3 }}>
                      Required action
                    </div>
                    {pctVsBase <= 0
                      ? (lang === 'vi' ? 'Duy trì sourcing mix hiện tại và khóa các origin EF thấp vào kế hoạch mua hàng.' : 'Maintain the current sourcing mix and lock low-EF origins into procurement planning.')
                      : (lang === 'vi' ? 'Cần kéo sourcing về origin EF thấp và kiểm soát Cat.4 để đưa quỹ đạo sát mục tiêu FLAG.' : 'Shift sourcing toward low-EF origins and control Cat.4 to realign with the FLAG trajectory.')}
                  </div>
                </div>

                {/* ── Origin Risk Analysis Panel ── */}
                <div id="s3-origin" style={{ scrollMarginTop: 92 }} />
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
                          {[2021, 2022, 2023, 2024, 2025, 2026].map(oyr => {
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
                                <strong>{oyr === 2026 ? 'FC 2026' : oyr}</strong> &nbsp;
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

              {/* Right column — balanced analysis stack */}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ── Method note banner ── */}
                <div style={{ padding: '8px 10px', background: 'linear-gradient(135deg,#fffbeb,#ffffff)', border: '1px solid #fcd34d', borderRadius: 8, fontSize: '10.5px', color: '#7a4f00', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' }}>
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

                <div style={{ fontSize: '11.5px', color: '#2d3748', background: '#f8fafc', padding: '6px 8px', borderLeft: '3px solid #cbd5e1', borderRadius: '4px' }}>
                  <strong>🔮 {lang === 'vi' ? 'Dự phóng 2026 (FC 2026) & Phương pháp luận:' : '2026 Forecast (FC 2026) & Methodology:'}</strong>{' '}
                  {lang === 'vi'
                    ? `Dự phóng phát thải chuỗi cung ứng cuối 2026 cán mốc `
                    : `Year-end 2026 supply chain emissions are projected at `}
                  <strong style={{ color: '#3E7B3E' }}>{Math.round(fcS3Total).toLocaleString()} tCO₂e</strong>.
                  <span style={{ display: 'block', margin: '4px 0 2px' }}>
                    {lang === 'vi'
                      ? 'Dự phóng chuỗi cung ứng được cấu trúc độc lập theo từng Category nhằm triệt tiêu điểm mù tĩnh:'
                      : 'Supply chain forecasting is structurally bifurcated by Category to eliminate static blind spots:'}
                  </span>
                  <ul style={{ margin: 0, paddingLeft: 18, color: '#4a5568' }}>
                    <li>
                      <strong style={{ color: '#2F855A' }}>Cat.1 (Cashew):</strong> {lang === 'vi' ? 'Q1 Thực tế + [Kế hoạch Thu mua MTC × Origin EF của từng quốc gia gộp lại].' : 'Q1 Actual + [Aggregated MTC Procurement Plan × Origin-specific Unit EF].'}
                    </li>
                    <li>
                      <strong style={{ color: '#90BE6D' }}>Cat.3 (WTT Fuel):</strong> {lang === 'vi' ? 'Q1 Thực tế + [Cường độ WTT Q1 × Khối lượng sản xuất MTC]. Thể hiện sự đồng bộ hoàn toàn với Scope 1 & 2.' : 'Q1 Actual + [Q1 YTD WTT Intensity × Remaining MTC Processing Volume]. Ensures absolute synchronicity with Scope 1 & 2 momentum.'}
                    </li>
                    <li>
                      <strong style={{ color: '#4A9E8C' }}>Cat.4 (Transport):</strong> {lang === 'vi' ? 'Q1 Thực tế + Tổng [Khoảng cách tuyến đường × Khối lượng vận chuyển MTC × EF phương tiện].' : 'Q1 Actual + Sum of [Route Distance × MTC Haulage Volume × Mode-specific EF].'}
                    </li>
                  </ul>
                </div>

                {/* ── EF Trend — all years ── */}
                <div id="s3-transport" style={{ scrollMarginTop: 92 }} />
                {(() => {
                  const efYears = [2021, 2022, 2023, 2024, 2025, 2026].map(y => {
                    const s3y = s3Data.find(d => d.year === y);
                    const rcn = y === 2026 ? s3FcRcn : (rcnByYear[y] || 0);
                    const total = y === 2026 ? fcS3Total : (s3y?.total || 0);
                    const cat1Total = y === 2026 ? fcS3Cat1 : (s3y?.cat1 || 0);
                    const cat3Total = y === 2026 ? fcS3Cat3 : (s3y?.cat3 || 0);
                    const cat4Total = y === 2026 ? fcS3Cat4 : ((s3y?.cat4v || 0) + (s3y?.cat4r || 0));
                    const ef = rcn > 0 ? total / rcn : 0;
                    const cat1 = rcn > 0 ? cat1Total / rcn : 0;
                    const cat3 = rcn > 0 ? cat3Total / rcn : 0;
                    const cat4 = rcn > 0 ? cat4Total / rcn : 0;
                    return { y, ef, cat1, cat3, cat4, total, rcn, isFc: y === 2026 };
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
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 10px', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' }}>
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
                                    <rect x={bx} y={by} width={subW - 1} height={bh} fill={cat.color} rx={1} opacity={d.isFc ? 0.68 : 0.88} stroke={d.isFc ? '#E8960E' : 'none'} strokeDasharray={d.isFc ? '2 2' : undefined} />
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
                              <text x={gx + subW * SUB_CATS.length / 2} y={H - 6} textAnchor="middle" fontSize={10} fontWeight={d.isFc ? 900 : d.y === 2025 ? 800 : 600} fill={d.isFc ? '#E8960E' : '#444'}>
                                {d.isFc ? 'FC 2026' : d.y}
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
                  const catRows = [
                    ...catYears.map(row => ({ year: row.year, total: row.total, cat1: row.cat1, cat3: row.cat3, cat4: row.cat4v + row.cat4r, isFc: false })),
                    { year: 2026, total: fcS3Total, cat1: fcS3Cat1, cat3: fcS3Cat3, cat4: fcS3Cat4, isFc: true },
                  ].filter(row => row.total > 0);
                  if (catRows.length === 0) return null;
                  const W = 520, H = 130, PL = 50, PR = 10, PT = 14, PB = 28;
                  const chartW = W - PL - PR;
                  const rowH = (H - PT - PB) / catRows.length;
                  const cats = [
                    { key: 'cat1', label: 'Cat.1 Cashew', color: '#2F855A' },
                    { key: 'cat3', label: 'Cat.3 WTT', color: '#90BE6D' },
                    { key: 'cat4', label: 'Cat.4 Transport', color: '#4A9E8C' },
                  ];
                  return (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 10px', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' }}>
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
                        {catRows.map((row, i) => {
                          const total = row.total || 1;
                          const segs = [row.cat1, row.cat3, row.cat4];
                          const y = PT + i * rowH;
                          let curX = PL;
                          return (
                            <g key={row.year}>
                              <text x={PL - 4} y={y + rowH / 2 + 4} textAnchor="end" fontSize={9.5} fontWeight={row.isFc ? 900 : row.year === 2025 ? 800 : 600} fill={row.isFc ? '#E8960E' : '#444'}>
                                {row.isFc ? 'FC 2026' : row.year}
                              </text>
                              {segs.map((val, si) => {
                                const pct = val / total;
                                const sw = chartW * pct;
                                const bx = curX;
                                curX += sw;
                                return (
                                  <g key={si}>
                                    <rect x={bx} y={y + 1} width={sw} height={rowH - 3} fill={cats[si].color} rx={1} opacity={row.isFc ? 0.68 : 0.85} stroke={row.isFc ? '#E8960E' : 'none'} strokeDasharray={row.isFc ? '2 2' : undefined} />
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
                  const allYrs = [2021, 2022, 2023, 2024, 2025, 2026].map(y => {
                    const s3y = s3Data.find(d => d.year === y);
                    const rcn = y === 2026 ? s3FcRcn : (rcnByYear[y] || 0);
                    const total = y === 2026 ? fcS3Total : (s3y?.total || 0);
                    const cat1 = y === 2026 ? fcS3Cat1 : (s3y?.cat1 || 0);
                    const cat4 = y === 2026 ? fcS3Cat4 : ((s3y?.cat4v || 0) + (s3y?.cat4r || 0));
                    return {
                      y, ef: rcn > 0 ? total / rcn : 0,
                      total, rcn,
                      isFc: y === 2026,
                      cat1Pct: total > 0 ? Math.round(cat1 / total * 100) : 0,
                      cat4Pct: total > 0 ? Math.round(cat4 / total * 100) : 0,
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
                      cat1Pct: cur.cat1Pct, cat4Pct: cur.cat4Pct, isFc: cur.isFc
                    };
                  });
                  const latestRow = rows[rows.length - 1];
                  return (
                    <div style={{ fontSize: '11px', lineHeight: '1.55', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 10px', boxShadow: '0 6px 16px rgba(15,23,42,0.04)' }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 800, color: '#1a3d5c' }}>
                        {lang === 'vi' ? `✏️ So sánh EF Scope 3 — Năm qua Năm (${allYrs[0].y}–FC 2026)` : `✏️ Scope 3 EF Comparison — Year over Year (${allYrs[0].y}–FC 2026)`}
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
                                  <td style={{ padding: '3px 6px', fontWeight: 700 }}>{r.from}→{r.isFc ? 'FC 2026' : r.to}</td>
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

            {/* OGSM Table */}
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ background: '#1a3d5c', color: 'white' }}>
                    <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, minWidth: 220 }}>Scope 3</th>
                    {oKeys.map((k) => (
                      <th key={k} style={{
                        padding: '5px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap',
                        background: k.includes('2026*') ? '#E8960E' : k.includes('FC') ? '#3E7B3E' : undefined,
                      }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Total Emissions row */}
                  <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 700 }}>Total Emissions (tCO₂e)</td>
                    {[s3Base.total, s3_2022?.total || 0, s3_2023?.total || 0, s3_2024?.total || 0, s3Cur.total].map((v, vi) => (
                      <td key={vi} style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{Math.round(v).toLocaleString()}</td>
                    ))}
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: '#7a4f00', background: '#fff8e1' }}>{s3_2026ytd ? Math.round(s3_2026ytd.total).toLocaleString() : '—'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: '#3E7B3E', background: '#f0fdf4' }}>{fcS3Total.toLocaleString()}</td>
                  </tr>
                  {/* Intensity row (tCO2e / tRCN procured) */}
                  <tr style={{ background: '#fff', borderBottom: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 700, color: '#666' }}>Intensity (tCO₂e/tRCN)</td>
                    {[2021, 2022, 2023, 2024, 2025].map((y, vi) => (
                      <td key={vi} style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: '#666' }}>
                        {rcnByYear[y] > 0 ? (((s3Data.find(d => d.year === y)?.total) || 0) / rcnByYear[y]).toFixed(4) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: '#88641a', background: '#fff8e1' }}>
                      {s3_2026ytd && ytd26rcn_s3 > 0 ? (s3_2026ytd.total / ytd26rcn_s3).toFixed(4) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800, color: '#15803d', background: '#f0fdf4' }}>
                      {(fcS3Total / full26rcn_s3).toFixed(4)}
                    </td>
                  </tr>
                  {/* Sub-category rows */}
                  {[
                    { label: '  ↳ Cat.1 Cashew (FLAG)', ytd: s3_2026ytd?.cat1, fc: fcS3Cat1, hist: [s3Base.cat1, s3_2022?.cat1 || 0, s3_2023?.cat1 || 0, s3_2024?.cat1 || 0, s3Cur.cat1] },
                    { label: '  ↳ Cat.3 WTT', ytd: s3_2026ytd?.cat3, fc: fcS3Cat3, hist: [s3Base.cat3, s3_2022?.cat3 || 0, s3_2023?.cat3 || 0, s3_2024?.cat3 || 0, s3Cur.cat3] },
                    { label: '  ↳ Cat.4 Transport', ytd: s3_2026ytd ? s3_2026ytd.cat4v + s3_2026ytd.cat4r : undefined, fc: fcS3Cat4, hist: [s3Base.cat4v + s3Base.cat4r, (s3_2022?.cat4v || 0) + (s3_2022?.cat4r || 0), (s3_2023?.cat4v || 0) + (s3_2023?.cat4r || 0), (s3_2024?.cat4v || 0) + (s3_2024?.cat4r || 0), s3Cur.cat4v + s3Cur.cat4r] },
                  ].map((row, ri) => (
                    <tr key={ri} style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '4px 8px', color: '#555' }}>{row.label}</td>
                      {row.hist.map((v, vi) => <td key={vi} style={{ padding: '4px 8px', textAlign: 'right', color: '#555' }}>{Math.round(v).toLocaleString()}</td>)}
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#7a4f00', background: '#fff8e1' }}>{row.ytd != null ? Math.round(row.ytd).toLocaleString() : '—'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#3E7B3E', background: '#f0fdf4' }}>{row.fc.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        function RcnChart({ yrs, svgId, facId }: { yrs: { year: number; label?: string; rcn: number; q1Rcn?: number }[]; svgId: string; facId: string }) {
          const W = 300, H = 170;
          const PL = 34, PR = 34, PT = 36, PB = 28;
          const n = yrs.length;
          const step = (W - PL - PR) / (n - 1);
          const maxV = Math.max(...yrs.map(d => Math.max(d.rcn, d.q1Rcn || 0))) * 1.22 || 1;
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
                  const q1Cy = d.q1Rcn ? py(d.q1Rcn) : null;
                  // stagger label: even indices go above, odd below — prevents overlap
                  const labelY = i % 2 === 0 ? cy - 9 : cy + 17;
                  return (
                    <g key={d.year}>
                      {q1Cy !== null && (
                        <g>
                          <line x1={cx} y1={q1Cy} x2={cx} y2={cy} stroke={S1_COLOR} strokeWidth={1.2} strokeDasharray="3,3" opacity={0.75} />
                          <circle cx={cx} cy={q1Cy} r={3.3} fill="#fff" stroke={S1_COLOR} strokeWidth={1.5} />
                          <text x={cx - 8} y={q1Cy - 6} textAnchor="end" fontSize={7.5} fontWeight={700} fill={S1_COLOR}>Q1</text>
                        </g>
                      )}
                      <circle cx={cx} cy={cy} r={4} fill={S1_COLOR} stroke="white" strokeWidth={1} />
                      <text x={cx} y={Math.min(Math.max(labelY, 12), H - PB - 3)}
                        textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#1a1a1a">
                        {d.rcn.toLocaleString()}
                      </text>
                      <text x={cx} y={H - 5} textAnchor="middle" fontSize={d.label ? 8 : 9} fontWeight={d.label ? 700 : 400} fill={d.label ? HDR_COLOR : '#666'}>{d.label || d.year}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        }

        // ── Intensity stacked bar chart ─────────────────────────────
        function IntChart({ yrs, svgId, facId }: { yrs: { year: number; label?: string; s1Int: number; s2Int: number; totalInt: number; q1TotalInt?: number }[]; svgId: string; facId: string }) {
          const W = 300, H = 190;
          const PL = 8, PR = 8, PT = 26, PB = 42;
          const n = yrs.length;
          const cw = (W - PL - PR) / n;
          const bw = Math.min(cw * 0.68, 42);
          const bx = (i: number) => PL + i * cw + (cw - bw) / 2;
          const cx = (i: number) => PL + i * cw + cw / 2;
          const chartH = H - PT - PB;
          const maxV = Math.max(...yrs.map(d => Math.max(d.totalInt, d.q1TotalInt || 0))) * 1.26 || 1;
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
                  const q1Y = d.q1TotalInt ? py(d.q1TotalInt) : null;
                  return (
                    <g key={d.year}>
                      {/* S2 gray bar */}
                      <rect x={bx(i)} y={topY} width={bw} height={s2H} fill={S2_COLOR} rx={1} />
                      {/* S1 dark red bar */}
                      <rect x={bx(i)} y={s1StartY} width={bw} height={s1H} fill={S1_COLOR} rx={1} />
                      {q1Y !== null && (
                        <g>
                          <line x1={bx(i) - 3} y1={q1Y} x2={bx(i) + bw + 3} y2={q1Y} stroke="#111" strokeWidth={1.3} strokeDasharray="3,2" />
                          <text x={bx(i) + bw + 6} y={q1Y + 3} fontSize={7.2} fontWeight={800} fill="#111">Q1</text>
                        </g>
                      )}
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
                      <text x={cx(i)} y={yrY} textAnchor="middle" fontSize={d.label ? 8 : 9.5} fontWeight={d.label ? 700 : 400} fill={d.label ? HDR_COLOR : '#555'}>{d.label || d.year}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        }

        // ── Commentary: auto-computed insights ────────────────────────
        const YEARS5 = [2021, 2022, 2023, 2024, 2025];
        const intensityWithForecast = intensityData.map(col => {
          const annualRows = reportData.annualDataByFactory[col.fac.id === 'TOTAL' ? 'ALL' : col.fac.id] || [];
          const q1Row = annualRows.find(row => row.year === 2026) || { year: 2026, scope1: 0, scope2: 0, rcn: 0 };
          const isTotal = col.fac.id === 'TOTAL';
          const mtcQty = (() => {
            if (isTotal) return MTC_2026_TOTAL_QTY;
            const normName = col.fac.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            if (normName.includes('tay ninh') || normName.includes('tay-ninh')) return MTC_2026_FACTORIES['Tay Ninh'].total;
            if (normName.includes('long an')) return MTC_2026_FACTORIES['Long An'].total;
            if (normName.includes('phan thiet') || normName.includes('phan-thiet') || normName.startsWith('pt')) return MTC_2026_FACTORIES['Phan Thiet'].total;
            if (normName.includes('tuti') || normName.includes('india')) return MTC_2026_FACTORIES['Tuticorin'].total;
            return 0;
          })();
          const q1S1Int = q1Row.rcn > 0 ? Math.round((q1Row.scope1 * 1000) / q1Row.rcn * 10) / 10 : 0;
          const q1S2Int = q1Row.rcn > 0 ? Math.round((q1Row.scope2 * 1000) / q1Row.rcn * 10) / 10 : 0;
          const base2025 = col.years.find(y => y.year === 2025);
          const fcRcn = q1Row.rcn + mtcQty;
          const fcS1Val = isTotal ? fcS1 : Math.round(q1Row.rcn > 0 ? q1Row.scope1 + (q1Row.scope1 / q1Row.rcn) * mtcQty : base2025?.s1 || 0);
          const fcS2Val = isTotal ? fcS2 : Math.round(q1Row.rcn > 0 ? q1Row.scope2 + (q1Row.scope2 / q1Row.rcn) * mtcQty : base2025?.s2 || 0);
          const fcS1Int = fcRcn > 0 ? Math.round((fcS1Val * 1000) / fcRcn * 10) / 10 : 0;
          const fcS2Int = fcRcn > 0 ? Math.round((fcS2Val * 1000) / fcRcn * 10) / 10 : 0;
          const q1TotalInt = Math.round((q1S1Int + q1S2Int) * 10) / 10;

          return {
            ...col,
            years: [
              ...col.years,
              {
                year: 2026,
                label: '2026 FC',
                s1: fcS1Val,
                s2: fcS2Val,
                rcn: Math.round(fcRcn),
                s1Int: fcS1Int,
                s2Int: fcS2Int,
                totalInt: Math.round((fcS1Int + fcS2Int) * 10) / 10,
                q1Rcn: Math.round(q1Row.rcn),
                q1TotalInt: q1TotalInt > 0 ? q1TotalInt : undefined,
              },
            ],
          };
        });
        const facCols = intensityWithForecast.filter(c => c.fac.id !== 'TOTAL');
        const totalCol = intensityWithForecast.find(c => c.fac.id === 'TOTAL');
        const get5 = (col: typeof intensityWithForecast[0], yr: number) => col.years.find(y => y.year === yr)!;

        const svgToImage = (svgElement: SVGSVGElement): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
          const clone = svgElement.cloneNode(true) as SVGSVGElement;
          const viewBox = clone.getAttribute('viewBox') || '0 0 300 180';
          const [, , vbW, vbH] = viewBox.split(/[\s,]+/).map(Number);
          clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          clone.setAttribute('width', String(vbW || 300));
          clone.setAttribute('height', String(vbH || 180));
          const svgString = new XMLSerializer().serializeToString(clone);
          const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = event => {
            URL.revokeObjectURL(url);
            reject(event);
          };
          img.src = url;
        });

        const downloadIntensitySlide = async () => {
          const cols = intensityWithForecast;
          const chartW = 300;
          const rcnH = 170;
          const intH = 190;
          const colGap = 18;
          const headerH = 92;
          const sectionGap = 26;
          const footerH = 58;
          const scale = 3;
          const canvasW = cols.length * chartW + (cols.length - 1) * colGap + 40;
          const canvasH = headerH + rcnH + sectionGap + intH + footerH;
          const canvas = document.createElement('canvas');
          canvas.width = canvasW * scale;
          canvas.height = canvasH * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.scale(scale, scale);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.fillStyle = HDR_COLOR;
          ctx.fillRect(0, 0, canvasW, 28);
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 16px Arial, sans-serif';
          ctx.fillText('CO₂ Intensity & RCN Production Trend (2021–2026 FC)', 16, 19);
          ctx.fillStyle = '#111827';
          ctx.font = '700 12px Arial, sans-serif';
          ctx.fillText('2026 FC includes Q1 actual marker + months-to-come forecast', 16, 50);
          ctx.fillStyle = S1_COLOR;
          ctx.fillRect(16, 62, 10, 10);
          ctx.fillStyle = '#334155';
          ctx.font = '600 10px Arial, sans-serif';
          ctx.fillText('Scope 1', 31, 71);
          ctx.fillStyle = S2_COLOR;
          ctx.fillRect(92, 62, 10, 10);
          ctx.fillStyle = '#334155';
          ctx.fillText('Scope 2', 107, 71);
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#111827';
          ctx.beginPath();
          ctx.moveTo(178, 67);
          ctx.lineTo(210, 67);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText('Q1 actual marker', 218, 71);

          for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const x = 20 + i * (chartW + colGap);
            ctx.fillStyle = HDR_COLOR;
            ctx.fillRect(x, 78, chartW, 18);
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 11px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(col.fac.name, x + chartW / 2, 91);
            ctx.textAlign = 'left';
            const rcnSvg = document.getElementById(`svg-rcn-${col.fac.id}`) as unknown as SVGSVGElement | null;
            const intSvg = document.getElementById(`svg-int-${col.fac.id}`) as unknown as SVGSVGElement | null;
            if (rcnSvg) ctx.drawImage(await svgToImage(rcnSvg), x, headerH, chartW, rcnH);
            if (intSvg) ctx.drawImage(await svgToImage(intSvg), x, headerH + rcnH + sectionGap, chartW, intH);
          }

          ctx.fillStyle = '#f0f4f8';
          ctx.fillRect(0, canvasH - footerH, canvasW, footerH);
          ctx.fillStyle = '#334155';
          ctx.font = '600 10px Arial, sans-serif';
          ctx.fillText('SCOPE DEFINITION: Scope 1 = direct on-site fuel combustion; Scope 2 = purchased electricity. 2026 FC = Q1 actual + MTC forecast.', 16, canvasH - 34);
          ctx.fillText('CO₂ Intensity = kg CO₂e per metric ton of RCN input.', 16, canvasH - 18);

          const link = document.createElement('a');
          link.download = 'CO2_Intensity_RCN_Production_Trend_2021_2026_FC.png';
          link.href = canvas.toDataURL('image/png', 1.0);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

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
            <div id="opex-intensity-composite" style={{
              width: '100%',
              background: '#fff',
              border: `1.5px solid #b8ccd9`,
              borderRadius: 8,
              boxShadow: '0 3px 16px rgba(26,61,92,0.10)',
              overflow: 'hidden',
            }}>
              {/* ── Slide title bar ── */}
              <div style={{ padding: '8px 16px 6px', borderBottom: `2.5px solid ${ACCENT}`, background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#111', lineHeight: 1.2 }}>
                    CO₂ Intensity &amp; RCN Production Trend (2021–2026 FC)
                  </div>
                  <div style={{ fontSize: 12, color: '#555', fontWeight: 600, marginTop: 2 }}>
                    Scope 1 &amp; Scope 2 — {lang === 'vi' ? 'Q1 actual marker + FC cả năm theo Nhà máy và Tổng' : 'Q1 actual marker + full-year FC by Factory and Total'}
                  </div>
                </div>
                <button
                  onClick={downloadIntensitySlide}
                  style={{ fontSize: '10px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', fontWeight: 800, color: HDR_COLOR }}
                  title="Download one combined HD PNG for all 5 chart panels"
                >
                  <span>📸</span> All HD
                </button>
              </div>

              {/* ── Main body: charts left + commentary right ── */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>

                {/* LEFT: 5-col chart grid (~76%) */}
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #d0dde8' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${intensityWithForecast.length}, minmax(0,1fr))`,
                  }}>
                    {intensityWithForecast.map((col, ci) => (
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
      {selectedScope === 'supply' && (() => {
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
                        <text x={301} y={-24} fontSize="10" fill="#555">volume, still ~17% below &apos;21</text>
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

              {/* Bottom Row: differentiated executive cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', padding: '0 12px 12px', gap: 12 }}>

                {/* Panel 3: Driver scorecard */}
                <div style={{ border: '1px solid #d7dde5', background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
                  <div style={{ background: '#9A0000', color: 'white', padding: '6px 10px', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'white', color: '#9A0000', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 7, fontSize: 9, fontWeight: 900 }}>3</div>
                    EMISSION DRIVER SCORECARD
                  </div>
                  <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, minHeight: 118 }}>
                    {[
                      { label: 'Main hotspot', value: 'Cat.1', sub: '>90% of Scope 3', color: '#9A0000' },
                      { label: '2025 burden', value: 'VN 72%', sub: 'shifted toward Vietnam', color: '#C8281A' },
                      { label: 'Control lever', value: 'Origin EF', sub: 'procurement KPI', color: '#1a3d5c' },
                    ].map(card => (
                      <div key={card.label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 7, padding: '9px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', color: '#64748b', fontWeight: 800 }}>{card.label}</div>
                        <div style={{ fontSize: 18, lineHeight: 1.1, marginTop: 6, color: card.color, fontWeight: 950 }}>{card.value}</div>
                        <div style={{ fontSize: 9.5, marginTop: 5, color: '#475569', lineHeight: 1.25 }}>{card.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel 4: Action roadmap */}
                <div style={{ border: '1px solid #d7dde5', background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}>
                  <div style={{ background: '#1a3d5c', color: 'white', padding: '6px 10px', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: 'white', color: '#1a3d5c', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 7, fontSize: 9, fontWeight: 900 }}>4</div>
                    2032 ACTION ROADMAP
                  </div>
                  <div style={{ padding: '12px 16px', minHeight: 118, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'start' }}>
                    {[
                      { step: '01', title: 'Procurement', body: 'Add origin EF into sourcing scorecard.' },
                      { step: '02', title: 'Logistics', body: 'Optimize transport mode and route load factor.' },
                      { step: '03', title: 'Governance', body: 'Assign country KPIs using VN/India split.' },
                    ].map(item => (
                      <div key={item.step} style={{ position: 'relative', paddingLeft: 10, borderLeft: '2px solid #1a3d5c' }}>
                        <div style={{ fontSize: 9, color: '#9A0000', fontWeight: 900 }}>STEP {item.step}</div>
                        <div style={{ fontSize: 12, color: '#111827', fontWeight: 900, marginTop: 3 }}>{item.title}</div>
                        <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.35, marginTop: 4 }}>{item.body}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* ── FC 2026 Calculation Detail ─ Scope 3 ── */}
              {(() => {
                const HIST = [2021, 2022, 2023, 2024, 2025];
                const ytdRCN = get(2026).rcn;
                const ytd_c1 = s3Data.find(d => d.year === 2026)?.cat1 || 0;
                const ytd_c3 = s3Data.find(d => d.year === 2026)?.cat3 || 0;
                const ytd_c4v = s3Data.find(d => d.year === 2026)?.cat4v || 0;
                const ytd_c4r = s3Data.find(d => d.year === 2026)?.cat4r || 0;
                const ytd_c4 = ytd_c4v + ytd_c4r;
                const iC3 = ytdRCN > 0 ? ytd_c3 / ytdRCN : 0;
                const mtcC3est = Math.round(iC3 * MTC_2026_TOTAL_QTY);

                const getS3y = (y: number) => s3Data.find(d => d.year === y);

                return (
                  <details id="s3-calc" open style={{ scrollMarginTop: 92, margin: '0 12px 12px', border: '1.5px solid #3E7B3E', borderRadius: 8, overflow: 'hidden', fontSize: '10.5px' }}>
                    <summary style={{ background: '#3E7B3E', color: 'white', padding: '5px 12px', fontWeight: 800, cursor: 'pointer', listStyle: 'none' }}>
                      📐 FC 2026 Calculation Detail — Scope 3 (Cat.1 + Cat.3 + Cat.4)
                    </summary>
                    <div style={{ background: '#f6fdf6', padding: '8px 12px' }}>
                      {/* Formula banner */}
                      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '6px 14px', marginBottom: 10, fontFamily: 'monospace', fontSize: 11, color: '#14532d', textAlign: 'center' }}>
                        FC S3 = (YTD Cat.1 + Cat.1 MTC Origin-Mix) + (YTD Cat.3 + Intensity₃ × MTC) + (YTD Cat.4 + Logistics Route-Map MTC)
                        <span style={{ display: 'block', marginTop: 4, fontWeight: 800, fontSize: 12 }}>
                          = {fcS3Cat1.toLocaleString()} + {fcS3Cat3.toLocaleString()} + {fcS3Cat4.toLocaleString()} = <span style={{ color: '#3E7B3E' }}>{fcS3Total.toLocaleString()} tCO₂e</span>
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#1a3d5c', color: 'white' }}>
                            <th style={{ padding: '3px 8px', textAlign: 'left', minWidth: 210 }}>Parameter</th>
                            {HIST.map(y => <th key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{y}</th>)}
                            <th style={{ padding: '3px 8px', textAlign: 'right', background: '#E8960E' }}>Q1 &apos;26</th>
                            <th style={{ padding: '3px 8px', textAlign: 'right', background: '#3E7B3E' }}>FC &apos;26</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* RCN */}
                          <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '3px 8px', fontWeight: 700 }}>RCN Volume (tRCN)</td>
                            {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{get(y).rcn.toLocaleString()}</td>)}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{ytdRCN.toLocaleString()}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', background: '#f0fdf4', color: '#888' }}>{(ytdRCN + MTC_2026_TOTAL_QTY).toLocaleString()}*</td>
                          </tr>
                          {/* Cat.1 */}
                          <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '3px 8px', fontWeight: 700 }}>Cat.1 — Purchased Goods (tCO₂e)</td>
                            {HIST.map(y => { const d = getS3y(y); return <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{d?.cat1 ? Math.round(d.cat1).toLocaleString() : '—'}</td>; })}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{Math.round(ytd_c1).toLocaleString()}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#f0fdf4', color: '#3E7B3E' }}>{fcS3Cat1.toLocaleString()}</td>
                          </tr>
                          <tr style={{ background: '#f5fdf5', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '3px 8px', paddingLeft: 18, color: '#555' }}>Method: YTD + ∑(MTC_Origin × EF_Origin) — origin-mix weighted</td>
                            {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#bbb', fontSize: 9 }}>O-mix</td>)}
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fff8e1', fontSize: 9 }}>YTD base</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#3E7B3E', background: '#f0fdf4', fontSize: 9 }}>YTD + O-mix MTC</td>
                          </tr>
                          {/* Cat.3 */}
                          <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '3px 8px', fontWeight: 700 }}>Cat.3 — Fuel &amp; Energy Related (tCO₂e)</td>
                            {HIST.map(y => { const d = getS3y(y); return <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{d?.cat3 ? Math.round(d.cat3).toLocaleString() : '—'}</td>; })}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{Math.round(ytd_c3).toLocaleString()}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#f0fdf4', color: '#3E7B3E' }}>{fcS3Cat3.toLocaleString()}</td>
                          </tr>
                          <tr style={{ background: '#f5fdf5', borderBottom: '2px solid #3E7B3E' }}>
                            <td style={{ padding: '3px 8px', paddingLeft: 18, fontWeight: 800, color: '#14532d' }}>
                              Intensity Cat.3 (tCO₂e/tRCN) [← coefficient applied]
                            </td>
                            {HIST.map(y => {
                              const d = getS3y(y); const r = get(y).rcn;
                              return <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#555' }}>{d?.cat3 && r ? (d.cat3 / r).toFixed(4) : '—'}</td>;
                            })}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 900, color: '#3E7B3E', background: '#fff8e1' }}>{iC3.toFixed(4)} ← FC</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', background: '#f0fdf4', color: '#888' }}>+{mtcC3est.toLocaleString()} est.</td>
                          </tr>
                          {/* Cat.4 */}
                          <tr style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '3px 8px', fontWeight: 700 }}>Cat.4 — Transportation (tCO₂e)</td>
                            {HIST.map(y => { const d = getS3y(y); const v = (d?.cat4v || 0) + (d?.cat4r || 0); return <td key={y} style={{ padding: '3px 8px', textAlign: 'right' }}>{v > 0 ? Math.round(v).toLocaleString() : '—'}</td>; })}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#fff8e1', color: '#7a4f00' }}>{Math.round(ytd_c4).toLocaleString()}</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, background: '#f0fdf4', color: '#3E7B3E' }}>{fcS3Cat4.toLocaleString()}</td>
                          </tr>
                          <tr style={{ background: 'white' }}>
                            <td style={{ padding: '3px 8px', paddingLeft: 18, color: '#555' }}>Method: YTD + Logistics Route-Map MTC (T-km × EF per origin)</td>
                            {HIST.map(y => <td key={y} style={{ padding: '3px 8px', textAlign: 'right', color: '#bbb', fontSize: 9 }}>T-km</td>)}
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#555', background: '#fff8e1', fontSize: 9 }}>YTD base</td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#3E7B3E', background: '#f0fdf4', fontSize: 9 }}>YTD + Route MTC</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 5 }}>
                        * Full-year procurement RCN = YTD Q1 {ytdRCN.toLocaleString()} + Procurement MTC {MTC_2026_TOTAL_QTY.toLocaleString()} tRCN (used for Cat.1 &amp; Cat.3)
                      </div>

                      {/* Raw Procurement Plan 2026 */}
                      <details style={{ marginTop: 10, border: '1px solid #86efac', borderRadius: 6, overflow: 'hidden' }}>
                        <summary style={{ background: '#dcfce7', color: '#14532d', padding: '4px 10px', fontWeight: 700, cursor: 'pointer', listStyle: 'none', fontSize: 10 }}>
                          📦 Raw Procurement Plan 2026 (MTC) — Bấm để xem chi tiết kế hoạch từng nhà máy × nguồn gốc
                        </summary>
                        <div style={{ background: '#f6fdf6', padding: '8px 10px', overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                              <tr style={{ background: '#166534', color: 'white' }}>
                                <th style={{ padding: '3px 8px', textAlign: 'left' }}>Factory</th>
                                {Object.keys(MTC_2026_FACTORIES['Tay Ninh'].origins).concat(
                                  ...Object.keys(MTC_2026_FACTORIES).map(f => Object.keys(MTC_2026_FACTORIES[f].origins))
                                ).filter((v, i, a) => a.indexOf(v) === i).map(o => (
                                  <th key={o} style={{ padding: '3px 8px', textAlign: 'right' }}>{o}</th>
                                ))}
                                <th style={{ padding: '3px 8px', textAlign: 'right', background: '#14532d' }}>Total MTC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(MTC_2026_FACTORIES).map(([fac, { total, origins }], fi) => {
                                const allOrigins = Object.keys(MTC_2026_FACTORIES['Tay Ninh'].origins).concat(
                                  ...Object.keys(MTC_2026_FACTORIES).map(f => Object.keys(MTC_2026_FACTORIES[f].origins))
                                ).filter((v, i, a) => a.indexOf(v) === i);
                                return (
                                  <tr key={fac} style={{ background: fi % 2 === 0 ? '#f0fdf4' : 'white', borderBottom: '1px solid #d1fae5' }}>
                                    <td style={{ padding: '3px 8px', fontWeight: 700 }}>{fac}</td>
                                    {allOrigins.map(o => (
                                      <td key={o} style={{ padding: '3px 8px', textAlign: 'right', color: origins[o] ? '#166534' : '#ccc' }}>
                                        {origins[o] ? origins[o].toLocaleString() : '—'}
                                      </td>
                                    ))}
                                    <td style={{ padding: '3px 8px', textAlign: 'right', fontWeight: 800, color: '#14532d' }}>{total.toLocaleString()}</td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background: '#dcfce7', borderTop: '2px solid #166534', fontWeight: 800 }}>
                                <td style={{ padding: '3px 8px' }}>TOTAL MTC</td>
                                {Object.keys(MTC_2026_FACTORIES['Tay Ninh'].origins).concat(
                                  ...Object.keys(MTC_2026_FACTORIES).map(f => Object.keys(MTC_2026_FACTORIES[f].origins))
                                ).filter((v, i, a) => a.indexOf(v) === i).map(o => (
                                  <td key={o} style={{ padding: '3px 8px', textAlign: 'right', color: '#14532d' }}>
                                    {Object.values(MTC_2026_FACTORIES).reduce((s, f) => s + (f.origins[o] || 0), 0).toLocaleString() || '—'}
                                  </td>
                                ))}
                                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#14532d' }}>{MTC_2026_TOTAL_QTY.toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div style={{ marginTop: 8, fontSize: '10px', color: '#555', background: '#f0fdf4', padding: '5px 8px', borderRadius: 4, border: '1px solid #86efac' }}>
                            <strong>EF table used for Cat.1 calculation:</strong> Guinea-B 0.92, C.Ivory 1.84, Tanzania 0.47, Indonesia 3.31, Cambodia 0.38, Senegal 0.65, Ghana 0.77, Guinea 0.77 (tCO₂e/tRCN — SBTi FLAG methodology).
                            Cat.4 transport EF: vessel 0.01604 g/t-km · road 0.07547 g/t-km.
                          </div>
                        </div>
                      </details>
                    </div>
                  </details>
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
                  <div id="s3-regional" style={{ scrollMarginTop: 92, marginTop: 12, background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 12px' }}>
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
            </div>
          </div>
        );
      })()}

      {/* ── Forecast Methodology Banner (shown when toggle ON) ──────── */}
      {showForecast && (
        <div style={{
          margin: '4px 12px 6px', borderRadius: 8,
          border: '2px solid #1a3d5c',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f0fe 100%)',
          overflow: 'hidden',
        }}>
          {/* Banner header */}
          <div style={{
            background: 'linear-gradient(135deg, #1a3d5c, #2d6a9f)', color: '#fff',
            padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontWeight: 800, fontSize: 12 }}>🔮 FC 2026 — Dự báo Cả Năm (Full Year Forecast)</span>
            <span style={{ fontSize: 11, fontWeight: 900 }}>
              Total: {fcTotal.toLocaleString()} tCO₂e
              <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.85 }}>
                (S1: {fcS1.toLocaleString()} + S2: {fcS2.toLocaleString()} + S3: {fcS3Total.toLocaleString()})
              </span>
            </span>
          </div>
          {/* Full Audit Table (Raw Data & Methodology) */}
          <details style={{ background: '#fff', borderTop: '1px solid #d0dbe8' }} open>
            <summary style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#1a3d5c', cursor: 'pointer', userSelect: 'none', background: '#f8fafc' }}>
              📊 Raw Data & Tham số Tính toán (Click để thu gọn/mở rộng)
            </summary>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '6px 12px', textAlign: 'left', width: '9%' }}>Scope</th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '15%' }}>Lịch sử 2025<br /><span style={{ fontWeight: 400, fontSize: 9 }}>(Tấn RCN, tCO₂e)</span></th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '12%' }}>Cường độ 2025<br /><span style={{ fontWeight: 400, fontSize: 9 }}>(tCO₂e / tRCN)</span></th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '15%' }}>Thực tế YTD 2026<br /><span style={{ fontWeight: 400, fontSize: 9 }}>(Tấn RCN, tCO₂e)</span></th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '12%' }}>Cường độ YTD<br /><span style={{ fontWeight: 400, fontSize: 9 }}>(tCO₂e / tRCN)</span></th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '15%' }}>Phát thải MTC<br /><span style={{ fontWeight: 400, fontSize: 9 }}>(Kế hoạch còn lại)</span></th>
                  <th style={{ padding: '6px 12px', textAlign: 'right', width: '22%' }}>Công thức / Dự báo 2026</th>
                </tr>
              </thead>
              <tbody>
                {/* Scope 1 */}
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#C8281A' }}>🔥 Scope 1</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{get(2025).rcn.toLocaleString()}</b><br />s1: {s1_2025.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{get(2025).rcn > 0 ? (s1_2025 / get(2025).rcn).toFixed(4) : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{ytd26rcn.toLocaleString()}</b><br />ytd: {ytd26s1.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{int_s1.toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>V: {facMtcQty.toLocaleString()} MT<br />est: {Math.round(mtc_s1).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', background: '#fef2f2' }}>
                    {selectedFac === 'ALL' ? (
                      <>
                        <div style={{ fontSize: 9, color: '#9A0000', fontWeight: 700, marginBottom: 2 }}>✅ Source: Approved Opex FC1 2026 Spreadsheet</div>
                        <b><span style={{ color: '#C8281A', fontSize: 12 }}>{fcS1.toLocaleString()} tCO₂e</span></b>
                        <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>[Dynamic ref: {ytd26s1} + {Math.round(mtc_s1)} = {calculatedFcS1}]</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>YTD + (Intensity × MTC)</div>
                        <b>{ytd26s1.toLocaleString()} + {Math.round(mtc_s1).toLocaleString()} = <span style={{ color: '#C8281A', fontSize: 12 }}>{fcS1.toLocaleString()}</span></b>
                      </>
                    )}
                  </td>
                </tr>
                {/* Scope 2 */}
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#4472C4' }}>⚡ Scope 2</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{get(2025).rcn.toLocaleString()}</b><br />s2: {s2_2025.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{get(2025).rcn > 0 ? (s2_2025 / get(2025).rcn).toFixed(4) : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{ytd26rcn.toLocaleString()}</b><br />ytd: {ytd26s2.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{int_s2.toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>V: {facMtcQty.toLocaleString()} MT<br />est: {Math.round(mtc_s2).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', background: '#eff6ff' }}>
                    {selectedFac === 'ALL' ? (
                      <>
                        <div style={{ fontSize: 9, color: '#1d4ed8', fontWeight: 700, marginBottom: 2 }}>✅ Source: Approved Opex FC1 2026 Spreadsheet</div>
                        <b><span style={{ color: '#4472C4', fontSize: 12 }}>{fcS2.toLocaleString()} tCO₂e</span></b>
                        <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>[Dynamic ref: {ytd26s2} + {Math.round(mtc_s2)} = {calculatedFcS2}]</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>YTD + (Intensity × MTC)</div>
                        <b>{ytd26s2.toLocaleString()} + {Math.round(mtc_s2).toLocaleString()} = <span style={{ color: '#4472C4', fontSize: 12 }}>{fcS2.toLocaleString()}</span></b>
                      </>
                    )}
                  </td>
                </tr>
                {/* Scope 3 Cat1 */}
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#3E7B3E' }}>🌿 S3.Cat1</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>ytd: {ytd26_s3cat1.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Theo Nguồn O-Mix</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>V: 62,027 MT<br />est: {Math.round(forecast2026Cat1_MTC()).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', background: '#f0fdf4' }}>
                    <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>YTD + ∑(MTC_Origin × EF)</div>
                    <b>{ytd26_s3cat1.toLocaleString()} + {Math.round(forecast2026Cat1_MTC()).toLocaleString()} = <span style={{ color: '#3E7B3E', fontSize: 12 }}>{fcS3Cat1.toLocaleString()}</span></b>
                  </td>
                </tr>
                {/* Scope 3 Cat3 */}
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#15803d' }}>⚙️ S3.Cat3</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{get(2025).rcn.toLocaleString()}</b><br />cat3: {s3_2025_data?.cat3 ? Math.round(s3_2025_data.cat3).toLocaleString() : 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{(ytd26rcn > 0 ? ytd26_s3cat3 / ytd26rcn : 0).toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>RCN: <b>{ytd26rcn.toLocaleString()}</b><br />ytd: {ytd26_s3cat3.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{(ytd26rcn > 0 ? ytd26_s3cat3 / ytd26rcn : 0).toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>V: 62,027 MT<br />est: {Math.round((ytd26rcn > 0 ? ytd26_s3cat3 / ytd26rcn : 0) * 62027).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', background: '#f0fdf4' }}>
                    <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>YTD + (Cường độ YTD × 62,027)</div>
                    <b>{ytd26_s3cat3.toLocaleString()} + {Math.round((ytd26rcn > 0 ? ytd26_s3cat3 / ytd26rcn : 0) * 62027).toLocaleString()} = <span style={{ color: '#15803d', fontSize: 12 }}>{fcS3Cat3.toLocaleString()}</span></b>
                  </td>
                </tr>
                {/* Scope 3 Cat4 */}
                <tr>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f766e' }}>🚢 S3.Cat4</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>-</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>ytd: {ytd26_s3cat4.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Origin T-km × EF</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>V: 62,027 MT<br />est: {Math.round(forecast2026Cat4_MTC().total).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', background: '#f0fdfa' }}>
                    <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>YTD + Logistics Route Map MTC</div>
                    <b>{ytd26_s3cat4.toLocaleString()} + {Math.round(forecast2026Cat4_MTC().total).toLocaleString()} = <span style={{ color: '#0f766e', fontSize: 12 }}>{fcS3Cat4.toLocaleString()}</span></b>
                  </td>
                </tr>
              </tbody>
            </table>
          </details>
        </div>
      )}

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
