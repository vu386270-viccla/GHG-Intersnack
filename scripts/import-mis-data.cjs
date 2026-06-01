const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORY_BY_SOURCE = {
  Wood: 'wood_logs',
  'Waste Water': 'wastewater',
  LPG: 'lpg',
  Diesel: 'diesel',
  R134A: 'fgas_r134a',
  R410A: 'fgas_r410a',
  R404A: 'fgas_r404a',
  'CO2 Packing': 'co2_packing',
  'CO2 PCCC': 'co2_pccc',
  Electricity: 'electricity',
};

const UNIT_BY_CATEGORY = {
  wood_logs: 'kg',
  wastewater: 'm3',
  lpg: 'kg',
  diesel: 'litre',
  fgas_r134a: 'kg',
  fgas_r410a: 'kg',
  fgas_r404a: 'kg',
  co2_packing: 'kg',
  co2_pccc: 'kg',
  electricity: 'kWh',
};

const GRID_EF = {
  Vietnam: { 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 },
  India: { 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 },
};

const EF_BY_CATEGORY = {
  Vietnam: {
    wood_logs: 0.0280,
    wastewater: 0.2013,
    lpg: 1.5710,
    diesel: 2.7000,
    fgas_r134a: 1300.0000,
    fgas_r410a: 2088.0000,
    fgas_r404a: 3920.0000,
    co2_packing: 1.0000,
    co2_pccc: 1.0000,
  },
  India: {
    wood_logs: 0.0350,
    wastewater: 0.2013,
    lpg: 1.5200,
    diesel: 2.6800,
    fgas_r134a: 1300.0000,
    fgas_r410a: 2088.0000,
    fgas_r404a: 3920.0000,
    co2_packing: 1.0000,
    co2_pccc: 1.0000,
  },
};

const SCOPE_BY_CATEGORY = { electricity: 'scope_2' };

function round4(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function plantKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function canonicalPlant(name) {
  const key = plantKey(name);
  if (key === 'phanthiet') return 'Phan Thiet';
  if (key === 'longan') return 'Long An';
  if (key === 'tayninh') return 'Tay Ninh';
  if (key === 'tuticorin') return 'Tuticorin';
  return String(name || '').trim();
}

function countryForPlant(plant) {
  return canonicalPlant(plant) === 'Tuticorin' ? 'India' : 'Vietnam';
}

function emissionFactor(category, country, year) {
  if (category === 'electricity') return GRID_EF[country]?.[year] ?? GRID_EF[country]?.[2025] ?? 0;
  return EF_BY_CATEGORY[country]?.[category] ?? 0;
}

async function fetchFactoryMap() {
  const { data, error } = await supabase.from('factories').select('id,name,code');
  if (error) throw error;
  const map = new Map();
  for (const factory of data || []) map.set(canonicalPlant(factory.name), factory.id);
  return map;
}

async function deleteExisting(years) {
  for (const year of years) {
    const { error } = await supabase
      .from('emissions_data')
      .delete()
      .eq('year', year)
      .in('scope', ['scope_1', 'scope_2']);
    if (error) throw error;
    console.log(`Deleted existing Scope 1/2 rows for ${year}`);
  }
}

async function main() {
  const jsonPath = path.join(__dirname, 'mis_data_export.json');
  if (!fs.existsSync(jsonPath)) throw new Error(`Missing ${jsonPath}. Run: python scripts/export-mis-xlsx-to-json.py`);

  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const factoryMap = await fetchFactoryMap();
  const recordMap = new Map();

  for (const row of rows) {
    const category = CATEGORY_BY_SOURCE[row.source];
    if (!category) continue;

    const plant = canonicalPlant(row.plant);
    const factoryId = factoryMap.get(plant);
    if (!factoryId) throw new Error(`No factory_id found for plant: ${row.plant}`);

    const activity = Number(row.consumption_qty) || 0;
    if (activity <= 0) continue;

    const country = countryForPlant(plant);
    const ef4 = round4(emissionFactor(category, country, Number(row.year)));

    const scope = SCOPE_BY_CATEGORY[category] || 'scope_1';
    const key = [factoryId, row.year, row.month, scope, category].join('|');
    const emission = round4((activity * ef4) / 1000);
    const existing = recordMap.get(key);
    if (existing) {
      existing.activity_data = round4(existing.activity_data + activity);
      existing.emissions_tco2e = round4(existing.emissions_tco2e + emission);
    } else {
      recordMap.set(key, {
        factory_id: factoryId,
        year: Number(row.year),
        month: Number(row.month),
        scope,
        category,
        activity_data: activity,
        activity_unit: UNIT_BY_CATEGORY[category] || row.unit,
        emissions_tco2e: emission,
        notes: `MIS activity source=${row.source}; EF 4dp=${ef4}; previous MIS 3dp=${row.mis_ef_3dp}`,
      });
    }
  }

  const records = [...recordMap.values()];
  const years = [...new Set(records.map((record) => record.year))].sort();
  await deleteExisting(years);

  const batchSize = 100;
  let inserted = 0;
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    const { error } = await supabase.from('emissions_data').upsert(batch, { onConflict: 'factory_id,year,month,scope,category' });
    if (error) throw error;
    inserted += batch.length;
    process.stdout.write(`Inserted ${inserted}/${records.length}\r`);
  }
  console.log(`\nImported ${inserted} Scope 1/2 rows from MIS using 4dp EF.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});



