import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function paged(table, select, builder) {
    let rows = [], offset = 0, PAGE = 1000;
    while (true) {
        let q = supabase.from(table).select(select).range(offset, offset + PAGE - 1);
        q = builder(q);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows = rows.concat(data);
        if (data.length < PAGE) break;
        offset += PAGE;
    }
    return rows;
}

async function main() {
    const { data: facs } = await supabase.from('factories').select('id,name,country');
    const findName = id => (facs.find(f => f.id === id)?.name || id).replace('Nam Mỹ', 'Tây Ninh').replace('Dĩ An Củ', 'Long An').replace('Dĩ An A', 'Phan Thiết');
    console.log('=== FACTORIES ==='); facs.forEach(f => console.log(f.id, f.name, f.country));

    const years = [2024, 2025, 2026];
    for (const year of years) {
        const all = await paged('emissions_data', 'factory_id,year,month,scope,category,activity_data,emissions_tco2e', q => q.eq('year', year));
        console.log(`\n=== EMISSIONS ${year}: ${all.length} rows ===`);
        const byFac = {};
        for (const r of all) {
            const name = findName(r.factory_id);
            if (!byFac[name]) byFac[name] = { s1: 0, s2: 0, elecKwh: 0, woodTons: 0, dieselLiters: 0, lpgTons: 0, months: new Set() };
            const d = byFac[name], v = Number(r.emissions_tco2e) || 0, act = Number(r.activity_data) || 0;
            d.months.add(r.month);
            if (r.scope === 'scope_1') d.s1 += v;
            if (r.scope === 'scope_2') d.s2 += v;
            if (r.category === 'electricity') d.elecKwh += act;
            if (r.category === 'wood_logs') d.woodTons += act;
            if (r.category === 'diesel') d.dieselLiters += act;
            if (r.category === 'lpg') d.lpgTons += act;
        }
        for (const [name, d] of Object.entries(byFac).sort()) {
            console.log(`${name}|months=${d.months.size}|S1=${Math.round(d.s1)}|S2=${Math.round(d.s2)}|Elec=${Math.round(d.elecKwh)}|Wood=${Math.round(d.woodTons)}|Diesel=${Math.round(d.dieselLiters)}|LPG=${Math.round(d.lpgTons)}`);
        }
    }

    for (const year of years) {
        const prod = await paged('production_data', 'factory_id,year,month,category,quantity', q => q.eq('year', year));
        console.log(`\n=== PRODUCTION ${year}: ${prod.length} rows ===`);
        const byFac = {};
        for (const r of prod) {
            const name = findName(r.factory_id);
            if (!byFac[name]) byFac[name] = { rcn: 0, ck: 0, months: new Set() };
            const d = byFac[name]; d.months.add(r.month);
            if (r.category === 'rcn_input') d.rcn += Number(r.quantity) || 0;
            if (r.category === 'ck_output') d.ck += Number(r.quantity) || 0;
        }
        for (const [name, d] of Object.entries(byFac).sort()) console.log(`${name}|months=${d.months.size}|RCN=${Math.round(d.rcn)}|CK=${Math.round(d.ck)}`);
    }
}
main().catch(e => { console.error(e); process.exit(1); });
