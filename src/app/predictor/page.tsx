'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fitRegression, DataPoint } from '@/lib/regression';

// ── Types ──
interface MonthPoint {
  factoryId: string;
  year: number;
  month: number;
  key: string;       // "YYYY-MM"
  rcn: number;       // MT
  firewood: number;  // tons (activity_data)
  diesel: number;    // liters
  electricity: number; // kWh
  // tCO2e per utility
  fwEm: number;
  dsEm: number;
  elEm: number;
}

interface Factory { id: string; name: string; country: string; }

// ── Emission factors for display ──
const EF = {
  firewood:    { unit: 'tons',   label: 'Firewood (Boiler)',  color: '#C8281A', emUnit: 'tCO₂e/ton',  iconLabel: '🪵' },
  diesel:      { unit: 'liters', label: 'Diesel',             color: '#F59E0B', emUnit: 'tCO₂e/L',    iconLabel: '⛽' },
  electricity: { unit: 'kWh',   label: 'Electricity (Grid)',  color: '#3B82F6', emUnit: 'tCO₂e/kWh',  iconLabel: '⚡' },
};

type Utility = keyof typeof EF;

// ── SBTi annual target (Scope 1+2, −50% by 2032 vs 2021) ──
// We use a monthly pro-rata target based on factory-level baseline
const SBTI_REDUCTION_BY_2032 = 0.50;
const BASE_YEAR = 2021;
const TARGET_YEAR = 2032;

function r2Color(r2: number): string {
  if (r2 >= 0.85) return '#22C55E';
  if (r2 >= 0.65) return '#F59E0B';
  return '#EF4444';
}

function r2Label(r2: number): string {
  if (r2 >= 0.85) return 'Strong fit — high confidence';
  if (r2 >= 0.65) return 'Moderate fit — use with caution';
  return 'Weak fit — low reliability';
}

function fmtNum(n: number, dp = 0): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

// ── Scatter plot (inline SVG) ──
function ScatterPlot({
  points, m, b, label, color, xLabel, yLabel,
}: {
  points: DataPoint[];
  m: number; b: number;
  label: string; color: string; xLabel: string; yLabel: string;
}) {
  const W = 340, H = 180;
  const PAD = { l: 46, r: 12, t: 16, b: 36 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs); const xMax = Math.max(...xs, xMin + 1);
  const yMin = 0;              const yMax = Math.max(...ys, 1) * 1.15;

  const cx = (x: number) => PAD.l + ((x - xMin) / (xMax - xMin)) * cW;
  const cy = (y: number) => PAD.t + cH - ((y - yMin) / (yMax - yMin)) * cH;

  // Regression line endpoints
  const ry0 = m * xMin + b;
  const ry1 = m * xMax + b;

  const ticks5 = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* grid */}
      {ticks5.map(f => {
        const y = PAD.t + cH - f * cH;
        return <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />;
      })}

      {/* Y axis ticks */}
      {ticks5.map(f => {
        const v = yMin + f * (yMax - yMin);
        const y = PAD.t + cH - f * cH;
        const label = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0);
        return <text key={f} x={PAD.l - 4} y={y + 3} fontSize={7} textAnchor="end" fill="#9ca3af">{label}</text>;
      })}

      {/* X labels */}
      {[0, 0.5, 1].map(f => {
        const v = xMin + f * (xMax - xMin);
        const x = PAD.l + f * cW;
        return <text key={f} x={x} y={H - PAD.b + 10} fontSize={7} textAnchor="middle" fill="#9ca3af">{v.toFixed(0)} MT</text>;
      })}

      {/* Axis labels */}
      <text x={W / 2} y={H - 2} fontSize={7.5} textAnchor="middle" fill="#6b7280">{xLabel}</text>
      <text x={8} y={H / 2} fontSize={7.5} textAnchor="middle" fill="#6b7280"
        transform={`rotate(-90, 8, ${H / 2})`}>{yLabel}</text>

      {/* Regression line */}
      <line
        x1={cx(xMin)} y1={cy(Math.max(yMin, ry0))}
        x2={cx(xMax)} y2={cy(Math.min(yMax, ry1))}
        stroke={color} strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7}
      />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={cx(p.x)} cy={cy(p.y)} r={p.isOutlier ? 4 : 3.5}
            fill={p.isOutlier ? '#9ca3af' : color}
            opacity={p.isOutlier ? 0.3 : 0.75}
            stroke={p.isOutlier ? '#6b7280' : 'white'}
            strokeWidth={0.8}
          >
            <title>{p.label}: RCN={fmtNum(p.x)} MT, {label}={fmtNum(p.y)}</title>
          </circle>
        </g>
      ))}
    </svg>
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

  // ── Fetch multi-year data (2025 → current) ──
  useEffect(() => {
    setLoading(true);
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = fromYear; y <= currentYear; y++) years.push(y);

    Promise.all([
      supabase.from('factories').select('id,name,country'),
      supabase.from('production_data')
        .select('factory_id,year,month,category,quantity')
        .in('year', years)
        .eq('category', 'rcn_input')
        .limit(5000),
      supabase.from('emissions_data')
        .select('factory_id,year,month,category,activity_data,emissions_tco2e')
        .in('year', years)
        .in('category', ['firewood', 'diesel', 'electricity'])
        .limit(20000),
    ]).then(([fRes, prodRes, emRes]) => {
      const facs = (fRes.data || []) as Factory[];
      setFactories(facs);
      if (facs.length > 0 && !factoryId) setFactoryId(facs[0].id);

      const prod = prodRes.data || [];
      const ems  = emRes.data  || [];

      // Build month-level points
      // Group key: factoryId + year + month
      const map = new Map<string, MonthPoint>();
      for (const p of prod) {
        const key = `${p.factory_id}|${p.year}|${p.month}`;
        if (!map.has(key)) map.set(key, {
          factoryId: p.factory_id, year: p.year, month: p.month,
          key: `${p.year}-${String(p.month).padStart(2, '0')}`,
          rcn: 0, firewood: 0, diesel: 0, electricity: 0,
          fwEm: 0, dsEm: 0, elEm: 0,
        });
        map.get(key)!.rcn += Number(p.quantity);
      }
      for (const e of ems) {
        const key = `${e.factory_id}|${e.year}|${e.month}`;
        if (!map.has(key)) continue;
        const pt = map.get(key)!;
        if (e.category === 'firewood')    { pt.firewood    += Number(e.activity_data); pt.fwEm += Number(e.emissions_tco2e); }
        if (e.category === 'diesel')      { pt.diesel      += Number(e.activity_data); pt.dsEm += Number(e.emissions_tco2e); }
        if (e.category === 'electricity') { pt.electricity += Number(e.activity_data); pt.elEm += Number(e.emissions_tco2e); }
      }

      // Only keep months that have RCN > 0 (factory was operating)
      setRawPoints([...map.values()].filter(p => p.rcn > 0));
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromYear]);

  // ── Filter to selected factory ──
  const pts = useMemo(() =>
    rawPoints.filter(p => !factoryId || p.factoryId === factoryId),
    [rawPoints, factoryId]
  );

  // ── Fit regression per utility ──
  const regs = useMemo((): Record<Utility, ReturnType<typeof fitRegression>> => {
    const toDP = (pts: MonthPoint[], yKey: Utility): DataPoint[] =>
      pts.map(p => ({ x: p.rcn, y: p[yKey], label: p.key }));

    return {
      firewood:    fitRegression(toDP(pts, 'firewood')),
      diesel:      fitRegression(toDP(pts, 'diesel')),
      electricity: fitRegression(toDP(pts, 'electricity')),
    };
  }, [pts]);

  // ── Prediction from input RCN ──
  const rcn = parseFloat(rcnInput) || 0;

  const predicted = useMemo((): Record<Utility, number> => ({
    firewood:    rcn > 0 ? regs.firewood.predict(rcn)    : 0,
    diesel:      rcn > 0 ? regs.diesel.predict(rcn)      : 0,
    electricity: rcn > 0 ? regs.electricity.predict(rcn) : 0,
  }), [rcn, regs]);

  // ── Emission from predicted activity ──
  // We use the empirical emissions-per-activity from the dataset
  const emRatio = useMemo(() => {
    const ratio = (key: 'fwEm' | 'dsEm' | 'elEm', actKey: Utility) => {
      const total = pts.reduce((s, p) => s + p[key], 0);
      const act   = pts.reduce((s, p) => s + p[actKey], 0);
      return act > 0 ? total / act : 0;
    };
    return {
      firewood:    ratio('fwEm', 'firewood'),
      diesel:      ratio('dsEm', 'diesel'),
      electricity: ratio('elEm', 'electricity'),
    };
  }, [pts]);

  const predictedEm = useMemo(() => ({
    firewood:    predicted.firewood    * emRatio.firewood,
    diesel:      predicted.diesel      * emRatio.diesel,
    electricity: predicted.electricity * emRatio.electricity,
    total() { return this.firewood + this.diesel + this.electricity; },
  }), [predicted, emRatio]);

  // ── SBTi Monthly Target ──
  // For a given month, the linear SBTi pathway target vs 2021 baseline
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  // Interpolated reduction % for current year (linear 2021→2032)
  const yearsElapsed = Math.max(0, thisYear - BASE_YEAR);
  const totalYears   = TARGET_YEAR - BASE_YEAR;
  const reductionPct = (yearsElapsed / totalYears) * SBTI_REDUCTION_BY_2032;
  
  // Baseline emissions per MT RCN for this factory (empirical from data)
  const baselineEmPerRcn = useMemo(() => {
    if (pts.length === 0) return 0;
    const totalEm  = pts.reduce((s, p) => s + p.fwEm + p.dsEm + p.elEm, 0);
    const totalRcn = pts.reduce((s, p) => s + p.rcn, 0);
    return totalRcn > 0 ? totalEm / totalRcn : 0;
  }, [pts]);

  // Target total emission for the predicted RCN amount
  const targetEm = rcn > 0 ? (baselineEmPerRcn * rcn * (1 - reductionPct)) : 0;
  const gapEm    = predictedEm.total() - targetEm;
  const gapPct   = predictedEm.total() > 0 ? (gapEm / predictedEm.total()) * 100 : 0;

  // Required % reduction per utility (applied uniformly)
  const requiredReduction = gapPct > 0 ? gapPct : 0;

  // ── Months in dataset ──
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ── Selected factory name ──
  const factoryName = factories.find(f => f.id === factoryId)?.name || factoryId;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <div className="loading-spinner" />
      <span style={{ color: 'var(--color-text-muted)' }}>Loading predictor data...</span>
    </div>
  );

  const UTILITIES: Utility[] = ['firewood', 'diesel', 'electricity'];

  return (
    <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6366F1' }}>🔮</span> Emission Predictor
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 4 }}>
            Scope 1 & 2 — Linear Regression Model
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          Dự đoán lượng điện / củi / diesel cần thiết theo RCN đầu vào — tự động loại bỏ outlier (2σ)
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {/* Factory */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Factory</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {factories.map(f => (
              <button key={f.id} onClick={() => setFactoryId(f.id)} style={{
                padding: '5px 14px', borderRadius: 20, border: '1.5px solid',
                borderColor: factoryId === f.id ? '#6366F1' : 'var(--color-border)',
                background: factoryId === f.id ? '#6366F1' : 'transparent',
                color: factoryId === f.id ? '#fff' : 'var(--color-text-secondary)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Baseline period */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Baseline from year</div>
          <select
            value={fromYear}
            onChange={e => setFromYear(Number(e.target.value))}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)',
              background: 'var(--color-bg-secondary)', color: 'var(--color-text)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            {[2022, 2023, 2024, 2025].map(y => (
              <option key={y} value={y}>{y} → {now.getFullYear()}</option>
            ))}
          </select>
        </div>

        {/* n data points */}
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 20 }}>{pts.length}</div>
          months of data
        </div>
      </div>

      {/* ── Regression cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {UTILITIES.map(u => {
          const reg = regs[u];
          const info = EF[u];
          return (
            <div key={u} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: info.color }}>
                  {info.iconLabel} {info.label}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: `${r2Color(reg.r2)}22`, color: r2Color(reg.r2),
                }}>
                  R² = {reg.r2.toFixed(3)}
                </div>
              </div>

              {/* Mini formula */}
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 8, fontFamily: 'monospace' }}>
                y = {fmtNum(reg.m, 2)}·RCN {reg.b >= 0 ? '+' : '−'} {fmtNum(Math.abs(reg.b), 0)}
              </div>

              {/* Scatter */}
              <ScatterPlot
                points={reg.points}
                m={reg.m} b={reg.b}
                label={info.label} color={info.color}
                xLabel="RCN (MT)" yLabel={info.unit}
              />

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 8, fontSize: 10 }}>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{reg.n}</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>pts used</div>
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: reg.outliers > 0 ? '#F59E0B' : 'var(--color-text)' }}>{reg.outliers}</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>outliers</div>
                </div>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                    {reg.rmse >= 1000 ? `${(reg.rmse / 1000).toFixed(1)}K` : fmtNum(reg.rmse, 0)}
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>RMSE</div>
                </div>
              </div>

              {/* R2 interpretation */}
              <div style={{
                marginTop: 6, fontSize: 9.5, fontWeight: 600,
                color: r2Color(reg.r2), padding: '3px 6px',
                background: `${r2Color(reg.r2)}14`, borderRadius: 6, textAlign: 'center',
              }}>
                {r2Label(reg.r2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input & Prediction ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Input panel */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
            📥 Input RCN — Predict Utilities
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              RCN Input (MT) — {factoryName}
            </label>
            <input
              type="number"
              min={0}
              step={10}
              value={rcnInput}
              onChange={e => setRcnInput(e.target.value)}
              placeholder="Enter MT RCN..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '2px solid',
                borderColor: rcn > 0 ? '#6366F1' : 'var(--color-border)',
                background: 'var(--color-bg-secondary)', color: 'var(--color-text)',
                fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)',
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
            />
          </div>

          {rcn > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {UTILITIES.map(u => {
                const reg   = regs[u];
                const info  = EF[u];
                const val   = predicted[u];
                const emVal = predictedEm[u as Utility];
                const confidence = reg.r2 >= 0.85 ? '± 10%' : reg.r2 >= 0.65 ? '± 20%' : '± 35%+';
                return (
                  <div key={u} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 10, background: `${info.color}10`,
                    border: `1.5px solid ${info.color}30`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: info.color }}>{info.iconLabel} {info.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {fmtNum(emVal, 2)} tCO₂e · R²={reg.r2.toFixed(2)} {confidence}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: info.color }}>
                        {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(2)}M`
                         : val >= 1000 ? `${(val / 1000).toFixed(1)}K` : fmtNum(val, 0)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{info.unit}</div>
                    </div>
                  </div>
                );
              })}

              {/* Total emission */}
              <div style={{
                padding: '10px 14px', borderRadius: 10, background: '#6366F110',
                border: '2px solid #6366F130', marginTop: 4,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>📊 Total Scope 1+2 (predicted)</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#6366F1' }}>
                    {fmtNum(predictedEm.total(), 1)} tCO₂e
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Intensity: {rcn > 0 ? fmtNum(predictedEm.total() / rcn, 4) : '—'} tCO₂e/MT RCN
                </div>
              </div>
            </div>
          )}

          {!rcn && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              ↑ Enter RCN to see predicted utilities
            </div>
          )}
        </div>

        {/* SBTi Target panel */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
            🎯 SBTi Target Gap — {monthLabels[thisMonth - 1]} {thisYear}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Linear pathway: −{(reductionPct * 100).toFixed(1)}% vs baseline by {thisYear} · Target: −{SBTI_REDUCTION_BY_2032 * 100}% by {TARGET_YEAR}
          </div>

          {rcn > 0 ? (
            <>
              {/* Target vs predicted comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Predicted emission</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: gapPct > 0 ? '#EF4444' : '#22C55E' }}>
                    {fmtNum(predictedEm.total(), 1)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                </div>
                <div style={{ background: '#22C55E10', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1.5px solid #22C55E30' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>SBTi target</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#22C55E' }}>
                    {fmtNum(targetEm, 1)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>tCO₂e</div>
                </div>
              </div>

              {/* Gap indicator */}
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                background: gapPct > 0 ? '#EF444410' : '#22C55E10',
                border: `1.5px solid ${gapPct > 0 ? '#EF4444' : '#22C55E'}30`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {gapPct > 0 ? '⚠️ Over target by' : '✅ Under target by'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
                    color: gapPct > 0 ? '#EF4444' : '#22C55E' }}>
                    {Math.abs(gapPct).toFixed(1)}%
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  Gap: {fmtNum(Math.abs(gapEm), 1)} tCO₂e
                </div>
              </div>

              {/* Required reduction per utility */}
              {gapPct > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    To reach SBTi target — reduce all utilities by {requiredReduction.toFixed(1)}%:
                  </div>
                  {UTILITIES.map(u => {
                    const info = EF[u];
                    const current = predicted[u];
                    const needed  = current * (1 - requiredReduction / 100);
                    const save    = current - needed;
                    return (
                      <div key={u} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', marginBottom: 6, borderRadius: 8,
                        background: 'var(--color-bg-secondary)',
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: info.color }}>{info.iconLabel} {info.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                            Save: {save >= 1000 ? `${(save / 1000).toFixed(1)}K` : fmtNum(save, 0)} {info.unit}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                            {current >= 1000 ? `${(current / 1000).toFixed(1)}K` : fmtNum(current, 0)}
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#22C55E' }}>
                            {needed >= 1000 ? `${(needed / 1000).toFixed(1)}K` : fmtNum(needed, 0)}
                            <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 2 }}>{info.unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {gapPct <= 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: '#22C55E', fontSize: 13, fontWeight: 700 }}>
                  ✅ Already on track with SBTi target!
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              ← Enter RCN to calculate SBTi gap
            </div>
          )}
        </div>
      </div>

      {/* ── Data table footnote ── */}
      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Model trained on {fromYear}–{thisYear} monthly data from {factoryName} · Outliers removed at 2σ threshold ·
        Baseline intensity from all available months · SBTi: −50% Scope 1+2 by {TARGET_YEAR} vs {BASE_YEAR}
      </div>
    </div>
  );
}
