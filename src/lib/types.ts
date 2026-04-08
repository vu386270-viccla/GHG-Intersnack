// ── GHG Tracking App Types ──

export type ScopeType = 'scope_1' | 'scope_2' | 'scope_3';

export interface Factory {
  id: string;
  name: string;
  location: string;
  country: string;
  code: string;
  created_at: string;
}

export interface EmissionFactor {
  id: string;
  scope: ScopeType;
  category: string;
  subcategory?: string;
  unit: string;
  factor: number;
  source: string;
  year?: number;
  country?: string;
  created_at: string;
}

export interface EmissionsData {
  id: string;
  factory_id: string;
  year: number;
  month: number;
  scope: ScopeType;
  category: string;
  activity_data: number;
  activity_unit: string;
  emission_factor_id?: string;
  emissions_tco2e: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SBTiTarget {
  id: string;
  scope: string;
  base_year: number;
  target_year: number;
  base_year_emissions: number;
  reduction_target_pct: number;
  description?: string;
  created_at: string;
}

// ── Aggregated/View Types ──

export interface ScopeSummary {
  scope: ScopeType;
  totalEmissions: number;
  previousYearEmissions: number;
  percentOfTotal: number;
  changePercent: number;
  categories: CategorySummary[];
}

export interface CategorySummary {
  category: string;
  label: string;
  emissions: number;
  percentOfScope: number;
  unit: string;
}

export interface FactorySummary {
  factory: Factory;
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  monthlyTrend: MonthlyData[];
}

export interface MonthlyData {
  month: number;
  label: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export interface TargetProgress {
  scope: string;
  label: string;
  baseYearEmissions: number;
  currentEmissions: number;
  targetEmissions: number;
  reductionTargetPct: number;
  actualReductionPct: number;
  onTrack: boolean;
  targetYear: number;
  baseYear: number;
}

// ── Chart Types ──

export interface BarChartData {
  label: string;
  values: { key: string; value: number; color: string }[];
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface TrendPoint {
  label: string;
  values: { key: string; value: number; color: string }[];
}

// ── Scope 1 Categories (actual EFs from Intersnack) ──

export const SCOPE_1_CATEGORIES = [
  { key: 'wood_logs', label: 'Củi / Gỗ (Boiler)', unit: 'tấn', icon: '🪵', process: 'Boiler', efUnit: 'kg CO₂e/tấn', ef: 28 },
  { key: 'wastewater', label: 'Nước thải (WWTS)', unit: 'm³', icon: '🌊', process: 'WWTS', efUnit: 'kg CO₂e/m³', ef: 0.2013 },
  { key: 'lpg', label: 'Khí LPG (Xe nâng)', unit: 'tấn', icon: '🛢️', process: 'FLTs', efUnit: 'kg CO₂e/tấn', ef: 2909.26 }, // 1.571 * 1851.85 (Vietnam)
  { key: 'diesel', label: 'Dầu Diesel (Máy phát/Xe)', unit: 'lít', icon: '⛽', process: 'Generator / Company Car', efUnit: 'kg CO₂e/lít', ef: 2.68 },
  { key: 'fgas_r22', label: 'F-Gas R22', unit: 'kg', icon: '❄️', process: 'Refrigeration & A/C', efUnit: 'HCFC kg/kg', ef: 1810 },
  { key: 'fgas_r32', label: 'F-Gas R32', unit: 'kg', icon: '❄️', process: 'Refrigeration & A/C', efUnit: 'HFC kg/kg', ef: 675 },
  { key: 'fgas_r134a', label: 'F-Gas R134A', unit: 'kg', icon: '❄️', process: 'Refrigeration & A/C', efUnit: 'HFC kg/kg', ef: 1300 },
  { key: 'fgas_r410a', label: 'F-Gas R410A', unit: 'kg', icon: '❄️', process: 'Refrigeration & A/C', efUnit: 'HFC kg/kg', ef: 2088 },
  { key: 'fgas_r404a', label: 'F-Gas R404A', unit: 'kg', icon: '❄️', process: 'Refrigeration & A/C', efUnit: 'HFC kg/kg', ef: 3920 },
  { key: 'co2_cylinder', label: 'Bình CO₂', unit: 'kg', icon: '🧪', process: 'CO₂ Tanks', efUnit: 'CO₂ kg/kg', ef: 1 },
] as const;

export const SCOPE_2_CATEGORIES = [
  { key: 'electricity', label: 'Điện lưới mua', unit: 'kWh', icon: '⚡', process: 'Grid Electricity' },
] as const;

// Scope 2 Grid Emission Factors by country & year
export interface GridEF {
  country: string;
  year: number;
  factor: number; // kg CO2e / kWh
  source: string;
}

export const GRID_EMISSION_FACTORS: GridEF[] = [
  { country: 'Vietnam', year: 2020, factor: 0.8041, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2021, factor: 0.7221, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2022, factor: 0.6766, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2023, factor: 0.6592, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2024, factor: 0.6592, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2025, factor: 0.6592, source: 'MONRE Vietnam' },
  { country: 'Vietnam', year: 2026, factor: 0.6592, source: 'MONRE Vietnam' },
  { country: 'India', year: 2020, factor: 0.7130, source: 'CEA India' },
  { country: 'India', year: 2021, factor: 0.7030, source: 'CEA India' },
  { country: 'India', year: 2022, factor: 0.7150, source: 'CEA India' },
  { country: 'India', year: 2023, factor: 0.7160, source: 'CEA India' },
  { country: 'India', year: 2024, factor: 0.7270, source: 'CEA India' },
  { country: 'India', year: 2025, factor: 0.7100, source: 'CEA India' },
  { country: 'India', year: 2026, factor: 0.7100, source: 'CEA India' },
];

export const SCOPE_3_CATEGORIES = [
  { key: 'purchased_goods', label: 'Hàng hóa & Dịch vụ mua', unit: 'tấn', icon: '📦', ghgCategory: 'Cat. 1', description: 'Purchased Goods & Services' },
  { key: 'upstream_transport', label: 'Vận tải ngược dòng', unit: 'tấn-km', icon: '🚛', ghgCategory: 'Cat. 4', description: 'Upstream Transportation & Distribution' },
  { key: 'fuel_energy_related', label: 'Hoạt động năng lượng liên quan', unit: 'tCO₂e', icon: '🔋', ghgCategory: 'Cat. 3', description: 'Fuel & Energy-Related Activities' },
] as const;

export const MONTHS_VI = [
  'Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06',
  'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12'
] as const;

export const SCOPE_COLORS = {
  scope_1: '#E32314',
  scope_2: '#F5A623',
  scope_3: '#8CB92D',
} as const;

export const SCOPE_LABELS: Record<ScopeType, string> = {
  scope_1: 'Scope 1',
  scope_2: 'Scope 2',
  scope_3: 'Scope 3',
};

export const SCOPE_DESCRIPTIONS: Record<ScopeType, string> = {
  scope_1: 'Phát thải trực tiếp',
  scope_2: 'Phát thải gián tiếp (Năng lượng mua)',
  scope_3: 'Phát thải chuỗi giá trị',
};
