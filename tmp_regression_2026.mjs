import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function paged(table, select, builder) { let rows = [], offset = 0, PAGE = 1000; while (true) { let q = supabase.from(table).select(select).range(offset, offset + PAGE - 1); q = builder(q); const { data, error } = await q; if (error) throw error; if (!data?.length) break; rows = rows.concat(data); if (data.length < PAGE) break; offset += PAGE; } return rows; }
function linReg(pts) { const n = pts.length; const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0), sxy = pts.reduce((s, p) => s + p.x * p.y, 0), sx2 = pts.reduce((s, p) => s + p.x * p.x, 0); const den = n * sx2 - sx * sx; const m = den === 0 ? 0 : (n * sxy - sx * sy) / den; const b = den === 0 ? sy / n : (sy - m * sx) / n; const mean = sy / n; const ssTot = pts.reduce((s, p) => s + (p.y - mean) ** 2, 0); const ssRes = pts.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0); return { m, b, r2: ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot), pred: x => Math.max(0, m * x + b) }; }
const plan = { 'Tây Ninh': 18000, 'Long An': 17800, 'Phan Thiết': 17700, 'Tuticorin': 25000 };
const nameMap = n => n;
const years = [2021, 2022, 2023, 2024, 2025];
const facs = (await supabase.from('factories').select('id,name,country')).data;
const em = await paged('emissions_data', 'factory_id,year,month,category,activity_data', q => q.in('year', years).in('category', ['electricity', 'wood_logs', 'diesel', 'lpg']));
const prod = await paged('production_data', 'factory_id,year,month,category,quantity', q => q.in('year', years).eq('category', 'rcn_input'));
const data = {};
for (const f of facs) { data[f.name] = {}; for (const y of years) data[f.name][y] = { rcn: 0, elec: 0, wood: 0, diesel: 0, lpg: 0 }; }
for (const p of prod) { const f = facs.find(f => f.id === p.factory_id)?.name; if (data[f]?.[p.year]) data[f][p.year].rcn += Number(p.quantity) || 0; }
for (const e of em) { const f = facs.find(f => f.id === e.factory_id)?.name; if (!data[f]?.[e.year]) continue; if (e.category === 'electricity') data[f][e.year].elec += Number(e.activity_data) || 0; if (e.category === 'wood_logs') data[f][e.year].wood += Number(e.activity_data) || 0; if (e.category === 'diesel') data[f][e.year].diesel += Number(e.activity_data) || 0; if (e.category === 'lpg') data[f][e.year].lpg += Number(e.activity_data) || 0; }
console.log('Factory|Metric|Formula|R2|FC2026');
for (const f of Object.keys(plan)) {
    const rows = years.map(y => data[f][y]).filter(r => r.rcn > 0);
    for (const metric of ['elec', 'wood', 'diesel', 'lpg']) {
        const pts = rows.map(r => ({ x: r.rcn, y: r[metric] })); const rg = linReg(pts); console.log(`${f}|${metric}|y=${rg.m.toFixed(6)}*RCN+${rg.b.toFixed(2)}|${rg.r2.toFixed(3)}|${Math.round(rg.pred(plan[f]))}`);
    }
}
