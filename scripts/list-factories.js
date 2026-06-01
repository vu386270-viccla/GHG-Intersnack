import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) {
      const value = rest.join('=').replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getFactories() {
  const { data, error } = await supabase
    .from('factories')
    .select('id,name');

  if (error) throw error;
  return data;
}

(async () => {
  try {
    const factories = await getFactories();

    console.log('\n=== ALL FACTORIES IN DATABASE ===\n');
    factories.forEach(f => {
      console.log(`ID: ${f.id} | Name: "${f.name}"`);
    });

    // Check if our target names exist
    const targetNames = ['Tay Ninh', 'Long An', 'Phan Thiet', 'Tuticorin'];
    console.log('\n=== TARGET FACTORIES LOOKUP ===\n');
    for (const target of targetNames) {
      const match = factories.find(f =>
        f.name.toLowerCase().includes(target.toLowerCase())
      );
      if (match) {
        console.log(`✓ "${target}" found as: "${match.name}" (ID: ${match.id})`);
      } else {
        console.log(`✗ "${target}" NOT FOUND`);
      }
    }

    // Also get emission records count per factory
    const { data: counts } = await supabase
      .from('emissions_data')
      .select('factory_id, year, scope', { count: 'exact' });

    console.log('\n=== EMISSION RECORDS BY FACTORY (S1+S2, 2021-2025) ===\n');
    const factoryCounts = {};
    for (const f of factories) {
      factoryCounts[f.id] = { name: f.name, count: 0 };
    }
    // We'd need to actually query with grouping but let's just show all data

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
