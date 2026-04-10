const fs = require('fs');
const text = fs.readFileSync('./scripts/RAW_DATA.csv', 'utf8');
const lines = text.split(/\r?\n/).filter(l => {
  const t = l.trim();
  return t && !t.startsWith(',') && !t.startsWith('-') && !t.startsWith('Source') && !t.startsWith('MIX') && !t.startsWith('Plant');
});

// EF from calc_emissions.js (current code)
const EF_WOOD_CURRENT = 1.83;  // tCO2e per ton — THIS IS THE KEY

// EF from HSE / types.ts
const EF_WOOD_HSE = 0.028;     // tCO2e per ton (= 28 kg CO2e/ton)

// MIS data from screenshot (Boiler = wood only, in kg CO2e)
const MIS_DATA = {
  LongAn:    { boilerKg: 43812.72 },
  PhanThiet: { boilerKg: 44915.58 },
  TayNinh:   { boilerKg: 52835.16 },
  Tuticorin: { boilerKg: 47811.40 },
};

console.log('\n====================================================================');
console.log('  SCOPE 1 BOILER (Firewood only) — 2025 Raw Data Analysis');
console.log('====================================================================');
console.log('Checking EF used in calc_emissions.js vs HSE EF vs MIS numbers\n');

const woodByPlant = {};

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

  const wood = parse(rawCols[3]);
  const month = dateStr;

  if (!woodByPlant[plant]) woodByPlant[plant] = { totalWood: 0, months: [] };
  woodByPlant[plant].totalWood += wood;
  woodByPlant[plant].months.push({ m: month, wood });
});

console.log(`${'Plant'.padEnd(12)} | ${'Wood(ton)'.padStart(10)} | ${'Curr EF(1.83)'.padStart(14)} | ${'HSE EF(0.028)'.padStart(14)} | ${'MIS(kgCO2e)'.padStart(12)} | ${'MIS→tCO2e'.padStart(10)} | ${'Curr vs MIS'.padStart(12)} | ${'HSE vs MIS'.padStart(11)}`);
console.log('-'.repeat(115));

for (const [plant, v] of Object.entries(woodByPlant)) {
  const currEm = v.totalWood * EF_WOOD_CURRENT;        // tCO2e using 1.83
  const hseEm  = v.totalWood * EF_WOOD_HSE;            // tCO2e using 0.028

  // Match MIS (fuzzy name matching)
  const misKey = Object.keys(MIS_DATA).find(k => plant.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(plant.toLowerCase().replace('phan thiet', 'phanthiet')));
  const mis = misKey ? MIS_DATA[misKey] : null;
  const misT = mis ? mis.boilerKg / 1000 : null;  // kg → tCO2e
  const diffCurr = misT ? (currEm - misT) : null;
  const diffHSE  = misT ? (hseEm  - misT) : null;

  console.log(
    `${plant.padEnd(12)} | ${v.totalWood.toFixed(2).padStart(10)} | ${currEm.toFixed(2).padStart(14)} | ${hseEm.toFixed(2).padStart(14)} | ` +
    (mis ? mis.boilerKg.toFixed(2).padStart(12) : '       N/A  ') + ' | ' +
    (misT ? misT.toFixed(2).padStart(10) : '     N/A  ') + ' | ' +
    (diffCurr !== null ? ((diffCurr >= 0 ? '+' : '') + diffCurr.toFixed(2)).padStart(12) : '       N/A  ') + ' | ' +
    (diffHSE  !== null ? ((diffHSE  >= 0 ? '+' : '') + diffHSE.toFixed(2)).padStart(11) : '      N/A ')
  );
}

console.log('\n====================================================================');
console.log('KEY FINDINGS:');
console.log('====================================================================');
console.log(`EF in calc_emissions.js = ${EF_WOOD_CURRENT} tCO2e/ton (Firewood)`);
console.log(`EF from HSE (types.ts)  = ${EF_WOOD_HSE} tCO2e/ton (= 28 kg CO2e/ton)`);
console.log(`Ratio: ${EF_WOOD_CURRENT} / ${EF_WOOD_HSE} = ${(EF_WOOD_CURRENT / EF_WOOD_HSE).toFixed(2)}x`);
console.log('');
console.log('The MIS system uses HSE raw data × 0.028 tCO2e/ton');
console.log(`Our script uses 1.83 tCO2e/ton — that is ${(EF_WOOD_CURRENT/EF_WOOD_HSE).toFixed(1)}x HIGHER than HSE EF!`);
console.log('');
console.log('Why 1.83? This looks like it may include NCV conversion:');
console.log('  NCV of firewood ≈ 15 GJ/ton');
console.log('  IPCC EF biomass ≈ 112 kg CO2/GJ');
console.log('  1.83 tCO2e/ton ≈ using some intermediate EF chain...');
console.log('');

// What EF would reconcile with MIS?
console.log('--- Back-calculation: what EF to match MIS? ---');
for (const [plant, v] of Object.entries(woodByPlant)) {
  const misKey = Object.keys(MIS_DATA).find(k => plant.toLowerCase().includes(k.toLowerCase()));
  if (!misKey) continue;
  const misT = MIS_DATA[misKey].boilerKg / 1000;
  const impliedEF = misT / v.totalWood;
  console.log(`  ${plant}: ${v.totalWood.toFixed(1)} ton × EF = ${MIS_DATA[misKey].boilerKg.toFixed(2)} kgCO2e → implied EF = ${impliedEF.toFixed(4)} tCO2e/ton (= ${(impliedEF*1000).toFixed(2)} kgCO2e/ton)`);
}
