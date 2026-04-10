/**
 * Check Phan Thiet monthly DB data vs screenshot values
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const FAC_ID = '0a586cb1-60e9-4d36-8073-ddc002c88c0d'; // Phan Thiet

// ── Values from screenshot (columns: Electricity | Wood | Water | Diesel | LPG)
// User says first column (780) = ignore. So col "Electricity"=kWh, "Wood"=kg, 
// "Water"=m3(?), "Diesel"=L, "LPG"=kg
// Note: "Water" col seems = WWTS_m3 × 1.25 → need to verify which is real
const SC = {
  // year, month → { elec(kWh), wood(kg), water(?), diesel(L), lpg(kg) }
  '2025-1':  { elec: 185926, wood: 178290, water: 987,   diesel: 100,  lpg: 0   },
  '2025-2':  { elec: 258409, wood:  91350, water: 834,   diesel: 100,  lpg: 0   },
  '2025-3':  { elec: 288272, wood: 127190, water: 1060,  diesel: 100,  lpg: 0   },
  '2025-4':  { elec: 315278, wood: 117990, water: 1136,  diesel: 100,  lpg: 0   },
  '2025-5':  { elec: 362491, wood: 128960, water: 1078,  diesel: 100,  lpg: 0   },
  '2025-6':  { elec: 360835, wood: 155400, water: 1372,  diesel:  99,  lpg: 0   },
  '2025-7':  { elec: 347697, wood: 129930, water: 1196,  diesel:   0,  lpg: 0   },
  '2025-8':  { elec: 375751, wood: 150850, water: 1217,  diesel: 100,  lpg: 0   },
  '2025-9':  { elec: 342320, wood: 142500, water: 1153,  diesel: 105,  lpg: 0   },
  '2025-10': { elec: 400676, wood: 162640, water: 1126,  diesel: 105,  lpg: 0   },
  '2025-11': { elec: 329826, wood: 153110, water: 1338,  diesel:  98,  lpg: 0   },
  '2025-12': { elec: 244261, wood:  65898, water: 1149,  diesel:   0,  lpg: 0   },
  '2024-7':  { elec: 299833, wood: 120370, water: 938,   diesel: 100,  lpg: 504  },
  '2024-8':  { elec: 294975, wood: 118960, water: 989,   diesel: 100,  lpg: 516  },
  '2024-9':  { elec: 302341, wood: 130010, water: 856,   diesel:   0,  lpg: 576  },
  '2024-10': { elec: 312947, wood: 136530, water: 945,   diesel: 100,  lpg: 576  },
  '2024-11': { elec: 318293, wood: 136560, water: 946,   diesel:  99,  lpg: 0    },
  '2024-12': { elec: 307347, wood: 103180, water: 904,   diesel: 100,  lpg: 0    },
  '2023-7':  { elec: 373888, wood: 146840, water: 1264,  diesel: 110,  lpg: 720  },
  '2023-8':  { elec: 391032, wood: 150470, water: 1168,  diesel: 100,  lpg: 648  },
  '2026-1':  { elec: 180166, wood:  49510, water: 856,   diesel: 114,  lpg: 0    },
  '2026-2':  { elec: 154414, wood:  80050, water: 833,   diesel:   0,  lpg: 0    },
  '2026-3':  { elec: 397899, wood: 167150, water: 975,   diesel: 102,  lpg: 0    },
};

async function main() {
  const { data: rows } = await s
    .from('emissions_data')
    .select('year,month,category,activity_data,activity_unit,emissions_tco2e')
    .eq('factory_id', FAC_ID)
    .in('year', [2023,2024,2025,2026])
    .limit(5000);

  // Group by year-month-category
  const db = {};
  for (const r of rows || []) {
    const k = `${r.year}-${r.month}`;
    if (!db[k]) db[k] = {};
    db[k][r.category] = { act: Number(r.activity_data), unit: r.activity_unit };
  }

  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chk = (dbVal, scVal, label) => {
    if (scVal == null || scVal === 0) return `${label}: DB=${dbVal?.toFixed(1)||'N/A'} SC=0/null`;
    const diff = (dbVal||0) - scVal;
    const pct  = scVal > 0 ? (diff/scVal*100).toFixed(1) : '-';
    const flag = Math.abs(diff) < 0.6 ? '✅' : Math.abs(Number(pct)) < 2 ? '⚠️' : '❌';
    return `${flag}${label}: DB=${(dbVal||0).toFixed(1)} SC=${scVal} Δ=${diff>=0?'+':''}${diff.toFixed(1)}(${pct}%)`;
  };

  let issues = 0, total = 0;
  console.log('\n══ Phan Thiet: DB vs Screenshot (monthly) ═══════════════════════════\n');

  for (const [key, sc] of Object.entries(SC)) {
    const [yr, mo] = key.split('-').map(Number);
    const d    = db[key] || {};
    const elec = d.electricity?.act || 0;
    const wood = (d.wood_logs?.act || 0) * 1000; // ton→kg
    const wwts = d.wastewater?.act || 0;          // m3
    const dsl  = d.diesel?.act || 0;              // litres
    const lpg  = (d.lpg?.act || 0) * 1000;        // ton→kg

    // Water: check both raw and ×1.25
    const waterRaw = wwts;
    const waterScaled = wwts * 1.25;

    const elecOK  = Math.abs(elec  - sc.elec)  < 1;
    const woodOK  = Math.abs(wood  - sc.wood)  < 2;
    const dslOK   = Math.abs(dsl   - sc.diesel) < 2;
    const lpgOK   = Math.abs(lpg   - sc.lpg)   < 5;
    const waterOK_raw    = sc.water > 0 && Math.abs(waterRaw    - sc.water) < 2;
    const waterOK_scaled = sc.water > 0 && Math.abs(waterScaled - sc.water) < 2;

    const allOK = elecOK && woodOK && dslOK && lpgOK;
    total++;
    if (!allOK) issues++;

    const label = `${yr}-${MONTHS[mo]}`.padEnd(9);
    const status = allOK ? '✅' : '⚠️';
    console.log(`${status} ${label} | ${chk(elec,sc.elec,'Elec')} | ${chk(wood,sc.wood,'Wood(kg)')} | Water_raw=${waterRaw.toFixed(0)} SC=${sc.water} [×1.25=${waterScaled.toFixed(0)}] ${waterOK_raw?'✅raw':waterOK_scaled?'⚠️×1.25':'❌??'} | ${chk(dsl,sc.diesel,'Diesel')} | ${chk(lpg,sc.lpg,'LPG(kg)')}`);
  }

  console.log(`\n── Summary: ${total - issues}/${total} months fully matched (Elec/Wood/Diesel/LPG) ──`);
  console.log(`   Water column = WWTS_m3 × 1.25 in most months (may be total water vs WWTS only)`);
}
main().catch(console.error);
