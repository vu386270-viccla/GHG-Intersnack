// ── Data Service: Fetch real data from Supabase ──
import { supabase } from './supabase';
import {
  Factory, MonthlyData, FactorySummary, ScopeSummary,
  TargetProgress, SCOPE_COLORS, MONTHS_VI,
  SCOPE_1_CATEGORIES, SCOPE_3_CATEGORIES,
} from './types';

// ── Chart Helpers ──
export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

export function formatTCO2e(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

// ── Types for raw Supabase data ──
interface RawEmission {
  factory_id: string;
  year: number;
  month: number;
  scope: string;
  category: string;
  activity_data: number;
  emissions_tco2e: number;
  cost_usd?: number;
}

// ── In-memory cache ──
let _cache: {
  factories: Factory[];
  emissions: RawEmission[];
  year: number;
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateCache() {
  _cache = null;
}

async function fetchData(year: number) {
  if (_cache && _cache.year === year && Date.now() - _cache.timestamp < CACHE_TTL) {
    return _cache;
  }

  const [factoriesRes, emissionsRes] = await Promise.all([
    supabase.from('factories').select('*'),
    supabase.from('emissions_data').select('factory_id,year,month,scope,category,activity_data,emissions_tco2e,cost_usd')
      .eq('year', year)
      .limit(5000),  // Supabase default cap is 1000; 4 plants × 12 months × ~25 categories = ~1200/yr
  ]);

  const factories = (factoriesRes.data || []) as Factory[];
  const emissions = (emissionsRes.data || []) as RawEmission[];

  _cache = { factories, emissions, year, timestamp: Date.now() };
  return _cache;
}

// ── Get previous year data for comparison ──
async function fetchPrevYear(year: number) {
  const { data } = await supabase
    .from('emissions_data')
    .select('scope,emissions_tco2e')
    .eq('year', year - 1)
    .limit(5000);
  return (data || []) as { scope: string; emissions_tco2e: number }[];
}

// ── Main data function ──
export async function getDashboardData(year: number = new Date().getFullYear()) {
  const { factories, emissions } = await fetchData(year);
  const [prevYearData, prodRes] = await Promise.all([
    fetchPrevYear(year),
    supabase
      .from('production_data')
      .select('factory_id,year,month,category,quantity')
      .eq('year', year),
  ]);
  const prodRows = (prodRes.data || []) as { factory_id: string; year: number; month: number; category: string; quantity: number }[];

  // Group emissions by scope
  const byScope: Record<string, number> = {};
  const byScopeCost: Record<string, number> = {};
  const byScopeCategory: Record<string, Record<string, number>> = {};
  const byScopeCategoryCost: Record<string, Record<string, number>> = {};
  
  for (const e of emissions) {
    byScope[e.scope] = (byScope[e.scope] || 0) + Number(e.emissions_tco2e);
    byScopeCost[e.scope] = (byScopeCost[e.scope] || 0) + Number(e.cost_usd || 0);
    
    if (!byScopeCategory[e.scope]) byScopeCategory[e.scope] = {};
    byScopeCategory[e.scope][e.category] = (byScopeCategory[e.scope][e.category] || 0) + Number(e.emissions_tco2e);
    
    if (!byScopeCategoryCost[e.scope]) byScopeCategoryCost[e.scope] = {};
    byScopeCategoryCost[e.scope][e.category] = (byScopeCategoryCost[e.scope][e.category] || 0) + Number(e.cost_usd || 0);
  }

  const totalS1 = byScope['scope_1'] || 0;
  const totalS2 = byScope['scope_2'] || 0;
  let   totalS3 = byScope['scope_3'] || 0; // will be replaced by scope3_transport_data below
  const totalS1Cost = byScopeCost['scope_1'] || 0;
  const totalS2Cost = byScopeCost['scope_2'] || 0;

  // ── Pull real Scope 3 from scope3_transport_data ──────────────────────────
  // emissions_data has virtually no scope_3 rows — actual Cat.1 + Cat.4 data
  // lives in scope3_transport_data; Cat.3 (WTT) is derived from fuel activity.
  const WTT_FAC = {
    diesel_VN: 0.00055, diesel_IN: 0.0008058,
    lpg: 0.392,
    elec_VN: 0.00006, elec_IN: 0.00012,
  };
  const facCtry: Record<string, string> = Object.fromEntries(
    factories.map(f => [f.id, (f as any).country || ''])
  );
  const sumS3Trans = (rows: any[] | null) => {
    let cat1 = 0, cat4 = 0;
    for (const r of rows || []) {
      cat1 += (Number(r.em_cashew_kg) || 0) / 1000;
      cat4 += ((Number(r.km_ton_vessel) || 0) * 0.01604
             + (Number(r.km_ton_road)   || 0) * 0.07547) / 1000;
    }
    return { cat1, cat4 };
  };

  const [s3TransRes, s3Trans2021Res] = await Promise.all([
    supabase.from('scope3_transport_data')
      .select('em_cashew_kg,km_ton_vessel,km_ton_road').eq('year', year),
    year !== 2021
      ? supabase.from('scope3_transport_data')
          .select('em_cashew_kg,km_ton_vessel,km_ton_road').eq('year', 2021)
      : Promise.resolve({ data: null as any }),
  ]);

  let s3Cat3Wtt = 0;
  for (const e of emissions) {
    const isIndia = facCtry[e.factory_id] === 'India';
    const act = Number(e.activity_data) || 0;
    if      (e.category === 'diesel')      s3Cat3Wtt += act * (isIndia ? WTT_FAC.diesel_IN : WTT_FAC.diesel_VN);
    else if (e.category === 'lpg')         s3Cat3Wtt += act * WTT_FAC.lpg;
    else if (e.category === 'electricity') s3Cat3Wtt += act * (isIndia ? WTT_FAC.elec_IN   : WTT_FAC.elec_VN);
  }

  const s3Cur  = sumS3Trans(s3TransRes.data);
  const s3Real = s3Cur.cat1 + s3Cur.cat4 + s3Cat3Wtt;
  if (s3Real > totalS3) totalS3 = s3Real; // prefer transport data over sparse emissions_data entries

  const s3Base2021Trans = sumS3Trans(s3Trans2021Res.data);

  const grandTotal = totalS1 + totalS2 + totalS3;

  // Previous year totals
  const prevByScope: Record<string, number> = {};
  for (const e of prevYearData) {
    prevByScope[e.scope] = (prevByScope[e.scope] || 0) + Number(e.emissions_tco2e);
  }

  // ── Factory Summaries ──
  const factorySummaries: FactorySummary[] = factories.map(factory => {
    const fEmissions = emissions.filter(e => e.factory_id === factory.id);
    
    const monthlyTrend: MonthlyData[] = Array.from({ length: 12 }, (_, i) => {
      const monthData = fEmissions.filter(e => e.month === i + 1);
      const s1 = monthData.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
      const s2 = monthData.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
      const s3 = monthData.filter(e => e.scope === 'scope_3').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
      const c1 = monthData.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.cost_usd || 0), 0);
      const c2 = monthData.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.cost_usd || 0), 0);
      return { 
        month: i + 1, label: MONTHS_VI[i], 
        scope1: Math.round(s1), scope2: Math.round(s2), scope3: Math.round(s3), total: Math.round(s1 + s2 + s3),
        costScope1: Math.round(c1), costScope2: Math.round(c2)
      };
    });

    const scope1 = fEmissions.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
    const scope2 = fEmissions.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
    const scope3 = fEmissions.filter(e => e.scope === 'scope_3').reduce((s, e) => s + Number(e.emissions_tco2e), 0);
    const scope1Cost = fEmissions.filter(e => e.scope === 'scope_1').reduce((s, e) => s + Number(e.cost_usd || 0), 0);
    const scope2Cost = fEmissions.filter(e => e.scope === 'scope_2').reduce((s, e) => s + Number(e.cost_usd || 0), 0);

    return {
      factory,
      totalEmissions: Math.round(scope1 + scope2 + scope3),
      totalCost: Math.round(scope1Cost + scope2Cost),
      scope1: Math.round(scope1),
      scope2: Math.round(scope2),
      scope3: Math.round(scope3),
      scope1Cost: Math.round(scope1Cost),
      scope2Cost: Math.round(scope2Cost),
      monthlyTrend,
    };
  }).sort((a, b) => b.totalEmissions - a.totalEmissions);

  // ── Scope Summaries ──
  const calcChange = (scope: string, current: number): number => {
    const prev = prevByScope[scope] || 0;
    if (prev === 0) return 0;
    return Math.round(((current - prev) / prev) * 1000) / 10;
  };

  const scopeSummaries: ScopeSummary[] = [
    {
      scope: 'scope_1' as const,
      totalEmissions: Math.round(totalS1),
      totalCost: Math.round(totalS1Cost),
      previousYearEmissions: Math.round(prevByScope['scope_1'] || 0),
      percentOfTotal: grandTotal > 0 ? Math.round((totalS1 / grandTotal) * 100) : 0,
      changePercent: calcChange('scope_1', totalS1),
      categories: SCOPE_1_CATEGORIES.map(cat => {
        const catEmissions = byScopeCategory['scope_1']?.[cat.key] || 0;
        const catCost = byScopeCategoryCost['scope_1']?.[cat.key] || 0;
        return {
          category: cat.key,
          label: cat.label,
          emissions: Math.round(catEmissions),
          cost: Math.round(catCost),
          percentOfScope: totalS1 > 0 ? Math.round((catEmissions / totalS1) * 100) : 0,
          unit: cat.unit,
        };
      }).filter(c => c.emissions > 0),
    },
    {
      scope: 'scope_2' as const,
      totalEmissions: Math.round(totalS2),
      totalCost: Math.round(totalS2Cost),
      previousYearEmissions: Math.round(prevByScope['scope_2'] || 0),
      percentOfTotal: grandTotal > 0 ? Math.round((totalS2 / grandTotal) * 100) : 0,
      changePercent: calcChange('scope_2', totalS2),
      categories: [
        { category: 'electricity', label: 'Điện lưới', emissions: Math.round(totalS2), cost: Math.round(totalS2Cost), percentOfScope: 100, unit: 'kWh' },
      ],
    },
    {
      scope: 'scope_3' as const,
      totalEmissions: Math.round(totalS3),
      previousYearEmissions: Math.round(prevByScope['scope_3'] || 0),
      percentOfTotal: grandTotal > 0 ? Math.round((totalS3 / grandTotal) * 100) : 0,
      changePercent: calcChange('scope_3', totalS3),
      categories: [
        {
          category: 'purchased_goods',
          label: 'Cat.1 — Hàng hóa mua (Cashew)',
          emissions: Math.round(s3Cur.cat1),
          percentOfScope: totalS3 > 0 ? Math.round(s3Cur.cat1 / totalS3 * 100) : 0,
          unit: 'tCO₂e',
        },
        {
          category: 'fuel_energy_related',
          label: 'Cat.3 — WTT (Năng lượng thượng nguồn)',
          emissions: Math.round(s3Cat3Wtt),
          percentOfScope: totalS3 > 0 ? Math.round(s3Cat3Wtt / totalS3 * 100) : 0,
          unit: 'tCO₂e',
        },
        {
          category: 'upstream_transport',
          label: 'Cat.4 — Vận tải thượng nguồn',
          emissions: Math.round(s3Cur.cat4),
          percentOfScope: totalS3 > 0 ? Math.round(s3Cur.cat4 / totalS3 * 100) : 0,
          unit: 'tCO₂e',
        },
      ].filter(c => c.emissions > 0),
    },
  ];

  // ── Monthly Totals ──
  const monthlyTotals: MonthlyData[] = Array.from({ length: 12 }, (_, i) => {
    const s1 = factorySummaries.reduce((sum, f) => sum + f.monthlyTrend[i].scope1, 0);
    const s2 = factorySummaries.reduce((sum, f) => sum + f.monthlyTrend[i].scope2, 0);
    const s3 = factorySummaries.reduce((sum, f) => sum + f.monthlyTrend[i].scope3, 0);
    return { month: i + 1, label: MONTHS_VI[i], scope1: s1, scope2: s2, scope3: s3, total: s1 + s2 + s3 };
  });

  // ── Scope 1 Monthly by Category ──
  const scope1Monthly = Array.from({ length: 12 }, (_, i) => {
    const monthEmissions = emissions.filter(e => e.scope === 'scope_1' && e.month === i + 1);
    const catMap: Record<string, { em: number, cost: number }> = {};
    for (const e of monthEmissions) {
      if (!catMap[e.category]) catMap[e.category] = { em: 0, cost: 0 };
      catMap[e.category].em += Number(e.emissions_tco2e);
      catMap[e.category].cost += Number(e.cost_usd || 0);
    }
    const total = Object.values(catMap).reduce((s, v) => s + v.em, 0);
    const totalCost = Object.values(catMap).reduce((s, v) => s + v.cost, 0);
    return {
      month: i + 1,
      label: MONTHS_VI[i],
      categories: Object.entries(catMap).map(([key, value]) => ({ key, value: Math.round(value.em), cost: Math.round(value.cost) })),
      total: Math.round(total),
      totalCost: Math.round(totalCost),
    };
  });

  // ── Scope 2 Monthly by Category ──
  const scope2Monthly = Array.from({ length: 12 }, (_, i) => {
    const monthEmissions = emissions.filter(e => e.scope === 'scope_2' && e.month === i + 1);
    const catMap: Record<string, { em: number, cost: number }> = {};
    for (const e of monthEmissions) {
      if (!catMap[e.category]) catMap[e.category] = { em: 0, cost: 0 };
      catMap[e.category].em += Number(e.emissions_tco2e);
      catMap[e.category].cost += Number(e.cost_usd || 0);
    }
    const total = Object.values(catMap).reduce((s, v) => s + v.em, 0);
    const totalCost = Object.values(catMap).reduce((s, v) => s + v.cost, 0);
    return {
      month: i + 1,
      label: MONTHS_VI[i],
      categories: Object.entries(catMap).map(([key, value]) => ({ key, value: Math.round(value.em), cost: Math.round(value.cost) })),
      total: Math.round(total),
      totalCost: Math.round(totalCost),
    };
  });

  // ── Monthly RCN totals (all factories) for intensity calc ──
  const monthlyRCN = Array.from({ length: 12 }, (_, i) =>
    prodRows.filter(p => p.category === 'rcn_input' && p.month === i + 1)
            .reduce((s, p) => s + Number(p.quantity), 0)
  );

  // ── SBTi Targets ──
  // Use 2021 as base year — fetch 2021 emissions
  let baseS1S2 = 0;
  let baseS3 = 0;
  
  if (year !== 2021) {
    const { data: base2021 } = await supabase
      .from('emissions_data')
      .select('scope,emissions_tco2e')
      .eq('year', 2021)
      .limit(5000);
    
    if (base2021) {
      for (const e of base2021) {
        const val = Number(e.emissions_tco2e);
        if (e.scope === 'scope_1' || e.scope === 'scope_2') baseS1S2 += val;
        if (e.scope === 'scope_3') baseS3 += val;
      }
    }
  } else {
    baseS1S2 = totalS1 + totalS2;
    baseS3 = totalS3;
  }

  // Override Scope 3 baseline with transport data if available (much more accurate)
  const s3Base2021FromTrans = s3Base2021Trans.cat1 + s3Base2021Trans.cat4;
  if (s3Base2021FromTrans > baseS3) baseS3 = s3Base2021FromTrans;

  // If no base year data at all, use estimated multiplier
  let baselineEstimated = false;
  if (baseS1S2 === 0) { baseS1S2 = (totalS1 + totalS2) * 1.25; baselineEstimated = true; }
  if (baseS3 === 0) baseS3 = totalS3 * 1.12;

  // SBTi: −50% Scope 1+2 và −30% Scope 3 by 2032 vs baseline 2021
  const BASE_YEAR = 2021;
  const TARGET_YEAR = 2032;
  const yearsElapsed = Math.max(0, year - BASE_YEAR);
  const totalYears = TARGET_YEAR - BASE_YEAR; // 11

  // Linear on-track threshold: expected reduction at current year
  const s12LinearThreshold = baseS1S2 * (1 - 0.50 * (yearsElapsed / totalYears));
  const s3LinearThreshold  = baseS3  * (1 - 0.30 * (yearsElapsed / totalYears));

  const currentS12 = totalS1 + totalS2;
  const targets: TargetProgress[] = [
    {
      scope: 'Scope 1 + 2',
      label: 'Phát thải vận hành',
      baseYearEmissions: Math.round(baseS1S2),
      currentEmissions: Math.round(currentS12),
      targetEmissions: Math.round(baseS1S2 * 0.50), // −50% by 2032
      reductionTargetPct: 50,
      actualReductionPct: baseS1S2 > 0 ? Math.round(((baseS1S2 - currentS12) / baseS1S2) * 100) : 0,
      onTrack: currentS12 <= s12LinearThreshold,
      targetYear: 2032,
      baseYear: 2021,
    },
    {
      scope: 'Scope 3',
      label: 'Chuỗi giá trị',
      baseYearEmissions: Math.round(baseS3),
      currentEmissions: Math.round(totalS3),
      targetEmissions: Math.round(baseS3 * 0.70), // −30% by 2032
      reductionTargetPct: 30,
      actualReductionPct: baseS3 > 0 ? Math.round(((baseS3 - totalS3) / baseS3) * 100) : 0,
      onTrack: totalS3 <= s3LinearThreshold,
      targetYear: 2032,
      baseYear: 2021,
    },
  ];

  // ── RCN / CK Production Intensity ──
  const totalRCN = prodRows.filter(p => p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
  const totalCK  = prodRows.filter(p => p.category === 'ck_output').reduce((s, p) => s + Number(p.quantity), 0);
  const monthlyIntensity = Array.from({ length: 12 }, (_, i) => {
    const mRCN = prodRows
      .filter(p => p.category === 'rcn_input' && p.month === i + 1)
      .reduce((s, p) => s + Number(p.quantity), 0);
    const mTotal = monthlyTotals[i].total;
    return mRCN > 0 ? Math.round((mTotal / mRCN) * 1000) / 1000 : 0;
  });
  const rcnData = {
    totalRCN: Math.round(totalRCN),
    totalCK: Math.round(totalCK),
    intensity: totalRCN > 0 ? Math.round((grandTotal / totalRCN) * 1000) / 1000 : 0,
    monthlyIntensity,
  };

  // ── Completeness: per factory × month, any data at all ──
  const completeness: Record<string, boolean[]> = {};
  for (const factory of factories) {
    completeness[factory.id] = Array.from({ length: 12 }, (_, i) =>
      emissions.some(e => e.factory_id === factory.id && e.month === i + 1)
    );
  }

  // ── kWh per factory (Scope 2 cost analysis) ──
  const kwhByFactory: Record<string, number> = {};
  for (const factory of factories) {
    kwhByFactory[factory.id] = emissions
      .filter(e => e.factory_id === factory.id && e.scope === 'scope_2' && e.category === 'electricity')
      .reduce((s, e) => s + Number(e.activity_data), 0);
  }
  const totalKwh = Object.values(kwhByFactory).reduce((s, v) => s + v, 0);

  // ── Last updated timestamp ──
  const { data: lastUpdatedRes } = await supabase
    .from('emissions_data')
    .select('created_at')
    .eq('year', year)
    .order('created_at', { ascending: false })
    .limit(1);
  const lastUpdated: string | null = (lastUpdatedRes?.[0] as any)?.created_at ?? null;

  // ── Per-factory RCN breakdown ──
  const rcnByFactory: Record<string, { totalRCN: number; totalCK: number; monthlyRCN: number[] }> = {};
  for (const factory of factories) {
    const fProd = prodRows.filter(p => p.factory_id === factory.id);
    const fRCN = fProd.filter(p => p.category === 'rcn_input').reduce((s, p) => s + Number(p.quantity), 0);
    const fCK  = fProd.filter(p => p.category === 'ck_output').reduce((s, p) => s + Number(p.quantity), 0);
    rcnByFactory[factory.id] = {
      totalRCN: Math.round(fRCN),
      totalCK: Math.round(fCK),
      monthlyRCN: Array.from({ length: 12 }, (_, i) =>
        fProd.filter(p => p.category === 'rcn_input' && p.month === i + 1)
             .reduce((s, p) => s + Number(p.quantity), 0)
      ),
    };
  }

  return {
    factories,
    factorySummaries,
    scopeSummaries,
    grandTotal: Math.round(grandTotal),
    monthlyTotals,
    scope1Monthly,
    scope2Monthly,
    monthlyRCN,
    targets,
    rcnData,
    rcnByFactory,
    year,
    baselineEstimated,
    completeness,
    kwhByFactory,
    totalKwh,
    lastUpdated,
  };
}

// ── Annual totals by scope — used by Targets page chart ──
export async function getAnnualTotals(fromYear: number, toYear: number): Promise<Record<number, { s12: number; s3: number }>> {
  // Fetch S1+S2 from emissions_data, S3 from scope3_transport_data
  const [opsRes, s3Res] = await Promise.all([
    supabase.from('emissions_data')
      .select('year,scope,emissions_tco2e')
      .gte('year', fromYear).lte('year', toYear).limit(10000),
    supabase.from('scope3_transport_data')
      .select('year,em_cashew_kg,km_ton_vessel,km_ton_road')
      .gte('year', fromYear).lte('year', toYear),
  ]);

  const result: Record<number, { s12: number; s3: number }> = {};

  for (const e of opsRes.data || []) {
    if (!result[e.year]) result[e.year] = { s12: 0, s3: 0 };
    const val = Number(e.emissions_tco2e);
    if (e.scope === 'scope_1' || e.scope === 'scope_2') result[e.year].s12 += val;
  }

  // Aggregate Scope 3 from transport table (Cat.1 + Cat.4)
  const s3ByYear: Record<number, number> = {};
  for (const r of s3Res.data || []) {
    const cat1 = (Number(r.em_cashew_kg) || 0) / 1000;
    const cat4 = ((Number(r.km_ton_vessel) || 0) * 0.01604 + (Number(r.km_ton_road) || 0) * 0.07547) / 1000;
    s3ByYear[r.year] = (s3ByYear[r.year] || 0) + cat1 + cat4;
  }
  for (const [yr, val] of Object.entries(s3ByYear)) {
    const y = Number(yr);
    if (!result[y]) result[y] = { s12: 0, s3: 0 };
    result[y].s3 = val;
  }

  return result;
}

// ── Re-export static constants that pages use ──
export { SCOPE_1_CATEGORIES, SCOPE_3_CATEGORIES, SCOPE_COLORS, MONTHS_VI } from './types';

// ── Scope 3 Summary (Cat.1 + Cat.3 WTT + Cat.4) — annual, all years ──

export interface Scope3YearRow {
  year: number;
  cat1_cashew: number;   // FLAG — purchased goods (tCO2e)
  cat3_wtt: number;      // non-FLAG — fuel & energy upstream (tCO2e)
  cat4_vessel: number;   // non-FLAG — upstream ocean transport (tCO2e)
  cat4_road: number;     // non-FLAG — upstream road transport (tCO2e)
  totalFlag: number;     // Cat.1
  totalNonFlag: number;  // Cat.3 + Cat.4
  total: number;
}

// WTT emission factors (kg CO2e per activity unit)
const WTT = {
  diesel_VN:   0.00055,   // tCO2e/L
  diesel_IN:   0.0008058, // tCO2e/L
  lpg:         0.392,     // tCO2e/ton (0.2 kgCO2e/L × 1960 L/ton)
  elec_VN:     0.00006,   // tCO2e/kWh
  elec_IN:     0.00012,   // tCO2e/kWh
};

export async function getScope3SummaryData(): Promise<{
  rows: Scope3YearRow[];
  baseline2021: Scope3YearRow | undefined;
}> {
  const START_YEAR = 2018;
  const END_YEAR   = new Date().getFullYear() + 1; // include next year if data exists
  const YEARS: number[] = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) YEARS.push(y);

  // 1. Fetch Cat.1 + Cat.4 from scope3_transport_data (annual, VN+India combined)
  const { data: s3raw } = await supabase
    .from('scope3_transport_data')
    .select('year,shipped_qty_mts,km_ton_vessel,km_ton_road,em_cashew_kg')
    .in('year', YEARS);

  // 2. Fetch fuel activity data for WTT (Cat.3) — all years, all factories
  const { data: factories } = await supabase.from('factories').select('id,country');
  const factoryCountry: Record<string, string> = {};
  for (const f of factories || []) factoryCountry[f.id] = f.country;

  const { data: fuelRows } = await supabase
    .from('emissions_data')
    .select('factory_id,year,category,activity_data')
    .in('year', YEARS)
    .in('category', ['diesel', 'lpg', 'electricity'])
    .limit(10000);

  // Aggregate Cat.1 + Cat.4 per year
  const byYear: Record<number, { cashew: number; vessel: number; road: number }> = {};
  for (const yr of YEARS) byYear[yr] = { cashew: 0, vessel: 0, road: 0 };
  for (const r of s3raw || []) {
    byYear[r.year].cashew += (Number(r.em_cashew_kg) || 0) / 1000; // kg → tCO2e
    byYear[r.year].vessel += (Number(r.km_ton_vessel) || 0) * 0.01604 / 1000; // kg → t
    byYear[r.year].road   += (Number(r.km_ton_road)   || 0) * 0.07547 / 1000;
  }

  // Aggregate WTT (Cat.3) per year
  const wttByYear: Record<number, number> = {};
  for (const yr of YEARS) wttByYear[yr] = 0;
  for (const r of fuelRows || []) {
    const yr = r.year;
    const isIndia = factoryCountry[r.factory_id] === 'India';
    const act = Number(r.activity_data) || 0;
    let wtt = 0;
    if (r.category === 'diesel')      wtt = act * (isIndia ? WTT.diesel_IN : WTT.diesel_VN);
    else if (r.category === 'lpg')    wtt = act * WTT.lpg;
    else if (r.category === 'electricity') wtt = act * (isIndia ? WTT.elec_IN : WTT.elec_VN);
    wttByYear[yr] = (wttByYear[yr] || 0) + wtt;
  }

  const rows: Scope3YearRow[] = YEARS.map(yr => {
    const d = byYear[yr];
    const cat1  = Math.round(d.cashew);
    const cat3  = Math.round(wttByYear[yr] || 0);
    const cat4v = Math.round(d.vessel);
    const cat4r = Math.round(d.road);
    return {
      year: yr,
      cat1_cashew: cat1,
      cat3_wtt: cat3,
      cat4_vessel: cat4v,
      cat4_road: cat4r,
      totalFlag: cat1,
      totalNonFlag: cat3 + cat4v + cat4r,
      total: cat1 + cat3 + cat4v + cat4r,
    };
  }).filter(r => r.total > 0);

  return { rows, baseline2021: rows.find(r => r.year === 2021) };
}
