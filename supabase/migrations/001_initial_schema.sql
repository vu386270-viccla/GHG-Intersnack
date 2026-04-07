-- ============================================
-- GHG Tracking App — Supabase Schema
-- Intersnack Group SBTi Compliance
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Factories ──
CREATE TABLE factories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Vietnam',
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed factories (3 Vietnam + 1 India)
INSERT INTO factories (name, location, country, code) VALUES
  ('Nhà máy A', 'Bình Dương', 'Vietnam', 'FAC-A'),
  ('Nhà máy B', 'Long An', 'Vietnam', 'FAC-B'),
  ('Nhà máy C', 'Đồng Nai', 'Vietnam', 'FAC-C'),
  ('Nhà máy D', 'Maharashtra', 'India', 'FAC-D');

-- ── Emission Factors ──
CREATE TABLE emission_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope TEXT NOT NULL CHECK (scope IN ('scope_1', 'scope_2', 'scope_3')),
  category TEXT NOT NULL,
  subcategory TEXT,
  process TEXT,
  unit TEXT NOT NULL,
  factor NUMERIC NOT NULL,
  country TEXT, -- NULL = global, 'Vietnam', 'India'
  year INT, -- NULL = static, year value = time-varying (e.g., grid EF)
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Scope 1 Emission Factors (static)
INSERT INTO emission_factors (scope, category, process, unit, factor, source) VALUES
  ('scope_1', 'wood_logs', 'Boiler', 'kg CO2e/ton', 43.893270, 'IPCC'),
  ('scope_1', 'wastewater', 'WWTS', 'kg CO2e/m3', 0.201, 'IPCC'),
  ('scope_1', 'lpg', 'FLTs', 'kg CO2e/ton', 2939.29, 'IPCC'),
  ('scope_1', 'diesel', 'Generator/Company Car', 'kg CO2e/l', 2.512064, 'IPCC'),
  ('scope_1', 'fgas_r134a', 'Refrigeration & A/C', 'HFC kg/kg', 1300, 'IPCC AR6'),
  ('scope_1', 'fgas_r410a', 'Refrigeration & A/C', 'HFC kg/kg', 3943, 'IPCC AR6'),
  ('scope_1', 'fgas_r404a', 'Refrigeration & A/C', 'HFC kg/kg', 1924, 'IPCC AR6'),
  ('scope_1', 'co2_cylinder', 'CO2 Tanks', 'CO2 kg/kg', 1, 'Direct');

-- Scope 2 Grid Emission Factors (time-varying, country-specific)
INSERT INTO emission_factors (scope, category, process, unit, factor, country, year, source) VALUES
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.7221, 'Vietnam', 2021, 'MONRE Vietnam'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.7098, 'Vietnam', 2022, 'MONRE Vietnam'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6969, 'Vietnam', 2023, 'MONRE Vietnam'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6855, 'Vietnam', 2024, 'MONRE Vietnam'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6750, 'Vietnam', 2025, 'MONRE Vietnam (est.)'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6650, 'Vietnam', 2026, 'MONRE Vietnam (est.)'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.7080, 'India', 2021, 'CEA India'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.7160, 'India', 2022, 'CEA India'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.7020, 'India', 2023, 'CEA India'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6940, 'India', 2024, 'CEA India'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6850, 'India', 2025, 'CEA India (est.)'),
  ('scope_2', 'electricity', 'Grid Electricity', 'kg CO2e/kWh', 0.6770, 'India', 2026, 'CEA India (est.)');

-- ── Monthly Emissions Data ──
CREATE TABLE emissions_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factory_id UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  scope TEXT NOT NULL CHECK (scope IN ('scope_1', 'scope_2', 'scope_3')),
  category TEXT NOT NULL,
  activity_data NUMERIC NOT NULL DEFAULT 0,
  activity_unit TEXT NOT NULL,
  emission_factor_id UUID REFERENCES emission_factors(id),
  emissions_tco2e NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(factory_id, year, month, scope, category)
);

-- ── SBTi Targets ──
CREATE TABLE sbti_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope TEXT NOT NULL,
  base_year INT NOT NULL DEFAULT 2021,
  target_year INT NOT NULL DEFAULT 2032,
  base_year_emissions NUMERIC NOT NULL,
  reduction_target_pct NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed SBTi targets (Intersnack: S1+2 -50%, S3 -30% by 2032)
INSERT INTO sbti_targets (scope, base_year, target_year, base_year_emissions, reduction_target_pct, description) VALUES
  ('scope_1_2', 2021, 2032, 0, 50, 'Giảm 50% phát thải vận hành (Scope 1 + 2) so với năm 2021'),
  ('scope_3', 2021, 2032, 0, 30, 'Giảm 30% phát thải chuỗi giá trị (Scope 3) so với năm 2021');

-- ── Audit Log ──
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX idx_emissions_factory ON emissions_data(factory_id);
CREATE INDEX idx_emissions_scope ON emissions_data(scope);
CREATE INDEX idx_emissions_period ON emissions_data(year, month);
CREATE INDEX idx_emissions_lookup ON emissions_data(factory_id, year, month, scope);
CREATE INDEX idx_ef_scope ON emission_factors(scope, category);
CREATE INDEX idx_ef_country_year ON emission_factors(country, year);

-- ── Row Level Security ──
ALTER TABLE factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE emissions_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sbti_targets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow read access" ON factories FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON emission_factors FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON emissions_data FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON sbti_targets FOR SELECT USING (true);

-- Allow authenticated users to insert/update emissions data
CREATE POLICY "Allow insert emissions" ON emissions_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update emissions" ON emissions_data FOR UPDATE USING (true);

-- Allow authenticated users to manage emission factors
CREATE POLICY "Allow insert ef" ON emission_factors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update ef" ON emission_factors FOR UPDATE USING (true);
