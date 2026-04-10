/**
 * Check Phan Thiet DB data by year vs screenshot values
 * Screenshot columns: Electricity | Wood | Water | Diesel | LPG | Total
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

// PHAN THIET factory ID
const FAC_ID = '0a586cb1-60e9-4d36-8073-ddc002c88c0d';

// Screenshot values (from user's image) — ACTIVITY DATA per year
// Columns visible: Electricity(kWh) | Wood(?) | Water(?) | Diesel(L) | LPG | Total
const SCREENSHOT = {
  2026: { elec: 2130,   wood: 732479,    water: 296710,    diesel: 2664,   lpg: 216  },
  2025: { elec: 10911,  wood: 3811742,   water: 1604128,   diesel: 13646,  lpg: 1007 },
  2024: { elec: 8557,   wood: 3053582,   water: 1244630,   diesel: 10701,  lpg: 990  },
  2023: { elec: 9331,   wood: 3968131,   water: 1461140,   diesel: 11670,  lpg: 6840 },
  2022: { elec: 10284,  wood: 3969224,   water: 1788753,   diesel: 12863,  lpg: 8242 },
  2021: { elec: null,   wood: 3154232,   water: 1601712,   diesel: null,   lpg: 5283 },
};

async function main() {
  const { data: rows } = await s
    .from('emissions_data')
    .select('year,scope,category,activity_data,activity_unit,emissions_tco2e')
    .eq('factory_id', FAC_ID)
    .limit(5000);

  // Group by year → category → sum activity
  const byYear = {};
  for (const r of rows || []) {
    if (!byYear[r.year]) byYear[r.year] = {};
    const bc = byYear[r.year];
    if (!bc[r.category]) bc[r.category] = { act: 0, em: 0, unit: r.activity_unit };
    bc[r.category].act += Number(r.activity_data);
    bc[r.category].em  += Number(r.emissions_tco2e);
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(' PHAN THIET — DB activity data vs Screenshot (by year)');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(' NOTE: Checking which columns in screenshot map to which DB categories');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const years = [2021, 2022, 2023, 2024, 2025, 2026];

  for (const yr of years) {
    const db  = byYear[yr] || {};
    const sc  = SCREENSHOT[yr] || {};

    const dbElec   = db.electricity?.act  || 0;
    const dbWood   = db.wood_logs?.act    || 0;  // in tons
    const dbWater  = db.wastewater?.act   || 0;  // in m3
    const dbDiesel = db.diesel?.act       || 0;  // in litres
    const dbLPG    = db.lpg?.act          || 0;  // in tons
    const dbCO2Pk  = db.co2_packing?.act  || 0;
    const dbCO2PC  = db.co2_pccc?.act     || 0;

    // Try different unit mappings to find which matches screenshot
    const chk = (label, dbVal, scVal, unit) => {
      if (scVal == null) return `  ${label.padEnd(18)} DB=${dbVal.toFixed(2).padStart(12)} ${unit} | Screenshot=N/A`;
      const diff = dbVal - scVal;
      const flag = Math.abs(diff) < 1 ? '✅' : Math.abs(diff/Math.max(scVal,1)) < 0.01 ? '⚠️' : '❌';
      return `  ${label.padEnd(18)} DB=${dbVal.toFixed(2).padStart(12)} ${unit} | SC=${scVal.toFixed(0).padStart(12)} | diff=${diff >= 0 ? '+' : ''}${diff.toFixed(1)} ${flag}`;
    };

    console.log(`┌── Year ${yr} ${'─'.repeat(52)}`);
    console.log(chk('Electricity(kWh)', dbElec,        sc.elec,  'kWh'));
    console.log(chk('Wood(ton)',         dbWood,        sc.wood   != null ? sc.wood/1000 : null, 'ton → SC÷1000'));
    console.log(chk('Wood(kg=ton×1000)', dbWood*1000,  sc.wood,  'kg'));
    console.log(chk('Water(m3)',         dbWater,       sc.water  != null ? sc.water/1000 : null, 'm3 → SC÷1000'));
    console.log(chk('Water(litre/100)',  dbWater*100,   sc.water, 'm3×100'));
    console.log(chk('Diesel(L)',         dbDiesel,      sc.diesel != null ? sc.diesel/1000 : null, 'L → SC÷1000'));
    console.log(chk('Diesel(L×1000)',    dbDiesel*1000, sc.diesel,'L×1000'));
    console.log(chk('LPG(ton)',          dbLPG,         sc.lpg    != null ? sc.lpg/1000 : null,   'ton → SC÷1000'));
    console.log(chk('LPG(kg=ton×1000)', dbLPG*1000,    sc.lpg,   'kg'));
    console.log(`└${'─'.repeat(60)}\n`);
  }

  // Also show Scope 1 emissions totals to compare with MIS
  console.log('\n── Scope 1 Emissions by year (from DB) ──');
  console.log(`${'Year'.padEnd(6)} ${'Wood(kgCO2)'.padStart(14)} ${'Diesel'.padStart(10)} ${'WWTS'.padStart(10)} ${'LPG'.padStart(8)} ${'Total S1'.padStart(12)}`);
  for (const yr of years) {
    const db  = byYear[yr] || {};
    const s1cats = ['wood_logs','diesel','wastewater','lpg','fgas_r134a','fgas_r410a','fgas_r404a','co2_packing','co2_pccc'];
    const s1 = s1cats.reduce((sum, c) => sum + (db[c]?.em || 0), 0) * 1000;
    const wood = (db.wood_logs?.em || 0) * 1000;
    const diesel = (db.diesel?.em || 0) * 1000;
    const wwts = (db.wastewater?.em || 0) * 1000;
    const lpg = (db.lpg?.em || 0) * 1000;
    console.log(`${yr}   ${wood.toFixed(0).padStart(14)} ${diesel.toFixed(0).padStart(10)} ${wwts.toFixed(0).padStart(10)} ${lpg.toFixed(0).padStart(8)} ${s1.toFixed(0).padStart(12)}`);
  }
}

main().catch(console.error);
