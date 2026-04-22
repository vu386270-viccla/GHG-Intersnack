#!/usr/bin/env node
/**
 * Insert Solar PT Rooftop Initiative into Supabase
 * Source: opex-report/page.tsx — PT Solar constants
 *
 * Data:
 *   System output: 1,614 MWh/year (year-1)
 *   EF: 0.6592 tCO2/kWh (national grid per solar report)
 *   Net saving (Scope 2, year 1): 1,614 × 0.6592 ≈ 1,064 tCO2e/year
 *   Online: end-2026, first full year 2027
 *   Panel degradation: 1%/year
 */

const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';

// Load from .env.local
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local not found. Run: vercel env pull .env.local');
        process.exit(1);
    }
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
    const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    if (!ANON_KEY) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local');
        process.exit(1);
    }

    const headers = {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'return=representation',
    };

    // Step 1: Get factory_id for Phan Thiet
    console.log('🔍 Looking up factory_id for Phan Thiet...');
    const facResp = await fetch(`${SUPABASE_URL}/rest/v1/factories?select=id,name,code&name=ilike.*phan*`, { headers });
    const facData = await facResp.json();
    console.log('Factories found:', JSON.stringify(facData, null, 2));

    let ptFactoryId = null;
    if (Array.isArray(facData) && facData.length > 0) {
        // Find the one matching Phan Thiet
        const ptFactory = facData.find(f =>
            (f.name || '').toLowerCase().includes('phan') ||
            (f.code || '').toLowerCase().includes('pt')
        );
        if (ptFactory) {
            ptFactoryId = ptFactory.id;
            console.log(`✅ Found PT factory: ${ptFactory.name} (id: ${ptFactoryId})`);
        }
    }

    if (!ptFactoryId) {
        console.log('⚠️  No PT factory found. Listing all factories...');
        const allFac = await fetch(`${SUPABASE_URL}/rest/v1/factories?select=id,name,code`, { headers });
        const allFacData = await allFac.json();
        console.log('All factories:', JSON.stringify(allFacData, null, 2));
        console.log('Setting factory_id to null (applies to all factories)');
    }

    // Step 2: Insert the initiative
    const initiative = {
        name: 'Điện mặt trời áp mái — Nhà máy Phan Thiết (1,614 MWh/năm)',
        description: 'Hệ thống điện mặt trời áp mái 1,614 MWh/năm tại nhà máy Phan Thiết. Nguồn: Báo cáo khả thi hệ thống điện mặt trời (Cân bằng phát thải CO₂). EF sử dụng: 0.6592 tCO₂/kWh (lưới quốc gia). Tiết kiệm Scope 2 ~1,064 tCO₂e/năm (năm đầu). Dự kiến vận hành: cuối 2026, năm đầy đủ đầu tiên: 2027. Độ suy giảm tấm pin: 1%/năm.',
        factory_id: ptFactoryId,
        scope: 'scope_2',
        status: 'in_progress',
        start_date: '2026-01-01',
        target_date: '2027-01-01',
        estimated_reduction_tco2e: 1064,
        actual_reduction_tco2e: 0,
        estimated_cost_vnd: 0,
        notes: 'Nguồn: opex-report solar constants. 1614 MWh × 0.6592 tCO₂/kWh = 1,064 tCO₂e/năm (năm 1). Năm tiếp theo giảm 1%/năm theo độ suy giảm tấm pin.',
        updated_at: new Date().toISOString(),
    };

    console.log('\n📤 Inserting Solar PT initiative...');
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/reduction_initiatives`, {
        method: 'POST',
        headers,
        body: JSON.stringify(initiative),
    });

    const statusCode = insertResp.status;
    let result;
    try {
        result = await insertResp.json();
    } catch (e) {
        result = await insertResp.text();
    }

    if (statusCode >= 200 && statusCode < 300) {
        console.log('✅ SUCCESS! Initiative inserted:');
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error(`❌ Error ${statusCode}:`, JSON.stringify(result, null, 2));

        if (statusCode === 404) {
            console.log('\n💡 Table "reduction_initiatives" may not exist yet.');
            console.log('Run this SQL in Supabase Dashboard > SQL Editor:');
            console.log(`
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

ALTER TABLE reduction_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read" ON reduction_initiatives FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON reduction_initiatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update" ON reduction_initiatives FOR UPDATE USING (true);
CREATE POLICY "Allow delete" ON reduction_initiatives FOR DELETE USING (true);
      `);
        } else if (statusCode === 403) {
            console.log('\n💡 403 Forbidden — RLS policy missing. Run in Supabase SQL Editor:');
            console.log(`
CREATE POLICY "Allow insert" ON reduction_initiatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update" ON reduction_initiatives FOR UPDATE USING (true);
CREATE POLICY "Allow delete" ON reduction_initiatives FOR DELETE USING (true);
      `);
        }
    }
}

main().catch(console.error);
