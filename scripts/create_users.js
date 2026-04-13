/**
 * create_users.js — Tạo users GHG Dashboard
 * Usage: SUPABASE_SERVICE_KEY=xxx node scripts/create_users.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service_role key (không phải anon)

if (!SERVICE_KEY) {
  console.error('❌  Set SUPABASE_SERVICE_KEY=... trước khi chạy');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: 'minh.tran@icc.com', password: 'Pass@123', role: 'viewer' },
  { email: 'sang.do@icc.com',   password: 'Pass@123', role: 'viewer' },
  { email: 'duc.nguyen@icc.com',password: 'Pass@123', role: 'viewer' },
  { email: 'admin@icc.com',     password: 'vuhuynh123', role: 'admin'  },
];

async function main() {
  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: false,          // yêu cầu verify email
      user_metadata: { role: u.role },
    });

    if (error) {
      console.error(`❌  ${u.email}: ${error.message}`);
    } else {
      console.log(`✅  ${u.email} [${u.role}] — id: ${data.user.id}`);
    }
  }
}

main();
