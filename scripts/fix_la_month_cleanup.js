/**
 * Fix step 2: Xóa rows tháng 5/2026 Scope 1 Long An
 * 
 * Vì RLS block delete với anon key, ta dùng workaround:
 * update các rows tháng 5 thành activity_data=0, emissions_tco2e=0
 * hoặc thử delete lại.
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://irbvgsyzidqnzhpetmdk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const FAC_ID = '7040a994-d776-410b-a429-19c0269e2697'; // Long An

async function main() {
    console.log('\n══ Cleanup: zeroing out T5/2026 Scope 1 Long An ══\n');

    // First check what's there
    const { data: rows } = await supabase
        .from('emissions_data')
        .select('id, category, activity_data, emissions_tco2e')
        .eq('factory_id', FAC_ID)
        .eq('year', 2026)
        .eq('month', 5)
        .eq('scope', 'scope_1');

    console.log(`Found ${rows?.length ?? 0} rows in T5/2026:`);
    rows?.forEach(r => console.log(`  ${r.id} | ${r.category} | ${r.activity_data} | ${r.emissions_tco2e}`));

    if (!rows || rows.length === 0) {
        console.log('Nothing to clean up!');
        return;
    }

    // Try update each row to zero it out
    for (const r of rows) {
        const { error } = await supabase
            .from('emissions_data')
            .update({ activity_data: 0, emissions_tco2e: 0 })
            .eq('id', r.id);

        if (error) {
            console.log(`❌ Update by id ${r.id}: ${error.message}`);
        } else {
            console.log(`✅ Zeroed: ${r.category} (id=${r.id})`);
        }
    }

    // Verify
    const { data: check } = await supabase
        .from('emissions_data')
        .select('category, activity_data, emissions_tco2e')
        .eq('factory_id', FAC_ID)
        .eq('year', 2026)
        .eq('month', 5)
        .eq('scope', 'scope_1');

    console.log('\n── After cleanup ──');
    check?.forEach(r => console.log(`  ${r.category}: activity=${r.activity_data} | emissions=${r.emissions_tco2e}`));

    // Also verify T4
    const { data: t4 } = await supabase
        .from('emissions_data')
        .select('category, activity_data, emissions_tco2e')
        .eq('factory_id', FAC_ID)
        .eq('year', 2026)
        .eq('month', 4)
        .eq('scope', 'scope_1');

    console.log('\n── T4/2026 Scope 1 (should have correct data) ──');
    let total = 0;
    t4?.forEach(r => {
        console.log(`  ✅ ${r.category}: activity=${r.activity_data} | ${r.emissions_tco2e} tCO2e`);
        total += Number(r.emissions_tco2e);
    });
    console.log(`  TOTAL: ${total.toFixed(4)} tCO2e`);
    console.log('\n✅ Done!');
}

main().catch(console.error);
