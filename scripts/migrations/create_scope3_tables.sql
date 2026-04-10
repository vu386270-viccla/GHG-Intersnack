-- ============================================================
-- Scope 3 Data Tables Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Table: scope3_transport_data
-- Stores raw cashew shipping data: quantity, tonne-km by vessel and road
CREATE TABLE IF NOT EXISTS scope3_transport_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region          TEXT NOT NULL,        -- 'VN' or 'India'
  year            INT  NOT NULL,
  origin_country  TEXT NOT NULL,        -- source country of cashew
  shipped_qty_mts NUMERIC NOT NULL,     -- metric tonnes shipped
  km_ton_vessel   NUMERIC DEFAULT 0,    -- tonne-km via ocean vessel
  km_ton_road     NUMERIC DEFAULT 0,    -- tonne-km via road
  -- Calculated emissions (kg CO2e)
  em_vessel_kg    NUMERIC GENERATED ALWAYS AS (km_ton_vessel * 0.01604) STORED,
  em_road_kg      NUMERIC GENERATED ALWAYS AS (km_ton_road   * 0.07547) STORED,
  em_cashew_kg    NUMERIC,              -- Cat.1: shipped_qty * cashew EF per origin (populated by script)
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_s3t_year   ON scope3_transport_data(year);
CREATE INDEX IF NOT EXISTS idx_s3t_region ON scope3_transport_data(region);
CREATE INDEX IF NOT EXISTS idx_s3t_origin ON scope3_transport_data(origin_country);

-- Enable RLS and allow anon read/write (same as emissions_data)
ALTER TABLE scope3_transport_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all" ON scope3_transport_data FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- Quick verification
SELECT 'scope3_transport_data created OK' AS status;
