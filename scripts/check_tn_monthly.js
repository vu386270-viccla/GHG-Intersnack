const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const FAC_ID = '041d71b2-f002-438d-b711-3f6195f0c4e5'; // Tay Ninh

// Screenshot values: Electricity(kWh) | Wood(kg) | Water(m³×1.25?) | Diesel(L) | LPG(kg)
const SC = {
  '2026-3': { elec:475034, wood:177430, water:1308,  diesel:565,  lpg:0   },
  '2026-2': { elec:195622, wood: 80740, water:1931,  diesel:100,  lpg:0   },
  '2026-1': { elec:259134, wood: 79780, water:1538,  diesel:440,  lpg:0   },
  '2025-12':{ elec:323620, wood: 87910, water:1836,  diesel:1100, lpg:0   },
  '2025-11':{ elec:362952, wood:141730, water:1697,  diesel:1640, lpg:0   },
  '2025-10':{ elec:472034, wood:172020, water:2041,  diesel:1930, lpg:0   },
  '2025-9': { elec:385388, wood:158280, water:1583,  diesel:1500, lpg:0   },
  '2025-8': { elec:394126, wood:134400, water:2088,  diesel:1100, lpg:0   },
  '2025-7': { elec:439502, wood:149020, water:1615,  diesel:700,  lpg:0   },
  '2025-6': { elec:400380, wood:233780, water:2122,  diesel:774,  lpg:0   },
  '2025-5': { elec:449024, wood:168690, water:2607,  diesel:1000, lpg:0   },
  '2025-4': { elec:453302, wood:157450, water:2095,  diesel:1050, lpg:0   },
  '2025-3': { elec:462286, wood:176790, water:1818,  diesel:1620, lpg:0   },
  '2025-2': { elec:410068, wood:160350, water:1468,  diesel:990,  lpg:0   },
  '2025-1': { elec:296952, wood:146550, water:1711,  diesel:890,  lpg:0   },
  '2024-12':{ elec:399230, wood:169940, water:1896,  diesel:80,   lpg:0   },
  '2024-11':{ elec:445150, wood:174450, water:1502,  diesel:1420, lpg:0   },
  '2024-10':{ elec:417000, wood:131240, water:1683,  diesel:1130, lpg:0   },
  '2024-9': { elec:370100, wood:137310, water:1622,  diesel:2010, lpg:0   },
  '2024-8': { elec:390900, wood:148370, water:1733,  diesel:1570, lpg:0   },
  '2024-7': { elec:391600, wood:144480, water:2139,  diesel:1700, lpg:0   },
  '2024-6': { elec:424400, wood:173320, water:1634,  diesel:1240, lpg:0   },
  '2024-5': { elec:438300, wood:139160, water:1610,  diesel:1170, lpg:0   },
  '2024-4': { elec:380000, wood:143400, water:1538,  diesel:1140, lpg:0   },
  '2024-3': { elec:314200, wood:109180, water:1088,  diesel:1740, lpg:0   },
  '2024-2': { elec:199900, wood: 53790, water:1287,  diesel:790,  lpg:0   },
  '2024-1': { elec:309800, wood: 68810, water:1358,  diesel:1520, lpg:192 },
  '2023-12':{ elec:279800, wood: 72350, water:1611,  diesel:1470, lpg:132 },
  '2023-11':{ elec:323500, wood:108340, water:1984,  diesel:1910, lpg:312 },
  '2023-10':{ elec:415000, wood:192150, water:2115,  diesel:1180, lpg:660 },
  '2023-9': { elec:428800, wood:143260, water:3296,  diesel:1590, lpg:528 },
  '2023-8': { elec:518100, wood:185390, water:2760,  diesel:1750, lpg:600 },
  '2023-7': { elec:503700, wood:212370, water:2337,  diesel:1780, lpg:552 },
};

const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function main() {
  const { data: rows } = await s
    .from('emissions_data')
    .select('year,month,category,activity_data,activity_unit')
    .eq('factory_id', FAC_ID)
    .in('year', [2023,2024,2025,2026])
    .limit(5000);

  const db = {};
  for (const r of rows || []) {
    const k = `${r.year}-${r.month}`;
    if (!db[k]) db[k] = {};
    db[k][r.category] = Number(r.activity_data);
  }

  const ok  = (a, b, tol=1) => Math.abs(a - b) <= tol;
  const fmt = (a, b, tol=1) => {
    const diff = a - b;
    const pct  = b > 0 ? (diff/b*100).toFixed(1) : '-';
    return ok(a, b, tol)
      ? `✅${a.toFixed(0)}`
      : `❌DB=${a.toFixed(0)} SC=${b} Δ=${diff>=0?'+':''}${diff.toFixed(0)}(${pct}%)`;
  };

  let pass=0, fail=0;
  const results = [];

  for (const [key, sc] of Object.entries(SC)) {
    const [yr, mo] = key.split('-').map(Number);
    const d = db[key] || {};
    const dbElec = d.electricity || 0;
    const dbWood = (d.wood_logs || 0) * 1000;       // ton→kg
    const dbWwts = d.wastewater || 0;               // m³
    const dbDsl  = d.diesel || 0;
    const dbLPG  = (d.lpg || 0) * 1000;             // ton→kg

    // Water: test both raw and ×1.25
    const waterScaled = dbWwts * 1.25;
    const waterOK = ok(waterScaled, sc.water, 2);
    const waterRawOK = ok(dbWwts, sc.water, 2);

    const elecOK = ok(dbElec, sc.elec, 1);
    const woodOK = ok(dbWood, sc.wood, 2);
    const dslOK  = ok(dbDsl,  sc.diesel, 2);
    const lpgOK  = ok(dbLPG,  sc.lpg, 5);
    const allOK  = elecOK && woodOK && dslOK && lpgOK;

    if (allOK) pass++; else fail++;

    const waterStr = waterRawOK ? `✅${dbWwts.toFixed(0)}(raw)` :
                     waterOK    ? `⚠️${dbWwts.toFixed(0)}×1.25=${waterScaled.toFixed(0)}` :
                                  `❌DB_wwts=${dbWwts.toFixed(0)} SC=${sc.water}`;
    results.push({ yr, mo, allOK, elecOK, woodOK, dslOK, lpgOK,
      str: `${allOK?'✅':'❌'} ${yr}-${MONTHS[mo].padEnd(3)} | Elec:${fmt(dbElec,sc.elec)} | Wood:${fmt(dbWood,sc.wood,2)} | Water:${waterStr} | Diesel:${fmt(dbDsl,sc.diesel,2)} | LPG:${fmt(dbLPG,sc.lpg,5)}` });
  }

  // Sort by year-month desc
  results.sort((a,b) => b.yr-a.yr || b.mo-a.mo);
  results.forEach(r => console.log(r.str));

  console.log(`\n── Tay Ninh: ${pass}/${pass+fail} months matched (Elec/Wood/Diesel/LPG) ──`);
  const wConf = results.filter(r => {
    const k = `${r.yr}-${r.mo}`;
    const d = db[k] || {};
    return ok((d.wastewater||0)*1.25, SC[`${r.yr}-${r.mo}`]?.water||0, 2);
  }).length;
  console.log(`   Water col = WWTS×1.25 confirmed in ${wConf}/${results.length} months`);
}
main().catch(console.error);
