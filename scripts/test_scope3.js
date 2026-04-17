const { createClient } = require('@supabase/supabase-js');

// Use anon key — run raw SQL via Supabase rpc
// If this works, the table just needs a SELECT policy.
// Alternative: use Supabase Dashboard > Authentication > Policies
const s = createClient(
    'https://irbvgsyzidqnzhpetmdk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

async function main() {
    // Test anon vs auth: fetch count
    const { data, error, count } = await s
        .from('scope3_transport_data')
        .select('id', { count: 'exact', head: true });

    console.log('Anon total count:', count, '| error:', error?.message || 'none');

    // Also check what RLS policies exist via information_schema (won't work via anon, just try)
    const { data: pol } = await s.rpc('get_policies_for_table', { tbl: 'scope3_transport_data' }).maybeSingle();
    console.log('RLS policies RPC:', pol);
}
main().catch(console.error);
