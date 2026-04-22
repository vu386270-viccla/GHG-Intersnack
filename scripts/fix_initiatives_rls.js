#!/usr/bin/env node
/**
 * Fix Supabase RLS policies for reduction_initiatives table
 * and insert Solar PT initiative via service role bypass
 *
 * Uses the Management API to run SQL directly
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
        const m = line.match(/^([^=]+)="?([^"]*)"?$/);
        if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
}

async function main() {
    const env = loadEnv();
    const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
    const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    // Extract project ref from URL: https://irbvgsyzidqnzhpetmdk.supabase.co
    const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
    console.log('Project ref:', projectRef);

    const headers = {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'return=representation',
    };

    // First, let's check what record is actually in the DB via SELECT *
    console.log('\n1️⃣  Checking reduction_initiatives table...');
    const checkResp = await fetch(
        `${SUPABASE_URL}/rest/v1/reduction_initiatives?select=id,name,status,scope`,
        { headers }
    );
    const checkData = await checkResp.json();
    console.log(`Status: ${checkResp.status}`);
    console.log('Data:', JSON.stringify(checkData, null, 2));

    if (checkResp.status === 200) {
        console.log(`\n✅ Table exists with ${Array.isArray(checkData) ? checkData.length : 0} records`);

        // If empty, the record we inserted may have had a different RLS context.
        // Re-insert using anon key (same as what the UI uses)
        if (!Array.isArray(checkData) || checkData.length === 0) {
            console.log('\n2️⃣  Re-inserting Solar PT initiative (table is empty)...');

            // Get factory_id
            const facResp = await fetch(
                `${SUPABASE_URL}/rest/v1/factories?select=id,name&name=ilike.*phan*`,
                { headers }
            );
            const facData = await facResp.json();
            console.log('Factories:', JSON.stringify(facData));
            const ptFactory = Array.isArray(facData) ? facData[0] : null;
            const ptFactoryId = ptFactory?.id || null;

            const record = {
                name: 'Điện mặt trời áp mái — Nhà máy Phan Thiết (1,614 MWh/năm)',
                description: 'Hệ thống điện mặt trời áp mái 1,614 MWh/năm tại nhà máy Phan Thiết. EF: 0.6592 tCO₂/kWh. Tiết kiệm ~1,064 tCO₂e/năm (năm đầu). Online: cuối 2026.',
                factory_id: ptFactoryId,
                scope: 'scope_2',
                status: 'in_progress',
                start_date: '2026-01-01',
                target_date: '2027-01-01',
                estimated_reduction_tco2e: 1064,
                actual_reduction_tco2e: 0,
                estimated_cost_vnd: 0,
                notes: '1614 MWh × 0.6592 tCO₂/kWh = 1,064 tCO₂e/năm (năm 1). Suy giảm 1%/năm.',
                updated_at: new Date().toISOString(),
            };

            const insertResp = await fetch(
                `${SUPABASE_URL}/rest/v1/reduction_initiatives`,
                {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=representation' },
                    body: JSON.stringify(record),
                }
            );
            const insertData = await insertResp.json();
            console.log(`Insert status: ${insertResp.status}`);
            console.log('Insert result:', JSON.stringify(insertData, null, 2));

            if (insertResp.status >= 400) {
                console.log('\n❌ INSERT failed. RLS insert policy missing or table does not exist.');
                console.log('\n📋  Run this SQL in Supabase Dashboard → SQL Editor → New Query:');
                console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql');
                console.log(`
-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS reduction_initiatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  factory_id UUID REFERENCES factories(id),
  scope TEXT NOT NULL DEFAULT 'scope_2' CHECK (scope IN ('scope_1','scope_2','scope_3','all')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  start_date DATE,
  target_date DATE,
  estimated_reduction_tco2e NUMERIC NOT NULL DEFAULT 0,
  actual_reduction_tco2e NUMERIC NOT NULL DEFAULT 0,
  estimated_cost_vnd NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE reduction_initiatives ENABLE ROW LEVEL SECURITY;

-- 3. Drop any old policies and recreate correctly for ALL roles
DROP POLICY IF EXISTS "Allow read" ON reduction_initiatives;
DROP POLICY IF EXISTS "Allow read access" ON reduction_initiatives;
DROP POLICY IF EXISTS "Allow insert" ON reduction_initiatives;
DROP POLICY IF EXISTS "Allow update" ON reduction_initiatives;
DROP POLICY IF EXISTS "Allow delete" ON reduction_initiatives;

CREATE POLICY "Allow read" ON reduction_initiatives FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert" ON reduction_initiatives FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON reduction_initiatives FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow delete" ON reduction_initiatives FOR DELETE TO anon, authenticated USING (true);

-- 4. Insert Solar PT initiative
INSERT INTO reduction_initiatives (
  name, description, factory_id, scope, status,
  start_date, target_date,
  estimated_reduction_tco2e, actual_reduction_tco2e, estimated_cost_vnd, notes
)
SELECT
  'Điện mặt trời áp mái — Nhà máy Phan Thiết (1,614 MWh/năm)',
  'Hệ thống điện mặt trời áp mái 1,614 MWh/năm tại nhà máy Phan Thiết. EF: 0.6592 tCO₂/kWh. Tiết kiệm ~1,064 tCO₂e/năm (năm đầu). Online: cuối 2026, năm đầy đủ đầu tiên: 2027. Suy giảm tấm pin: 1%/năm.',
  f.id, 'scope_2', 'in_progress',
  '2026-01-01', '2027-01-01',
  1064, 0, 0,
  '1614 MWh × 0.6592 tCO₂/kWh = 1,064 tCO₂e/năm (năm 1). Suy giảm 1%/năm. Nguồn: opex-report solar constants.'
FROM factories f
WHERE lower(f.name) LIKE '%phan%'
LIMIT 1;
`);
            }
        } else {
            console.log('\n✅ Records already exist in table. Issue may be RLS SELECT policy for authenticated role.');
            console.log('\n📋  Run this SQL to fix policies:');
            console.log(`
DROP POLICY IF EXISTS "Allow read" ON reduction_initiatives;
DROP POLICY IF EXISTS "Allow read access" ON reduction_initiatives;
CREATE POLICY "Allow read" ON reduction_initiatives FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert" ON reduction_initiatives FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON reduction_initiatives FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow delete" ON reduction_initiatives FOR DELETE TO anon, authenticated USING (true);
`);
        }
    } else if (checkResp.status === 404) {
        console.log('\n❌ Table does not exist. Run the full SQL above in Supabase Dashboard.');
    }

    console.log('\n🔗 Open Supabase SQL Editor:');
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
}

main().catch(console.error);
