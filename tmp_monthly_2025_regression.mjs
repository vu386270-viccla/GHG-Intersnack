import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const PAGE = 1000;
async function paged(table, select, builder) { let rows = [], off = 0; while (true) { let q = supabase.from(table).select(select).range(off, off + PAGE - 1); q = builder(q); const { data, error } = await q; if (error) throw error; if (!data?.length) break; rows = rows.concat(data); if (data.length < PAGE) break; off += PAGE; } return rows; }
function linReg(pts) { const n = pts.length; if (n < 3) return { m: 0, b: 0, r2: 0, rmse: 0, n, outliers: 0, predict: () => 0, points: pts }; const calc = (arr) => { const n = arr.length, sx = arr.reduce((s, p) => s + p.x, 0), sy = arr.reduce((s, p) => s + p.y, 0), sxy = arr.reduce((s, p) => s + p.x * p.y, 0), sx2 = arr.reduce((s, p) => s + p.x * p.x, 0), den = n * sx2 - sx * sx; const m = den === 0 ? 0 : (n * sxy - sx * sy) / den, b = den === 0 ? sy / n : (sy - m * sx) / n; return { m, b }; }; const c0 = calc(pts); const res = pts.map(p => Math.abs(p.y - (c0.m * p.x + c0.b))); const mean = res.reduce((s, r) => s + r, 0) / res.length; const sigma = Math.sqrt(res.reduce((s, r) => s + (r - mean) ** 2, 0) / res.length); const tagged = pts.map((p, i) => ({ ...p, isOutlier: res[i] > 2 * sigma })); const clean = tagged.filter(p => !p.isOutlier); const use = clean.length >= 2 ? clean : pts; const { m, b } = calc(use); const ymean = use.reduce((s, p) => s + p.y, 0) / use.length; const ssTot = use.reduce((s, p) => s + (p.y - ymean) ** 2, 0); const ssRes = use.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0); const rmse = Math.sqrt(ssRes / use.length); return { m, b, r2: ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot), rmse, n: use.length, outliers: tagged.filter(p => p.isOutlier).length, points: tagged, predict: x => Math.max(0, m * x + b) }; }
const plans = {
    'Tây Ninh': { total: 18000, ytd: 3535, mtc: 14465 },
    'Long An': { total: 17800, ytd: 3204, mtc: 14596 },
    'Phan Thiết': { total: 17700, ytd: 3200, mtc: 14500 },
    'Tuticorin': { total: 25000, ytd: 6534, mtc: 18466 },
};
const factories = (await supabase.from('factories').select('id,name,country')).data;
const fidName = Object.fromEntries(factories.map(f => [f.id, f.name]));
const prod = await paged('production_data', 'factory_id,year,month,category,quantity', q => q.in('year', [2025, 2026]).eq('category', 'rcn_input'));
const em = await paged('emissions_data', 'factory_id,year,month,category,activity_data', q => q.in('year', [2025, 2026]).in('category', ['electricity', 'wood_logs', 'diesel', 'lpg']));
const data = {};
for (const f of factories) { data[f.name] = {}; for (const y of [2025, 2026]) { data[f.name][y] = {}; for (let m = 1; m <= 12; m++)data[f.name][y][m] = { rcn: 0, electricity: 0, wood_logs: 0, diesel: 0, lpg: 0 }; } }
for (const p of prod) { const name = fidName[p.factory_id]; if (data[name]?.[p.year]?.[p.month]) data[name][p.year][p.month].rcn += Number(p.quantity) || 0; }
for (const e of em) { const name = fidName[e.factory_id]; if (data[name]?.[e.year]?.[e.month]) data[name][e.year][e.month][e.category] += Number(e.activity_data) || 0; }
const conversions = { wood_logs: 4000, diesel: 10.7, lpg: 12800 };
console.log('=== MONTHLY REGRESSION 2025 + 2026 MTC ALLOCATED BY 2025 APR-DEC SEASONALITY ===');
console.log('Plant|Elec_kWh|Gas_kWh|Other_kWh|Wood_ton|Diesel_L|LPG_ton|Total_RCN_check');
for (const [plant, plan] of Object.entries(plans)) {
    const train = []; for (let m = 1; m <= 12; m++) train.push({ month: m, ...data[plant][2025][m] });
    const aprDecTotal = train.filter(r => r.month >= 4).reduce((s, r) => s + r.rcn, 0);
    const rcn2026 = {};
    for (let m = 1; m <= 3; m++) rcn2026[m] = data[plant][2026][m].rcn || plan.ytd / 3;
    for (let m = 4; m <= 12; m++) { const share = aprDecTotal > 0 ? data[plant][2025][m].rcn / aprDecTotal : 1 / 9; rcn2026[m] = plan.mtc * share; }
    const preds = { electricity: 0, wood_logs: 0, diesel: 0, lpg: 0 }; const regs = {};
    for (const metric of ['electricity', 'wood_logs', 'diesel', 'lpg']) {
        const pts = train.map(r => ({ x: r.rcn, y: r[metric], label: `2025-${String(r.month).padStart(2, '0')}` }));
        const has = pts.some(p => p.y > 0);
        if (!has) { regs[metric] = { m: 0, b: 0, r2: 1, n: 12, outliers: 0 }; continue; }
        const reg = linReg(pts); regs[metric] = reg;
        const minPositive = Math.min(...pts.map(p => p.y).filter(v => v > 0));
        for (let m = 1; m <= 12; m++) { let y = reg.predict(rcn2026[m]); if (minPositive && y > 0) y = Math.max(y, minPositive); preds[metric] += y; }
    }
    const gas = preds.lpg * conversions.lpg;
    const other = preds.wood_logs * conversions.wood_logs + preds.diesel * conversions.diesel;
    const rcnSum = Object.values(rcn2026).reduce((s, v) => s + v, 0);
    console.log(`${plant}|${Math.round(preds.electricity)}|${Math.round(gas)}|${Math.round(other)}|${Math.round(preds.wood_logs)}|${Math.round(preds.diesel)}|${preds.lpg.toFixed(2)}|${Math.round(rcnSum)}`);
    console.log('  formulas/R2:', Object.entries(regs).map(([k, r]) => `${k}: y=${(r.m ?? 0).toFixed(4)}x+${(r.b ?? 0).toFixed(1)}, R2=${(r.r2 ?? 0).toFixed(3)}, out=${r.outliers ?? 0}`).join(' ; '));
    console.log('  monthly RCN 2026:', Object.entries(rcn2026).map(([m, v]) => `${m}:${Math.round(v)}`).join(', '));
}
