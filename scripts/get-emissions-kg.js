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

async function getEmissionsData() {
  const { data, error } = await supabase
    .from('emissions_data')
    .select(`
      factory_id,
      year,
      scope,
      emissions_tco2e
    `)
    .in('year', [2021, 2022, 2023, 2024, 2025])
    .in('scope', ['scope_1', 'scope_2'])
    .not('emissions_tco2e', 'is', null);

  if (error) throw error;
  return data;
}

async function getFactories() {
  const { data, error } = await supabase
    .from('factories')
    .select('id,name');

  if (error) throw error;
  return data;
}

(async () => {
  try {
    const [emissions, factories] = await Promise.all([
      getEmissionsData(),
      getFactories(),
    ]);

    // Create factory name lookup
    const factoryMap = new Map(factories.map(f => [f.id, f.name]));

    // Target factory names (as they appear in DB)
    const targetNames = ['Tây Ninh', 'Long An', 'Phan Thiết', 'Tuticorin'];
    const targetIds = new Set(
      factories.filter(f => targetNames.includes(f.name)).map(f => f.id)
    );

    console.log('Target factory IDs:', targetIds);

    const result = {};

    for (const factory of factories) {
      if (targetIds.has(factory.id)) {
        result[factory.name] = {};
      }
    }

    // Process emissions
    for (const row of emissions) {
      if (!targetIds.has(row.factory_id)) continue;

      const factoryName = factoryMap.get(row.factory_id);
      const year = row.year;
      const valueTco2e = Number(row.emissions_tco2e) || 0;
      const valueKg = Math.round(valueTco2e * 1000);

      if (!result[factoryName][year]) {
        result[factoryName][year] = { s1_kg: 0, s2_kg: 0 };
      }

      if (row.scope === 'scope_1') {
        result[factoryName][year].s1_kg += valueKg;
      } else if (row.scope === 'scope_2') {
        result[factoryName][year].s2_kg += valueKg;
      }
    }

    const years = [2021, 2022, 2023, 2024, 2025];
    const factoryOrder = targetNames;

    console.log('\n=== EMISSIONS DATA (kg) ===\n');
    console.log('Factory         | 2021        | 2022        | 2023        | 2024        | 2025        ');
    console.log('----------------|-------------|-------------|-------------|-------------|-------------');

    for (const factory of factoryOrder) {
      const factoryData = result[factory] || {};
      const row = years.map(y => {
        const d = factoryData[y] || { s1_kg: 0, s2_kg: 0 };
        return (d.s1_kg + d.s2_kg).toLocaleString('vi-VN');
      }).join(' | ');
      console.log(`${factory.padEnd(14)} | ${row}`);
    }

    console.log('\n--- Scope 1 breakdown (kg) ---\n');
    console.log('Factory         | 2021        | 2022        | 2023        | 2024        | 2025        ');
    console.log('----------------|-------------|-------------|-------------|-------------|-------------');

    for (const factory of factoryOrder) {
      const factoryData = result[factory] || {};
      const row = years.map(y => {
        const d = factoryData[y] || { s1_kg: 0 };
        return d.s1_kg.toLocaleString('vi-VN');
      }).join(' | ');
      console.log(`${factory.padEnd(14)} | ${row}`);
    }

    console.log('\n--- Scope 2 breakdown (kg) ---\n');
    console.log('Factory         | 2021        | 2022        | 2023        | 2024        | 2025        ');
    console.log('----------------|-------------|-------------|-------------|-------------|-------------');

    for (const factory of factoryOrder) {
      const factoryData = result[factory] || {};
      const row = years.map(y => {
        const d = factoryData[y] || { s2_kg: 0 };
        return d.s2_kg.toLocaleString('vi-VN');
      }).join(' | ');
      console.log(`${factory.padEnd(14)} | ${row}`);
    }

    console.log('\n--- Raw JSON ---\n');
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
