import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      env[key] = rest.join('=').replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function insertData() {
  const factoryId = '7040a994-d776-410b-a429-19c0269e2697';
  
  const records = [{
    factory_id: factoryId,
    year: 2026,
    month: 4,
    category: 'rcn_input',
    quantity: 1400,
    unit: 'tấn'
  }];

  const { error } = await supabase
    .from('production_data')
    .upsert(records, { onConflict: 'factory_id,year,month,category' });
    
  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Successfully inserted RCN = 1400 tấn for Long An in April 2026.');
  }
}

insertData().catch(console.error);
