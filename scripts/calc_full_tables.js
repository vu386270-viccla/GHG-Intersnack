const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'RAW_DATA.csv');
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter(function(l) {
  const t = l.trim();
  return t && !t.startsWith(',') && !t.startsWith('-') && !t.startsWith('Source') && !t.startsWith('MIX') && !t.startsWith('Plant');
});

const EF_WOOD_VN = 0.028, EF_WOOD_IN = 0.035, EF_LPG_VN = 2.9093, EF_LPG_IN = 2.983, EF_DIESEL = 0.00268;
const EF_R134A = 1300, EF_R410A = 2088, EF_R404A = 3920, EF_CO2_GAS = 1;
const VN_EF = {2021:0.7221,2022:0.6766,2023:0.6592,2024:0.6592,2025:0.6592};
const IN_EF = {2021:0.7030,2022:0.7150,2023:0.7160,2024:0.7270,2025:0.7100};

const byPlantYear = {};
const years = [2021,2022,2023,2024,2025];
years.forEach(function(y) { byPlantYear[y] = {}; });

lines.forEach(function(line) {
  const raw = line.split(',');
  if (raw.length < 13) return;
  const plant = (raw[1] || '').trim();
  const dateStr = (raw[2] || '').trim();
  const m = dateStr.match(/['\-\\/']?(\d{2})$/);
  if (!m) return;
  const yr = 2000 + parseInt(m[1]);
  if (yr < 2021 || yr > 2025) return;

  const parse = function(v) {
    if (!v) return 0;
    const n = parseFloat(v.replace(/[\s,"]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const wood = parse(raw[3]), lpg = parse(raw[5]), diesel = parse(raw[6]);
  const r134a = parse(raw[7]), r410a = parse(raw[8]), r404a = parse(raw[9]);
  const co2pack = parse(raw[10]), co2pccc = parse(raw[11]), kwh = parse(raw[12]);

  const isIndia = plant.toLowerCase().indexOf('tuticorin') !== -1;
  const gef = isIndia ? IN_EF[yr] : VN_EF[yr];
  const efWood = isIndia ? EF_WOOD_IN : EF_WOOD_VN;
  const efLpg = isIndia ? EF_LPG_IN : EF_LPG_VN;

  const s1 = wood * efWood + lpg * efLpg + diesel * EF_DIESEL + r134a * EF_R134A / 1000 + r410a * EF_R410A / 1000 + r404a * EF_R404A / 1000 + co2pack * EF_CO2_GAS / 1000 + co2pccc * EF_CO2_GAS / 1000;
  const s2 = kwh * gef / 1000;

  if (!byPlantYear[yr][plant]) byPlantYear[yr][plant] = { s1: 0, s2: 0 };
  byPlantYear[yr][plant].s1 += s1;
  byPlantYear[yr][plant].s2 += s2;
});

const plants = ['PhanThiet', 'LongAn', 'TayNinh', 'Tuticorin'];

console.log('\n=== SCOPE 1 BY PLANT (kg CO2e) ===');
console.log('Year       ' + plants.map(function(p) { return p.padEnd(14); }).join('') + 'Total_VN'.padEnd(16) + 'Tuticorin'.padEnd(14) + 'Total_ICC');
years.forEach(function(yr) {
  var totalVN = 0;
  var rowParts = [yr.toString().padEnd(8)];
  plants.filter(function(p) { return p !== 'Tuticorin'; }).forEach(function(p) {
    var val = 0;
    if (byPlantYear[yr][p]) val = Math.round(byPlantYear[yr][p].s1);
    rowParts.push(val.toString().padStart(14));
    totalVN += val;
  });
  rowParts.push(totalVN.toString().padStart(16));
  var tutiVal = 0;
  if (byPlantYear[yr]['Tuticorin']) tutiVal = Math.round(byPlantYear[yr]['Tuticorin'].s1);
  rowParts.push(tutiVal.toString().padStart(14));
  var totalICC = totalVN + tutiVal;
  rowParts.push(totalICC.toString().padStart(14));
  console.log(rowParts.join(''));
});

console.log('\n=== SCOPE 2 BY PLANT (kg CO2e) ===');
console.log('Year       ' + plants.map(function(p) { return p.padEnd(14); }).join('') + 'Total_VN'.padEnd(16) + 'Tuticorin'.padEnd(14) + 'Total_ICC');
years.forEach(function(yr) {
  var totalVN = 0;
  var rowParts = [yr.toString().padEnd(8)];
  plants.filter(function(p) { return p !== 'Tuticorin'; }).forEach(function(p) {
    var val = 0;
    if (byPlantYear[yr][p]) val = Math.round(byPlantYear[yr][p].s2);
    rowParts.push(val.toString().padStart(14));
    totalVN += val;
  });
  rowParts.push(totalVN.toString().padStart(16));
  var tutiVal = 0;
  if (byPlantYear[yr]['Tuticorin']) tutiVal = Math.round(byPlantYear[yr]['Tuticorin'].s2);
  rowParts.push(tutiVal.toString().padStart(14));
  var totalICC = totalVN + tutiVal;
  rowParts.push(totalICC.toString().padStart(14));
  console.log(rowParts.join(''));
});

console.log('\n=== TOTAL (S1+S2) BY PLANT (kg CO2e) ===');
console.log('Year       ' + plants.map(function(p) { return p.padEnd(14); }).join('') + 'Total_VN'.padEnd(16) + 'Tuticorin'.padEnd(14) + 'Total_ICC');
years.forEach(function(yr) {
  var totalVN = 0;
  var rowParts = [yr.toString().padEnd(8)];
  plants.filter(function(p) { return p !== 'Tuticorin'; }).forEach(function(p) {
    var val = 0;
    if (byPlantYear[yr][p]) val = Math.round(byPlantYear[yr][p].s1) + Math.round(byPlantYear[yr][p].s2);
    rowParts.push(val.toString().padStart(14));
    totalVN += val;
  });
  rowParts.push(totalVN.toString().padStart(16));
  var tutiVal = 0;
  if (byPlantYear[yr]['Tuticorin']) tutiVal = Math.round(byPlantYear[yr]['Tuticorin'].s1) + Math.round(byPlantYear[yr]['Tuticorin'].s2);
  rowParts.push(tutiVal.toString().padStart(14));
  var totalICC = totalVN + tutiVal;
  rowParts.push(totalICC.toString().padStart(14));
  console.log(rowParts.join(''));
});

console.log('\n=== YoY CHANGE SCOPE 1 (kg) ===');
console.log('Plant'.padEnd(14) + years.slice(1).map(function(y) { return y.toString().padStart(12); }).join(''));
plants.forEach(function(p) {
  var prev = 0;
  if (byPlantYear[2021] && byPlantYear[2021][p]) prev = Math.round(byPlantYear[2021][p].s1);
  var rowParts = [p.padEnd(14)];
  years.slice(1).forEach(function(yr) {
    var curr = 0;
    if (byPlantYear[yr] && byPlantYear[yr][p]) curr = Math.round(byPlantYear[yr][p].s1);
    var diff = curr - prev;
    rowParts.push(diff.toString().padStart(12));
    prev = curr;
  });
  console.log(rowParts.join(''));
});

console.log('\n=== YoY CHANGE SCOPE 2 (kg) ===');
console.log('Plant'.padEnd(14) + years.slice(1).map(function(y) { return y.toString().padStart(12); }).join(''));
plants.forEach(function(p) {
  var prev = 0;
  if (byPlantYear[2021] && byPlantYear[2021][p]) prev = Math.round(byPlantYear[2021][p].s2);
  var rowParts = [p.padEnd(14)];
  years.slice(1).forEach(function(yr) {
    var curr = 0;
    if (byPlantYear[yr] && byPlantYear[yr][p]) curr = Math.round(byPlantYear[yr][p].s2);
    var diff = curr - prev;
    rowParts.push(diff.toString().padStart(12));
    prev = curr;
  });
  console.log(rowParts.join(''));
});

console.log('\n=== YoY CHANGE TOTAL (kg) ===');
console.log('Plant'.padEnd(14) + years.slice(1).map(function(y) { return y.toString().padStart(12); }).join(''));
plants.forEach(function(p) {
  var prev = 0;
  if (byPlantYear[2021] && byPlantYear[2021][p]) prev = Math.round(byPlantYear[2021][p].s1) + Math.round(byPlantYear[2021][p].s2);
  var rowParts = [p.padEnd(14)];
  years.slice(1).forEach(function(yr) {
    var curr = 0;
    if (byPlantYear[yr] && byPlantYear[yr][p]) curr = Math.round(byPlantYear[yr][p].s1) + Math.round(byPlantYear[yr][p].s2);
    var diff = curr - prev;
    rowParts.push(diff.toString().padStart(12));
    prev = curr;
  });
  console.log(rowParts.join(''));
});
