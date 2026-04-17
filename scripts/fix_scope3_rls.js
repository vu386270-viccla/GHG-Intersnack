/**
 * Fix RLS on scope3_transport_data: add SELECT policy for authenticated users
 * The table currently only has "Allow anon all" policy -- so logged-in users get blocked.
 * This script adds a SELECT policy for authenticated role.
 * 
 * Usage:
 *   SUPABASE_SERVICE_KEY=<service_role_key> node scripts/fix_scope3_rls.js
 * 
 * Or: paste the SQL below into Supabase Dashboard > SQL Editor
 */

const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
    console.log('\n⚠️  No SUPABASE_SERVICE_KEY set. Instead, paste this SQL in Supabase Dashboard > SQL Editor:\n');
    console.log(`-- Fix RLS for scope3_transport_data
-- Run in: Supabase Dashboard > SQL Editor

CREATE POLICY IF NOT EXISTS "Allow authenticated read"
  ON scope3_transport_data
  FOR SELECT
  TO authenticated
  USING (true);

-- Also ensure anon can read (keep existing or re-add)
-- The "Allow anon all" policy already covers anon.
`);
    console.log('\n✅ Copy the SQL above and run it in your Supabase SQL Editor.');
    process.exit(0);
}

// If service key provided: run via API
async function runSQL(sql) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql }),
    });
    return resp;
}

runSQL(`CREATE POLICY IF NOT EXISTS "Allow authenticated read"
  ON scope3_transport_data FOR SELECT TO authenticated USING (true)`)
    .then(r => r.text().then(t => console.log(r.status, t)))
    .catch(e => console.error(e));
