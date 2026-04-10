/**
 * Check & Update Long An (LA) all years vs screenshot
 * IGNORE: water supply (nước cấp visible on screen)
 * Columns: Electricity(kWh) | Wood(kg) | Water(tap-ignore) | Diesel(L) | LPG(kg)
 * NOTE: Aug/2025 diesel was incorrectly set to 1700L → must correct to 600L
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);
const FAC_ID = '7040a994-d776-410b-a429-19c0269e2697'; // Long An

const EF = {
  electricity: 0.0006592, // tCO2e/kWh VN (approx for all years)
  wood_logs:   0.028,     // tCO2e/ton
  diesel:      0.00268,   // tCO2e/L
  lpg:         0.001716,  // tCO2e/kg
};

// Screenshot: elec(kWh), wood(kg), diesel(L|null=blank|0=explicit zero), lpg(kg|null)
// null = blank in screenshot (don't update), 0 = explicitly zero
const SC = {
  // 2026
  '2026-3': { elec:363913, wood:152910, diesel:0,    lpg:0    },
  '2026-2': { elec:169589, wood: 39620, diesel:0,    lpg:0    },
  '2026-1': { elec:256171, wood: 96570, diesel:0,    lpg:0    },
  // 2025 – IMPORTANT: Aug=600L (not 1700, which was mistake)
  '2025-12':{ elec:290583, wood:111640, diesel:null, lpg:null },
  '2025-11':{ elec:395129, wood:129680, diesel:300,  lpg:null },
  '2025-10':{ elec:391671, wood:133750, diesel:300,  lpg:null },
  '2025-9': { elec:364057, wood:142300, diesel:null, lpg:null },
  '2025-8': { elec:307960, wood:113460, diesel:600,  lpg:null }, // was set to 1700 — CORRECT TO 600
  '2025-7': { elec:394250, wood:127730, diesel:null, lpg:null },
  '2025-6': { elec:387113, wood:147320, diesel:null, lpg:null },
  '2025-5': { elec:401990, wood:144340, diesel:null, lpg:null },
  '2025-4': { elec:391792, wood:140700, diesel:500,  lpg:null },
  '2025-3': { elec:383158, wood:145600, diesel:null, lpg:null },
  '2025-2': { elec:311123, wood:123200, diesel:null, lpg:null },
  '2025-1': { elec:229248, wood:105020, diesel:null, lpg:null },
  // 2024
  '2024-12':{ elec:321275, wood:153470, diesel:null, lpg:null },
  '2024-11':{ elec:327899, wood:135230, diesel:null, lpg:null },
  '2024-10':{ elec:385100, wood:143880, diesel:600,  lpg:null },
  '2024-9': { elec:316400, wood:148040, diesel:600,  lpg:null },
  '2024-8': { elec:344500, wood:135850, diesel:null, lpg:null },
  '2024-7': { elec:332400, wood:185410, diesel:null, lpg:null },
  '2024-6': { elec:346100, wood:164790, diesel:null, lpg:null },
  '2024-5': { elec:390328, wood:150170, diesel:315,  lpg:null },
  '2024-4': { elec:353400, wood:164970, diesel:null, lpg:null },
  '2024-3': { elec:376100, wood:170850, diesel:1071, lpg:null },
  '2024-2': { elec:195300, wood: 72100, diesel:191,  lpg:null },
  '2024-1': { elec:357700, wood:152130, diesel:109,  lpg:null },
  // 2023
  '2023-12':{ elec:232900, wood: 88280, diesel:null, lpg:null },
  '2023-11':{ elec:326700, wood:121070, diesel:null, lpg:null },
  '2023-10':{ elec:384700, wood:169370, diesel:null, lpg:null },
  '2023-9': { elec:368700, wood:141450, diesel:1227, lpg:null },
  '2023-8': { elec:367600, wood:141120, diesel:null, lpg:null },
  '2023-7': { elec:360600, wood:129250, diesel:null, lpg:null },
  '2023-6': { elec:null,   wood:null,   diesel:null, lpg:null }, // cut off in screenshot
  '2023-5': { elec:null,   wood:null,   diesel:null, lpg:null },
  '2023-4': { elec:null,   wood:null,   diesel:null, lpg:null },
  '2023-3': { elec:347000, wood:151810, diesel:null, lpg:null },
  '2023-2': { elec:306200, wood:148650, diesel:null, lpg:null },
  '2023-1': { elec:245300, wood: 88220, diesel:null, lpg:null },
  // 2022
  '2022-12':{ elec:331100, wood:138110, diesel:null, lpg:null },
  '2022-11':{ elec:343400, wood:130570, diesel:null, lpg:null },
  '2022-10':{ elec:316900, wood:116120, diesel:null, lpg:null },
  '2022-9': { elec:317600, wood:137620, diesel:null, lpg:null },
  '2022-8': { elec:368900, wood:153726, diesel:null, lpg:null },
  '2022-7': { elec:361900, wood:170420, diesel:null, lpg:null },
  '2022-6': { elec:358600, wood:171240, diesel:null, lpg:null },
  '2022-5': { elec:368100, wood:161680, diesel:null, lpg:null },
  '2022-4': { elec:313000, wood:129560, diesel:null, lpg:null },
  '2022-3': { elec:316600, wood: 84780, diesel:null, lpg:null },
  '2022-2': { elec:181000, wood: 40020, diesel:null, lpg:null },
  '2022-1': { elec:211600, wood: 74730, diesel:null, lpg:null },
  // 2021
  '2021-12':{ elec:247900, wood: 61840, diesel:null, lpg:null },
  '2021-11':{ elec:258800, wood:100540, diesel:null, lpg:240  },
  '2021-10':{ elec:212700, wood:116530, diesel:null, lpg:720  },
  '2021-9': { elec:186500, wood:101840, diesel:null, lpg:120  },
  '2021-8': { elec:241400, wood: 92620, diesel:null, lpg:240  },
  '2021-7': { elec:192400, wood:157800, diesel:null, lpg:840  },
  '2021-6': { elec:353800, wood:204230, diesel:null, lpg:960  },
  '2021-5': { elec:311400, wood:197730, diesel:null, lpg:960  },
  '2021-4': { elec:301100, wood:197480, diesel:null, lpg:720  },
  '2021-3': { elec:342200, wood:161090, diesel:null, lpg:960  },
  '2021-2': { elec:266000, wood:138740, diesel:null, lpg:600  },
  '2021-1': { elec:298000, wood:164860, diesel:null, lpg:984  },
};

const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ok  = (a, b, tol) => b == null || Math.abs((a||0)-b) <= tol;
const fmt = (label, a, b, tol) => {
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

  console.log('\n══ Long An: DB vs MIS Screenshot ══════════════════════════\n');

  for (const [key, sc] of Object.entries(SC).sort((a,b)=>b[0]<a[0]?1:-1)) {
    const [yr, mo] = key.split('-').map(Number);
    const d = db[key] || {};
    const dbE = d.electricity || 0;
    const dbW = (d.wood_logs || 0) * 1000;
    const dbD = d.diesel || 0;
    const dbL = (d.lpg || 0) * 1000;

    const issues = [
      fmt('Elec',    dbE, sc.elec,   1),
      fmt('Wood(kg)',dbW, sc.wood,   2),
      fmt('Diesel',  dbD, sc.diesel, 2),
      fmt('LPG(kg)', dbL, sc.lpg,   5),
    ].filter(Boolean);

    const tag = `${yr}-${MONTHS[mo]}`;
    if (issues.length===0) { console.log(`✅ ${tag}`); pass++; }
    else { console.log(`❌ ${tag.padEnd(9)}: ${issues.join(' | ')}`); fail++; }

    const push = (cat, newActRaw, scope, unit, ef, dbRaw) => {
      if (newActRaw == null) return;
      const stored = dbRaw;
      if (!ok(stored, newActRaw, cat==='lpg'?5:cat==='wood_logs'?2:2)) {
        const actInUnit = (cat==='wood_logs'||cat==='lpg') ? newActRaw/1000 : newActRaw;
        diffs.push({ year:yr, month:mo, category:cat, newAct:actInUnit, scope, unit, ef, key });
      }
    };
    push('electricity', sc.elec,   'scope_2','kWh',   EF.electricity, dbE);
    push('wood_logs',   sc.wood,   'scope_1','ton',   EF.wood_logs,   dbW);
    push('diesel',      sc.diesel, 'scope_1','litre', EF.diesel,      dbD);
    push('lpg',         sc.lpg,    'scope_1','ton',   EF.lpg,         dbL);
  }

  console.log(`\n── Summary: ✅${pass} matched / ❌${fail} need fix (${diffs.length} records) ──\n`);

  // Flag Aug/2025 diesel correction explicitly
  const aug25dsl = diffs.find(d=>d.key==='2025-8'&&d.category==='diesel');
  if (aug25dsl) console.log(`⚠️  CORRECTING Aug/2025 diesel: 1700L → 600L (previous mistake)`);

  if (diffs.length===0) { console.log('All good!'); return; }

  let updated=0, inserted=0, errors=0;
  for (const u of diffs) {
    const newEm = +(u.newAct * u.ef).toFixed(6);
    const { data: upd, error } = await s
      .from('emissions_data')
      .update({ activity_data: u.newAct, emissions_tco2e: newEm })
      .eq('factory_id', FAC_ID).eq('year', u.year).eq('month', u.month).eq('category', u.category)
      .select('id');

    if (error) { console.log(`❌ ${u.year}-${u.month} ${u.category}: ${error.message}`); errors++; continue; }
    if (upd && upd.length>0) {
      console.log(`✅ Updated  ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`);
      updated++;
    } else {
      const { error:ie } = await s.from('emissions_data').insert({
        factory_id: FAC_ID, year:u.year, month:u.month,
        scope:u.scope, category:u.category,
        activity_data:u.newAct, activity_unit:u.unit, emissions_tco2e:newEm,
      });
      if (ie) { console.log(`❌ Insert ${u.year}-${u.month} ${u.category}: ${ie.message}`); errors++; }
      else { console.log(`➕ Inserted ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`); inserted++; }
    }
  }
  console.log(`\n✅ Done — Updated:${updated} | Inserted:${inserted} | Errors:${errors}`);

  // Also update RAW_DATA.csv for Aug/2025 diesel fix
  if (aug25dsl) {
    const fs = require('fs'), path = require('path');
    const csvPath = path.join(__dirname, 'RAW_DATA.csv');
    let csv = fs.readFileSync(csvPath, 'utf8');
    const fixed = csv.replace('08-25LongAn,LongAn,Aug/25,', (m) => m); // find row
    // More targeted fix
    const lines = csv.split('\n');
    let changed=false;
    for (let i=0;i<lines.length;i++){
      if (lines[i].startsWith('08-25LongAn,') || lines[i].includes('LongAn,Aug/25,')) {
        const parts = lines[i].split(',');
        if (parts[6]==='1700.00'||parts[6]==='1700') { parts[6]='600.00'; lines[i]=parts.join(','); changed=true; }
      }
    }
    if (changed) { fs.writeFileSync(csvPath, lines.join('\n'),'utf8'); console.log(`✅ CSV: Aug/2025 LA diesel corrected to 600L`); }
    else console.log(`⚠️  CSV: Aug/2025 LA diesel row not found for auto-fix — check manually`);
  }
}

main().catch(console.error);
