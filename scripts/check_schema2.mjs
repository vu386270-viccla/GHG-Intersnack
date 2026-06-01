import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach(l => {
  const [k, ...v] = l.trim().split('='); if (k && v.length) env[k] = v.join('=').replace(/^["']|["']$/g, '');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // 1. production_data
  const { data: p, error: pe } = await s.from('production_data').select('*').limit(3);
  console.log('\n=== production_data ===');
  if (pe) console.log('ERROR:', pe.message);
  else if (p?.length) { console.log('cols:', Object.keys(p[0])); console.log('sample:', JSON.stringify(p[0]).slice(0,400)); }
  else console.log('empty table or no data');

  // 2. scope3 distinct categories in emissions_data
  const { data: s3cats, error: s3e } = await s
    .from('emissions_data').select('scope,category').eq('scope','scope_3').limit(100);
  const cats = [...new Set((s3cats||[]).map(r=>r.category))];
  console.log('\n=== emissions_data scope_3 categories ===', cats);

  // 3. Totals per year for S1, S2 directly from DB
  const { data: byYear } = await s
    .from('emissions_data')
    .select('year,scope,emissions_tco2e')
    .in('scope', ['scope_1','scope_2'])
    .gte('year', 2023).lte('year', 2026)
    .limit(5000);

  const totals = {};
  for (const r of byYear||[]) {
    if (!totals[r.year]) totals[r.year] = { s1: 0, s2: 0 };
    if (r.scope === 'scope_1') totals[r.year].s1 += Number(r.emissions_tco2e)||0;
    if (r.scope === 'scope_2') totals[r.year].s2 += Number(r.emissions_tco2e)||0;
  }
  console.log('\n=== S1/S2 totals (rounded) from DB ===');
  for (const yr of [2023,2024,2025,2026]) {
    if (totals[yr]) console.log(`${yr}: S1=${Math.round(totals[yr].s1)} tCO2e, S2=${Math.round(totals[yr].s2)} tCO2e`);
  }

  // Q1 2026 (months 1-3)
  const { data: q1data } = await s
    .from('emissions_data')
    .select('year,month,scope,emissions_tco2e')
    .eq('year', 2026).in('month',[1,2,3])
    .in('scope',['scope_1','scope_2'])
    .limit(1000);
  const q1 = { s1: 0, s2: 0 };
  for (const r of q1data||[]) {
    if (r.scope==='scope_1') q1.s1 += Number(r.emissions_tco2e)||0;
    if (r.scope==='scope_2') q1.s2 += Number(r.emissions_tco2e)||0;
  }
  console.log(`\nQ1 2026 (m1-3): S1=${Math.round(q1.s1)} tCO2e, S2=${Math.round(q1.s2)} tCO2e`);

  // 4. S3 total from scope3_transport_data
  const { data: s3t } = await s.from('scope3_transport_data').select('year,em_cashew_kg,km_ton_vessel,km_ton_road').gte('year',2023).lte('year',2026).limit(5000);
  const s3tot = {};
  for (const r of s3t||[]) {
    if (!s3tot[r.year]) s3tot[r.year] = 0;
    s3tot[r.year] += (r.em_cashew_kg||0)/1000 + (r.km_ton_vessel||0)*0.01604/1000 + (r.km_ton_road||0)*0.07547/1000;
  }
  console.log('\n=== S3 totals from scope3_transport_data ===');
  for (const yr of [2023,2024,2025]) {
    console.log(`${yr}: S3=${s3tot[yr]?.toFixed(0)} tCO2e`);
  }

  // 5. Check if emissions_data has scope_3 entries stored directly
  const { data: s3direct, error: s3derr } = await s
    .from('emissions_data').select('year,scope,category,emissions_tco2e')
    .eq('scope','scope_3').gte('year',2023).limit(1000);
  const s3dirTot = {};
  for (const r of s3direct||[]) {
    if (!s3dirTot[r.year]) s3dirTot[r.year] = 0;
    s3dirTot[r.year] += Number(r.emissions_tco2e)||0;
  }
  console.log('\n=== S3 from emissions_data.scope_3 direct ===');
  for (const yr of [2023,2024,2025]) {
    console.log(`${yr}: ${s3dirTot[yr]?.toFixed(0)||0} tCO2e`);
  }
})();
