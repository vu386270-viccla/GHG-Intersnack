/**
 * Import RAW DATA.csv into Supabase
 * 4 factories: PhanThiet, LongAn, TayNinh, Tuticorin
 * Data: Jan 2021 → Mar 2026
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Emission Factors
const EF = {
  wood_logs: { Vietnam: 28, India: 28 },         // 0.028 t CO2e/ton -> 28 kg CO2e/ton
  wastewater: { Vietnam: 0.2013, India: 0.2013 }, // kg CO2e / m3
  // LPG density ~ 0.54 kg/L => 1 ton = 1851.85 L
  lpg: { Vietnam: 1.571 * 1851.85, India: 1.52 * 1851.85 }, // kg CO2e / ton
  diesel: { Vietnam: 2.68, India: 2.68 },        // kg CO2e / litre
  fgas_r134a: { Vietnam: 1300, India: 1300 },    // HFC kg/kg
  fgas_r410a: { Vietnam: 2088, India: 2088 },    // HFC kg/kg
  fgas_r404a: { Vietnam: 3920, India: 3920 },    // HFC kg/kg
  co2_packing: { Vietnam: 1, India: 1 },         // CO2 kg/kg
  co2_pccc: { Vietnam: 1, India: 1 },            // CO2 kg/kg
};

// Grid EF by country & year
const GRID_EF = {
  Vietnam: { 2020: 0.8041, 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 },
  India:   { 2020: 0.7130, 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 },
};

const FACTORY_COUNTRY = {
  PhanThiet: 'Vietnam',
  LongAn: 'Vietnam',
  TayNinh: 'Vietnam',
  Tuticorin: 'India',
};

// Parse month string like "Jan/21", "Jan-21", "Jan/23"
function parseDate(dateStr) {
  const monthMap = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const parts = dateStr.replace(/[/-]/g, ' ').split(' ');
  const month = monthMap[parts[0]];
  let year = parseInt(parts[1]);
  if (year < 100) year += 2000;
  return { month, year };
}

function parseNum(val) {
  if (!val || val.trim() === '') return 0;
  // Remove quotes, commas, spaces
  return parseFloat(val.replace(/[",\s]/g, '')) || 0;
}

// Calculate emissions in tCO2e
function calcEmissions(category, activityData, country, year) {
  let ef = 0;
  switch (category) {
    case 'wood_logs':    ef = EF.wood_logs[country]; break;
    case 'wastewater':   ef = EF.wastewater[country]; break;
    case 'lpg':          ef = EF.lpg[country]; break;
    case 'diesel':       ef = EF.diesel[country]; break;
    case 'fgas_r134a':   ef = EF.fgas_r134a[country]; break;
    case 'fgas_r410a':   ef = EF.fgas_r410a[country]; break;
    case 'fgas_r404a':   ef = EF.fgas_r404a[country]; break;
    case 'co2_packing':  ef = EF.co2_packing[country]; break;
    case 'co2_pccc':     ef = EF.co2_pccc[country]; break;
    case 'electricity':
      ef = (GRID_EF[country] && GRID_EF[country][year]) || 0.7;
      break;
    default: return 0;
  }
  return (activityData * ef) / 1000; // Convert kg to tonnes
}

async function main() {
  console.log('🏭 Starting RAW DATA import...\n');

  // Step 1: Update factory names in Supabase
  const factoryUpdates = [
    { code: 'FAC-A', name: 'Phan Thiết', location: 'Bình Thuận', country: 'Vietnam' },
    { code: 'FAC-B', name: 'Long An', location: 'Long An', country: 'Vietnam' },
    { code: 'FAC-C', name: 'Tây Ninh', location: 'Tây Ninh', country: 'Vietnam' },
    { code: 'FAC-D', name: 'Tuticorin', location: 'Tamil Nadu', country: 'India' },
  ];

  for (const f of factoryUpdates) {
    const { error } = await supabase
      .from('factories')
      .update({ name: f.name, location: f.location, country: f.country })
      .eq('code', f.code);
    if (error) console.error(`  ❌ Error updating ${f.code}:`, error.message);
    else console.log(`  ✅ Updated ${f.code} → ${f.name} (${f.location}, ${f.country})`);
  }

  // Step 2: Get factory IDs
  const { data: factories } = await supabase.from('factories').select('*');
  const factoryMap = {};
  for (const f of factories) {
    if (f.code === 'FAC-A') factoryMap['PhanThiet'] = f.id;
    if (f.code === 'FAC-B') factoryMap['LongAn'] = f.id;
    if (f.code === 'FAC-C') factoryMap['TayNinh'] = f.id;
    if (f.code === 'FAC-D') factoryMap['Tuticorin'] = f.id;
  }
  console.log('\n📋 Factory IDs:', factoryMap);

  // Step 3: Parse CSV and build emissions records
  const rawCSV = require('fs').readFileSync(
    require('path').join(__dirname, 'RAW_DATA.csv'), 'utf-8'
  );

  const lines = rawCSV.split('\n').filter(l => l.trim());
  // Find the header row (starts with "MIX,Plant") and skip everything before + including it
  const headerIdx = lines.findIndex(l => l.startsWith('MIX,Plant'));
  if (headerIdx === -1) {
    console.error('❌ Could not find header row "MIX,Plant" in CSV');
    return;
  }
  console.log(`  Found header at line ${headerIdx + 1}`);
  const dataLines = lines.slice(headerIdx + 1);

  const records = [];
  let lineCount = 0;

  for (const line of dataLines) {
    // CSV parse (handle quoted fields with commas)
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      if (char === '\r') continue;
      current += char;
    }
    fields.push(current.trim());

    const plantName = fields[1];
    const dateStr = fields[2];

    if (!plantName || !dateStr || !factoryMap[plantName]) continue;

    const { month, year } = parseDate(dateStr);
    const factoryId = factoryMap[plantName];
    const country = FACTORY_COUNTRY[plantName];

    // Parse activity data columns
    const wood = parseNum(fields[3]);       // D: Firewood (ton)
    const wwts = parseNum(fields[4]);       // E: Waste Water (m³)
    const lpg = parseNum(fields[5]);        // F: LPG (ton)
    const diesel = parseNum(fields[6]);     // G: Diesel (litres)
    const r134a = parseNum(fields[7]);      // H: R134A (kg)
    const r410a = parseNum(fields[8]);      // I: R410A (kg)
    const r404a = parseNum(fields[9]);      // J: R404A (kg)
    const co2Pack = parseNum(fields[10]);   // K: CO2 @ Packing (kg)
    const co2Pccc = parseNum(fields[11]);   // L: CO2 @ PCCC (kg)
    const electricity = parseNum(fields[12]); // M: Electricity (kWh)

    // Build Scope 1 records
    const scope1Items = [
      { category: 'wood_logs', data: wood, unit: 'ton' },
      { category: 'wastewater', data: wwts, unit: 'm3' },
      { category: 'lpg', data: lpg, unit: 'ton' },
      { category: 'diesel', data: diesel, unit: 'litre' },
      { category: 'fgas_r134a', data: r134a, unit: 'kg' },
      { category: 'fgas_r410a', data: r410a, unit: 'kg' },
      { category: 'fgas_r404a', data: r404a, unit: 'kg' },
      { category: 'co2_packing', data: co2Pack, unit: 'kg' },
      { category: 'co2_pccc', data: co2Pccc, unit: 'kg' },
    ];

    for (const item of scope1Items) {
      if (item.data > 0) {
        records.push({
          factory_id: factoryId,
          year,
          month,
          scope: 'scope_1',
          category: item.category,
          activity_data: item.data,
          activity_unit: item.unit,
          emissions_tco2e: Math.round(calcEmissions(item.category, item.data, country, year) * 10000) / 10000,
        });
      }
    }

    // Scope 2: Electricity
    if (electricity > 0) {
      records.push({
        factory_id: factoryId,
        year,
        month,
        scope: 'scope_2',
        category: 'electricity',
        activity_data: electricity,
        activity_unit: 'kWh',
        emissions_tco2e: Math.round(calcEmissions('electricity', electricity, country, year) * 10000) / 10000,
      });
    }

    lineCount++;
  }

  console.log(`\n📊 Parsed ${lineCount} data rows → ${records.length} emission records`);

  // Step 4: Upsert into Supabase (batch of 50)
  let inserted = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('emissions_data')
      .upsert(batch, {
        onConflict: 'factory_id,year,month,scope,category',
      });

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`  ✅ Imported ${inserted}/${records.length} records\r`);
    }
  }

  console.log(`\n\n🎉 Import complete!`);
  console.log(`  ✅ Inserted: ${inserted}`);
  if (errors > 0) console.log(`  ❌ Errors: ${errors}`);

  // Step 5: Summary
  const { data: summary } = await supabase
    .from('emissions_data')
    .select('scope, factory_id')
    .limit(1000);

  if (summary) {
    const scopeCounts = {};
    for (const r of summary) {
      scopeCounts[r.scope] = (scopeCounts[r.scope] || 0) + 1;
    }
    console.log('\n📈 Records by scope:', scopeCounts);
  }
}

main().catch(console.error);
