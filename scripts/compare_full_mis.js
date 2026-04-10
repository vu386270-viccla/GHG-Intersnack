/**
 * Full comparison: Dashboard vs MIS 2025 (all plants, all categories)
 * Using MIS screenshot data
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
  diesel:     { Vietnam: 0.00268, India: 0.00272 },
  fgas_r134a: { Vietnam: 1.300, India: 1.300 },
  fgas_r410a: { Vietnam: 2.088, India: 2.088 },
  fgas_r404a: { Vietnam: 3.920, India: 3.920 },
  co2:        { Vietnam: 0.001, India: 0.001 },
};
const GRID_EF = {
  Vietnam: { 2025: 0.6592 },
  India:   { 2025: 0.7100 },
};

// ── Full MIS 2025 from screenshot (kgCO₂e) ──
const MIS = {
  LongAn: {
    boiler:    43812.72,
    forklift:  0,
    vehicles:  4556.00,
    packing:   66.00,
    fgas:      0,
    wwts:      3180.62,
    s1Total:   51615.34,
    elec:      2799480.77,
    s2Total:   2799480.77,
    grandTotal:2851096.11,
  },
  PhanThiet: {
    boiler:    44915.58,
    forklift:  0,
    vehicles:  2698.76,
    packing:   0,
    fgas:      0,
    wwts:      2193.11,
    s1Total:   49807.46,
    elec:      2511937.98,
    s2Total:   2511937.98,
    grandTotal:2561745.43,
  },
  TayNinh: {
    boiler:    52835.16,
    forklift:  0,
    vehicles:  38307.92,
    packing:   0,
    fgas:      0,
    wwts:      3678.10,
    s1Total:   94821.18,
    elec:      3195908.81,
    s2Total:   3195908.81,
    grandTotal:3290729.99,
  },
  Tuticorin: {
    boiler:    47811.40,
    forklift:  3841.04,    // LPG Forklift — NOT in our CSV!
    vehicles:  130071.12,  // Diesel Other Vehicles
    packing:   658.00,     // CO2 Packing
    fgas:      27440.00,   // Refrigeration & A/C
    wwts:      4099.80,    // WWTS
    s1Total:   213921.36,
    elec:      3658722.30,
    s2Total:   3658722.30,
    grandTotal:3872643.66,
  },
};

const byPlant = {};
lines.forEach(line => {
  const rawCols = line.split(',');
  if (rawCols.length < 12) return;
  const plant   = (rawCols[1] || '').trim();
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

  if (!byPlant[plant]) byPlant[plant] = { country, actWood:0, actWwts:0, actLpg:0, actDiesel:0, actKwh:0, emWood:0, emWwts:0, emLpg:0, emDiesel:0, emFgas:0, emCo2pack:0, emCo2pccc:0, emS2:0 };
  const r = byPlant[plant];
  r.actWood   += wood;   r.actWwts += wwts;   r.actLpg += lpg; r.actDiesel += diesel; r.actKwh += kwh;
  r.emWood    += wood   * ef('wood_logs');
  r.emWwts    += wwts   * ef('wastewater');
  r.emLpg     += lpg    * 2.9093;               // LPG VN tCO2e/ton (India: 2.983)
  r.emDiesel  += diesel * ef('diesel');
  r.emFgas    += r134a * ef('fgas_r134a') + r410a * ef('fgas_r410a') + r404a * ef('fgas_r404a');
  r.emCo2pack += co2pack * ef('co2');
  r.emCo2pccc += co2pccc * ef('co2');
  r.emS2      += kwh * (GRID_EF[country][2025] || 0.66) / 1000;
});

// ── Print detailed comparison ──
const fmt = v => (v || 0).toFixed(2);
const diff = (a, b) => {
  if (b === null || b === undefined) return '   N/A   ';
  const d = a - b;
  const icon = Math.abs(d) < 5 ? '✅' : Math.abs(d) < 200 ? '⚠️' : '❌';
  return `${icon} ${(d>=0?'+':'')+d.toFixed(2)} (${(d/b*100).toFixed(1)}%)`;
};

const PLANTS = ['LongAn', 'PhanThiet', 'TayNinh', 'Tuticorin'];

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(' 2025 — DASHBOARD vs MIS — ALL PLANTS, ALL CATEGORIES (kgCO₂e)');
console.log('═══════════════════════════════════════════════════════════════════\n');

for (const plant of PLANTS) {
  const r   = byPlant[plant];
  const mis = MIS[plant];
  if (!r || !mis) continue;

  const emS1 = r.emWood + r.emWwts + r.emLpg + r.emDiesel + r.emFgas + r.emCo2pack + r.emCo2pccc;
  const emLpgForklift = r.emLpg; // VN LPG for forklifts
  const co2cyl = (r.emCo2pack + r.emCo2pccc) * 1000;

  console.log(`┌──── ${plant.padEnd(10)} ─────────────────────────────────────────────────────────────`);
  console.log(`│ ${'Category'.padEnd(22)} ${'Dashboard'.padStart(14)} kgCO₂e  ${'MIS'.padStart(14)} kgCO₂e   Difference`);
  console.log(`│ ${'─'.repeat(75)}`);
  console.log(`│ ${'Boiler (Wood)'.padEnd(22)} ${fmt(r.emWood*1000).padStart(14)}         ${fmt(mis.boiler).padStart(14)}   ${diff(r.emWood*1000, mis.boiler)}`);
  console.log(`│ ${'Forklift (LPG)'.padEnd(22)} ${fmt(emLpgForklift*1000).padStart(14)}         ${fmt(mis.forklift).padStart(14)}   ${diff(emLpgForklift*1000, mis.forklift)}`);
  console.log(`│ ${'Other Vehicles (Diesel)'.padEnd(22)} ${fmt(r.emDiesel*1000).padStart(14)}         ${fmt(mis.vehicles).padStart(14)}   ${diff(r.emDiesel*1000, mis.vehicles)}`);
  console.log(`│   → Activity: ${r.actDiesel.toFixed(0).padStart(8)} litres in CSV | MIS implies: ${(mis.vehicles / (plant==='Tuticorin'?2.72:2.68) * 1000).toFixed(0)} litres | Diff: ${(r.actDiesel - mis.vehicles/(plant==='Tuticorin'?2.72:2.68)*1000).toFixed(0)} L`);
  console.log(`│ ${'Packing (CO2 cyl.)'.padEnd(22)} ${co2cyl.toFixed(2).padStart(14)}         ${fmt(mis.packing).padStart(14)}   ${diff(co2cyl, mis.packing)}`);
  console.log(`│ ${'Refrigeration (F-Gas)'.padEnd(22)} ${fmt(r.emFgas*1000).padStart(14)}         ${fmt(mis.fgas).padStart(14)}   ${diff(r.emFgas*1000, mis.fgas)}`);
  console.log(`│ ${'WWTS'.padEnd(22)} ${fmt(r.emWwts*1000).padStart(14)}         ${fmt(mis.wwts).padStart(14)}   ${diff(r.emWwts*1000, mis.wwts)}`);
  console.log(`│   → Activity: ${r.actWwts.toFixed(0).padStart(8)} m³ | Dashboard EF=0.2013 → ${(r.emWwts*1000/r.actWwts*1000).toFixed(4)} | MIS implied: ${(mis.wwts/r.actWwts*1000).toFixed(4)} kg/m³`);
  console.log(`│ ${'─'.repeat(75)}`);
  console.log(`│ ${'SCOPE 1 TOTAL'.padEnd(22)} ${fmt(emS1*1000).padStart(14)}         ${fmt(mis.s1Total).padStart(14)}   ${diff(emS1*1000, mis.s1Total)}`);
  console.log(`│ ${'Electricity (Scope 2)'.padEnd(22)} ${fmt(r.emS2*1000).padStart(14)}         ${fmt(mis.elec).padStart(14)}   ${diff(r.emS2*1000, mis.elec)}`);
  console.log(`│   → Activity: ${r.actKwh.toFixed(0).padStart(10)} kWh | Dashboard EF VN=0.6592 IN=0.71 | MIS implied EF: ${(mis.elec/r.actKwh*1000).toFixed(4)} kg/kWh`);
  console.log(`│ ${'GRAND TOTAL'.padEnd(22)} ${fmt((emS1+r.emS2)*1000).padStart(14)}         ${fmt(mis.grandTotal).padStart(14)}   ${diff((emS1+r.emS2)*1000, mis.grandTotal)}`);
  console.log(`└──────────────────────────────────────────────────────────────────────────\n`);
}

// Summary of issues
console.log('═══════════════════════════════════════════════════════════════════');
console.log(' ROOT CAUSE SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════\n');
const totalDashS1 = PLANTS.reduce((acc, p) => {
  const r = byPlant[p];
  return acc + (r ? (r.emWood+r.emWwts+r.emLpg+r.emDiesel+r.emFgas+r.emCo2pack+r.emCo2pccc)*1000 : 0);
}, 0);
const totalMisS1 = PLANTS.reduce((acc, p) => acc + (MIS[p]?.s1Total || 0), 0);
console.log(`  Scope 1 Total — Dashboard: ${totalDashS1.toFixed(2)} kgCO₂e | MIS: ${totalMisS1.toFixed(2)} | Diff: ${(totalDashS1-totalMisS1).toFixed(2)}`);
