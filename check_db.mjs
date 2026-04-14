import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    let { data, error } = await supabase.from('emissions_data').select('*').eq('year', 2021).eq('scope', 'scope_1');
    console.log('2021 scope_1 total records:', data?.length);
    console.log('Total emissions:', data?.reduce((acc, curr) => acc + curr.emissions_tco2e, 0));
    
    // Test pagination logic
    let allEms = [];
    let offset = 0;
    const PAGE = 3000;
    while (true) {
      const { data: d2, error: e2 } = await supabase
        .from('emissions_data')
        .select('factory_id, year, scope, category, activity_data, emissions_tco2e')
        .gte('year', 2021)
        .lte('year', 2026)
        .range(offset, offset + PAGE - 1);
        
      if (e2 || !d2 || d2.length === 0) break;
      allEms = allEms.concat(d2);
      if (d2.length < PAGE) break;
      offset += PAGE;
    }
    console.log('Pagination fetch total records:', allEms.length);
    console.log('Pagination 2021 scope 1 emissions:', allEms.filter(x => x.year === 2021 && x.scope === 'scope_1').reduce((acc, curr) => acc + curr.emissions_tco2e, 0));
})();
