/**
 * Update TN discrepancies in Supabase DB + RAW_DATA.csv
 * Changes:
 *   Sep/2025 electricity:  383388  → 385388 kWh
 *   Jan/2025 electricity:  296900  → 296952 kWh
 *   Jan/2025 wood_logs:    146.50  → 146.55 ton
 *   May/2024 diesel:       1130    → 1170   L
 *   Jan/2024 diesel:       1120    → 1520   L
 */
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const s      = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);
const FAC_ID = '041d71b2-f002-438d-b711-3f6195f0c4e5'; // Tay Ninh

// Emission factors (consistent with calc_emissions.js)
const EF = {
  electricity: 0.0006592, // tCO2e/kWh VN (all years for now)
  wood_logs:   0.028,     // tCO2e/ton  VN
  diesel:      0.00268,   // tCO2e/L    VN
};

const UPDATES = [
  // { year, month, category, newActivity, unit }
  { year:2025, month:9,  category:'electricity', newAct:385388,  unit:'kWh',   ef: EF.electricity },
  { year:2025, month:1,  category:'electricity', newAct:296952,  unit:'kWh',   ef: EF.electricity },
  { year:2025, month:1,  category:'wood_logs',   newAct:146.55,  unit:'ton',   ef: EF.wood_logs   },
  { year:2024, month:5,  category:'diesel',      newAct:1170,    unit:'litre', ef: EF.diesel      },
  { year:2024, month:1,  category:'diesel',      newAct:1520,    unit:'litre', ef: EF.diesel      },
];

async function updateDB() {
  console.log('\n── Updating Supabase DB ──────────────────────────────');
  for (const u of UPDATES) {
    const newEm = +(u.newAct * u.ef).toFixed(6);
    const { data, error } = await s
      .from('emissions_data')
      .update({ activity_data: u.newAct, emissions_tco2e: newEm })
      .eq('factory_id', FAC_ID)
      .eq('year', u.year)
      .eq('month', u.month)
      .eq('category', u.category)
      .select('id, activity_data, emissions_tco2e');

    if (error) {
      console.log(`❌ ${u.year}-${u.month} ${u.category}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log(`⚠️  ${u.year}-${u.month} ${u.category}: no row found`);
    } else {
      console.log(`✅ ${u.year}-${String(u.month).padStart(2,'0')} ${u.category.padEnd(12)}: activity=${u.newAct} | emissions=${newEm} tCO2e`);
    }
  }
}

function updateCSV() {
  console.log('\n── Updating RAW_DATA.csv ────────────────────────────');
  const csvPath = path.join(__dirname, 'RAW_DATA.csv');
  let csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split('\n');

  // CSV column indices (0-based): ID,Plant,Date,Firewood,WWTS,LPG,Diesel,...,Electricity,...
  // Col 0=ID,1=Plant,2=Date,3=Firewood(ton),4=WWTS(m3),5=LPG(ton),6=Diesel(L),7=R134A,8=R410A,9=R404A,10=CO2@Packing,11=CO2@PCCC,12=Electricity,...
  const COL = { firewood:3, wwts:4, lpg:5, diesel:6, electricity:12 };

  const changes = [
    { id:'09-25TayNinh', col: COL.electricity, val:'383388.00',  newVal:'385388.00' },
    { id:'01-25TayNinh', col: COL.electricity, val:'296900.00',  newVal:'296952.00' },
    { id:'01-25TayNinh', col: COL.firewood,    val:'146.50',     newVal:'146.55'    },
    { id:'05-24TayNinh', col: COL.diesel,       val:'1130.00',    newVal:'1170.00'   },
    { id:'01-24TayNinh', col: COL.diesel,       val:'1120.00',    newVal:'1520.00'   },
  ];

  let updated = 0;
  for (let i = 0; i < lines.length; i++) {
    for (const c of changes) {
      if (lines[i].startsWith(c.id + ',')) {
        const parts = lines[i].split(',');
        if (parts[c.col] === c.val) {
          parts[c.col] = c.newVal;
          lines[i] = parts.join(',');
          console.log(`✅ Line ${i+1} [${c.id}] col ${c.col}: ${c.val} → ${c.newVal}`);
          updated++;
        } else {
          // Try trimmed match
          const cur = (parts[c.col]||'').trim().replace(/"/g,'');
          console.log(`⚠️  Line ${i+1} [${c.id}] col ${c.col}: found "${cur}" expected "${c.val}" — manual check needed`);
        }
      }
    }
  }

  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
  console.log(`\n   Saved CSV — ${updated} cells updated.`);
}

async function main() {
  await updateDB();
  updateCSV();
  console.log('\n✅ Done! All updates applied.');
}

main().catch(console.error);
