import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('emissions_data')
    .select('year,scope,emissions_tco2e');
    
  if (error) console.error(error);
  
  const sum2021 = { s1: 0, s2: 0, s3: 0 };
  let s1Rows = 0;
  data.forEach(r => {
    if (r.year === 2021) {
      if (r.scope === 'scope_1') {
         sum2021.s1 += r.emissions_tco2e;
         s1Rows++;
      }
      if (r.scope === 'scope_2') sum2021.s2 += r.emissions_tco2e;
      if (r.scope === 'scope_3') sum2021.s3 += r.emissions_tco2e;
    }
  });
  console.log("Total rows returned:", data.length);
  console.log("2021 Total S1 rows:", s1Rows);
  console.log("2021 Sum S1:", sum2021.s1);
  console.log("2021 Sum S2:", sum2021.s2);
}
check();
