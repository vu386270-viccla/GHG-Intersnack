const fs = require('fs');
const csv = fs.readFileSync('scripts/RAW_DATA.csv', 'utf8');
const lines = csv.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Source') && !l.startsWith('---') && !l.startsWith(','));

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
  INDIA_EF: 0.8928,
  WASTEWATER_VN: 0.2315,
  WASTEWATER_IN: 0.2315
};

const plants = ['PhanThiet','LongAn','TayNinh','Tuticorin'];
const years = [2021,2022,2023,2024,2025];

// Store emissions in grams
let data = {};
plants.forEach(p => {
  data[p] = {};
  years.forEach(y => {
    data[p][y] = { s1: 0, s2: 0 };
  });
});

lines.forEach(line => {
  const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
  if (cols.length < 13) return;
  const plant = cols[1];
  if (!plants.includes(plant)) return;
  const dateStr = cols[2];
  if (!dateStr) return;
  let parts = dateStr.split('/');
  if (parts.length !== 2) parts = dateStr.split('-');
  if (parts.length !== 2) return;
  const yearStr = parts[1];
  let year = parseInt(yearStr);
  if (year < 100) year += 2000;
  if (year < 2021 || year > 2025) return;

  const wood = parseFloat(cols[3]) || 0;
  const wastewater = parseFloat(cols[4]) || 0;
  const lpg = parseFloat(cols[5]) || 0;
  const diesel = parseFloat(cols[6]) || 0;
  const r134a = parseFloat(cols[7]) || 0;
  const r410a = parseFloat(cols[8]) || 0;
  const r404a = parseFloat(cols[9]) || 0;
  const co2pack = parseFloat(cols[10]) || 0;
  const co2pccc = parseFloat(cols[11]) || 0;
  const kwh = parseFloat(cols[12]) || 0;

  // Scope1 tCO2e
  const s1_t = wood * EF.WOOD_VN
    + lpg * EF.LPG_VN
    + diesel * EF.DIESEL_VN
    + r134a * EF.R134A / 1000
    + r410a * EF.R410A / 1000
    + r404a * EF.R404A / 1000
    + co2pack * EF.CO2_PACKING / 1000
    + co2pccc * EF.CO2_PCCC / 1000
    + wastewater * (plant === 'Tuticorin' ? EF.WASTEWATER_IN : EF.WASTEWATER_VN) / 1000;

  // Scope2 tCO2e
  const ef = plant === 'Tuticorin' ? EF.INDIA_EF : EF.VN_EF;
  const s2_t = kwh * ef / 1000;

  // Convert to grams
  data[plant][year].s1 += s1_t * 1e6;
  data[plant][year].s2 += s2_t * 1e6;
});

// Function to format large numbers with commas
function fmt(n) {
  return n.toLocaleString('en-US');
}

// Print absolute emissions (gCO2e)
console.log('=== Absolute Emissions (gCO2e) ===');
console.log('\nScope1:');
console.log('Year,' + plants.join(','));
years.forEach(y => {
  const row = plants.map(p => Math.round(data[p][y].s1)).join(',');
  console.log(`${y},${row}`);
});

console.log('\nScope2:');
console.log('Year,' + plants.join(','));
years.forEach(y => {
  const row = plants.map(p => Math.round(data[p][y].s2)).join(',');
  console.log(`${y},${row}`);
});

console.log('\nTotal (S1+S2):');
console.log('Year,' + plants.join(','));
years.forEach(y => {
  const row = plants.map(p => Math.round(data[p][y].s1 + data[p][y].s2)).join(',');
  console.log(`${y},${row}`);
});

// Print YoY change (gCO2e)
console.log('\n\n=== Year-over-Year Change (gCO2e) ===');
console.log('\nScope1 Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const diff = Math.round(data[p][y].s1 - data[p][prev].s1);
    const sign = diff >= 0 ? '+' : '';
    return sign + diff.toLocaleString('en-US');
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}

console.log('\nScope2 Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const diff = Math.round(data[p][y].s2 - data[p][prev].s2);
    const sign = diff >= 0 ? '+' : '';
    return sign + diff.toLocaleString('en-US');
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}

console.log('\nTotal Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const diff = Math.round((data[p][y].s1 + data[p][y].s2) - (data[p][prev].s1 + data[p][prev].s2));
    const sign = diff >= 0 ? '+' : '';
    return sign + diff.toLocaleString('en-US');
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}

// Also print percentage change
console.log('\n\n=== Year-over-Year % Change ===');
console.log('\nScope1 % Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const base = data[p][prev].s1;
    if (base === 0) return 'N/A';
    const pct = ((data[p][y].s1 - base) / base * 100).toFixed(1);
    return pct + '%';
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}

console.log('\nScope2 % Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const base = data[p][prev].s2;
    if (base === 0) return 'N/A';
    const pct = ((data[p][y].s2 - base) / base * 100).toFixed(1);
    return pct + '%';
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}

console.log('\nTotal % Change:');
console.log('Year,' + plants.join(','));
for (let i = 1; i < years.length; i++) {
  const y = years[i];
  const prev = years[i-1];
  const row = plants.map(p => {
    const base = data[p][prev].s1 + data[p][prev].s2;
    if (base === 0) return 'N/A';
    const pct = ((data[p][y].s1 + data[p][y].s2 - base) / base * 100).toFixed(1);
    return pct + '%';
  }).join(',');
  console.log(`${y} vs ${prev},${row}`);
}
