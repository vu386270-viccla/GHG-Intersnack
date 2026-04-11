-- ============================================================
-- Add cost_usd column to emissions_data
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE emissions_data
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC DEFAULT NULL;

COMMENT ON COLUMN emissions_data.cost_usd IS
  'Actual energy cost in USD for this emission record (fuel bill, electricity bill, etc.). Optional — leave NULL if unknown.';

-- Index for financial analysis queries
CREATE INDEX IF NOT EXISTS idx_ems_cost ON emissions_data(cost_usd) WHERE cost_usd IS NOT NULL;

SELECT 'cost_usd column added OK' AS status;
