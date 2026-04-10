const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

// MIS 2025 Phan Thiet reference (kgCO₂e)
const MIS = { boiler: 44915.58, diesel: 2698.76, wwts: 2193.11, s1: 49807.46, elec: 2511937.98 };
const EF  = { wood: 0.028, diesel_vn: 0.00268, wwts: 0.0002013, elec_vn: 0.0006592, elec_vn_units: 'tCO2e/kWh' };

async function main() {
  const { data: rows, error } = await s
    .from('emissions_data')
    .select('scope,category,activity_data,activity_unit,emissions_tco2e,month')
    .eq('factory_id', '0a586cb1-60e9-4d36-8073-ddc002c88c0d')
    .eq('year', 2025)
    .limit(500);

  if (error) { console.error(error); return; }

  const bycat = {};
  for (const x of rows) {
    if (!bycat[x.category]) bycat[x.category] = { act: 0, em: 0, unit: x.activity_unit };
    bycat[x.category].act += Number(x.activity_data);
    bycat[x.category].em  += Number(x.emissions_tco2e);
  }

  console.log('\n=== Phan Thiet 2025 — DB vs MIS ===\n');
  console.log(`${'Category'.padEnd(18)} ${'Activity'.padStart(14)} ${'Unit'.padEnd(8)} ${'DB (kgCO2e)'.padStart(14)} ${'MIS (kgCO2e)'.padStart(14)} ${'Diff'.padStart(10)}`);
  console.log('-'.repeat(82));

  const print = (cat, misVal) => {
    const v = bycat[cat] || { act: 0, em: 0, unit: '-' };
    const dbKg = v.em * 1000;
    const diff = misVal != null ? dbKg - misVal : null;
    const pct  = misVal > 0 ? (diff / misVal * 100).toFixed(1) : '-';
    const flag = diff == null ? '' : Math.abs(diff) < 5 ? '✅' : Math.abs(Number(pct)) < 1 ? '⚠️' : '❌';
    const diffStr = diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} (${pct}%) ${flag}` : '-';
    console.log(`${cat.padEnd(18)} ${v.act.toFixed(2).padStart(14)} ${(v.unit||'').padEnd(8)} ${dbKg.toFixed(2).padStart(14)} ${(misVal||'N/A').toString().padStart(14)} ${diffStr}`);
  };

  print('wood_logs',   MIS.boiler);
  print('diesel',      MIS.diesel);
  print('wastewater',  MIS.wwts);
  print('lpg',         0);
  print('fgas_r134a',  0);
  print('fgas_r410a',  0);
  print('co2_packing', 0);
  print('electricity',  MIS.elec);

  // Scope 1 total
  const s1 = ['wood_logs','diesel','wastewater','lpg','fgas_r134a','fgas_r410a','co2_packing','co2_pccc']
    .reduce((sum, c) => sum + (bycat[c]?.em || 0), 0) * 1000;
  console.log('-'.repeat(82));
  console.log(`${'SCOPE 1 TOTAL'.padEnd(18)} ${' '.padStart(14)} ${' '.padEnd(8)} ${s1.toFixed(2).padStart(14)} ${MIS.s1.toString().padStart(14)} ${(s1 - MIS.s1 >= 0 ? '+' : '') + (s1 - MIS.s1).toFixed(1)} (${((s1-MIS.s1)/MIS.s1*100).toFixed(2)}%)`);

  // Activity breakdown for water and wood
  console.log('\n--- Activity data cross-check ---');
  const wood = bycat['wood_logs'];
  const wwts = bycat['wastewater'];
  const elec = bycat['electricity'];
  const diesel = bycat['diesel'];
  if (wood)   console.log(`Wood:       DB=${wood.act.toFixed(2)} ton  → expected MIS=${(MIS.boiler/EF.wood/1000).toFixed(2)} ton (÷${EF.wood} tCO2e/ton×1000)`);
  if (diesel) console.log(`Diesel:     DB=${diesel.act.toFixed(2)} L    → expected MIS=${(MIS.diesel/EF.diesel_vn/1000).toFixed(2)} L (÷${EF.diesel_vn} tCO2e/L×1000)`);
  if (wwts)   console.log(`Water:      DB=${wwts.act.toFixed(2)} m³   → expected MIS=${(MIS.wwts/EF.wwts/1000).toFixed(2)} m³ (÷${EF.wwts} tCO2e/m³×1000)`);
  if (elec)   console.log(`Elec:       DB=${elec.act.toFixed(2)} kWh  → expected MIS=${(MIS.elec/EF.elec_vn/1000).toFixed(2)} kWh (÷${EF.elec_vn})`);
}

main().catch(console.error);
