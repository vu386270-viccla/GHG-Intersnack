const fs = require('fs');
const csv = fs.readFileSync('scripts/RAW_DATA.csv', 'utf8');
const lines = csv.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Source') && !l.startsWith('---') && !l.startsWith(','));

// Emission factors
const EF = {
  WOOD_VN: 0.028,
  LPG_VN: 2.9093,
  DIESEL_VN: 0.00268,
  R134A: 1430,
  R410A: 2088,
  R404A: 3922,
  CO2_PACKING: 1,
  CO2_PCCC: 1,
  VN_EF: 0.7221,
  INDIA_EF: 0.8928
};

const plants = ['PhanThiet','LongAn','TayNinh','Tuticorin'];
const years = [2021,2022,2023,2024,2025];

let sums = {};
plants.forEach(p => years.forEach(y => sums[`${p}_${y}`] = {s1:0, s2:0}));

lines.forEach(line => {
  // Split by comma, but handle quoted fields (simple approach)
  const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
  if (cols.length < 13) return;
  const plant = cols[1];
  if (!plants.includes(plant)) return;
  const dateStr = cols[2];
  if (!dateStr) return;

  // Parse date: accept both '/' and '-'
  let parts = dateStr.split('/');
  if (parts.length !== 2) parts = dateStr.split('-');
  if (parts.length !== 2) return;
  const yearStr = parts[1];
  let year = parseInt(yearStr);
  if (year < 100) year += 2000;
  if (year < 2021 || year > 2025) return;

  // Parse numeric columns (indices based on header line 9)
  const wood = parseFloat(cols[3]) || 0;
  const lpg = parseFloat(cols[5]) || 0; // skip waste water col4
  const diesel = parseFloat(cols[6]) || 0;
  const r134a = parseFloat(cols[7]) || 0;
  const r410a = parseFloat(cols[8]) || 0;
  const r404a = parseFloat(cols[9]) || 0;
  const co2pack = parseFloat(cols[10]) || 0;
  const co2pccc = parseFloat(cols[11]) || 0;
  const kwh = parseFloat(cols[12]) || 0;

  // Scope1 tCO2e
  const s1 = wood * EF.WOOD_VN
    + lpg * EF.LPG_VN
    + diesel * EF.DIESEL_VN
    + r134a * EF.R134A / 1000
    + r410a * EF.R410A / 1000
    + r404a * EF.R404A / 1000
    + co2pack * EF.CO2_PACKING / 1000
    + co2pccc * EF.CO2_PCCC / 1000;

  // Scope2 tCO2e
  const ef = plant === 'Tuticorin' ? EF.INDIA_EF : EF.VN_EF;
  const s2 = kwh * ef / 1000; // kg/kWh -> tCO2e

  const key = `${plant}_${year}`;
  sums[key].s1 += s1;
  sums[key].s2 += s2;
});

// Print tables (tCO2e, 3 decimals)
console.log('=== Scope1 (tCO2e, unrounded) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = sums[`PhanThiet_${y}`].s1;
  const l = sums[`LongAn_${y}`].s1;
  const t = sums[`TayNinh_${y}`].s1;
  const tu = sums[`Tuticorin_${y}`].s1;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${p.toFixed(3)},${l.toFixed(3)},${t.toFixed(3)},${tu.toFixed(3)},${tv.toFixed(3)},${ti.toFixed(3)}`);
});

console.log('\n=== Scope2 (tCO2e, unrounded) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = sums[`PhanThiet_${y}`].s2;
  const l = sums[`LongAn_${y}`].s2;
  const t = sums[`TayNinh_${y}`].s2;
  const tu = sums[`Tuticorin_${y}`].s2;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${p.toFixed(3)},${l.toFixed(3)},${t.toFixed(3)},${tu.toFixed(3)},${tv.toFixed(3)},${ti.toFixed(3)}`);
});

console.log('\n=== Total (tCO2e, unrounded) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = sums[`PhanThiet_${y}`].s1 + sums[`PhanThiet_${y}`].s2;
  const l = sums[`LongAn_${y}`].s1 + sums[`LongAn_${y}`].s2;
  const t = sums[`TayNinh_${y}`].s1 + sums[`TayNinh_${y}`].s2;
  const tu = sums[`Tuticorin_${y}`].s1 + sums[`Tuticorin_${y}`].s2;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${p.toFixed(3)},${l.toFixed(3)},${t.toFixed(3)},${tu.toFixed(3)},${tv.toFixed(3)},${ti.toFixed(3)}`);
});

// Print kg (multiply by 1000, rounded to integer because t has 3 decimals)
console.log('\n=== Scope1 (kg) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = sums[`PhanThiet_${y}`].s1 * 1000;
  const l = sums[`LongAn_${y}`].s1 * 1000;
  const t = sums[`TayNinh_${y}`].s1 * 1000;
  const tu = sums[`Tuticorin_${y}`].s1 * 1000;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${Math.round(p)},${Math.round(l)},${Math.round(t)},${Math.round(tu)},${Math.round(tv)},${Math.round(ti)}`);
});

console.log('\n=== Scope2 (kg) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = sums[`PhanThiet_${y}`].s2 * 1000;
  const l = sums[`LongAn_${y}`].s2 * 1000;
  const t = sums[`TayNinh_${y}`].s2 * 1000;
  const tu = sums[`Tuticorin_${y}`].s2 * 1000;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${Math.round(p)},${Math.round(l)},${Math.round(t)},${Math.round(tu)},${Math.round(tv)},${Math.round(ti)}`);
});

console.log('\n=== Total (kg) ===');
console.log('Year,PhanThiet,LongAn,TayNinh,Tuticorin,Total_VN,Total_ICC');
years.forEach(y => {
  const p = (sums[`PhanThiet_${y}`].s1 + sums[`PhanThiet_${y}`].s2) * 1000;
  const l = (sums[`LongAn_${y}`].s1 + sums[`LongAn_${y}`].s2) * 1000;
  const t = (sums[`TayNinh_${y}`].s1 + sums[`TayNinh_${y}`].s2) * 1000;
  const tu = (sums[`Tuticorin_${y}`].s1 + sums[`Tuticorin_${y}`].s2) * 1000;
  const tv = p + l + t;
  const ti = tv + tu;
  console.log(`${y},${Math.round(p)},${Math.round(l)},${Math.round(t)},${Math.round(tu)},${Math.round(tv)},${Math.round(ti)}`);
});
