import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dbPath = path.join(__dirname, '..', 'ghg.db');
const jsonPath = path.join(__dirname, 'mis_data_export.json');
const csvPath = path.join(__dirname, 'RAW_DATA.csv');

const FACTORY_ID = '7040a994-d776-410b-a429-19c0269e2697'; // Long An
const YEAR = 2026;
const MONTH = 5;

// Emission Factors (Vietnam)
const EF = {
  electricity: 0.6592, // kg CO2e / kWh
  wastewater: 0.2013,  // kg CO2e / m3
  diesel: 2.7,         // kg CO2e / litre
  wood_logs: 0.028,    // kg CO2e / kg (28 kg / ton)
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function run() {
  console.log('🏁 Starting May 2026 Long An Data Import...\n');

  // 1. UPDATE SQLITE DATABASE
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ SQLite database not found at ${dbPath}`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  console.log(`📂 Opened local SQLite database at: ${dbPath}`);

  // Prepare May 2026 Emissions Data
  // Note: Firewood củi = 114.570 tons = 114570 kg
  const emissions = [
    {
      category: 'electricity',
      scope: 'scope_2',
      activity_data: 279297,
      unit: 'kWh',
      ef: EF.electricity,
      notes: 'MIS activity source=Electricity; EF 4dp=0.6592; previous MIS 3dp=0.659',
    },
    {
      category: 'wastewater',
      scope: 'scope_1',
      activity_data: 835.8,
      unit: 'm3',
      ef: EF.wastewater,
      notes: 'MIS activity source=Waste Water; EF 4dp=0.2013; previous MIS 3dp=0.201',
    },
    {
      category: 'diesel',
      scope: 'scope_1',
      activity_data: 40,
      unit: 'litre',
      ef: EF.diesel,
      notes: 'MIS activity source=Diesel; EF 4dp=2.7; previous MIS 3dp=2.7',
    },
    {
      category: 'wood_logs',
      scope: 'scope_1',
      activity_data: 114570,
      unit: 'kg',
      ef: EF.wood_logs,
      notes: 'MIS activity source=Wood; EF 4dp=0.028; previous MIS 3dp=0.028',
    },
  ];

  console.log('Inserting/updating emissions data in SQLite...');
  const upsertEmission = db.prepare(`
    INSERT INTO emissions_data (id, factory_id, year, month, scope, category, activity_data, activity_unit, emissions_tco2e, cost_usd, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(factory_id, year, month, scope, category)
    DO UPDATE SET 
      activity_data = excluded.activity_data, 
      emissions_tco2e = excluded.emissions_tco2e, 
      notes = excluded.notes, 
      updated_at = CURRENT_TIMESTAMP
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const e of emissions) {
      const emissionsTco2e = Math.round((e.activity_data * e.ef / 1000) * 10000) / 10000;
      const uuid = generateUUID();
      upsertEmission.run(
        uuid,
        FACTORY_ID,
        YEAR,
        MONTH,
        e.scope,
        e.category,
        e.activity_data,
        e.unit,
        emissionsTco2e,
        0, // cost_usd
        e.notes
      );
      console.log(`  ✓ ${e.category} (${e.scope}): ${e.activity_data} ${e.unit} = ${emissionsTco2e} tCO2e`);
    }
    db.exec('COMMIT');
    console.log('✅ SQLite emissions data updated.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Failed to update SQLite emissions:', err.message);
  }

  // Prepare May 2026 Production Data
  // Note: RCN = 1252851 kg = 1252.851 MT, CK = 322.5 tons = 322500 kg (stored in kg but unit is MT)
  const production = [
    { category: 'rcn_input', quantity: 1252.851, unit: 'MT' },
    { category: 'ck_output', quantity: 322500, unit: 'MT' },
  ];

  console.log('Inserting/updating production data in SQLite...');
  const upsertProduction = db.prepare(`
    INSERT INTO production_data (id, factory_id, year, month, category, quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(factory_id, year, month, category)
    DO UPDATE SET 
      quantity = excluded.quantity, 
      unit = excluded.unit, 
      updated_at = CURRENT_TIMESTAMP
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const p of production) {
      const uuid = generateUUID();
      upsertProduction.run(
        uuid,
        FACTORY_ID,
        YEAR,
        MONTH,
        p.category,
        p.quantity,
        p.unit
      );
      console.log(`  ✓ ${p.category}: ${p.quantity} ${p.unit}`);
    }
    db.exec('COMMIT');
    console.log('✅ SQLite production data updated.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Failed to update SQLite production:', err.message);
  }

  // 2. UPDATE mis_data_export.json
  if (fs.existsSync(jsonPath)) {
    console.log(`\nUpdating ${jsonPath}...`);
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const rows = JSON.parse(jsonContent);

    // Update wastewater
    const wwIdx = rows.findIndex(r => r.year === YEAR && r.month === MONTH && r.plant === 'Long An' && r.source === 'Waste Water');
    if (wwIdx !== -1) {
      rows[wwIdx].consumption_qty = 835.8;
      rows[wwIdx].mis_emission_kg = Math.round(835.8 * 0.201 * 1000) / 1000;
      console.log(`  ✓ Updated Waste Water row in JSON`);
    } else {
      rows.push({
        year: YEAR,
        month: MONTH,
        plant: 'Long An',
        scope: 'Scope 1',
        process: 'WWTS',
        source: 'Waste Water',
        unit: 'cubic metres',
        consumption_qty: 835.8,
        mis_ef_3dp: 0.201,
        mis_emission_kg: Math.round(835.8 * 0.201 * 1000) / 1000
      });
      console.log(`  + Added Waste Water row to JSON`);
    }

    // Upsert Electricity
    const elecIdx = rows.findIndex(r => r.year === YEAR && r.month === MONTH && r.plant === 'Long An' && r.source === 'Electricity');
    const elecRow = {
      year: YEAR,
      month: MONTH,
      plant: 'Long An',
      scope: 'Scope 2',
      process: 'Grid Electricity',
      source: 'Electricity',
      unit: 'kWh',
      consumption_qty: 279297,
      mis_ef_3dp: 0.659,
      mis_emission_kg: Math.round(279297 * 0.659 * 1000) / 1000
    };
    if (elecIdx !== -1) {
      rows[elecIdx] = elecRow;
      console.log(`  ✓ Updated Electricity row in JSON`);
    } else {
      rows.push(elecRow);
      console.log(`  + Added Electricity row to JSON`);
    }

    // Upsert Wood
    const woodIdx = rows.findIndex(r => r.year === YEAR && r.month === MONTH && r.plant === 'Long An' && r.source === 'Wood');
    const woodRow = {
      year: YEAR,
      month: MONTH,
      plant: 'Long An',
      scope: 'Scope 1',
      process: 'Boiler',
      source: 'Wood',
      unit: 'kg',
      consumption_qty: 114570,
      mis_ef_3dp: 0.028,
      mis_emission_kg: Math.round(114570 * 0.028 * 1000) / 1000
    };
    if (woodIdx !== -1) {
      rows[woodIdx] = woodRow;
      console.log(`  ✓ Updated Wood row in JSON`);
    } else {
      rows.push(woodRow);
      console.log(`  + Added Wood row to JSON`);
    }

    // Upsert Diesel
    const dieselIdx = rows.findIndex(r => r.year === YEAR && r.month === MONTH && r.plant === 'Long An' && r.source === 'Diesel');
    const dieselRow = {
      year: YEAR,
      month: MONTH,
      plant: 'Long An',
      scope: 'Scope 1',
      process: 'Generator / Company Car',
      source: 'Diesel',
      unit: 'litre',
      consumption_qty: 40,
      mis_ef_3dp: 2.7,
      mis_emission_kg: Math.round(40 * 2.7 * 1000) / 1000
    };
    if (dieselIdx !== -1) {
      rows[dieselIdx] = dieselRow;
      console.log(`  ✓ Updated Diesel row in JSON`);
    } else {
      rows.push(dieselRow);
      console.log(`  + Added Diesel row to JSON`);
    }

    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`✅ Saved ${jsonPath}.`);
  } else {
    console.warn(`⚠️ Warning: ${jsonPath} not found!`);
  }

  // 3. UPDATE RAW_DATA.csv
  if (fs.existsSync(csvPath)) {
    console.log(`\nUpdating ${csvPath}...`);
    let csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Check if May 2026 Long An row already exists in CSV
    const idx = lines.findIndex(l => l.startsWith('05-26LongAn,') || l.includes('LongAn,May/26,'));

    // Generate CSV line
    // Format: MIX,Plant,Date,Firewood,Waste Water,LPG,Diesel,R134A,R410A,R404A,Co2 @ Packing,Co2 @ PCCC,Electricity,Production (MTs),CK,,
    // May/26: Firewood = 114.57 (tons), Wastewater = 835.80, Diesel = 40.00, Electricity = 279297.00, RCN = " 1,252.851 ", CK = " 322,500 "
    const newCsvLine = `05-26LongAn,LongAn,May/26,114.57,835.80,,40.00,,,,,279297.00," 1,252.851 "," 322,500 ",,`;

    if (idx !== -1) {
      lines[idx] = newCsvLine;
      console.log(`  ✓ Updated existing May/26 Long An row in CSV`);
    } else {
      // Find the place to insert it (chronologically after 04-26 or at the end of the 2026 block)
      let insertIdx = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('LongAn') && lines[i].includes('/26')) {
          insertIdx = i + 1;
          break;
        }
      }
      lines.splice(insertIdx, 0, newCsvLine);
      console.log(`  + Inserted May/26 Long An row to CSV at line ${insertIdx + 1}`);
    }

    fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
    console.log(`✅ Saved ${csvPath}.`);
  } else {
    console.warn(`⚠️ Warning: ${csvPath} not found!`);
  }

  console.log('\n🎉 May 2026 Long An data import successfully completed!');
}

run().catch(console.error);
