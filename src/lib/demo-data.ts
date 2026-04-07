// ── Demo Data for GHG Dashboard ──
// Realistic sample data for 4 factories (3 Vietnam + 1 India)

import {
  Factory, MonthlyData, FactorySummary, ScopeSummary,
  TargetProgress, SCOPE_COLORS, MONTHS_VI,
  SCOPE_1_CATEGORIES, SCOPE_3_CATEGORIES,
} from './types';

// ── Factories ──
export const DEMO_FACTORIES: Factory[] = [
  { id: '1', name: 'Nhà máy A', location: 'Bình Dương', country: 'Vietnam', code: 'FAC-A', created_at: '2021-01-01' },
  { id: '2', name: 'Nhà máy B', location: 'Long An', country: 'Vietnam', code: 'FAC-B', created_at: '2021-01-01' },
  { id: '3', name: 'Nhà máy C', location: 'Đồng Nai', country: 'Vietnam', code: 'FAC-C', created_at: '2021-01-01' },
  { id: '4', name: 'Nhà máy D', location: 'Maharashtra', country: 'India', code: 'FAC-D', created_at: '2021-01-01' },
];

// ── Helper: Random within range ──
function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// ── Generate Monthly Data for a Factory ──
function generateMonthly(
  baseS1: number, baseS2: number, baseS3: number,
  variance: number = 0.15
): MonthlyData[] {
  const seasonal = [0.92, 0.88, 0.95, 1.0, 1.08, 1.15, 1.18, 1.16, 1.1, 1.02, 0.94, 0.9];

  return Array.from({ length: 12 }, (_, i) => {
    const s = seasonal[i];
    const s1 = Math.round(baseS1 * s * rand(1 - variance, 1 + variance));
    const s2 = Math.round(baseS2 * s * rand(1 - variance, 1 + variance));
    const s3 = Math.round(baseS3 * s * rand(1 - variance, 1 + variance * 0.5));
    return {
      month: i + 1,
      label: MONTHS_VI[i],
      scope1: s1,
      scope2: s2,
      scope3: s3,
      total: s1 + s2 + s3,
    };
  });
}

// ── Factory Summaries with scope 1 breakdown ──
export const DEMO_FACTORY_SUMMARIES: FactorySummary[] = [
  {
    factory: DEMO_FACTORIES[0],
    totalEmissions: 0,
    scope1: 0, scope2: 0, scope3: 0,
    monthlyTrend: generateMonthly(420, 680, 1850),
  },
  {
    factory: DEMO_FACTORIES[1],
    totalEmissions: 0,
    scope1: 0, scope2: 0, scope3: 0,
    monthlyTrend: generateMonthly(380, 520, 1600),
  },
  {
    factory: DEMO_FACTORIES[2],
    totalEmissions: 0,
    scope1: 0, scope2: 0, scope3: 0,
    monthlyTrend: generateMonthly(510, 750, 2100),
  },
  {
    factory: DEMO_FACTORIES[3],
    totalEmissions: 0,
    scope1: 0, scope2: 0, scope3: 0,
    monthlyTrend: generateMonthly(290, 410, 1350),
  },
].map(fs => {
  const s1 = fs.monthlyTrend.reduce((sum, m) => sum + m.scope1, 0);
  const s2 = fs.monthlyTrend.reduce((sum, m) => sum + m.scope2, 0);
  const s3 = fs.monthlyTrend.reduce((sum, m) => sum + m.scope3, 0);
  return { ...fs, scope1: s1, scope2: s2, scope3: s3, totalEmissions: s1 + s2 + s3 };
});

// ── Scope Summaries ──
const totalS1 = DEMO_FACTORY_SUMMARIES.reduce((s, f) => s + f.scope1, 0);
const totalS2 = DEMO_FACTORY_SUMMARIES.reduce((s, f) => s + f.scope2, 0);
const totalS3 = DEMO_FACTORY_SUMMARIES.reduce((s, f) => s + f.scope3, 0);
const grandTotal = totalS1 + totalS2 + totalS3;

// Scope 1 category breakdown proportions (realistic for food factory with wood boiler)
const S1_BREAKDOWN = {
  wood_logs: 0.35,     // Wood logs for boiler — major source
  wastewater: 0.08,    // Wastewater treatment
  lpg: 0.15,           // LPG for forklifts
  diesel: 0.18,        // Diesel for generators & cars
  fgas_r134a: 0.07,    // Refrigerant R134A
  fgas_r410a: 0.06,    // Refrigerant R410A
  fgas_r404a: 0.08,    // Refrigerant R404A
  co2_cylinder: 0.03,  // CO2 cylinders
};

export const DEMO_SCOPE_SUMMARIES: ScopeSummary[] = [
  {
    scope: 'scope_1',
    totalEmissions: totalS1,
    previousYearEmissions: Math.round(totalS1 * 1.08),
    percentOfTotal: Math.round((totalS1 / grandTotal) * 100),
    changePercent: -7.4,
    categories: SCOPE_1_CATEGORIES.map(cat => ({
      category: cat.key,
      label: cat.label,
      emissions: Math.round(totalS1 * (S1_BREAKDOWN[cat.key as keyof typeof S1_BREAKDOWN] || 0)),
      percentOfScope: Math.round((S1_BREAKDOWN[cat.key as keyof typeof S1_BREAKDOWN] || 0) * 100),
      unit: cat.unit,
    })),
  },
  {
    scope: 'scope_2',
    totalEmissions: totalS2,
    previousYearEmissions: Math.round(totalS2 * 1.05),
    percentOfTotal: Math.round((totalS2 / grandTotal) * 100),
    changePercent: -4.8,
    categories: [
      { category: 'electricity', label: 'Điện lưới', emissions: totalS2, percentOfScope: 100, unit: 'kWh' },
    ],
  },
  {
    scope: 'scope_3',
    totalEmissions: totalS3,
    previousYearEmissions: Math.round(totalS3 * 1.03),
    percentOfTotal: Math.round((totalS3 / grandTotal) * 100),
    changePercent: -3.1,
    categories: [
      { category: 'purchased_goods', label: 'Cat.1 — Hàng hóa & Dịch vụ mua', emissions: Math.round(totalS3 * 0.55), percentOfScope: 55, unit: 'tấn' },
      { category: 'upstream_transport', label: 'Cat.4 — Vận tải ngược dòng', emissions: Math.round(totalS3 * 0.28), percentOfScope: 28, unit: 'tấn-km' },
      { category: 'fuel_energy_related', label: 'Cat.3 — Hoạt động năng lượng liên quan', emissions: Math.round(totalS3 * 0.17), percentOfScope: 17, unit: 'tCO₂e' },
    ],
  },
];

export const DEMO_GRAND_TOTAL = grandTotal;

// ── SBTi Target Progress ──
const baseYearS1S2 = Math.round((totalS1 + totalS2) * 1.25);
const baseYearS3 = Math.round(totalS3 * 1.12);

export const DEMO_TARGETS: TargetProgress[] = [
  {
    scope: 'Scope 1 + 2',
    label: 'Phát thải vận hành',
    baseYearEmissions: baseYearS1S2,
    currentEmissions: totalS1 + totalS2,
    targetEmissions: Math.round(baseYearS1S2 * 0.5),
    reductionTargetPct: 50,
    actualReductionPct: Math.round(((baseYearS1S2 - (totalS1 + totalS2)) / baseYearS1S2) * 100),
    onTrack: true,
    targetYear: 2032,
    baseYear: 2021,
  },
  {
    scope: 'Scope 3',
    label: 'Chuỗi giá trị',
    baseYearEmissions: baseYearS3,
    currentEmissions: totalS3,
    targetEmissions: Math.round(baseYearS3 * 0.7),
    reductionTargetPct: 30,
    actualReductionPct: Math.round(((baseYearS3 - totalS3) / baseYearS3) * 100),
    onTrack: true,
    targetYear: 2032,
    baseYear: 2021,
  },
];

// ── Aggregated Monthly Trend (all factories) ──
export const DEMO_MONTHLY_TOTALS: MonthlyData[] = Array.from({ length: 12 }, (_, i) => {
  const s1 = DEMO_FACTORY_SUMMARIES.reduce((sum, f) => sum + f.monthlyTrend[i].scope1, 0);
  const s2 = DEMO_FACTORY_SUMMARIES.reduce((sum, f) => sum + f.monthlyTrend[i].scope2, 0);
  const s3 = DEMO_FACTORY_SUMMARIES.reduce((sum, f) => sum + f.monthlyTrend[i].scope3, 0);
  return {
    month: i + 1,
    label: MONTHS_VI[i],
    scope1: s1,
    scope2: s2,
    scope3: s3,
    total: s1 + s2 + s3,
  };
});

// ── Scope 1 Monthly by Category (detailed) ──
export const DEMO_SCOPE1_MONTHLY = Array.from({ length: 12 }, (_, i) => {
  const total = DEMO_FACTORY_SUMMARIES.reduce((sum, f) => sum + f.monthlyTrend[i].scope1, 0);
  return {
    month: i + 1,
    label: MONTHS_VI[i],
    categories: Object.entries(S1_BREAKDOWN).map(([key, pct]) => ({
      key,
      value: Math.round(total * pct * rand(0.9, 1.1)),
    })),
    total,
  };
});

// ── Chart Helpers ──
export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

export function formatTCO2e(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}
