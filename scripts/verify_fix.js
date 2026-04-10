/**
 * Verify post-fix: Calculate Scope 1 by category from RAW_DATA
 * Compare BOILER-only vs ALL Scope 1 vs MIS data
 */
const fs = require('fs');
const text = fs.readFileSync('./scripts/RAW_DATA.csv', 'utf8');
const lines = text.split(/\r?\n/).filter(l => {
  const t = l.trim();
  return t && !t.startsWith(',') && !t.startsWith('-') && !t.startsWith('Source') && !t.startsWith('MIX') && !t.startsWith('Plant');
});

// EF — FIXED (HSE aligned)
const EF = {
  wood_logs:  { Vietnam: 0.028, India: 0.035 },   // tCO2e/ton
  wastewater: { Vietnam: 0.0002013, India: 0.0002013 }, // tCO2e/m3
  lpg:        { Vietnam: 2.9093, India: 2.983 },   // tCO2e/ton
  diesel:     { Vietnam: 0.00268, India: 0.00272 }, // tCO2e/litre
  fgas_r134a: { Vietnam: 1.300, India: 1.300 },    // tCO2e/kg
  fgas_r410a: { Vietnam: 2.088, India: 2.088 },
  fgas_r404a: { Vietnam: 3.920, India: 3.920 },
  co2:        { Vietnam: 0.001, India: 0.001 },     // tCO2e/kg
};
const GRID_EF = {
  Vietnam: { 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 },
  India:   { 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 },
};

// MIS data from screenshot (Boiler only, unit = kg CO2e)
const MIS_BOILER_2025 = {
  LongAn:    43812.72,
  PhanThiet: 44915.58,
  TayNinh:   52835.16,
  Tuticorin: 47811.40,
};

const byPlant = {};

lines.forEach(line => {
  const rawCols = line.split(',');
  if (rawCols.length < 12) return;
  const plant = (rawCols[1] || '').trim();
  const dateStr = (rawCols[2] || '').trim();
  if (!dateStr || !plant) return;
  const yearMatch = dateStr.match(/['\/\-]?(\d{2})$/);
  if (!yearMatch) return;
  const yr = 2000 + parseInt(yearMatch[1]);
  if (yr !== 2025) return;

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

  if (!byPlant[plant]) byPlant[plant] = {
    country,
    wood: 0, wwts: 0, lpg: 0, diesel: 0, r134a: 0, r410a: 0, r404a: 0, co2: 0, kwh: 0,
    emWood: 0, emWwts: 0, emLpg: 0, emDiesel: 0, emFgas: 0, emCo2: 0, emS2: 0,
  };

  byPlant[plant].wood    += wood;
  byPlant[plant].wwts    += wwts;
  byPlant[plant].lpg     += lpg;
  byPlant[plant].diesel  += diesel;
  byPlant[plant].kwh     += kwh;

  byPlant[plant].emWood   += wood    * ef('wood_logs');
  byPlant[plant].emWwts   += wwts    * ef('wastewater');
  byPlant[plant].emLpg    += lpg     * ef('lpg');
  byPlant[plant].emDiesel += diesel  * ef('diesel');
  byPlant[plant].emFgas   += (r134a * ef('fgas_r134a') + r410a * ef('fgas_r410a') + r404a * ef('fgas_r404a'));
  byPlant[plant].emCo2    += (co2pack + co2pccc) * ef('co2');
  byPlant[plant].emS2     += kwh * (GRID_EF[country][yr] || 0.66) / 1000;
});

console.log('\n=============================================================');
console.log(' SCOPE 1 — 2025 FULL BREAKDOWN (after EF fix)');
console.log('=============================================================');
console.log(`\n${'Plant'.padEnd(12)} | ${'Boiler(Wood)'.padStart(12)} | ${'WWTS'.padStart(8)} | ${'LPG'.padStart(8)} | ${'Diesel'.padStart(8)} | ${'F-Gas'.padStart(8)} | ${'CO2'.padStart(6)} | ${'S1 Total'.padStart(10)}`);
console.log('-'.repeat(90));

let totWood=0, totWwts=0, totLpg=0, totDiesel=0, totFgas=0, totCo2=0, totS1=0;

for (const [plant, v] of Object.entries(byPlant).sort()) {
  const s1 = v.emWood + v.emWwts + v.emLpg + v.emDiesel + v.emFgas + v.emCo2;
  totWood+=v.emWood; totWwts+=v.emWwts; totLpg+=v.emLpg; totDiesel+=v.emDiesel;
  totFgas+=v.emFgas; totCo2+=v.emCo2; totS1+=s1;
  console.log(
    `${plant.padEnd(12)} | ${(v.emWood*1000).toFixed(2).padStart(12)} | ${(v.emWwts*1000).toFixed(2).padStart(8)} | ${(v.emLpg*1000).toFixed(2).padStart(8)} | ${(v.emDiesel*1000).toFixed(2).padStart(8)} | ${(v.emFgas*1000).toFixed(2).padStart(8)} | ${(v.emCo2*1000).toFixed(2).padStart(6)} | ${(s1*1000).toFixed(2).padStart(10)} kgCO2e`
  );
}
console.log('-'.repeat(90));
console.log(`${'TOTAL'.padEnd(12)} | ${(totWood*1000).toFixed(2).padStart(12)} | ${(totWwts*1000).toFixed(2).padStart(8)} | ${(totLpg*1000).toFixed(2).padStart(8)} | ${(totDiesel*1000).toFixed(2).padStart(8)} | ${(totFgas*1000).toFixed(2).padStart(8)} | ${(totCo2*1000).toFixed(2).padStart(6)} | ${(totS1*1000).toFixed(2).padStart(10)} kgCO2e`);

console.log('\n=============================================================');
console.log(' COMPARISON: Dashboard BOILER vs MIS BOILER (2025)');
console.log('=============================================================');
console.log(`\n${'Plant'.padEnd(12)} | ${'Dash Boiler (kgCO2e)'.padStart(22)} | ${'MIS Boiler (kgCO2e)'.padStart(21)} | ${'Diff'.padStart(10)} | Match?`);
console.log('-'.repeat(80));

for (const [plant, v] of Object.entries(byPlant).sort()) {
  const dashKg = v.emWood * 1000;
  const misKg  = MIS_BOILER_2025[plant] || 0;
  const diff   = dashKg - misKg;
  const pct    = misKg > 0 ? (diff / misKg * 100).toFixed(2) : 'N/A';
  const ok     = Math.abs(diff) < 1 ? '✅' : Math.abs(diff) < 100 ? '⚠️ ~OK' : '❌';
  console.log(
    `${plant.padEnd(12)} | ${dashKg.toFixed(2).padStart(22)} | ${misKg.toFixed(2).padStart(21)} | ${((diff >= 0 ? '+' : '') + diff.toFixed(2)).padStart(10)} | ${ok} (${pct}%)`
  );
}

console.log('\nNote: MIS "Boiler" = wood_logs only. Dashboard Scope 1 Total also includes WWTS, LPG, Diesel, F-Gas, CO2.');
