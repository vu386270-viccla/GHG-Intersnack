/**
 * Patch: Long An 2025 diesel - update Aug from 600L to 1700L
 * Total year 2025 diesel = 1700L → emissions = 1700 × 2.68 / 1000 = 4.556 tCO2e (= 4556 kgCO2e)
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const EF_DIESEL_VN = 2.68; // kg CO2e per litre
const NEW_DIESEL_L  = 1700;
const OLD_DIESEL_L  = 600;
const MONTH         = 8;    // August (only month with diesel in CSV)

async function main() {
  // Get Long An factory ID
  const { data: factories } = await supabase.from('factories').select('*');
  const longAn = factories.find(f => f.code === 'FAC-B' || f.name?.includes('Long An'));
  if (!longAn) { console.error('Long An factory not found!'); return; }
  console.log(`Long An ID: ${longAn.id} (${longAn.name})`);

  // Show current record
  const { data: current } = await supabase
    .from('emissions_data')
    .select('*')
    .eq('factory_id', longAn.id)
    .eq('year', 2025)
    .eq('month', MONTH)
    .eq('scope', 'scope_1')
    .eq('category', 'diesel');

  console.log('\nCurrent diesel record for Long An Aug 2025:');
  console.log(current);

  const newEmissions = Math.round(NEW_DIESEL_L * EF_DIESEL_VN) / 1000; // tCO2e
  console.log(`\nUpdating: ${OLD_DIESEL_L}L → ${NEW_DIESEL_L}L`);
  console.log(`New emissions_tco2e: ${newEmissions} tCO2e (= ${newEmissions * 1000} kgCO2e)`);

  // Upsert (update existing Aug diesel record)
  const { error } = await supabase
    .from('emissions_data')
    .upsert({
      factory_id:      longAn.id,
      year:            2025,
      month:           MONTH,
      scope:           'scope_1',
      category:        'diesel',
      activity_data:   NEW_DIESEL_L,
      activity_unit:   'litre',
      emissions_tco2e: newEmissions,
    }, { onConflict: 'factory_id,year,month,scope,category' });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  console.log('✅ Updated successfully!');

  // Verify
  const { data: after } = await supabase
    .from('emissions_data')
    .select('month,category,activity_data,activity_unit,emissions_tco2e')
    .eq('factory_id', longAn.id)
    .eq('year', 2025)
    .eq('scope', 'scope_1')
    .eq('category', 'diesel');

  console.log('\nVerification — Long An 2025 diesel after update:');
  for (const r of (after || [])) {
    console.log(`  M${String(r.month).padStart(2,'0')}: ${r.activity_data}L → ${r.emissions_tco2e} tCO2e (${(r.emissions_tco2e * 1000).toFixed(2)} kgCO2e)`);
  }

  // Check total Scope 1 for Long An 2025
  const { data: all } = await supabase
    .from('emissions_data')
    .select('category,activity_data,emissions_tco2e')
    .eq('factory_id', longAn.id)
    .eq('year', 2025)
    .eq('scope', 'scope_1')
    .limit(500);

  const totalS1 = (all || []).reduce((s, r) => s + Number(r.emissions_tco2e), 0);
  const dieselTotal = (all || []).filter(r => r.category === 'diesel').reduce((s, r) => s + Number(r.emissions_tco2e), 0);
  console.log(`\nLong An 2025 Scope 1 Total: ${(totalS1 * 1000).toFixed(2)} kgCO2e`);
  console.log(`  → Diesel total: ${(dieselTotal * 1000).toFixed(2)} kgCO2e (MIS: 4556.00)`);
  console.log(`  → Scope 1 Total vs MIS: Dashboard=${(totalS1 * 1000).toFixed(2)} | MIS=51615.34 | Diff=${((totalS1*1000) - 51615.34).toFixed(2)}`);
}

main().catch(console.error);
