/**
 * Insert Scope 3 transport & purchasing raw data into scope3_transport_data
 * Run AFTER executing migrations/create_scope3_tables.sql in Supabase
 *
 * Categories:
 *   - em_vessel_kg  = km_ton_vessel * 0.01604  (Cat.4/9 Ocean)
 *   - em_road_kg    = km_ton_road   * 0.07547  (Cat.4/9 Road)
 *   - em_cashew_kg  = shipped_qty   * cashew_EF (Cat.1 Purchased Goods)
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

// Cashew EF per origin country (kg CO2e / kg RCN)
const CASHEW_EF = {
  'BENIN':        2.13,
  'BISSAU':       9.82,    // Guinea-Bissau
  'GHANA':        2.2,
  'INDIA':        4.24971,
  'IVORY COAST':  11.2396,
  'CAMBODIA':     2.7,
  'TANZANIA':     14.96,
  'CONAKRY':      9.82,    // Guinea generic proxy
  'INDONESIA':    24.74,
  'SENEGAL':      9.82,
  'VIETNAM':      11.2396,
  'NIGERIA':      1.56,
};

// Raw data from MIS screenshot
// [region, year, origin, shipped_qty_mts, km_ton_vessel, km_ton_road]
const RAW = [
  // 2021
  ['India', 2021, 'BENIN',        4219.435,   66046816.05,   118144.18],
  ['India', 2021, 'BISSAU',      12655.400,  167608117.60,   354351.20],
  ['India', 2021, 'GHANA',        5128.359,   78889546.50,   143594.05],
  ['India', 2021, 'INDIA',        1173.774,          0.00,  1432004.28],
  ['India', 2021, 'IVORY COAST', 10998.735,  164387093.31,   307964.58],
  ['VN',    2021, 'CAMBODIA',     4788.658,          0.00,  1556313.85],
  ['VN',    2021, 'GHANA',        9657.741,  187124758.31,  1545238.56],
  ['VN',    2021, 'IVORY COAST', 24413.118,  462349104.73,  3887233.64],
  ['VN',    2021, 'TANZANIA',     4054.482,   35194217.41,   648717.12],
  // 2022
  ['India', 2022, 'BISSAU',      15844.051,  209838611.44,   443633.43],
  ['India', 2022, 'IVORY COAST', 21272.078,  317932477.79,   595618.18],
  ['VN',    2022, 'BISSAU',       5058.493,   87191038.34,   809358.88],
  ['VN',    2022, 'CAMBODIA',     3218.544,          0.00,  1046026.80],
  ['VN',    2022, 'CONAKRY',      1061.780,   18694722.24,   169884.80],
  ['VN',    2022, 'GHANA',        9916.871,  192145563.75,  1535081.00],
  ['VN',    2022, 'IVORY COAST', 10909.613,  206612273.10,  1742114.76],
  ['VN',    2022, 'SENEGAL',      2015.361,   33857041.00,   322457.76],
  ['VN',    2022, 'TANZANIA',    13734.870,  119223121.70,  2197579.20],
  // 2023
  ['India', 2023, 'GHANA',        5096.950,   78406381.85,   142714.60],
  ['India', 2023, 'IVORY COAST', 11219.891,  167692490.89,   314156.95],
  ['VN',    2023, 'BISSAU',       7320.763,  126184799.98,  1041631.36],
  ['VN',    2023, 'CAMBODIA',     8358.156,          0.00,  1053127.66],
  ['VN',    2023, 'GHANA',         500.420,    8317831.11,    80067.20],
  ['VN',    2023, 'INDONESIA',    1454.815,    3241263.81,   183306.69],
  ['VN',    2023, 'IVORY COAST', 11669.190,  220997561.61,  1763202.92],
  ['VN',    2023, 'SENEGAL',      1069.222,   17962386.44,   171075.52],
  ['VN',    2023, 'TANZANIA',    15381.260,  133514320.33,  2021047.38],
  ['VN',    2023, 'VIETNAM',      1025.840,          0.00,         0.00],
  // 2024
  ['India', 2024, 'BISSAU',      11896.928,   70131027.46,  6114313.98],
  ['India', 2024, 'GHANA',        1543.215,   14043256.50,    43210.02],
  ['India', 2024, 'IVORY COAST',  2461.170,   23262978.84,    68912.76],
  ['India', 2024, 'TANZANIA',     2409.342,    1138240.35,    67461.58],
  ['VN',    2024, 'BISSAU',       4644.537,   66196622.90,   631723.66],
  ['VN',    2024, 'CAMBODIA',     2429.389,          0.00,   306103.01],
  ['VN',    2024, 'GHANA',        1490.565,   26867671.89,   204764.61],
  ['VN',    2024, 'INDONESIA',    4098.460,   37831188.33,   586065.16],
  ['VN',    2024, 'IVORY COAST',  9001.417,  159897817.92,  1268135.04],
  ['VN',    2024, 'SENEGAL',      1315.548,   22683401.73,   206875.86],
  ['VN',    2024, 'TANZANIA',    13178.755,  115835641.43,  1752502.79],
  ['VN',    2024, 'VIETNAM',       484.435,    4040853.88,    61038.81],
  // 2025
  ['India', 2025, 'BISSAU',       7835.910,   73006976.32,   219405.48],
  ['India', 2025, 'GHANA',        4809.167,   82390649.04,   134656.68],
  ['India', 2025, 'IVORY COAST',  5541.000,   91225153.80,   155148.00],
  ['India', 2025, 'NIGERIA',      1060.288,   20622601.60,    29688.06],
  ['India', 2025, 'TANZANIA',     2105.350,   25163143.20,    58949.80],
  ['VN',    2025, 'BISSAU',       7472.335,   69738452.65,   989342.79],
  ['VN',    2025, 'CAMBODIA',     3241.040,          0.00,   408371.04],
  ['VN',    2025, 'CONAKRY',      1276.164,   19431851.46,   204186.24],
  ['VN',    2025, 'GHANA',        2978.571,   51188929.53,   417197.67],
  ['VN',    2025, 'INDONESIA',     983.860,     826994.54,   123966.36],
  ['VN',    2025, 'IVORY COAST', 10988.664,  167922832.58,  1555829.83],
  ['VN',    2025, 'NIGERIA',      1139.757,   18746279.15,   143609.38],
  ['VN',    2025, 'SENEGAL',      3321.460,   58999913.07,   418503.96],
  ['VN',    2025, 'TANZANIA',    13386.824,  127562019.77,  1863410.11],
  ['VN',    2025, 'VIETNAM',       205.371,          0.00,    25876.75],
  // 2026 (partial)
  ['India', 2026, 'TANZANIA',     3249.968,   16214090.35,    90999.10],
  ['VN',    2026, 'BISSAU',        610.001,   11774815.84,    76860.13],
  ['VN',    2026, 'CAMBODIA',        0.000,          0.00,        0.00],
  ['VN',    2026, 'INDONESIA',     156.350,        418.55,    19700.10],
  ['VN',    2026, 'IVORY COAST',   950.000,          0.00,   119700.00],
  ['VN',    2026, 'TANZANIA',    10156.195,   17518685.80,   316667.13],
  ['VN',    2026, 'VIETNAM',         0.000,          0.00,        0.00],
];

async function main() {
  // Build records
  const records = RAW
    .filter(r => r[3] > 0 || r[4] > 0 || r[5] > 0) // skip zero rows
    .map(([region, year, origin, qty, vessel, road]) => {
      const ef = CASHEW_EF[origin] ?? null;
      const em_cashew = ef != null ? +(qty * 1000 * ef).toFixed(2) : null; // kg RCN → kg CO2e
      return {
        region,
        year,
        origin_country: origin,
        shipped_qty_mts: qty,
        km_ton_vessel:   vessel,
        km_ton_road:     road,
        em_cashew_kg:    em_cashew,
        notes: ef == null ? 'No EF mapping for '+origin : null,
      };
    });

  console.log(`Inserting ${records.length} records...`);

  // Upsert in batches
  const BATCH = 20;
  let ok = 0, err = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await s.from('scope3_transport_data').insert(batch).select('id');
    if (error) {
      console.log(`❌ Batch ${i}-${i+BATCH}: ${error.message}`);
      err += batch.length;
    } else {
      ok += data.length;
    }
  }
  console.log(`\n✅ Done — Inserted: ${ok} | Errors: ${err}`);

  // Print summary
  const byYear = {};
  for (const r of records) {
    if (!byYear[r.year]) byYear[r.year] = { qty: 0, vessel_em: 0, road_em: 0, cashew_em: 0 };
    byYear[r.year].qty        += r.shipped_qty_mts;
    byYear[r.year].vessel_em  += r.km_ton_vessel * 0.01604 / 1000; // → tCO2e
    byYear[r.year].road_em    += r.km_ton_road   * 0.07547 / 1000;
    byYear[r.year].cashew_em  += (r.em_cashew_kg || 0) / 1000;
  }
  console.log('\n=== Scope 3 Emission Summary (tCO2e) ===');
  console.log('Year  │  RCN(MTS)  │ Cat.4 Vessel │  Cat.4 Road  │  Cat.1 Cashew │  TOTAL');
  console.log('──────┼────────────┼──────────────┼──────────────┼───────────────┼────────');
  for (const yr of [2021,2022,2023,2024,2025,2026]) {
    const d = byYear[yr] || {};
    const tot = (d.vessel_em||0)+(d.road_em||0)+(d.cashew_em||0);
    console.log(
      `${yr}  │ ${(d.qty||0).toFixed(0).padStart(9)}  │ ${(d.vessel_em||0).toFixed(0).padStart(12)} │ ${(d.road_em||0).toFixed(0).padStart(12)} │ ${(d.cashew_em||0).toFixed(0).padStart(13)} │ ${tot.toFixed(0).padStart(7)}`
    );
  }
}
main().catch(console.error);
