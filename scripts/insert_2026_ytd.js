/**
 * Insert 2026 YTD Scope 3 transport data into scope3_transport_data
 * Source: MIS export — data as of Q1-2026 (partial, not full year)
 *
 * Notes = 'YTD Q1-2026' để dashboard biết đây là data chưa đủ năm
 *
 * Run: node scripts/insert_2026_ytd.js
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

// Cashew EF per origin country (kg CO2e / kg RCN)
const CASHEW_EF = {
  'BENIN':        2.13,
  'BISSAU':       9.82,
  'GHANA':        2.2,
  'INDIA':        4.24971,
  'IVORY COAST':  11.2396,
  'CAMBODIA':     2.7,
  'TANZANIA':     14.96,
  'CONAKRY':      9.82,
  'INDONESIA':    24.74,
  'SENEGAL':      9.82,
  'VIETNAM':      11.2396,
  'NIGERIA':      1.56,
};

// 2026 YTD data (MIS export, partial year)
// [region, year, origin, shipped_qty_mts, km_ton_vessel, km_ton_road]
const RAW_2026 = [
  ['India', 2026, 'TANZANIA',    3249.968,  16214090.35,  90999.10],
  ['VN',    2026, 'BISSAU',       610.001,  11774815.84,  76860.13],
  ['VN',    2026, 'CAMBODIA',       0.000,         0.00,      0.00],
  ['VN',    2026, 'INDONESIA',    156.350,       418.55,  19700.10],
  ['VN',    2026, 'IVORY COAST',  950.000,         0.00, 119700.00],
  ['VN',    2026, 'TANZANIA',   10156.195,  17518685.80, 316667.13],
  ['VN',    2026, 'VIETNAM',        0.000,         0.00,      0.00],
];

const NOTE = 'YTD Q1-2026';

async function main() {
  // 1. Delete any existing 2026 rows (clean re-insert)
  const { error: delErr, count } = await s
    .from('scope3_transport_data')
    .delete()
    .eq('year', 2026);
  if (delErr) {
    console.error('❌ Delete failed:', delErr.message);
    process.exit(1);
  }
  console.log(`🗑️  Cleared existing 2026 rows`);

  // 2. Build insert records
  const records = RAW_2026.map(([region, year, origin, qty, vessel, road]) => {
    const ef = CASHEW_EF[origin] ?? null;
    const em_cashew = ef != null ? +(qty * 1000 * ef).toFixed(2) : null;
    return {
      region,
      year,
      origin_country: origin,
      shipped_qty_mts: qty,
      km_ton_vessel:   vessel,
      km_ton_road:     road,
      em_cashew_kg:    em_cashew,
      notes: NOTE,
    };
  });

  // 3. Preview before inserting
  console.log('\n=== Records to insert ===');
  for (const r of records) {
    const cat1_tco2e = r.em_cashew_kg != null ? (r.em_cashew_kg / 1000).toFixed(2) : 'N/A';
    const cat4v_tco2e = (r.km_ton_vessel * 0.01604 / 1000).toFixed(2);
    const cat4r_tco2e = (r.km_ton_road   * 0.07547 / 1000).toFixed(2);
    console.log(
      `  ${r.region.padEnd(6)} | ${r.origin_country.padEnd(14)} | ` +
      `qty=${r.shipped_qty_mts.toFixed(3).padStart(10)} MTS | ` +
      `Cat.1=${cat1_tco2e.padStart(8)} tCO2e | ` +
      `Cat.4v=${cat4v_tco2e.padStart(8)} | ` +
      `Cat.4r=${cat4r_tco2e.padStart(8)} | ` +
      `notes="${r.notes}"`
    );
  }

  // 4. Insert
  const { data, error } = await s
    .from('scope3_transport_data')
    .insert(records)
    .select('id,region,year,origin_country');

  if (error) {
    console.error('\n❌ Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Inserted ${data.length} rows for 2026 YTD:`);
  for (const r of data) {
    console.log(`   → ${r.region} | ${r.origin_country} | ${r.year}`);
  }

  // 5. Emission summary
  let total_cat1 = 0, total_cat4v = 0, total_cat4r = 0, total_qty = 0;
  for (const r of records) {
    total_qty   += r.shipped_qty_mts;
    total_cat1  += (r.em_cashew_kg || 0) / 1000;
    total_cat4v += r.km_ton_vessel * 0.01604 / 1000;
    total_cat4r += r.km_ton_road   * 0.07547 / 1000;
  }
  const grand = total_cat1 + total_cat4v + total_cat4r;
  console.log('\n=== 2026 YTD Scope 3 Summary (tCO2e) ===');
  console.log(`  Shipped (MTS) : ${total_qty.toFixed(3)}`);
  console.log(`  Cat.1 Cashew  : ${total_cat1.toFixed(2)} tCO2e`);
  console.log(`  Cat.4 Vessel  : ${total_cat4v.toFixed(2)} tCO2e`);
  console.log(`  Cat.4 Road    : ${total_cat4r.toFixed(2)} tCO2e`);
  console.log(`  ─────────────────────────────`);
  console.log(`  TOTAL Scope 3 : ${grand.toFixed(2)} tCO2e`);
  console.log('\n⚠️  Data is PARTIAL (YTD Q1-2026) — dashboard will show partial data badge.');
}

main().catch(console.error);
