const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

async function main() {
  console.log('\n=== ROW COUNT PER YEAR in emissions_data ===');
  for (const yr of [2021, 2022, 2023, 2024, 2025, 2026]) {
    // Query without limit (default 1000)
    const { data: d1 } = await supabase.from('emissions_data').select('id,category').eq('year', yr);
    // Query with limit 5000
    const { data: d2 } = await supabase.from('emissions_data').select('id,category').eq('year', yr).limit(5000);
    const cap = d1?.length === 1000 ? ' ← ⚠️ HIT 1000 CAP!' : '';
    console.log(`  ${yr}: default=${d1?.length ?? 'err'} | limit5000=${d2?.length ?? 'err'}${cap}`);
  }

  // Total all years
  const { data: all1 } = await supabase.from('emissions_data').select('id');
  const { data: all2 } = await supabase.from('emissions_data').select('id').limit(10000);
  console.log(`\n  ALL YEARS: default=${all1?.length} | limit10000=${all2?.length}`);
  if (all1?.length === 1000) console.log('  ⚠️ Default query is CAPPED at 1000 — multi-year queries are truncated!');

  // Check specific Long An 2025 diesel data
  const { data: la } = await supabase.from('emissions_data')
    .select('month,category,activity_data,emissions_tco2e,activity_unit')
    .eq('year', 2025)
    .eq('scope', 'scope_1')
    .ilike('factory_id', '%')
    .order('month')
    .limit(5000);

  // Get Long An factory id
  const { data: facs } = await supabase.from('factories').select('*');
  const la_fac = facs?.find(f => f.name?.includes('Long An') || f.code === 'FAC-B');
  console.log(`\n  Long An factory: ${la_fac?.id} (${la_fac?.name})`);

  const { data: laData } = await supabase.from('emissions_data')
    .select('month,category,activity_data,emissions_tco2e')
    .eq('year', 2025)
    .eq('factory_id', la_fac?.id)
    .eq('scope', 'scope_1')
    .order('month')
    .limit(500);

  console.log('\n  Long An 2025 Scope 1 records:');
  for (const r of (laData || [])) {
    console.log(`    M${String(r.month).padStart(2,'0')} ${r.category.padEnd(15)} act=${r.activity_data} em=${r.emissions_tco2e}`);
  }
}
main().catch(console.error);
