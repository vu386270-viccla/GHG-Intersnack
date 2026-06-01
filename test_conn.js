import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log("Checking Supabase connection...");
  try {
    const start = Date.now();
    const { data, error } = await supabase.from('emissions_data').select('count', { count: 'exact', head: true });
    const duration = Date.now() - start;
    console.log(`Query took ${duration}ms`);
    if (error) {
      console.error("Supabase Error:", error);
    } else {
      console.log("Supabase Connection Success, Data:", data);
    }
  } catch (err) {
    console.error("Catastrophic error:", err);
  }
})();
