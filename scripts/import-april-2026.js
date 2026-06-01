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

// Factory IDs
const FACTORIES = {
  'Tây Ninh': '041d71b2-f002-438d-b711-3f6195f0c4e5',
  'Phan Thiết': '0a586cb1-60e9-4d36-8073-ddc002c88c0d',
  'Tuticorin': '6a400f3d-059a-43e7-88ae-d5441ae7c7b5',
};

// Emission Factors (kg CO2e per unit)
const EF = {
  Vietnam: {
    wood_logs: 28,
    wastewater: 0.2013,
    diesel: 2.68,
    lpg: 2909.26,
    co2_cylinder: 1,
    electricity: 0.6592,
  },
  India: {
    wood_logs: 35,
    wastewater: 0.2013,
    diesel: 2.72,
    lpg: 2983.00,
    co2_cylinder: 1,
    electricity: 0.7100,
  }
};

// Data for April 2026
const aprilData = {
  'Tây Ninh': {
    country: 'Vietnam',
    scope1: [
      { category: 'wood_logs', value: 174.39, unit: 'tấn' },
      { category: 'wastewater', value: 2082, unit: 'm³' },
      { category: 'diesel', value: 250, unit: 'lít' },
    ],
    scope2: [
      { category: 'electricity', value: 461504, unit: 'kWh' },
    ],
    production: [
      { category: 'rcn_input', quantity: 1800, unit: 'tấn' },
      { category: 'ck_output', quantity: 463392, unit: 'kg' },
    ]
  },
  'Phan Thiết': {
    country: 'Vietnam',
    scope1: [
      { category: 'wood_logs', value: 144.31, unit: 'tấn' },
      { category: 'wastewater', value: 1240, unit: 'm³' },
      { category: 'diesel', value: 220, unit: 'lít' },
    ],
    scope2: [
      { category: 'electricity', value: 367997, unit: 'kWh' },
    ],
    production: [
      { category: 'rcn_input', quantity: 1521, unit: 'tấn' },
      { category: 'ck_output', quantity: 441758, unit: 'kg' },
    ]
  },
  'Tuticorin': {
    country: 'India',
    scope1: [
      { category: 'wood_logs', value: 120.49, unit: 'tấn' },
      { category: 'wastewater', value: 797.06, unit: 'm³' },
      { category: 'lpg', value: 0.09, unit: 'tấn' },
      { category: 'diesel', value: 1509, unit: 'lít' },
      { category: 'co2_cylinder', value: 303.5, unit: 'kg' },
    ],
    scope2: [
      { category: 'electricity', value: 429520, unit: 'kWh' },
    ],
    production: [
      { category: 'rcn_input', quantity: 2071, unit: 'tấn' },
      { category: 'ck_output', quantity: 550194, unit: 'kg' },
    ]
  }
};

async function insertData() {
  const year = 2026;
  const month = 4;

  for (const [factoryName, data] of Object.entries(aprilData)) {
    const factoryId = FACTORIES[factoryName];
    if (!factoryId) {
      console.error(`Factory not found: ${factoryName}`);
      continue;
    }

    const country = data.country;
    const efCountry = EF[country];

    // Insert Scope 1 emissions
    const scope1Records = data.scope1.map(item => {
      const ef = efCountry[item.category];
      const emissionsKg = item.value * ef;
      const emissionsTco2e = Math.round((emissionsKg / 1000) * 10000) / 10000;
      return {
        factory_id: factoryId,
        year,
        month,
        scope: 'scope_1',
        category: item.category,
        activity_data: item.value,
        activity_unit: item.unit,
        emissions_tco2e: emissionsTco2e,
      };
    });

    // Insert Scope 2 emissions
    const scope2Records = data.scope2.map(item => {
      const ef = efCountry[item.category];
      const emissionsKg = item.value * ef;
      const emissionsTco2e = Math.round((emissionsKg / 1000) * 10000) / 10000;
      return {
        factory_id: factoryId,
        year,
        month,
        scope: 'scope_2',
        category: item.category,
        activity_data: item.value,
        activity_unit: item.unit,
        emissions_tco2e: emissionsTco2e,
      };
    });

    // Insert Production data
    const productionRecords = data.production.map(item => ({
      factory_id: factoryId,
      year,
      month,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit
    }));

    // Upsert emissions (scope 1 + 2)
    const allEmissions = [...scope1Records, ...scope2Records];
    if (allEmissions.length > 0) {
      const { error: emisError } = await supabase
        .from('emissions_data')
        .upsert(allEmissions, { onConflict: 'factory_id,year,month,scope,category' });
      if (emisError) {
        console.error(`Error inserting emissions for ${factoryName}:`, emisError.message);
      } else {
        console.log(`✓ Inserted ${allEmissions.length} emission records for ${factoryName}`);
        allEmissions.forEach(r => {
          console.log(`  - ${r.scope}/${r.category}: ${r.activity_data} ${r.activity_unit} = ${r.emissions_tco2e} tCO2e`);
        });
      }
    }

    // Upsert production data
    if (productionRecords.length > 0) {
      const { error: prodError } = await supabase
        .from('production_data')
        .upsert(productionRecords, { onConflict: 'factory_id,year,month,category' });
      if (prodError) {
        console.error(`Error inserting production for ${factoryName}:`, prodError.message);
      } else {
        console.log(`✓ Inserted ${productionRecords.length} production records for ${factoryName}`);
        productionRecords.forEach(r => {
          console.log(`  - ${r.category}: ${r.quantity} ${r.unit}`);
        });
      }
    }
  }

  console.log('\n✅ April 2026 data import complete!');
}

insertData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
