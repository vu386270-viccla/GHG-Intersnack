/**
 * Check & Update Tuticorin (India) all years vs screenshot
 * Columns: Electricity(kWh) | Wood(kg) | Water(ignore, ×1.25) | Diesel(L) | LPG(kg)
 * Ignoring: Water, refrigerant gas
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);
const FAC_ID = '6a400f3d-059a-43e7-88ae-d5441ae7c7b5'; // Tuticorin

// EF for India
const EF = {
  electricity: 0.00071,   // tCO2e/kWh (India grid)
  wood_logs:   0.035,     // tCO2e/ton (wood pellets India)
  diesel:      0.00268,   // tCO2e/L
  lpg:         0.001716,  // tCO2e/kg
};

// Screenshot values – null = blank (skip)
// LPG in kg, Wood in kg
const SC = {
  // 2026
  '2026-3': { elec:489104, wood:132370, diesel:1051,  lpg:102  },
  '2026-2': { elec:415808, wood:119940, diesel:4170,  lpg:171  },
  '2026-1': { elec:386352, wood:112000, diesel:2471,  lpg:171  },
  // 2025
  '2025-12':{ elec:441728, wood:120100, diesel:3378,  lpg:190  },
  '2025-11':{ elec:460519, wood:130610, diesel:3093,  lpg:228  },
  '2025-10':{ elec:402480, wood:115150, diesel:5199,  lpg:152  },
  '2025-9': { elec:511273, wood:122230, diesel:4600,  lpg:171  },
  '2025-8': { elec:477934, wood:129350, diesel:2513,  lpg:171  },
  '2025-7': { elec:505101, wood:127070, diesel:3811,  lpg:247  },
  '2025-6': { elec:437910, wood:106320, diesel:4883,  lpg:152  },
  '2025-5': { elec:328209, wood: 83990, diesel:5786,  lpg:171  },
  '2025-4': { elec:411400, wood:103940, diesel:7019,  lpg:209  },
  '2025-3': { elec:472790, wood:123930, diesel:5287,  lpg:304  },
  '2025-2': { elec:401848, wood:114290, diesel:1312,  lpg:228  },
  '2025-1': { elec:301938, wood: 89060, diesel:1653,  lpg:304  },
  // 2024
  '2024-12':{ elec:236224, wood: 70660, diesel:2815,  lpg:380  },
  '2024-11':{ elec:385952, wood:130250, diesel:7586,  lpg:228  },
  '2024-10':{ elec:403920, wood:128579, diesel:6244,  lpg:304  },
  '2024-9': { elec:432624, wood:122621, diesel:6303,  lpg:228  },
  '2024-8': { elec:460528, wood:116700, diesel:3391,  lpg:228  },
  '2024-7': { elec:388800, wood: 95860, diesel:4609,  lpg:228  },
  '2024-6': { elec:446592, wood:106390, diesel:5089,  lpg:228  },
  '2024-5': { elec:492680, wood:114510, diesel:5318,  lpg:304  },
  '2024-4': { elec:467292, wood:109950, diesel:716,   lpg:228  },
  '2024-3': { elec:427056, wood:171060, diesel:1032,  lpg:228  },
  '2024-2': { elec:457616, wood:192880, diesel:2451,  lpg:304  },
  '2024-1': { elec:338784, wood:138440, diesel:2396,  lpg:228  },
  // 2023
  '2023-12':{ elec:340672, wood:114060, diesel:5255,  lpg:228  },
  '2023-11':{ elec:411376, wood:162240, diesel:10514, lpg:152  },
  '2023-10':{ elec:387450, wood:166880, diesel:3178,  lpg:228  },
  '2023-9': { elec:416273, wood:153140, diesel:4460,  lpg:152  },
  '2023-8': { elec:430064, wood:172310, diesel:6535,  lpg:152  },
  '2023-7': { elec:395680, wood:187400, diesel:7291,  lpg:304  },
  '2023-6': { elec:410810, wood:175760, diesel:2897,  lpg:228  },
  '2023-5': { elec:419159, wood:189250, diesel:3165,  lpg:228  },
  '2023-4': { elec:352107, wood:179560, diesel:1415,  lpg:152  },
  '2023-3': { elec:488191, wood:209930, diesel:1232,  lpg:285  },
  '2023-2': { elec:397057, wood:206710, diesel:2549,  lpg:228  },
  '2023-1': { elec:353110, wood:172020, diesel:1114,  lpg:228  },
  // 2022
  '2022-12':{ elec:398816, wood:181620, diesel:0,     lpg:4098 },
  '2022-11':{ elec:372916, wood:178820, diesel:0,     lpg:3419 },
  '2022-10':{ elec:301068, wood:158850, diesel:0,     lpg:5640 },
  '2022-9': { elec:391878, wood:241420, diesel:null,  lpg:2755 },
  '2022-8': { elec:377760, wood:209950, diesel:5800,  lpg:228  },
  '2022-7': { elec:341676, wood:197460, diesel:5371,  lpg:228  },
  '2022-6': { elec: 90936, wood: 80100, diesel:2532,  lpg:228  },
  '2022-5': { elec:402024, wood:216880, diesel:2528,  lpg:228  },
  '2022-4': { elec:367956, wood:199130, diesel:8515,  lpg:152  },
  '2022-3': { elec:391020, wood:220190, diesel:2100,  lpg:228  },
  '2022-2': { elec:332868, wood:198720, diesel:210,   lpg:152  },
  '2022-1': { elec:288036, wood:187980, diesel:4060,  lpg:228  },
  // 2021
  '2021-12':{ elec:383184, wood:181620, diesel:null,  lpg:304  },
  '2021-11':{ elec:386136, wood:224310, diesel:null,  lpg:190  },
  '2021-10':{ elec:398004, wood:261920, diesel:null,  lpg:228  },
  '2021-9': { elec:404769, wood:248940, diesel:null,  lpg:247  },
  '2021-8': { elec:398073, wood: 28990, diesel:null,  lpg:285  },
  '2021-7': { elec:422084, wood:null,   diesel:null,  lpg:190  },
  '2021-6': { elec:139533, wood:null,   diesel:null,  lpg:285  },
  '2021-5': { elec:193225, wood: 55730, diesel:null,  lpg:247  },
  '2021-4': { elec:377700, wood: 90770, diesel:null,  lpg:190  },
  '2021-3': { elec:385052, wood:null,   diesel:null,  lpg:304  },
  '2021-2': { elec:357753, wood:null,   diesel:null,  lpg:190  },
  '2021-1': { elec:284510, wood:null,   diesel:null,  lpg:76   },
};

const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ok  = (a, b, tol=1) => b == null || Math.abs((a||0)-b) <= tol;
const fmt = (label, a, b, tol=1) => {
  if (b == null) return null;
  const d = (a||0)-b, pct=(b>0?(d/b*100).toFixed(1):'-');
  return Math.abs(d)<=tol ? null : `${label}:❌DB=${(a||0).toFixed(0)} SC=${b} Δ=${d>=0?'+':''}${d.toFixed(0)}(${pct}%)`;
};

async function main() {
  const { data: rows } = await s
    .from('emissions_data')
    .select('year,month,category,activity_data')
    .eq('factory_id', FAC_ID)
    .limit(5000);

  const db = {};
  for (const r of rows || []) {
    const k = `${r.year}-${r.month}`;
    if (!db[k]) db[k] = {};
    db[k][r.category] = +r.activity_data;
  }

  const diffs = [];
  let pass=0, fail=0;

  console.log('\n══ Tuticorin: DB vs MIS Screenshot ══════════════════════════\n');

  for (const [key, sc] of Object.entries(SC).sort((a,b)=>b[0]<a[0]?1:-1)) {
    const [yr, mo] = key.split('-').map(Number);
    const d = db[key] || {};
    const dbE = d.electricity || 0;
    const dbW = (d.wood_logs || 0) * 1000;
    const dbD = d.diesel || 0;
    const dbL = (d.lpg || 0) * 1000;

    const issues = [
      fmt('Elec', dbE, sc.elec, 1),
      fmt('Wood(kg)', dbW, sc.wood, 2),
      fmt('Diesel', dbD, sc.diesel, 2),
      fmt('LPG(kg)', dbL, sc.lpg, 5),
    ].filter(Boolean);

    const tag = `${yr}-${MONTHS[mo]}`;
    if (issues.length === 0) {
      console.log(`✅ ${tag}`);
      pass++;
    } else {
      console.log(`❌ ${tag.padEnd(9)}: ${issues.join(' | ')}`);
      fail++;
    }

    // Queue updates
    const push = (cat, newAct, scope, unit, ef) => {
      if (newAct == null) return;
      const stored = cat==='wood_logs'||cat==='lpg' ? (d[cat]||0)*1000 : (d[cat]||0);
      if (!ok(stored, newAct, cat==='lpg'?5:cat==='wood_logs'?2:2)) {
        const actInUnit = (cat==='wood_logs'||cat==='lpg') ? newAct/1000 : newAct;
        diffs.push({ year:yr, month:mo, category:cat, newAct:actInUnit, scope, unit, ef });
      }
    };
    push('electricity', sc.elec,  'scope_2', 'kWh',   EF.electricity);
    push('wood_logs',   sc.wood,  'scope_1', 'ton',   EF.wood_logs);
    push('diesel',      sc.diesel,'scope_1', 'litre', EF.diesel);
    push('lpg',         sc.lpg,   'scope_1', 'ton',   EF.lpg);
  }

  console.log(`\n── Summary: ✅${pass} matched / ❌${fail} need fix (${diffs.length} records to update) ──\n`);

  if (diffs.length === 0) { console.log('All good!'); return; }

  // Apply updates
  let updated=0, inserted=0, errors=0;
  for (const u of diffs) {
    const newEm = +(u.newAct * u.ef).toFixed(6);
    const { data: upd, error } = await s
      .from('emissions_data')
      .update({ activity_data: u.newAct, emissions_tco2e: newEm })
      .eq('factory_id', FAC_ID).eq('year', u.year).eq('month', u.month).eq('category', u.category)
      .select('id');

    if (error) { console.log(`❌ ${u.year}-${u.month} ${u.category}: ${error.message}`); errors++; continue; }

    if (upd && upd.length > 0) {
      console.log(`✅ Updated  ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`);
      updated++;
    } else {
      const { error: ie } = await s.from('emissions_data').insert({
        factory_id: FAC_ID, year: u.year, month: u.month,
        scope: u.scope, category: u.category,
        activity_data: u.newAct, activity_unit: u.unit, emissions_tco2e: newEm,
      });
      if (ie) { console.log(`❌ Insert ${u.year}-${u.month} ${u.category}: ${ie.message}`); errors++; }
      else { console.log(`➕ Inserted ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`); inserted++; }
    }
  }

  console.log(`\n✅ Done — Updated:${updated} | Inserted:${inserted} | Errors:${errors}`);
}

main().catch(console.error);
