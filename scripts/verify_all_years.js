/**
 * Full verification: ALL years, ALL categories vs MIS
 */
const fs = require('fs');
const text = fs.readFileSync('./scripts/RAW_DATA.csv', 'utf8');
const lines = text.split(/\r?\n/).filter(l => {
  const t = l.trim();
  return t && !t.startsWith(',') && !t.startsWith('-') && !t.startsWith('Source') && !t.startsWith('MIX') && !t.startsWith('Plant');
});

const EF = {
  wood_logs:  { Vietnam: 0.028, India: 0.035 },
  wastewater: { Vietnam: 0.0002013, India: 0.0002013 },
  lpg:        { Vietnam: 2.9093, India: 2.983 },
  diesel:     { Vietnam: 0.00268, India: 0.00272 },
  fgas_r134a: { Vietnam: 1.300, India: 1.300 },
  fgas_r410a: { Vietnam: 2.088, India: 2.088 },
  fgas_r404a: { Vietnam: 3.920, India: 3.920 },
  co2:        { Vietnam: 0.001, India: 0.001 },
};
const GRID_EF = {
  Vietnam: { 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 },
  India:   { 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 },
};

// MIS 2025 data from screenshot (kgCO2e)
const MIS_2025 = {
  LongAn:    { boiler: 43812.72, vehicles: null,     wwts: null,    total: null    },
  PhanThiet: { boiler: 44915.58, vehicles: null,     wwts: null,    total: null    },
  TayNinh:   { boiler: 52835.16, vehicles: 38307.92, wwts: 3678.10, total: 94821.18 },
  Tuticorin: { boiler: 47811.40, vehicles: null,     wwts: null,    total: null    },
};

const byPlantYear = {};

lines.forEach(line => {
  const rawCols = line.split(',');
  if (rawCols.length < 12) return;
  const plant   = (rawCols[1] || '').trim();
  const dateStr = (rawCols[2] || '').trim();
  if (!dateStr || !plant) return;
  const yearMatch = dateStr.match(/['\/\-]?(\d{2})$/);
  if (!yearMatch) return;
  const yr = 2000 + parseInt(yearMatch[1]);
  if (yr < 2021 || yr > 2026) return;

  const parse = v => {
    if (!v) return 0;
    const n = parseFloat(v.replace(/[\s,"]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const country = plant === 'Tuticorin' ? 'India' : 'Vietnam';
  const ef = c => EF[c][country];

  const wood    = parse(rawCols[3]);
  const wwts    = parse(rawCols[4]);
  const lpg     = parse(rawCols[5]);
  const diesel  = parse(rawCols[6]);
  const r134a   = parse(rawCols[7]);
  const r410a   = parse(rawCols[8]);
  const r404a   = parse(rawCols[9]);
  const co2pack = parse(rawCols[10]);
  const co2pccc = parse(rawCols[11]);
  const kwh     = parse(rawCols[12]);

  const key = `${plant}_${yr}`;
  if (!byPlantYear[key]) byPlantYear[key] = { plant, yr, country, emWood:0, emWwts:0, emLpg:0, emDiesel:0, emFgas:0, emCo2:0, emS2:0, actWood:0, actDiesel:0 };
  const r = byPlantYear[key];
  r.emWood   += wood   * ef('wood_logs');
  r.emWwts   += wwts   * ef('wastewater');
  r.emLpg    += lpg    * ef('lpg');
  r.emDiesel += diesel * ef('diesel');
  r.emFgas   += r134a * ef('fgas_r134a') + r410a * ef('fgas_r410a') + r404a * ef('fgas_r404a');
  r.emCo2    += (co2pack + co2pccc) * ef('co2');
  r.emS2     += kwh * (GRID_EF[country][yr] || 0.66) / 1000;
  r.actWood   += wood;
  r.actDiesel += diesel;
});

// ── Print ALL YEARS summary ──
console.log('\n═══════════════════════════════════════════════════════════════════════════════');
console.log(' SCOPE 1 — ALL YEARS BY PLANT (kgCO₂e) — post EF fix');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log(`\n${'Plant'.padEnd(12)} ${'Year'.padEnd(5)} | ${'Boiler(Wood)'.padStart(14)} | ${'OtherVeh(Diesel)'.padStart(17)} | ${'WWTS'.padStart(10)} | ${'LPG'.padStart(8)} | ${'F-Gas'.padStart(10)} | ${'CO2'.padStart(8)} | ${'S1 Total'.padStart(12)}`);
console.log('─'.repeat(108));

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const PLANTS = ['LongAn', 'PhanThiet', 'TayNinh', 'Tuticorin'];

for (const plant of PLANTS) {
  for (const yr of YEARS) {
    const r = byPlantYear[`${plant}_${yr}`];
    if (!r) continue;
    const s1 = r.emWood + r.emWwts + r.emLpg + r.emDiesel + r.emFgas + r.emCo2;

    // MIS comparison marker
    let mis = '';
    if (yr === 2025 && MIS_2025[plant]) {
      const m = MIS_2025[plant];
      const bdiff = ((r.emWood * 1000) - m.boiler).toFixed(0);
      const ddiff = m.vehicles !== null ? ((r.emDiesel * 1000) - m.vehicles).toFixed(0) : null;
      mis = ` ← Boiler diff:${bdiff}` + (ddiff !== null ? ` Diesel diff:${ddiff}` : '');
    }

    console.log(
      `${plant.padEnd(12)} ${String(yr).padEnd(5)} | ${(r.emWood*1000).toFixed(2).padStart(14)} | ${(r.emDiesel*1000).toFixed(2).padStart(17)} | ${(r.emWwts*1000).toFixed(2).padStart(10)} | ${(r.emLpg*1000).toFixed(2).padStart(8)} | ${(r.emFgas*1000).toFixed(2).padStart(10)} | ${(r.emCo2*1000).toFixed(2).padStart(8)} | ${(s1*1000).toFixed(2).padStart(12)}${mis}`
    );
  }
  console.log('─'.repeat(108));
}

// ── 2025 detailed comparison with MIS ──
console.log('\n\n═══════════════════════════════════════════════════════════════════════════════');
console.log(' 2025 — DASHBOARD vs MIS DETAILED COMPARISON');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('\n(All values in kgCO₂e)\n');

for (const plant of PLANTS) {
  const r = byPlantYear[`${plant}_2025`];
  const mis = MIS_2025[plant];
  if (!r || !mis) continue;

  const s1Total = (r.emWood + r.emWwts + r.emLpg + r.emDiesel + r.emFgas + r.emCo2) * 1000;
  console.log(`┌─ ${plant} ─────────────────────────────────────────────────────`);
  console.log(`│ ${'Category'.padEnd(20)} ${'Dashboard'.padStart(12)}  ${'MIS'.padStart(12)}  ${'Diff'.padStart(10)}  Status`);
  console.log(`│ ${'─'.repeat(65)}`);

  const check = (label, dashKg, misKg) => {
    if (misKg === null) {
      console.log(`│ ${label.padEnd(20)} ${dashKg.toFixed(2).padStart(12)}  ${'(no MIS data)'.padStart(12)}`);
      return;
    }
    const diff = dashKg - misKg;
    const pct  = (diff / misKg * 100).toFixed(2);
    const icon = Math.abs(diff) < 5 ? '✅' : Math.abs(diff) < 500 ? '⚠️' : '❌';
    console.log(`│ ${label.padEnd(20)} ${dashKg.toFixed(2).padStart(12)}  ${misKg.toFixed(2).padStart(12)}  ${((diff>=0?'+':'')+diff.toFixed(2)).padStart(10)}  ${icon} ${pct}%`);
  };

  check('Boiler (Wood)', r.emWood * 1000, mis.boiler);
  check('Other Vehicles (Diesel)', r.emDiesel * 1000, mis.vehicles);
  check('WWTS', r.emWwts * 1000, mis.wwts);
  check('LPG', r.emLpg * 1000, null);
  check('F-Gas', r.emFgas * 1000, null);
  check('CO2 cylinders', r.emCo2 * 1000, null);
  console.log(`│ ${'─'.repeat(65)}`);
  check('TOTAL Scope 1', s1Total, mis.total);
  console.log(`└─────────────────────────────────────────────────────────────────\n`);
}

// ── Grand totals by year (all plants combined) ──
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log(' GRAND TOTAL — ALL PLANTS SCOPE 1 + 2 BY YEAR (tCO₂e)');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log(`\n${'Year'.padEnd(5)} | ${'S1 Total'.padStart(10)} | ${'S2 Total'.padStart(10)} | ${'S1+S2 Total'.padStart(12)} | YoY S1+2`);
console.log('─'.repeat(60));
let prevTotal = 0;
for (const yr of YEARS) {
  let s1=0, s2=0;
  for (const plant of PLANTS) {
    const r = byPlantYear[`${plant}_${yr}`];
    if (!r) continue;
    s1 += r.emWood + r.emWwts + r.emLpg + r.emDiesel + r.emFgas + r.emCo2;
    s2 += r.emS2;
  }
  const total = s1 + s2;
  const yoy = prevTotal > 0 ? `${((total-prevTotal)/prevTotal*100).toFixed(1)}%` : '[BASELINE]';
  console.log(`${String(yr).padEnd(5)} | ${(s1*1000).toFixed(0).padStart(10)} | ${(s2*1000).toFixed(0).padStart(10)} | ${(total*1000).toFixed(0).padStart(12)} | ${yoy}`);
  prevTotal = total;
}
console.log('\nNote: Units = kgCO₂e for S1/S2 columns, but labeled as tCO₂e in DB (÷1000)');
