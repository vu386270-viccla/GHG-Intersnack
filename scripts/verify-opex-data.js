import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) {
      const value = rest.join('=').replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Factory mapping (use exact DB names)
const FACTORY_NAMES = {
  'Tây Ninh': { id: '041d71b2-f002-438d-b711-3f6195f0c4e5' },
  'Long An': { id: '7040a994-d776-410b-a429-19c0269e2697' },
  'Phan Thiết': { id: '0a586cb1-60e9-4d36-8073-ddc002c88c0d' },
  'Tuticorin': { id: '6a400f3d-059a-43e7-88ae-d5441ae7c7b5' },
};

async function fetchOpexEmissions() {
  let rows = [];
  let offset = 0;
  const PAGE = 1000;
  const OPEX_YEARS = [2021, 2022, 2023, 2024, 2025];

  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,scope,emissions_tco2e')
      .in('year', OPEX_YEARS)
      .in('scope', ['scope_1', 'scope_2'])
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows = rows.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

(async () => {
  try {
    const emissions = await fetchOpexEmissions();

    // Initialize result structure
    const result = {};
    for (const name of Object.keys(FACTORY_NAMES)) {
      result[name] = {};
    }

    // Process emissions
    for (const row of emissions) {
      // Skip if not target factory
      const targetEntry = Object.entries(FACTORY_NAMES).find(([, v]) => v.id === row.factory_id);
      if (!targetEntry) continue;

      const factoryName = targetEntry[0];
      const year = row.year;
      const valueTco2e = Number(row.emissions_tco2e) || 0;
      const valueKg = Math.round(valueTco2e * 1000);

      if (!result[factoryName][year]) {
        result[factoryName][year] = { s1_kg: 0, s2_kg: 0, total_kg: 0 };
      }

      if (row.scope === 'scope_1') {
        result[factoryName][year].s1_kg += valueKg;
      } else if (row.scope === 'scope_2') {
        result[factoryName][year].s2_kg += valueKg;
      }
    }

    // Calculate totals and YoY deltas
    const years = [2021, 2022, 2023, 2024, 2025];
    const factoryOrder = ['Tây Ninh', 'Long An', 'Phan Thiết', 'Tuticorin'];

    console.log('\n=== OPEX REPORT DATA VERIFICATION ===\n');
    console.log('Data source: fetchOpexEmissions() from Supabase');
    console.log('Units: kg (converted from tCO2e * 1000)\n');

    for (const factory of factoryOrder) {
      console.log(`\n========== ${factory} ==========`);
      console.log('\nTotal (S1+S2) by year:');
      console.log('Year | Total (kg) | Δ YoY (kg)');
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const data = result[factory][year] || { total_kg: 0 };
        if (i > 0) {
          const prevYear = years[i - 1];
          const prevData = result[factory][prevYear] || { total_kg: 0 };
          const delta = data.total_kg - prevData.total_kg;
          const pct = prevData.total_kg > 0 ? ((delta / prevData.total_kg) * 100).toFixed(1) : 'N/A';
          console.log(`${year} | ${data.total_kg.toLocaleString('vi-VN')} | ${delta >= 0 ? '+' : ''}${delta.toLocaleString('vi-VN')} (${pct}%)`);
        } else {
          console.log(`${year} | ${data.total_kg.toLocaleString('vi-VN')} | base`);
        }
      }

      console.log('\nScope 1 by year:');
      console.log('Year | S1 (kg) | Δ YoY (kg)');
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const data = result[factory][year] || { s1_kg: 0 };
        if (i > 0) {
          const prevYear = years[i - 1];
          const prevData = result[factory][prevYear] || { s1_kg: 0 };
          const delta = data.s1_kg - prevData.s1_kg;
          console.log(`${year} | ${data.s1_kg.toLocaleString('vi-VN')} | ${delta >= 0 ? '+' : ''}${delta.toLocaleString('vi-VN')}`);
        } else {
          console.log(`${year} | ${data.s1_kg.toLocaleString('vi-VN')} | base`);
        }
      }

      console.log('\nScope 2 by year:');
      console.log('Year | S2 (kg) | Δ YoY (kg)');
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const data = result[factory][year] || { s2_kg: 0 };
        if (i > 0) {
          const prevYear = years[i - 1];
          const prevData = result[factory][prevYear] || { s2_kg: 0 };
          const delta = data.s2_kg - prevData.s2_kg;
          console.log(`${year} | ${data.s2_kg.toLocaleString('vi-VN')} | ${delta >= 0 ? '+' : ''}${delta.toLocaleString('vi-VN')}`);
        } else {
          console.log(`${year} | ${data.s2_kg.toLocaleString('vi-VN')} | base`);
        }
      }
    }

    console.log('\n--- Full JSON ---\n');
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
