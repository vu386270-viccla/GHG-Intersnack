-- ============================================================
-- Reduction Initiatives Table
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS reduction_initiatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  factory_id      UUID REFERENCES factories(id),   -- NULL = all factories
  scope           TEXT NOT NULL CHECK (scope IN ('scope_1', 'scope_2', 'scope_3', 'all')),
  status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  start_date      DATE,
  target_date     DATE,
  estimated_reduction_tco2e  NUMERIC DEFAULT 0,    -- annual tCO2e reduction
  actual_reduction_tco2e     NUMERIC DEFAULT 0,    -- measured actual (if completed)
  estimated_cost_vnd         NUMERIC DEFAULT 0,    -- investment cost
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_init_scope   ON reduction_initiatives(scope);
CREATE INDEX IF NOT EXISTS idx_init_status  ON reduction_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_init_factory ON reduction_initiatives(factory_id);

ALTER TABLE reduction_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all" ON reduction_initiatives FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'reduction_initiatives created OK' AS status;
