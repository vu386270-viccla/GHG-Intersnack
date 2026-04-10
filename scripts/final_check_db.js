/**
 * Final comparison: Dashboard (DB) vs MIS 2025 — after all fixes
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

// ── MIS 2025 from screenshot (kgCO₂e) ──
const MIS = {
  LongAn:    { boiler:43812.72, forklift:0,       vehicles:4556.00,   packing:66.00,  fgas:0,      wwts:3180.62,  s1:51615.34,   elec:2799480.77 },
  PhanThiet: { boiler:44915.58, forklift:0,       vehicles:2698.76,   packing:0,      fgas:0,      wwts:2193.11,  s1:49807.46,   elec:2511937.98 },
  TayNinh:   { boiler:52835.16, forklift:0,       vehicles:38307.92,  packing:0,      fgas:0,      wwts:3678.10,  s1:94821.18,   elec:3195908.81 },
  Tuticorin: { boiler:47811.40, forklift:3841.04, vehicles:130071.12, packing:658.00, fgas:27440,  wwts:4099.80,  s1:213921.36,  elec:3658722.30 },
};

const PLANT_NAMES = { LongAn:'Long An', PhanThiet:'Phan Thiết', TayNinh:'Tây Ninh', Tuticorin:'Tuticorin' };
const FAC_IDS = {
  LongAn:    '7040a994-d776-410b-a429-19c0269e2697',
  PhanThiet: '0a586cb1-60e9-4d36-8073-ddc002c88c0d',
  TayNinh:   '041d71b2-f002-438d-b711-3f6195f0c4e5',
  Tuticorin: '6a400f3d-059a-43e7-88ae-d5441ae7c7b5',
};

async function main() {
  const { data: factories } = await supabase.from('factories').select('*');
  const facMap = Object.fromEntries(factories.map(f => [f.name?.replace(/\s+/g,''), f.id]));

  const { data: rows } = await supabase.from('emissions_data')
    .select('factory_id,scope,category,activity_data,emissions_tco2e')
    .eq('year', 2025)
    .limit(5000);

  // Group by factory
  const byFac = {};
  for (const r of rows || []) {
    if (!byFac[r.factory_id]) byFac[r.factory_id] = [];
    byFac[r.factory_id].push(r);
  }

  const fmt = v => (v||0).toFixed(2);
  const d   = (a, b) => {
    if (b == null) return '     N/A';
    const diff = a - b, pct = b !== 0 ? diff/b*100 : 0;
    const icon = Math.abs(diff) < 5 ? '✅' : Math.abs(pct) < 1 ? '⚠️' : '❌';
    return `${icon} ${diff>=0?'+':''}${diff.toFixed(1)} (${pct>=0?'+':''}${pct.toFixed(1)}%)`;
  };

  let totalDash=0, totalMIS=0;

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' FINAL CHECK: Dashboard (DB) vs MIS 2025 — all categories (kgCO₂e)');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  for (const [key, misData] of Object.entries(MIS)) {
    const facName = PLANT_NAMES[key];
    const facId   = FAC_IDS[key];
    const recs    = facId ? (byFac[facId] || []) : [];

    const s1 = scope => recs.filter(r => r.scope === scope);
    const sum = (arr, cat) => arr.filter(r => r.category === cat).reduce((s,r) => s + Number(r.emissions_tco2e), 0);

    const emBoiler   = sum(s1('scope_1'), 'wood_logs')  * 1000;
    const emForklift = sum(s1('scope_1'), 'lpg')        * 1000;
    const emVehicles = sum(s1('scope_1'), 'diesel')     * 1000;
    const emPacking  = (sum(s1('scope_1'), 'co2_packing') + sum(s1('scope_1'), 'co2_pccc')) * 1000;
    const emPackOnly = sum(s1('scope_1'), 'co2_packing') * 1000;
    const emFgas     = (sum(s1('scope_1'),'fgas_r134a') + sum(s1('scope_1'),'fgas_r410a') + sum(s1('scope_1'),'fgas_r404a')) * 1000;
    const emWwts     = sum(s1('scope_1'), 'wastewater') * 1000;
    const emS1Total  = recs.filter(r => r.scope === 'scope_1').reduce((s,r) => s + Number(r.emissions_tco2e), 0) * 1000;
    const emElec     = recs.filter(r => r.scope === 'scope_2').reduce((s,r) => s + Number(r.emissions_tco2e), 0) * 1000;

    console.log(`┌──── ${facName} ${'─'.repeat(55-facName.length)}`);
    console.log(`│  Category             Dashboard kgCO₂e    MIS kgCO₂e   Difference`);
    console.log(`│  ${'─'.repeat(65)}`);
    console.log(`│  Boiler (Wood)     ${fmt(emBoiler).padStart(12)}   ${fmt(misData.boiler).padStart(12)}   ${d(emBoiler, misData.boiler)}`);
    console.log(`│  Forklift (LPG)    ${fmt(emForklift).padStart(12)}   ${fmt(misData.forklift).padStart(12)}   ${d(emForklift, misData.forklift)}`);
    console.log(`│  Other Veh (Diesel)${fmt(emVehicles).padStart(12)}   ${fmt(misData.vehicles).padStart(12)}   ${d(emVehicles, misData.vehicles)}`);
    console.log(`│  Packing (CO2)     ${fmt(emPackOnly).padStart(12)}   ${fmt(misData.packing).padStart(12)}   ${d(emPackOnly, misData.packing)}`);
    console.log(`│  Refrigeration     ${fmt(emFgas).padStart(12)}   ${fmt(misData.fgas).padStart(12)}   ${d(emFgas, misData.fgas)}`);
    console.log(`│  WWTS              ${fmt(emWwts).padStart(12)}   ${fmt(misData.wwts).padStart(12)}   ${d(emWwts, misData.wwts)}`);
    console.log(`│  ${'─'.repeat(65)}`);
    console.log(`│  SCOPE 1 TOTAL     ${fmt(emS1Total).padStart(12)}   ${fmt(misData.s1).padStart(12)}   ${d(emS1Total, misData.s1)}`);
    console.log(`│  Electricity(S2)   ${fmt(emElec).padStart(12)}   ${fmt(misData.elec).padStart(12)}   ${d(emElec, misData.elec)}`);
    console.log(`└${'─'.repeat(68)}\n`);

    totalDash += emS1Total;
    totalMIS  += misData.s1;
  }

  console.log(`  ► GRAND TOTAL Scope 1: Dashboard=${totalDash.toFixed(0)} | MIS=${totalMIS.toFixed(0)} | Diff=${(totalDash-totalMIS).toFixed(0)} (${((totalDash-totalMIS)/totalMIS*100).toFixed(2)}%)`);
}
main().catch(console.error);
