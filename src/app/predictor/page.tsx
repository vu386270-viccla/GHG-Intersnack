'use client';
import SkeletonDashboard from '@/components/layout/SkeletonDashboard';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fitRegression, DataPoint } from '@/lib/regression';

// ── Types ──
interface MonthPoint {
  factoryId: string;
  year: number;
  month: number;
  key: string;
  rcn: number;
  firewood: number;
  diesel: number;
  electricity: number;
  fwEm: number;
  dsEm: number;
  elEm: number;
}

interface Factory { id: string; name: string; country: string; }

// ── Management KPI (tCO₂e/month) — top-down from management ──
// Same values as used in the PPT Overview page
const MONTHLY_KPI: Record<string, number> = {
  'Long An':    265,
  'Tây Ninh':   304,
  'Phan Thiết': 223,
  'Tuticorin':  334,
};

function getKpiForFactory(name: string): number | null {
  for (const [key, val] of Object.entries(MONTHLY_KPI)) {
    if (name.includes(key)) return val;
  }
  return null;
}

// ── Display config per utility ──
const EF = {
  firewood:    { unit: 'tons',   label: 'Firewood (Boiler)',  color: '#C8281A', iconLabel: '🪵' },
  diesel:      { unit: 'liters', label: 'Diesel',             color: '#F59E0B', iconLabel: '⛽' },
  electricity: { unit: 'kWh',   label: 'Electricity (Grid)',  color: '#3B82F6', iconLabel: '⚡' },
};

type Utility = keyof typeof EF;

// ── SBTi config ──
const SBTI_REDUCTION_BY_2032 = 0.50;
const BASE_YEAR  = 2021;
const TARGET_YEAR = 2032;

// ── Helpers ──
function r2Color(r2: number) {
  if (r2 >= 0.85) return '#22C55E';
  if (r2 >= 0.65) return '#F59E0B';
  return '#EF4444';
}
function r2Label(r2: number) {
  if (r2 >= 0.85) return 'Strong fit — high confidence';
  if (r2 >= 0.65) return 'Moderate fit — use with caution';
  return 'Weak fit — low reliability';
}
function fmtNum(n: number, dp = 0): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
}
function fmtAct(v: number, unit: string): string {
  const n = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
          : v >= 1000      ? `${(v / 1000).toFixed(1)}K`
          : fmtNum(v, 0);
  return `${n} ${unit}`;
}

// ── Scatter Plot ──
function ScatterPlot({ points, m, b, label, color, xLabel, yLabel }: {
  points: DataPoint[]; m: number; b: number;
  label: string; color: string; xLabel: string; yLabel: string;
}) {
  const W = 340, H = 175;
  const PAD = { l: 46, r: 12, t: 14, b: 36 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs, xMin + 1);
  const yMax = Math.max(...ys, 1) * 1.15;
  const cx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * cW;
  const cy = (y: number) => PAD.t + cH - (y / yMax) * cH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD.t + cH - f * cH;
        const v = f * yMax;
        const lbl = v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0);
        return <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
          <text x={PAD.l - 4} y={y + 3} fontSize={7} textAnchor="end" fill="#9ca3af">{lbl}</text>
        </g>;
      })}
      {[0, 0.5, 1].map(f => {
        const v = xMin + f * (xMax - xMin);
        return <text key={f} x={PAD.l + f * cW} y={H - PAD.b + 10} fontSize={7} textAnchor="middle" fill="#9ca3af">{v.toFixed(0)} MT</text>;
      })}
      <text x={W / 2} y={H - 2} fontSize={7.5} textAnchor="middle" fill="#6b7280">{xLabel}</text>
      <text x={8} y={H / 2} fontSize={7.5} textAnchor="middle" fill="#6b7280" transform={`rotate(-90, 8, ${H / 2})`}>{yLabel}</text>
      <line
        x1={cx(xMin)} y1={cy(Math.max(0, m * xMin + b))}
        x2={cx(xMax)} y2={cy(Math.min(yMax, m * xMax + b))}
        stroke={color} strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7}
      />
      {points.map((p, i) => (
        <circle key={i}
          cx={cx(p.x)} cy={cy(p.y)} r={p.isOutlier ? 4 : 3.5}
          fill={p.isOutlier ? '#9ca3af' : color}
          opacity={p.isOutlier ? 0.3 : 0.75}
          stroke={p.isOutlier ? '#6b7280' : 'white'} strokeWidth={0.8}
        >
          <title>{p.label}: RCN={fmtNum(p.x)} MT, {label}={fmtNum(p.y)}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── Gap breakdown row ──
function UtilityGapRow({
  info, current, needed, emSave, highlight,
}: {
  info: typeof EF[Utility];
  current: number;
  needed: number;
  emSave: number;
  highlight?: boolean;
}) {
  const save = current - needed;
  const pct  = current > 0 ? (save / current * 100) : 0;
  const isOver = current > needed;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 4,
      padding: '7px 10px', marginBottom: 5, borderRadius: 10,
      background: highlight ? `${info.color}08` : 'var(--color-bg-secondary)',
      border: `1.5px solid ${highlight ? info.color + '25' : 'transparent'}`,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, color: info.color, marginBottom: 1 }}>
          {info.iconLabel} {info.label}
        </div>
        {isOver && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            Reduce by&nbsp;
            <span style={{ fontWeight: 700, color: '#EF4444' }}>{pct.toFixed(1)}%</span>
            &nbsp;→ save {fmtAct(save, info.unit)}
            &nbsp;·&nbsp;<span style={{ color: '#EF4444' }}>−{fmtNum(emSave, 2)} tCO₂e</span>
          </div>
        )}
        {!isOver && (
          <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>✅ Already under target</div>
        )}
      </div>
      <div style={{ textAlign: 'right', minWidth: 80 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textDecoration: isOver ? 'line-through' : 'none' }}>
          {fmtAct(current, info.unit)}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: isOver ? '#22C55E' : '#22C55E' }}>
          {fmtAct(needed, info.unit)}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──
export default function PredictorPage() {
  const [loading, setLoading]     = useState(true);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [rawPoints, setRawPoints] = useState<MonthPoint[]>([]);
  const [factoryId, setFactoryId] = useState<string>('');
  const [rcnInput, setRcnInput]   = useState<string>('');
  const [fromYear, setFromYear]   = useState(2025);
  // Which right-panel to show: 'sbti' | 'kpi'
  const [targetTab, setTargetTab] = useState<'sbti' | 'kpi'>('kpi');

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Fetch data ──
  useEffect(() => {
    setLoading(true);
    const years: number[] = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);

    Promise.all([
      supabase.from('factories').select('id,name,country'),
      supabase.from('production_data')
        .select('factory_id,year,month,category,quantity')
        .in('year', years).eq('category', 'rcn_input').limit(5000),
      supabase.from('emissions_data')
        .select('factory_id,year,month,category,activity_data,emissions_tco2e')
        .in('year', years).in('category', ['wood_logs', 'diesel', 'electricity']).limit(20000),
    ]).then(([fRes, prodRes, emRes]) => {
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      if (facs.length > 0 && !factoryId) setFactoryId(facs[0].id);

      const prod = prodRes.data || [];
      const ems  = emRes.data  || [];

      const map = new Map<string, MonthPoint>();
      for (const p of prod) {
        const key = `${p.factory_id}|${p.year}|${p.month}`;
        if (!map.has(key)) map.set(key, {
          factoryId: p.factory_id, year: p.year, month: p.month,
          key: `${p.year}-${String(p.month).padStart(2, '0')}`,
          rcn: 0, firewood: 0, diesel: 0, electricity: 0, fwEm: 0, dsEm: 0, elEm: 0,
        });
        map.get(key)!.rcn += Number(p.quantity);
      }
      for (const e of ems) {
        const key = `${e.factory_id}|${e.year}|${e.month}`;
        if (!map.has(key)) continue;
        const pt = map.get(key)!;
        if (e.category === 'wood_logs')   { pt.firewood    += Number(e.activity_data); pt.fwEm += Number(e.emissions_tco2e); }
        if (e.category === 'diesel')      { pt.diesel      += Number(e.activity_data); pt.dsEm += Number(e.emissions_tco2e); }
        if (e.category === 'electricity') { pt.electricity += Number(e.activity_data); pt.elEm += Number(e.emissions_tco2e); }
      }
      setRawPoints([...map.values()].filter(p => p.rcn > 0 && (p.firewood > 0 || p.diesel > 0 || p.electricity > 0)));
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromYear]);

  // ── Filter & regression ──
  const pts = useMemo(() =>
    rawPoints.filter(p => !factoryId || p.factoryId === factoryId),
    [rawPoints, factoryId]
  );

  const regs = useMemo((): Record<Utility, ReturnType<typeof fitRegression>> => {
    const toDP = (ps: MonthPoint[], k: Utility): DataPoint[] =>
      ps.map(p => ({ x: p.rcn, y: p[k], label: p.key }));
    return {
      firewood:    fitRegression(toDP(pts, 'firewood')),
      diesel:      fitRegression(toDP(pts, 'diesel')),
      electricity: fitRegression(toDP(pts, 'electricity')),
    };
  }, [pts]);

  // ── Detect utilities with no data (all zeros in baseline) ──
  const hasData = useMemo((): Record<Utility, boolean> => ({
    firewood:    pts.some(p => p.firewood > 0),
    diesel:      pts.some(p => p.diesel > 0),
    electricity: pts.some(p => p.electricity > 0),
  }), [pts]);

  // Historical RCN range — used for extrapolation warning
  const rcnRange = useMemo(() => {
    const xs = pts.map(p => p.rcn).filter(v => v > 0);
    return xs.length > 0
      ? { min: Math.min(...xs), max: Math.max(...xs) }
      : { min: 0, max: 0 };
  }, [pts]);

  // Min observed monthly activity per utility — physical baseline floor
  // (factory still has idle load: lighting, HVAC, offices, refrigeration)
  const utilityMin = useMemo((): Record<Utility, number> => {
    const minOf = (k: Utility) => {
      const vals = pts.map(p => p[k]).filter(v => v > 0);
      return vals.length > 0 ? Math.min(...vals) : 0;
    };
    return {
      firewood:    minOf('firewood'),
      diesel:      minOf('diesel'),
      electricity: minOf('electricity'),
    };
  }, [pts]);

  const rcn = parseFloat(rcnInput) || 0;
  const outsideRange = rcn > 0 && rcnRange.max > 0 && (rcn < rcnRange.min || rcn > rcnRange.max);

  // Clamp regression output at historical monthly minimum so low-RCN
  // extrapolation doesn't yield unphysical near-zero utility values.
  const predicted = useMemo((): Record<Utility, number> => ({
    firewood:    rcn > 0 ? Math.max(regs.firewood.predict(rcn),    utilityMin.firewood)    : 0,
    diesel:      rcn > 0 ? Math.max(regs.diesel.predict(rcn),      utilityMin.diesel)      : 0,
    electricity: rcn > 0 ? Math.max(regs.electricity.predict(rcn), utilityMin.electricity) : 0,
  }), [rcn, regs, utilityMin]);

  // Empirical EF from dataset (tCO₂e per unit activity)
  const emRatio = useMemo(() => {
    const ratio = (emKey: 'fwEm'|'dsEm'|'elEm', actKey: Utility) => {
      const totEm  = pts.reduce((s, p) => s + p[emKey], 0);
      const totAct = pts.reduce((s, p) => s + p[actKey], 0);
      return totAct > 0 ? totEm / totAct : 0;
    };
    return {
      firewood:    ratio('fwEm', 'firewood'),
      diesel:      ratio('dsEm', 'diesel'),
      electricity: ratio('elEm', 'electricity'),
    };
  }, [pts]);

  const predictedEm = useMemo(() => {
    const fw = predicted.firewood    * emRatio.firewood;
    const ds = predicted.diesel      * emRatio.diesel;
    const el = predicted.electricity * emRatio.electricity;
    return { firewood: fw, diesel: ds, electricity: el, total: fw + ds + el };
  }, [predicted, emRatio]);

  // ── SBTi pathway target ──
  const yearsElapsed = Math.max(0, thisYear - BASE_YEAR);
  const reductionPct = (yearsElapsed / (TARGET_YEAR - BASE_YEAR)) * SBTI_REDUCTION_BY_2032;
  const baselineEmPerRcn = useMemo(() => {
    const totEm  = pts.reduce((s, p) => s + p.fwEm + p.dsEm + p.elEm, 0);
    const totRcn = pts.reduce((s, p) => s + p.rcn, 0);
    return totRcn > 0 ? totEm / totRcn : 0;
  }, [pts]);
  const sbtiTargetEm = rcn > 0 ? baselineEmPerRcn * rcn * (1 - reductionPct) : 0;
  const sbtiGapEm    = predictedEm.total - sbtiTargetEm;
  const sbtiGapPct   = predictedEm.total > 0 ? (sbtiGapEm / predictedEm.total) * 100 : 0;
  const sbtiReqReduction = Math.max(0, sbtiGapPct);

  // ── Monthly KPI target ──
  const factoryName  = factories.find(f => f.id === factoryId)?.name || factoryId;
  const kpiPerMonth  = getKpiForFactory(factoryName); // tCO₂e/month (management-set)
  const kpiGapEm     = kpiPerMonth !== null && rcn > 0 ? predictedEm.total - kpiPerMonth : 0;
  const kpiGapPct    = kpiPerMonth !== null && predictedEm.total > 0 ? (kpiGapEm / predictedEm.total) * 100 : 0;
  const kpiReqReduction = Math.max(0, kpiGapPct);

  // Per-utility KPI targets (proportional split using emission share)
  const kpiUtilityTarget = useMemo(() => {
    if (kpiPerMonth === null || predictedEm.total <= 0) return null;
    const ratio = kpiPerMonth / predictedEm.total;
    // Each utility is scaled by the same ratio to hit KPI total
    return {
      firewood:    predictedEm.firewood    * ratio,
      diesel:      predictedEm.diesel      * ratio,
      electricity: predictedEm.electricity * ratio,
    };
  }, [kpiPerMonth, predictedEm]);

  // Convert emission target per utility → activity units
  function emToAct(emTarget: number, emR: number): number {
    return emR > 0 ? emTarget / emR : 0;
  }

  const kpiActTarget = useMemo(() => {
    if (!kpiUtilityTarget) return null;
    return {
      firewood:    emToAct(kpiUtilityTarget.firewood,    emRatio.firewood),
      diesel:      emToAct(kpiUtilityTarget.diesel,      emRatio.diesel),
      electricity: emToAct(kpiUtilityTarget.electricity, emRatio.electricity),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiUtilityTarget, emRatio]);

  const UTILITIES: Utility[] = ['firewood', 'diesel', 'electricity'];

  if (loading) return <SkeletonDashboard />;return (
    <div className="page-enter" style={{ maxWidth: 1140, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6366F1' }}>🔮</span> Emission Predictor
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>
            Scope 1 & 2 · Linear Regression Model
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Enter RCN → model predicts electricity / firewood / diesel and shows gap vs KPI & SBTi · Outliers auto-removed (2σ)
        </div>
      </div>

      {/* ── Hướng dẫn đọc ── */}
      <details style={{
        marginBottom: 12, borderRadius: 10,
        background: '#6366F108', border: '1.5px solid #6366F125',
      }}>
        <summary style={{
          padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          color: '#6366F1', userSelect: 'none',
        }}>
          ℹ️ Hướng dẫn đọc số liệu & giới hạn mô hình
        </summary>
        <div style={{
          padding: '4px 14px 12px 14px', fontSize: 11.5,
          color: 'var(--color-text-secondary)', lineHeight: 1.55,
        }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li><b>Mô hình:</b> hồi quy tuyến tính <code>y = m·RCN + b</code>, huấn luyện trên dữ liệu tháng {fromYear}–{thisYear} (outlier 2σ đã loại).</li>
            <li><b>Nhập trong dải lịch sử</b> → prediction đáng tin cậy; xem <code>R²</code> ở từng card để đánh giá độ khớp.</li>
            <li><b>Nhập ngoài dải</b> → viền input chuyển cam + banner cảnh báo. Đây là extrapolation, không nên dùng để ra quyết định.</li>
            <li><b>Floor baseline:</b> prediction không thấp hơn mức tháng thấp nhất từng quan sát. Đại diện cho tải nền cố định (chiếu sáng, lạnh, văn phòng) không phụ thuộc RCN. Vì vậy với RCN rất nhỏ, kết quả sẽ bằng mức tối thiểu lịch sử chứ không gần 0.</li>
            <li><b>Gap vs KPI / SBTi:</b> so sánh tổng Scope 1+2 dự đoán với mục tiêu quản lý (KPI) hoặc đường cong SBTi tuyến tính −50% tới {TARGET_YEAR}.</li>
          </ul>
        </div>
      </details>

      {/* ── Controls ── */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }}>Factory</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {factories.map(f => (
              <button key={f.id} onClick={() => setFactoryId(f.id)} style={{
                padding: '4px 13px', borderRadius: 20, border: '1.5px solid',
                borderColor: factoryId === f.id ? '#6366F1' : 'var(--color-border)',
                background: factoryId === f.id ? '#6366F1' : 'transparent',
                color: factoryId === f.id ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}>{f.name}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 3 }}>Baseline from</div>
          <select value={fromYear} onChange={e => setFromYear(Number(e.target.value))} style={{
            padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)',
            background: 'var(--color-bg-secondary)', color: 'var(--color-text)', fontSize: 12,
          }}>
            {[2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y} → {thisYear}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>{pts.length}</span>&nbsp;months
        </div>
        {kpiPerMonth !== null && (
          <div style={{ marginLeft: 'auto', background: '#6366F110', border: '1.5px solid #6366F130', borderRadius: 10, padding: '5px 12px', fontSize: 11 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Monthly KPI</span>
            &nbsp;
            <span style={{ fontWeight: 800, color: '#6366F1', fontSize: 15 }}>{kpiPerMonth}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> tCO₂e</span>
          </div>
        )}
      </div>

      {/* ── Regression cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {UTILITIES.map(u => {
          const reg = regs[u];
          const info = EF[u];
          const hasActivity = hasData[u];
          return (
            <div key={u} className="card" style={{ padding: '11px 13px', position: 'relative', opacity: hasActivity ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: info.color }}>{info.iconLabel} {info.label}</div>
                {hasActivity ? (
                  <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${r2Color(reg.r2)}22`, color: r2Color(reg.r2) }}>
                    R² = {reg.r2.toFixed(3)}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#9ca3af22', color: '#9ca3af' }}>
                    No data
                  </div>
                )}
              </div>
              {hasActivity ? (
                <>
                  <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', marginBottom: 6, fontFamily: 'monospace' }}>
                    y = {fmtNum(reg.m, 2)}·RCN {reg.b >= 0 ? '+' : '−'} {fmtNum(Math.abs(reg.b), 0)}
                  </div>
                  <ScatterPlot points={reg.points} m={reg.m} b={reg.b} label={info.label} color={info.color} xLabel="RCN (MT)" yLabel={info.unit} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginTop: 6, fontSize: 9.5 }}>
                    {[{ v: String(reg.n), l: 'pts' }, { v: String(reg.outliers), l: 'outliers', warn: reg.outliers > 0 }, { v: reg.rmse >= 1000 ? `${(reg.rmse / 1000).toFixed(1)}K` : fmtNum(reg.rmse, 0), l: 'RMSE' }].map((item, i) => (
                      <div key={i} style={{ background: 'var(--color-bg-secondary)', borderRadius: 5, padding: '3px 5px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: item.warn ? '#F59E0B' : 'var(--color-text)' }}>{item.v}</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>{item.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 5, fontSize: 9, fontWeight: 600, color: r2Color(reg.r2), padding: '2px 5px', background: `${r2Color(reg.r2)}12`, borderRadius: 5, textAlign: 'center' }}>
                    {r2Label(reg.r2)}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 28 }}>🚫</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textAlign: 'center' }}>
                    Not used at {factoryName}<br />
                    <span style={{ fontSize: 9.5, fontWeight: 400 }}>No {info.label.toLowerCase()} data in baseline period</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Input + Target panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 12, alignItems: 'start' }}>

        {/* LEFT: Input panel */}
        <div className="card" style={{ padding: '15px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
            📥 Input RCN — Predict Utilities
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>
              RCN Input (MT) — {factoryName}
            </label>
            <input
              type="number" min={0} step={10} value={rcnInput}
              onChange={e => setRcnInput(e.target.value)}
              placeholder="Enter MT RCN..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: '2px solid',
                borderColor: outsideRange ? '#F59E0B' : rcn > 0 ? '#6366F1' : 'var(--color-border)',
                background: 'var(--color-bg-secondary)', color: 'var(--color-text)',
                fontSize: 20, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {rcnRange.max > 0 && (
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 5 }}>
                Dải lịch sử: <b style={{ color: 'var(--color-text-secondary)' }}>{fmtNum(rcnRange.min, 0)} – {fmtNum(rcnRange.max, 0)} MT/tháng</b>
              </div>
            )}
            {outsideRange && (
              <div style={{
                marginTop: 6, padding: '7px 10px', borderRadius: 8,
                background: '#F59E0B15', border: '1.5px solid #F59E0B40',
                fontSize: 10.5, color: '#F59E0B', fontWeight: 600, lineHeight: 1.45,
              }}>
                ⚠️ Ngoài dải dữ liệu huấn luyện — extrapolation, độ tin cậy thấp. Số đã được floor tại mức tháng thấp nhất từng quan sát để tránh giá trị phi thực tế.
              </div>
            )}
          </div>

          {rcn > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {UTILITIES.map(u => {
                const reg  = regs[u];
                const info = EF[u];
                const val  = predicted[u];
                const emV  = predictedEm[u];
                const conf = reg.r2 >= 0.85 ? '±10%' : reg.r2 >= 0.65 ? '±20%' : '±35%+';
                const active = hasData[u];
                return (
                  <div key={u} style={{
                    padding: '8px 11px', borderRadius: 10,
                    background: active ? `${info.color}0d` : 'var(--color-bg-secondary)',
                    border: `1.5px solid ${active ? info.color + '30' : 'var(--color-border)'}`,
                    opacity: active ? 1 : 0.55,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: active ? info.color : '#9ca3af' }}>{info.iconLabel} {info.label}</div>
                        {active ? (
                          <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>
                            {fmtNum(emV, 2)} tCO₂e · R²={reg.r2.toFixed(2)} {conf}
                          </div>
                        ) : (
                          <div style={{ fontSize: 9.5, color: '#9ca3af', fontStyle: 'italic' }}>Not used at this factory</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {active ? (
                          <>
                            <div style={{ fontSize: 17, fontWeight: 800, color: info.color }}>
                              {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(2)}M` : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : fmtNum(val, 0)}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>{info.unit}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>N/A</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Total */}
              <div style={{ padding: '9px 13px', borderRadius: 10, background: '#6366F110', border: '2px solid #6366F130', marginTop: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>📊 Total Scope 1+2</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#6366F1' }}>{fmtNum(predictedEm.total, 1)} tCO₂e</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  Intensity: {fmtNum(predictedEm.total / rcn, 4)} tCO₂e / MT RCN
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
              ↑ Enter RCN to see predicted utilities
            </div>
          )}
        </div>

        {/* RIGHT: Tab panel */}
        <div className="card" style={{ padding: '15px 16px' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--color-border)' }}>
            {([
              { key: 'kpi',  label: '🎯 Monthly KPI Target',  desc: 'Management-set' },
              { key: 'sbti', label: '📉 SBTi Pathway',        desc: '−50% by 2032' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTargetTab(t.key)} style={{
                flex: 1, padding: '9px 12px', border: 'none', cursor: 'pointer',
                background: targetTab === t.key ? '#6366F1' : 'transparent',
                color: targetTab === t.key ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
              }}>
                {t.label}
                <div style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.8, marginTop: 1 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* ── KPI panel ── */}
          {targetTab === 'kpi' && (
            <>
              {kpiPerMonth === null ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#F59E0B', fontSize: 12, fontWeight: 600 }}>
                  ⚠️ No KPI defined for {factoryName || 'this factory'}.<br />
                  <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--color-text-muted)' }}>Add it to MONTHLY_KPI in the predictor code.</span>
                </div>
              ) : rcn === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  ← Enter RCN to see KPI gap
                </div>
              ) : (
                <>
                  {/* KPI header */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Predicted emission</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: kpiGapPct > 0 ? '#EF4444' : '#22C55E' }}>{fmtNum(predictedEm.total, 1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                    </div>
                    <div style={{ flex: 1, background: '#6366F110', border: '1.5px solid #6366F130', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Monthly KPI</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#6366F1' }}>{fmtNum(kpiPerMonth, 0)}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                    </div>
                    <div style={{
                      flex: 1, borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                      background: kpiGapPct > 0 ? '#EF444410' : '#22C55E10',
                      border: `1.5px solid ${kpiGapPct > 0 ? '#EF444440' : '#22C55E40'}`,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{kpiGapPct > 0 ? 'Over by' : 'Under by'}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: kpiGapPct > 0 ? '#EF4444' : '#22C55E' }}>
                        {Math.abs(kpiGapPct).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fmtNum(Math.abs(kpiGapEm), 1)} tCO₂e</div>
                    </div>
                  </div>

                  {kpiGapPct > 0 && kpiActTarget ? (
                    <>
                      <div style={{
                        padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                        background: '#EF444408', border: '1.5px solid #EF444430',
                        fontSize: 11, fontWeight: 700, color: '#EF4444',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>To hit KPI — reduce all utilities uniformly by:</span>
                        <span style={{ fontSize: 20, fontFamily: 'var(--font-display)' }}>{kpiReqReduction.toFixed(1)}%</span>
                      </div>

                      {UTILITIES.map(u => {
                        const info     = EF[u];
                        const current  = predicted[u];
                        const needed   = kpiActTarget[u];
                        const emNeeded = kpiUtilityTarget![u];
                        const emSaved  = predictedEm[u] - emNeeded;
                        return (
                          <UtilityGapRow
                            key={u}
                            info={info}
                            current={current}
                            needed={needed}
                            emSave={emSaved}
                            highlight
                          />
                        );
                      })}

                      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-muted)', padding: '6px 10px', background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                        💡 Reduction split is proportional to each utility's emission share.
                        Firewood has highest leverage per unit reduced.
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#22C55E', fontSize: 13, fontWeight: 700 }}>
                      ✅ Predicted emission already within monthly KPI!
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── SBTi panel ── */}
          {targetTab === 'sbti' && (
            <>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                SBTi linear pathway: −{(reductionPct * 100).toFixed(1)}% vs 2021 baseline for {thisYear} ·
                Target: −50% by {TARGET_YEAR} · Month: {monthLabels[thisMonth - 1]} {thisYear}
              </div>

              {rcn === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  ← Enter RCN to calculate SBTi gap
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, background: 'var(--color-bg-secondary)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Predicted</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: sbtiGapPct > 0 ? '#EF4444' : '#22C55E' }}>{fmtNum(predictedEm.total, 1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                    </div>
                    <div style={{ flex: 1, background: '#22C55E10', border: '1.5px solid #22C55E30', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>SBTi target</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#22C55E' }}>{fmtNum(sbtiTargetEm, 1)}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                    </div>
                    <div style={{
                      flex: 1, borderRadius: 10, padding: '10px 12px', textAlign: 'center',
                      background: sbtiGapPct > 0 ? '#EF444410' : '#22C55E10',
                      border: `1.5px solid ${sbtiGapPct > 0 ? '#EF444440' : '#22C55E40'}`,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{sbtiGapPct > 0 ? 'Over by' : 'Under by'}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: sbtiGapPct > 0 ? '#EF4444' : '#22C55E' }}>
                        {Math.abs(sbtiGapPct).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{fmtNum(Math.abs(sbtiGapEm), 1)} tCO₂e</div>
                    </div>
                  </div>

                  {sbtiGapPct > 0 ? (
                    <>
                      <div style={{
                        padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                        background: '#EF444408', border: '1.5px solid #EF444430',
                        fontSize: 11, fontWeight: 700, color: '#EF4444',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>To stay on SBTi pathway — reduce all utilities by:</span>
                        <span style={{ fontSize: 20, fontFamily: 'var(--font-display)' }}>{sbtiReqReduction.toFixed(1)}%</span>
                      </div>
                      {UTILITIES.map(u => {
                        const info    = EF[u];
                        const current = predicted[u];
                        const needed  = current * (1 - sbtiReqReduction / 100);
                        const emSave  = predictedEm[u] - predictedEm[u] * (1 - sbtiReqReduction / 100);
                        return (
                          <UtilityGapRow key={u} info={info} current={current} needed={needed} emSave={emSave} highlight />
                        );
                      })}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#22C55E', fontSize: 13, fontWeight: 700 }}>
                      ✅ Already on track with SBTi pathway!
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* footnote */}
      <div style={{ marginTop: 10, fontSize: 9.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Model: {fromYear}–{thisYear} monthly data · {factoryName} · Outlier removal 2σ ·
        KPI = management top-down monthly target · SBTi −50% Scope 1+2 by {TARGET_YEAR} vs {BASE_YEAR}
      </div>
    </div>
  );
}
