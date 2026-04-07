-- Create production_data table for RCN input and CK output
CREATE TABLE IF NOT EXISTS production_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES factories(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  category TEXT NOT NULL, -- 'rcn_input' or 'ck_output'
  quantity NUMERIC NOT NULL DEFAULT 0, -- in Metric Tons
  unit TEXT NOT NULL DEFAULT 'MT',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(factory_id, year, month, category)
);

-- Enable RLS
ALTER TABLE production_data ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Allow public read" ON production_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON production_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON production_data FOR UPDATE USING (true);

-- Indexes
CREATE INDEX idx_prod_factory_year ON production_data(factory_id, year);
CREATE INDEX idx_prod_year_month ON production_data(year, month);
