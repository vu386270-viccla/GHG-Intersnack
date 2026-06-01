import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function page(table, select, builder) { let rows = [], off = 0; while (true) { let q = supabase.from(table).select(select).range(off, off + 999); q = builder(q); const { data, error } = await q; if (error) throw error; if (!data?.length) break; rows = rows.concat(data); if (data.length < 1000) break; off += 1000; } return rows; }
function sbtiTarget(baseline, year) { const BASE = 2021, END = 2031; if (year <= BASE) return baseline; if (year >= END) return baseline * .5; return baseline * (1 - .5 * (year - BASE) / (END - BASE)); }
const PT_SOLAR_ANNUAL_MWH = 1614, PT_SOLAR_EF = 0.6592, DEG = .01;
function ptSolarSaving(year) { if (year < 2027) return 0; const age = year - 2027; return PT_SOLAR_ANNUAL_MWH * Math.pow(1 - DEG, age) * PT_SOLAR_EF; }
const facs = (await supabase.from('factories').select('id,name')).data;
const em = await page('emissions_data', 'factory_id,year,scope,emissions_tco2e', q => q.eq('year', 2021).in('scope', ['scope_1', 'scope_2']));
const base = {}; for (const f of facs) base[f.name] = { s1: 0, s2: 0, s12: 0 }; base.ALL = { s1: 0, s2: 0, s12: 0 };
for (const r of em) { const name = facs.find(f => f.id === r.factory_id)?.name; const v = Number(r.emissions_tco2e) || 0; if (!base[name]) continue; if (r.scope === 'scope_1') { base[name].s1 += v; base.ALL.s1 += v; } else { base[name].s2 += v; base.ALL.s2 += v; } }
for (const k of Object.keys(base)) { base[k].s12 = base[k].s1 + base[k].s2; }
console.log('BASE2021', Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v.s12)])));
console.log('Year|PT_SBTi_Target_S1S2|PT_SolarSaving|PT_Net_Target_AfterSolar|ALL_SBTi_Target|ALL_Target_After_PT_Solar');
for (const y of [2027, 2028, 2029]) {
    const sol = ptSolarSaving(y);
    const ptT = sbtiTarget(base['Phan Thiết'].s12, y);
    const allT = sbtiTarget(base.ALL.s12, y);
    console.log(`${y}|${Math.round(ptT)}|${Math.round(sol)}|${Math.round(Math.max(0, ptT - sol))}|${Math.round(allT)}|${Math.round(Math.max(0, allT - sol))}`);
}
