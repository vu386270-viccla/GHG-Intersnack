import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = {};
readFileSync(envPath, 'utf-8').split('\n').forEach(l => {
  const t = l.trim(); if (!t || t.startsWith('#')) return;
  const [k, ...v] = t.split('='); if (k && v.length) env[k] = v.join('=').replace(/^["']|["']$/g, '');
});

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: d1, error: e1 } = await s.from('scope3_transport_data').select('*').limit(2);
  console.log('\nscope3_transport_data cols:', d1 && d1[0] ? Object.keys(d1[0]) : 'ERROR', e1?.message || '');
  if (d1 && d1[0]) console.log('  sample:', JSON.stringify(d1[0]).slice(0, 200));

  const { data: d2, error: e2 } = await s.from('production_data').select('*').limit(2);
  console.log('\nproduction_data cols:', d2 && d2[0] ? Object.keys(d2[0]) : 'ERROR', e2?.message || '');
  if (d2 && d2[0]) console.log('  sample:', JSON.stringify(d2[0]).slice(0, 200));

  const { data: d3, error: e3 } = await s.from('emissions_data').select('*').limit(1);
  console.log('\nemissions_data cols:', d3 && d3[0] ? Object.keys(d3[0]) : 'ERROR', e3?.message || '');
})();
