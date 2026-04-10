/**
 * Check & Update Tay Ninh 2021-2023 data vs screenshot
 * Ignoring: Water (×1.25 factor), refrigerant gas (known missing)
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);
const FAC_ID = '041d71b2-f002-438d-b711-3f6195f0c4e5';

const EF = { electricity: 0.0006592, wood_logs: 0.028, diesel: 0.00268, lpg: 0.001716 };

// Screenshot values: Electricity(kWh) | Wood(kg) | Diesel(L) | LPG(kg)
// null = blank in screenshot (skip update)
const SC = {
  '2023-7': { elec:503700, wood:212370, diesel:1780, lpg:552  },
  '2023-6': { elec:497400, wood:187090, diesel:1152, lpg:852  },
  '2023-5': { elec:472500, wood:131750, diesel:1620, lpg:696  },
  '2023-4': { elec:439800, wood:183560, diesel:1540, lpg:864  },
  '2023-3': { elec:479900, wood:177520, diesel:2220, lpg:792  },
  '2023-2': { elec:424700, wood:134300, diesel:1930, lpg:552  },
  '2023-1': { elec:281200, wood:107820, diesel:1100, lpg:861  },
  '2022-12':{ elec:403045, wood:180900, diesel:null, lpg:660  },
  '2022-11':{ elec:379815, wood:132050, diesel:null, lpg:828  },
  '2022-10':{ elec:411631, wood:125290, diesel:null, lpg:1292 },
  '2022-9': { elec:468449, wood:109110, diesel:null, lpg:1464 },
  '2022-8': { elec:424880, wood:152890, diesel:null, lpg:1613 },
  '2022-7': { elec:397882, wood:139950, diesel:null, lpg:1960 },
  '2022-6': { elec:469412, wood:181220, diesel:null, lpg:1005 },
  '2022-5': { elec:397773, wood:132000, diesel:null, lpg:1437 },
  '2022-4': { elec:382847, wood:119770, diesel:null, lpg:1211 },
  '2022-3': { elec:308218, wood:160380, diesel:null, lpg:1281 },
  '2022-2': { elec:357553, wood: 93850, diesel:null, lpg: 769 },
  '2022-1': { elec:290319, wood:102840, diesel:null, lpg:1001 },
  '2021-12':{ elec:326344, wood:100710, diesel:null, lpg:1330 },
  '2021-11':{ elec:308277, wood:106350, diesel:null, lpg: 833 },
  '2021-10':{ elec:313049, wood:110770, diesel:null, lpg: 724 },
  '2021-9': { elec:136034, wood:  null, diesel:null, lpg: 167 },
  '2021-8': { elec: 41882, wood: 41160, diesel:null, lpg: 328 },
  '2021-7': { elec:310213, wood: 90720, diesel:null, lpg:1021 },
  '2021-6': { elec:340153, wood: 86000, diesel:null, lpg:1257 },
  '2021-5': { elec:345830, wood:151710, diesel:null, lpg:1168 },
  '2021-4': { elec:370956, wood:156290, diesel:null, lpg:1570 },
  '2021-3': { elec:325645, wood:121360, diesel:null, lpg:1234 },
  '2021-2': { elec:238306, wood: 93420, diesel:null, lpg:1051 },
  '2021-1': { elec:281162, wood:129960, diesel:null, lpg:1369 },
};

const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function main() {
  const { data: rows } = await s
    .from('emissions_data')
    .select('year,month,category,activity_data,activity_unit,emissions_tco2e')
    .eq('factory_id', FAC_ID)
    .in('year', [2021,2022,2023])
    .limit(5000);

  const db = {};
  for (const r of rows || []) {
    const k = `${r.year}-${r.month}`;
    if (!db[k]) db[k] = {};
    db[k][r.category] = +r.activity_data;
  }

  const diffs = []; // items needing update

  console.log('\n══ Tay Ninh 2021-2023: DB vs Screenshot ════════════════════\n');
  const ok  = (a, b, tol=1) => b == null || Math.abs((a||0)-b) <= tol;
  const fmt = (a, b, tol=1) => {
    if (b == null) return `–`;
    const dbV = a||0;
    const diff= dbV - b;
    const pct = b>0?(diff/b*100).toFixed(1):'-';
    return Math.abs(diff)<=tol ? `✅${dbV}` : `❌DB=${dbV} SC=${b} Δ=${diff>=0?'+':''}${diff.toFixed(0)}(${pct}%)`;
  };

  for (const [key, sc] of Object.entries(SC).sort((a,b)=>a[0]<b[0]?1:-1)) {
    const [yr, mo] = key.split('-').map(Number);
    const d = db[key] || {};
    const dbElec = d.electricity || 0;
    const dbWood = (d.wood_logs || 0) * 1000;
    const dbDsl  = d.diesel || 0;
    const dbLPG  = (d.lpg || 0) * 1000;

    const elecOK = ok(dbElec, sc.elec, 1);
    const woodOK = ok(dbWood, sc.wood, 2);
    const dslOK  = ok(dbDsl,  sc.diesel, 2);
    const lpgOK  = ok(dbLPG,  sc.lpg, 5);
    const allOK  = elecOK && woodOK && dslOK && lpgOK;

    const tag = `${yr}-${MONTHS[mo]}`;
    console.log(`${allOK?'✅':'❌'} ${tag.padEnd(9)}: Elec:${fmt(dbElec,sc.elec)} | Wood:${fmt(dbWood,sc.wood,2)} | Diesel:${fmt(dbDsl,sc.diesel,2)} | LPG:${fmt(dbLPG,sc.lpg,5)}`);

    // Queue fixes
    if (!elecOK && sc.elec != null) diffs.push({ year:yr, month:mo, category:'electricity', newAct:sc.elec, scope:'scope_2', unit:'kWh', ef:EF.electricity });
    if (!woodOK && sc.wood != null) diffs.push({ year:yr, month:mo, category:'wood_logs',   newAct:sc.wood/1000, scope:'scope_1', unit:'ton', ef:EF.wood_logs });
    if (!dslOK  && sc.diesel!=null) diffs.push({ year:yr, month:mo, category:'diesel',       newAct:sc.diesel, scope:'scope_1', unit:'litre', ef:EF.diesel });
    if (!lpgOK  && sc.lpg  !=null) diffs.push({ year:yr, month:mo, category:'lpg',          newAct:sc.lpg/1000, scope:'scope_1', unit:'ton', ef:EF.lpg });
  }

  console.log(`\n── Found ${diffs.length} discrepancies to fix ──────────────────`);
  if (diffs.length === 0) { console.log('All good!'); return; }

  for (const u of diffs) {
    const newEm = +(u.newAct * u.ef).toFixed(6);
    // Try update first
    const { data: upd, error: updErr } = await s
      .from('emissions_data')
      .update({ activity_data: u.newAct, emissions_tco2e: newEm })
      .eq('factory_id', FAC_ID).eq('year', u.year).eq('month', u.month).eq('category', u.category)
      .select('id');

    if (updErr) {
      console.log(`❌ ${u.year}-${u.month} ${u.category}: ${updErr.message}`);
      continue;
    }

    if (upd && upd.length > 0) {
      console.log(`✅ Updated  ${u.year}-${String(u.month).padStart(2,'0')} ${u.category.padEnd(13)}: ${u.newAct} (${newEm} tCO2e)`);
    } else {
      // Row doesn't exist → insert
      const { error: insErr } = await s.from('emissions_data').insert({
        factory_id: FAC_ID, year: u.year, month: u.month,
        scope: u.scope, category: u.category,
        activity_data: u.newAct, activity_unit: u.unit, emissions_tco2e: newEm
      });
      if (insErr) console.log(`❌ Insert  ${u.year}-${u.month} ${u.category}: ${insErr.message}`);
      else console.log(`➕ Inserted ${u.year}-${String(u.month).padStart(2,'0')} ${u.category.padEnd(13)}: ${u.newAct} (${newEm} tCO2e)`);
    }
  }
  console.log('\n✅ Done!');
}

main().catch(console.error);
