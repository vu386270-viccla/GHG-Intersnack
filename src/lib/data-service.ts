// ── Data Service: Fetch real data from Supabase ──
import { supabase } from './supabase';
import {
  Factory, MonthlyData, FactorySummary, ScopeSummary,
  TargetProgress, SCOPE_COLORS, MONTHS_VI,
  SCOPE_1_CATEGORIES, SCOPE_3_CATEGORIES,
} from './types';
import { getS3StaticCat1and4, ORIGIN_EF, ORIGIN_MIX } from './scope3-data';

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

interface RawProduction {
  factory_id: string;
  year: number;
  month: number;
  category: string;
  quantity: number;
}

// ── In-memory cache ──
let _cache: {
  factories: Factory[];
  emissions: RawEmission[];
  year: number;
  timestamp: number;
} | null = null;

const CACHE_TTL = 0; // Disabled cache to prevent syncing mismatches with Opex Report

export function invalidateCache() {
  _cache = null;
}

async function fetchData(year: number) {
  if (_cache && _cache.year === year && Date.now() - _cache.timestamp < CACHE_TTL) {
    return _cache;
  }

  const [factoriesRes] = await Promise.all([
    supabase.from('factories').select('*'),
  ]);

  if (factoriesRes.error) {
    throw new Error(`[DB] factories: ${factoriesRes.error.message}`);
  }

  let allEmissions: RawEmission[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e,cost_usd')
      .eq('year', year)
      .range(offset, offset + PAGE - 1);

    if (error) {
       throw new Error(`[DB] emissions_data (${year}): ${error.message}`);
    }
    if (!data || data.length === 0) break;
    
    allEmissions = allEmissions.concat(data as RawEmission[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  const factories = (factoriesRes.data ?? []) as Factory[];
  _cache = { factories, emissions: allEmissions, year, timestamp: Date.now() };
  return _cache;
}

async function fetchPrevYear(year: number) {
  let allData: { scope: string; emissions_tco2e: number; factory_id: string }[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('scope,emissions_tco2e,factory_id')
      .eq('year', year - 1)
      .range(offset, offset + PAGE - 1);
    
    if (error) {
      console.warn(`[DB] emissions_data prev year (${year - 1}):`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data as { scope: string; emissions_tco2e: number; factory_id: string }[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return allData;
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

  // ── Pull real Scope 3 (Cat 1 & 4) from scope3-data logic ──────────────────────────
  const WTT_FAC = {
    diesel_VN: 0.00055, diesel_IN: 0.0006058,
    lpg: 0.2, // Both VN & IN
    elec_VN: 0.00008, elec_IN: 0.00012,
    wood_VN: 0.05214, wood_IN: 0.24,
  };
  const facCtry: Record<string, string> = Object.fromEntries(
    factories.map(f => [f.id, (f as any).country || ''])
  );
  
  let s3Cat3Wtt = 0;
  for (const e of emissions) {
    const isIndia = facCtry[e.factory_id] === 'India';
    const act = Number(e.activity_data) || 0;
    if      (e.category === 'diesel')      s3Cat3Wtt += act * (isIndia ? WTT_FAC.diesel_IN : WTT_FAC.diesel_VN);
    else if (e.category === 'lpg')         s3Cat3Wtt += act * WTT_FAC.lpg;
    else if (e.category === 'electricity') s3Cat3Wtt += act * (isIndia ? WTT_FAC.elec_IN   : WTT_FAC.elec_VN);
    else if (e.category === 'wood_logs')   s3Cat3Wtt += act * (isIndia ? WTT_FAC.wood_IN   : WTT_FAC.wood_VN);
  }

  const s3Cur = getS3StaticCat1and4(year);
  const s3Real = s3Cur.cat1 + s3Cur.cat4 + s3Cat3Wtt;
  if (s3Real > totalS3) totalS3 = s3Real;

  const s3Base2021Trans = getS3StaticCat1and4(2021);

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

// ── Annual breakdown per scope (S1 / S2 separately) — used by multi-year tabs ──
export interface AnnualScopeRow {
  year: number;
  s1: number;
  s2: number;
  s3: number;
}

export async function getAnnualScopeBreakdown(
  fromYear = 2018,
  toYear = new Date().getFullYear(),
): Promise<AnnualScopeRow[]> {
  // Fetch each year independently (same strategy as getDashboardData)
  // to guarantee totals match the KPI cards — avoids pagination truncation
  // when all years combined exceed the row limit.
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);

  const yearResults = await Promise.all(
    years.map(async (yr) => {
      let s1 = 0;
      let s2 = 0;
      let offset = 0;
      const PAGE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('emissions_data')
          .select('scope,emissions_tco2e')
          .eq('year', yr)
          .in('scope', ['scope_1', 'scope_2'])
          .range(offset, offset + PAGE - 1);

        if (error || !data || data.length === 0) break;

        for (const e of data) {
          const v = Number(e.emissions_tco2e);
          if (e.scope === 'scope_1') s1 += v;
          else if (e.scope === 'scope_2') s2 += v;
        }

        if (data.length < PAGE) break;
        offset += PAGE;
      }

      return { year: yr, s1: Math.round(s1), s2: Math.round(s2), s3: 0 };
    })
  );

  // Only include years that actually have data
  return yearResults.filter(r => r.s1 > 0 || r.s2 > 0);
}

// ── Annual totals by scope — used by Targets page chart ──
export async function getAnnualTotals(fromYear: number, toYear: number): Promise<Record<number, { s1: number; s2: number; s3: number }>> {
  const years: number[] = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);

  // Fetch factories once for WTT country lookup
  const { data: factoriesData } = await supabase.from('factories').select('id,country');
  const factoryCountry: Record<string, string> = {};
  for (const f of factoriesData || []) factoryCountry[f.id] = f.country;

  // Fetch each year's S1+S2 and fuel rows in parallel — avoids cross-year limit truncation
  const yearResults = await Promise.all(
    years.map(async (yr) => {
      const PAGE = 1000;
      let s1 = 0, s2 = 0;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('emissions_data')
          .select('scope,emissions_tco2e')
          .eq('year', yr)
          .in('scope', ['scope_1', 'scope_2'])
          .range(offset, offset + PAGE - 1);
        if (error || !data || data.length === 0) break;
        for (const e of data) {
          const v = Number(e.emissions_tco2e);
          if (e.scope === 'scope_1') s1 += v;
          else if (e.scope === 'scope_2') s2 += v;
        }
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      // WTT (Cat.3) from fuel activity data for this year
      let wtt = 0;
      const { data: fuelData } = await supabase
        .from('emissions_data')
        .select('factory_id,category,activity_data')
        .eq('year', yr)
        .in('category', ['diesel', 'lpg', 'electricity', 'wood_logs'])
        .limit(5000);
      for (const r of fuelData || []) {
        const isIndia = factoryCountry[r.factory_id] === 'India';
        const act = Number(r.activity_data) || 0;
        if (r.category === 'diesel')           wtt += act * (isIndia ? WTT.diesel_IN : WTT.diesel_VN);
        else if (r.category === 'lpg')         wtt += act * WTT.lpg;
        else if (r.category === 'electricity') wtt += act * (isIndia ? WTT.elec_IN : WTT.elec_VN);
        else if (r.category === 'wood_logs')   wtt += act * (isIndia ? WTT.wood_IN : WTT.wood_VN);
      }

      // S3: static Cat.1 + Cat.4 + dynamic WTT (Cat.3)
      const s3Static = getS3StaticCat1and4(yr);
      const s3 = s3Static.cat1 + s3Static.cat4 + wtt;

      return { yr, s1, s2, s3 };
    })
  );

  const result: Record<number, { s1: number; s2: number; s3: number }> = {};
  for (const { yr, s1, s2, s3 } of yearResults) {
    result[yr] = { s1, s2, s3 };
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
  isEstimated?: boolean; // true when Cat.1/Cat.4 come from a fallback year
  resolvedYear?: number | null; // the actual year used for Cat.1/Cat.4 static data (null = no data)
}

// WTT emission factors (kg CO2e per activity unit, effectively tCO2e/unit)
const WTT = {
  diesel_VN:   0.00055,   // tCO2e/L
  diesel_IN:   0.0006058, // tCO2e/L
  lpg:         0.2,       // tCO2e/ton 
  elec_VN:     0.00008,   // tCO2e/kWh
  elec_IN:     0.00012,   // tCO2e/kWh
  wood_VN:     0.05214,   // tCO2e/ton
  wood_IN:     0.24,      // tCO2e/ton
};

export async function getScope3SummaryData(): Promise<{
  rows: Scope3YearRow[];
  baseline2021: Scope3YearRow | undefined;
}> {
  const START_YEAR = 2018;
  const END_YEAR   = new Date().getFullYear(); // current year only — next year has no real data yet
  const YEARS: number[] = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) YEARS.push(y);

  // 1. Fetch fuel activity data for WTT (Cat.3) — all years, all factories
  const { data: factories } = await supabase.from('factories').select('id,country');
  const factoryCountry: Record<string, string> = {};
  for (const f of factories || []) factoryCountry[f.id] = f.country;

  let fuelRows: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,category,activity_data')
      .in('year', YEARS)
      .in('category', ['diesel', 'lpg', 'electricity', 'wood_logs'])
      .range(offset, offset + PAGE - 1);
      
    if (error || !data || data.length === 0) break;
    fuelRows = fuelRows.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
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
    else if (r.category === 'wood_logs')   wtt = act * (isIndia ? WTT.wood_IN : WTT.wood_VN);
    wttByYear[yr] = (wttByYear[yr] || 0) + wtt;
  }

  const rows: Scope3YearRow[] = YEARS.map(yr => {
    const s3 = getS3StaticCat1and4(yr);
    const cat1  = Math.round(s3.cat1);
    const cat3  = Math.round(wttByYear[yr] || 0);
    const cat4v = Math.round(s3.cat4v);
    const cat4r = Math.round(s3.cat4r);
    return {
      year: yr,
      cat1_cashew: cat1,
      cat3_wtt: cat3,
      cat4_vessel: cat4v,
      cat4_road: cat4r,
      totalFlag: cat1,
      totalNonFlag: cat3 + cat4v + cat4r,
      total: cat1 + cat3 + cat4v + cat4r,
      isEstimated: s3.isEstimated,
      resolvedYear: s3.resolvedYear,
    };
  }).filter(r => r.total > 0);

  return { rows, baseline2021: rows.find(r => r.year === 2021) };
}

const OPEX_YEARS = [2021, 2022, 2023, 2024, 2025, 2026] as const;
const OPEX_INTENSITY_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
const OPEX_FACTORY_ORDER = ['Long An', 'Phan Thiết', 'Tây Ninh', 'Tuticorin'] as const;

type OpexFactory = Pick<Factory, 'id' | 'name' | 'country'>;
type OpexEmissionRow = Pick<RawEmission, 'factory_id' | 'year' | 'scope' | 'category' | 'activity_data' | 'emissions_tco2e'>;
type OpexProductionRow = Pick<RawProduction, 'factory_id' | 'year' | 'quantity'>;

export interface OpexAnnualData {
  year: number;
  scope1: number;
  scope2: number;
  rcn: number;
}

export interface OpexIntensityYear {
  year: number;
  s1: number;
  s2: number;
  rcn: number;
  s1Int: number;
  s2Int: number;
  totalInt: number;
}

export interface OpexIntensityColumn {
  fac: OpexFactory;
  years: OpexIntensityYear[];
}

export interface OpexScope1BreakYear {
  year: number;
  cats: Record<string, number>;
  total: number;
}

export interface OpexScope3Row {
  year: number;
  cat1: number;
  cat3: number;
  cat4v: number;
  cat4r: number;
  total: number;
  qty: number;
  isEstimated?: boolean;
  resolvedYear?: number | null;
}

export interface OpexOriginRow {
  origin: string;
  qty: number;
  em: number;
  ef: number;
  color: string;
  pct: number;
}

export interface OpexOriginYearData {
  year: number;
  rows: OpexOriginRow[];
  totalQty: number;
  totalEm: number;
  highEfEm: number;
  weightedAvgEF: number;
}

export interface OpexReportData {
  factories: OpexFactory[];
  annualDataByFactory: Record<string, OpexAnnualData[]>;
  intensityData: OpexIntensityColumn[];
  scope1BreakdownByFactory: Record<string, OpexScope1BreakYear[]>;
  scope3Data: OpexScope3Row[];
  originData: OpexOriginYearData[];
}

function createEmptyAnnualRows(): Record<number, OpexAnnualData> {
  const rows = {} as Record<number, OpexAnnualData>;
  for (const year of OPEX_YEARS) {
    rows[year] = { year, scope1: 0, scope2: 0, rcn: 0 };
  }
  return rows;
}

function createEmptyScope1BreakRows(): Record<number, OpexScope1BreakYear> {
  const rows = {} as Record<number, OpexScope1BreakYear>;
  for (const year of OPEX_YEARS) {
    rows[year] = { year, cats: {}, total: 0 };
  }
  return rows;
}

function normalizeScope1Category(category: string): string {
  const catKey = category.toLowerCase().replace(/\s+/g, '_');
  if (catKey.includes('wood')) return 'wood_logs';
  if (catKey.includes('wastewater')) return 'wastewater';
  if (catKey === 'lpg') return 'lpg';
  if (catKey === 'diesel') return 'diesel';
  if (catKey.includes('r134')) return 'f_gas_fugitives_r134a';
  if (catKey.includes('r410')) return 'f_gas_fugitives_r410a';
  if (catKey.includes('r404')) return 'f_gas_fugitives_r404a';
  if (catKey.includes('co2') || catKey.includes('cylinder')) return 'co2_cylinder';
  return catKey;
}

function sortOpexFactories(factories: OpexFactory[]): OpexFactory[] {
  return [...factories].sort((a, b) => {
    const ai = OPEX_FACTORY_ORDER.findIndex(name => a.name.includes(name.split(' ')[0]));
    const bi = OPEX_FACTORY_ORDER.findIndex(name => b.name.includes(name.split(' ')[0]));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

async function fetchOpexFactories(): Promise<OpexFactory[]> {
  const { data, error } = await supabase
    .from('factories')
    .select('id,name,country');

  if (error) {
    throw new Error(`[DB] factories (opex): ${error.message}`);
  }

  return (data ?? []) as OpexFactory[];
}

async function fetchOpexEmissions(): Promise<OpexEmissionRow[]> {
  let rows: OpexEmissionRow[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,scope,category,activity_data,emissions_tco2e')
      .in('year', [...OPEX_YEARS])
      .in('scope', ['scope_1', 'scope_2'])
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`[DB] emissions_data (opex): ${error.message}`);
    }
    if (!data || data.length === 0) break;

    rows = rows.concat(data as OpexEmissionRow[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

async function fetchOpexProduction(): Promise<OpexProductionRow[]> {
  let rows: OpexProductionRow[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('production_data')
      .select('factory_id,year,quantity')
      .eq('category', 'rcn_input')
      .in('year', [...OPEX_YEARS])
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`[DB] production_data (opex): ${error.message}`);
    }
    if (!data || data.length === 0) break;

    rows = rows.concat(data as OpexProductionRow[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

export async function getOpexReportData(): Promise<OpexReportData> {
  const [factories, emissions, production, scope3Summary] = await Promise.all([
    fetchOpexFactories(),
    fetchOpexEmissions(),
    fetchOpexProduction(),
    getScope3SummaryData(),
  ]);

  const bucketKeys = ['ALL', ...factories.map(factory => factory.id)];
  const annualBuckets = Object.fromEntries(
    bucketKeys.map(key => [key, createEmptyAnnualRows()])
  ) as Record<string, Record<number, OpexAnnualData>>;
  const scope1Buckets = Object.fromEntries(
    bucketKeys.map(key => [key, createEmptyScope1BreakRows()])
  ) as Record<string, Record<number, OpexScope1BreakYear>>;

  for (const row of emissions) {
    const targetKeys = annualBuckets[row.factory_id] ? ['ALL', row.factory_id] : ['ALL'];
    const value = Number(row.emissions_tco2e) || 0;

    for (const key of targetKeys) {
      const annualRow = annualBuckets[key][row.year];
      if (!annualRow) continue;
      if (row.scope === 'scope_1') annualRow.scope1 += value;
      if (row.scope === 'scope_2') annualRow.scope2 += value;
    }

    if (row.scope !== 'scope_1') continue;

    const normalizedCategory = normalizeScope1Category(row.category);
    for (const key of targetKeys) {
      const breakRow = scope1Buckets[key][row.year];
      if (!breakRow) continue;
      breakRow.cats[normalizedCategory] = (breakRow.cats[normalizedCategory] || 0) + value;
      breakRow.total += value;
    }
  }

  for (const row of production) {
    const targetKeys = annualBuckets[row.factory_id] ? ['ALL', row.factory_id] : ['ALL'];
    const quantity = Number(row.quantity) || 0;

    for (const key of targetKeys) {
      const annualRow = annualBuckets[key][row.year];
      if (annualRow) annualRow.rcn += quantity;
    }
  }

  const annualDataByFactory = Object.fromEntries(
    Object.entries(annualBuckets).map(([key, byYear]) => [
      key,
      OPEX_YEARS.map(year => ({
        year,
        scope1: Math.round(byYear[year].scope1),
        scope2: Math.round(byYear[year].scope2),
        rcn: Math.round(byYear[year].rcn),
      })),
    ])
  ) as Record<string, OpexAnnualData[]>;

  const scope1BreakdownByFactory = Object.fromEntries(
    Object.entries(scope1Buckets).map(([key, byYear]) => [
      key,
      OPEX_YEARS.map(year => {
        const cats = Object.fromEntries(
          Object.entries(byYear[year].cats).map(([category, value]) => [category, Math.round(value)])
        ) as Record<string, number>;

        return {
          year,
          cats,
          total: Math.round(byYear[year].total),
        };
      }),
    ])
  ) as Record<string, OpexScope1BreakYear[]>;

  const sortedFactories = sortOpexFactories(factories);
  const intensityData: OpexIntensityColumn[] = sortedFactories.map(factory => {
    const lookup = Object.fromEntries(
      (annualDataByFactory[factory.id] || []).map(row => [row.year, row])
    ) as Record<number, OpexAnnualData>;

    const years = OPEX_INTENSITY_YEARS.map(year => {
      const row = lookup[year] || { year, scope1: 0, scope2: 0, rcn: 0 };
      const s1Int = row.rcn > 0 ? Math.round((row.scope1 * 1000) / row.rcn * 10) / 10 : 0;
      const s2Int = row.rcn > 0 ? Math.round((row.scope2 * 1000) / row.rcn * 10) / 10 : 0;
      return {
        year,
        s1: row.scope1,
        s2: row.scope2,
        rcn: row.rcn,
        s1Int,
        s2Int,
        totalInt: Math.round((s1Int + s2Int) * 10) / 10,
      };
    });

    return { fac: factory, years };
  });

  const totalLookup = Object.fromEntries(
    (annualDataByFactory.ALL || []).map(row => [row.year, row])
  ) as Record<number, OpexAnnualData>;
  intensityData.push({
    fac: { id: 'TOTAL', name: 'TOTAL', country: '' },
    years: OPEX_INTENSITY_YEARS.map(year => {
      const row = totalLookup[year] || { year, scope1: 0, scope2: 0, rcn: 0 };
      const s1Int = row.rcn > 0 ? Math.round((row.scope1 * 1000) / row.rcn * 10) / 10 : 0;
      const s2Int = row.rcn > 0 ? Math.round((row.scope2 * 1000) / row.rcn * 10) / 10 : 0;
      return {
        year,
        s1: row.scope1,
        s2: row.scope2,
        rcn: row.rcn,
        s1Int,
        s2Int,
        totalInt: Math.round((s1Int + s2Int) * 10) / 10,
      };
    }),
  });

  const scope3Data = scope3Summary.rows
    .filter(row => OPEX_YEARS.includes(row.year as (typeof OPEX_YEARS)[number]))
    .map(row => ({
      year: row.year,
      cat1: row.cat1_cashew,
      cat3: row.cat3_wtt,
      cat4v: row.cat4_vessel,
      cat4r: row.cat4_road,
      total: row.total,
      qty: Math.round(Object.values(ORIGIN_MIX[row.year] || {}).reduce((sum, qty) => sum + qty, 0)),
      isEstimated: row.isEstimated,
      resolvedYear: row.resolvedYear,
    }));

  const originData: OpexOriginYearData[] = OPEX_YEARS.map(year => {
    const mix = ORIGIN_MIX[year] || {};
    const totalQty = Object.values(mix).reduce((sum, qty) => sum + qty, 0);
    const rows: OpexOriginRow[] = Object.entries(mix)
      .map(([origin, qty]) => {
        const config = ORIGIN_EF[origin] || { ef: 2.5, flag: true, color: '#999' };
        return {
          origin,
          qty,
          em: Math.round(qty * config.ef),
          ef: config.ef,
          color: config.color,
          pct: totalQty > 0 ? qty / totalQty * 100 : 0,
        };
      })
      .sort((a, b) => b.em - a.em);

    const totalEm = rows.reduce((sum, row) => sum + row.em, 0);
    const highEfEm = rows.filter(row => row.ef > 5).reduce((sum, row) => sum + row.em, 0);
    const weightedAvgEF = totalQty > 0
      ? rows.reduce((sum, row) => sum + row.ef * row.qty, 0) / totalQty
      : 0;

    return {
      year,
      rows,
      totalQty,
      totalEm,
      highEfEm,
      weightedAvgEF,
    };
  });

  return {
    factories,
    annualDataByFactory,
    intensityData,
    scope1BreakdownByFactory,
    scope3Data,
    originData,
  };
}

export interface OverviewEmissionRow extends Pick<RawEmission, 'factory_id' | 'year' | 'month' | 'scope' | 'category' | 'activity_data' | 'emissions_tco2e'> {}

export interface OverviewProductionRow extends Pick<RawProduction, 'factory_id' | 'year' | 'month' | 'category' | 'quantity'> {}

export interface OverviewSourceData {
  factories: Factory[];
  emissions: OverviewEmissionRow[];
  production: OverviewProductionRow[];
}

export async function getOverviewSourceData(): Promise<OverviewSourceData> {
  const [factoriesRes, productionRes] = await Promise.all([
    supabase.from('factories').select('*'),
    (async () => {
      let rows: OverviewProductionRow[] = [];
      let offset = 0;
      const PAGE = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('production_data')
          .select('factory_id,year,month,category,quantity')
          .range(offset, offset + PAGE - 1);

        if (error) {
          throw new Error(`[DB] production_data (overview): ${error.message}`);
        }
        if (!data || data.length === 0) break;

        rows = rows.concat(data as OverviewProductionRow[]);
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      return rows;
    })(),
  ]);

  if (factoriesRes.error) {
    throw new Error(`[DB] factories (overview): ${factoriesRes.error.message}`);
  }

  let emissions: OverviewEmissionRow[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(`[DB] emissions_data (overview): ${error.message}`);
    }
    if (!data || data.length === 0) break;

    emissions = emissions.concat(data as OverviewEmissionRow[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return {
    factories: (factoriesRes.data ?? []) as Factory[],
    emissions,
    production: productionRes,
  };
}
