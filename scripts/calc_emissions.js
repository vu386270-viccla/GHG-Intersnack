const fs = require('fs');
const text = fs.readFileSync('./scripts/RAW_DATA.csv', 'utf8');
const lines = text.split(/\r?\n/).filter(l => {
  const t = l.trim();
  return t && !t.startsWith(',') && !t.startsWith('-') && !t.startsWith('Source') && !t.startsWith('MIX') && !t.startsWith('Plant');
});

// Emission factors — aligned with HSE (import-raw-data.js)
// Firewood/Biomass: VN = 28 kgCO2e/ton, India = 35 kgCO2e/ton (Wood pellets)
const EF_WOOD_VN = 0.028;  // tCO2e per ton (Firewood VN — HSE BEE/MONRE)
const EF_WOOD_IN = 0.035;  // tCO2e per ton (Wood pellets India — HSE BEE India)
const EF_LPG_VN  = 2.9093; // tCO2e per ton (MOC VN 2015 × GWP AR5)
const EF_LPG_IN  = 2.983;  // tCO2e per ton (MoEFCC India 2023)
const EF_DIESEL  = 0.00268;// tCO2e per litre (2.68 kg/litre ÷ 1000)
const EF_R134A = 1300;     // GWP AR5 (divide kg by 1000 for tCO2e)
const EF_R410A = 2088;
const EF_R404A = 3920;
const EF_CO2_GAS = 1;

// Regional Grid EF (kg CO2e per kWh → divide by 1000 for tCO2e/kWh)
const VN_EF = { 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 };
const IN_EF = { 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 };

const s1ByYear = {};
const s2ByYear = {};
[2021, 2022, 2023, 2024, 2025].forEach(y => { s1ByYear[y] = 0; s2ByYear[y] = 0; });

const byPlantYear = {};

lines.forEach(line => {
  const rawCols = line.split(',');
  if (rawCols.length < 12) return;

  const plant = (rawCols[1] || '').trim();
  const dateStr = (rawCols[2] || '').trim();
  if (!dateStr || !plant) return;

  const yearMatch = dateStr.match(/['\-\/]?(\d{2})$/);
  if (!yearMatch) return;
  const yr = 2000 + parseInt(yearMatch[1]);
  if (yr < 2021 || yr > 2025) return;

  const parse = v => {
    if (!v) return 0;
    const n = parseFloat(v.replace(/[\s,"]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const wood    = parse(rawCols[3]);
  const lpg     = parse(rawCols[5]);
  const diesel  = parse(rawCols[6]);
  const r134a   = parse(rawCols[7]);
  const r410a   = parse(rawCols[8]);
  const r404a   = parse(rawCols[9]);
  const co2pack = parse(rawCols[10]);
  const co2pccc = parse(rawCols[11]);
  const kwh     = parse(rawCols[12]);

  const isIndia = plant.toLowerCase().includes('tuticorin');
  const gef     = isIndia ? (IN_EF[yr] || 0.71) : (VN_EF[yr] || 0.6592);
  const efWood  = isIndia ? EF_WOOD_IN : EF_WOOD_VN;   // India=Wood pellets 0.035, VN=Firewood 0.028
  const efLpg   = isIndia ? EF_LPG_IN  : EF_LPG_VN;

  const s1 = wood * efWood
           + lpg * efLpg
           + diesel * EF_DIESEL
           + r134a * EF_R134A / 1000
           + r410a * EF_R410A / 1000
           + r404a * EF_R404A / 1000
           + co2pack * EF_CO2_GAS / 1000
           + co2pccc * EF_CO2_GAS / 1000;
  const s2 = kwh * gef / 1000;

  s1ByYear[yr] += s1;
  s2ByYear[yr] += s2;

  const key = plant + '_' + yr;
  if (!byPlantYear[key]) byPlantYear[key] = { s1: 0, s2: 0 };
  byPlantYear[key].s1 += s1;
  byPlantYear[key].s2 += s2;
});

console.log('\n=== SCOPE 1 — tCO2e (Firewood + Fuel + Refrigerants) ===');
let prev1 = 0;
[2021, 2022, 2023, 2024, 2025].forEach(yr => {
  const v = Math.round(s1ByYear[yr]);
  const delta = prev1 ? v - prev1 : 0;
  const pct = prev1 ? ((v - prev1) / prev1 * 100).toFixed(1) : '';
  console.log(`  ${yr}: ${v} tCO2e` + (prev1 ? `  →  YoY: ${delta > 0 ? '+' : ''}${delta} (${delta > 0 ? '+' : ''}${pct}%)` : '  [BASELINE]'));
  prev1 = v;
});

console.log('\n  2021 baseline = ' + Math.round(s1ByYear[2021]) + ', 50% target by 2031 = ' + Math.round(s1ByYear[2021] * 0.5));
console.log('  2025 vs baseline = ' + (((s1ByYear[2025] - s1ByYear[2021]) / s1ByYear[2021]) * 100).toFixed(1) + '%');

console.log('\n=== SCOPE 2 — tCO2e (Electricity × Regional Grid EF) ===');
let prev2 = 0;
[2021, 2022, 2023, 2024, 2025].forEach(yr => {
  const v = Math.round(s2ByYear[yr]);
  const delta = prev2 ? v - prev2 : 0;
  const pct = prev2 ? ((v - prev2) / prev2 * 100).toFixed(1) : '';
  console.log(`  ${yr}: ${v} tCO2e` + (prev2 ? `  →  YoY: ${delta > 0 ? '+' : ''}${delta} (${delta > 0 ? '+' : ''}${pct}%)` : '  [BASELINE]'));
  prev2 = v;
});

console.log('\n  2021 baseline = ' + Math.round(s2ByYear[2021]) + ', 50% target by 2031 = ' + Math.round(s2ByYear[2021] * 0.5));
console.log('  2025 vs baseline = ' + (((s2ByYear[2025] - s2ByYear[2021]) / s2ByYear[2021]) * 100).toFixed(1) + '%');

console.log('\n=== BY PLANT — 2025 Breakdown ===');
['PhanThiet', 'LongAn', 'TayNinh', 'Tuticorin'].forEach(p => {
  const k = p + '_2025';
  if (byPlantYear[k]) {
    console.log(`  ${p}: S1=${Math.round(byPlantYear[k].s1)}, S2=${Math.round(byPlantYear[k].s2)}`);
  }
});
