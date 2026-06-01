import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function page(table, select, builder) { let rows = [], off = 0; while (true) { let q = supabase.from(table).select(select).range(off, off + 999); q = builder(q); const { data, error } = await q; if (error) throw error; if (!data?.length) break; rows = rows.concat(data); if (data.length < 1000) break; off += 1000; } return rows; }

// SBTi linear target function
function sbtiTarget(baseline, year) { const B = 2021, E = 2031; if (year <= B) return baseline; if (year >= E) return baseline * .5; return baseline * (1 - .5 * (year - B) / (E - B)); }

// PT Solar Rooftop savings
const PT_SOLAR_MWH = 1614, PT_SOLAR_EF = 0.6592, PT_DEG = .01;
function ptSolarSaving(y) { if (y < 2027) return 0; return PT_SOLAR_MWH * Math.pow(1 - PT_DEG, y - 2027) * PT_SOLAR_EF; }
function ptSolarMWH(y) { if (y < 2027) return 0; return PT_SOLAR_MWH * Math.pow(1 - PT_DEG, y - 2027); }

// Get baseline 2021 data
const facs = (await supabase.from('factories').select('id,name,country')).data;
const em2021 = await page('emissions_data', 'factory_id,year,scope,category,activity_data,emissions_tco2e', q => q.eq('year', 2021).in('scope', ['scope_1', 'scope_2']));
const base = {}; for (const f of facs) base[f.name] = { s1: 0, s2: 0, elec: 0, wood: 0, diesel: 0, lpg: 0 }; base.ALL = { s1: 0, s2: 0, elec: 0, wood: 0, diesel: 0, lpg: 0 };
for (const r of em2021) { const n = facs.find(f => f.id === r.factory_id)?.name; const v = Number(r.emissions_tco2e) || 0, act = Number(r.activity_data) || 0; if (!base[n]) continue; if (r.scope === 'scope_1') { base[n].s1 += v; base.ALL.s1 += v; } else { base[n].s2 += v; base.ALL.s2 += v; } if (r.category === 'electricity') { base[n].elec += act; base.ALL.elec += act; } if (r.category === 'wood_logs') { base[n].wood += act; base.ALL.wood += act; } if (r.category === 'diesel') { base[n].diesel += act; base.ALL.diesel += act; } if (r.category === 'lpg') { base[n].lpg += act; base.ALL.lpg += act; }; }

// Get FC1 2026 values (our previously calculated regression results)
const fc2026 = {
    'Tây Ninh': { elec: 4928047, wood: 1847, diesel: 13218, lpg: 0, rcn: 18000 },
    'Long An': { elec: 4409049, wood: 1597, diesel: 2700, lpg: 0, rcn: 17800 },
    'Phan Thiết': { elec: 4238364, wood: 1688, diesel: 1430, lpg: 0, rcn: 17700 },
    'Tuticorin': { elec: 5550176, wood: 1445, diesel: 51786, lpg: 2.27, rcn: 25000 },
};

// Assumption for 2027-2029 RCN
// Based on plan trend: use FC1 2026 RCN as proxy (stable at current plan, no MIS expansion assumed)
const rcnPlan = {
    'Tây Ninh': 18000,
    'Long An': 17800,
    'Phan Thiết': 17700,
    'Tuticorin': 25000,
};
const rcnTotal = Object.values(rcnPlan).reduce((s, v) => s + v, 0); // 78,500

// EF
const EF_ELEC_VN = 0.8928 / 1000; // tCO2e/kWh
const EF_ELEC_IN = 0.7070 / 1000;
const EF_WOOD_VN = 0.028;        // tCO2e/ton
const EF_WOOD_IN = 0.035;
const EF_DIESEL_VN = 0.010700;   // tCO2e/L (approx)
const EF_DIESEL_IN = 0.010700;
const EF_LPG = 2.909;            // tCO2e/ton

// Calculate target-driven projections
console.log('=== FC 2026-2029 FULL MIS TABLE ===');
console.log('');
console.log('Plant|Year|Elec_kWh|Gas_kWh|Other_kWh|Edible_Waste|Notes');

for (const [plant, rcn] of Object.entries(rcnPlan)) {
    const isIndia = plant === 'Tuticorin';
    const efElec = isIndia ? EF_ELEC_IN : EF_ELEC_VN;
    const efWood = isIndia ? EF_WOOD_IN : EF_WOOD_VN;
    const base2021 = base[plant];
    const baseline_s12 = base2021.s1 + base2021.s2;
    const fc26 = fc2026[plant];

    // 2026 S1+S2 estimated emissions
    const s1_fc26 = fc26.wood * efWood * 1000 + fc26.diesel * EF_DIESEL_VN + fc26.lpg * EF_LPG;
    const s2_fc26 = fc26.elec * efElec;
    const s12_fc26 = s1_fc26 + s2_fc26;

    for (const year of [2026, 2027, 2028, 2029]) {
        const target_s12 = sbtiTarget(baseline_s12, year);
        const solar = plant === 'Phan Thiết' ? ptSolarSaving(year) : 0;
        const solarMWH = plant === 'Phan Thiết' ? ptSolarMWH(year) : 0;

        // For 2026 we have the regression result
        if (year === 2026) {
            const gas = Math.round(fc26.lpg * 12800);
            const other = Math.round(fc26.wood * 4000 + fc26.diesel * 10.7);
            console.log(`${plant}|${year}|${Math.round(fc26.elec)}|${gas}|${other}|N/A|FC1 regression 2025 monthly`);
            continue;
        }

        // For 2027-2029:
        // Strategy: SBTi target caps total S1+S2. Reduce proportionally from FC26 level.
        // For PT: Solar reduces S2 first, then remaining reductions needed from operations.

        // Effective target (net of solar)
        const remaining_target = Math.max(0, target_s12 - solar);

        // Required reduction ratio from FC26 to hit remaining target
        const ratio = s12_fc26 > 0 ? Math.min(1, remaining_target / s12_fc26) : 1;

        // Scale all activity proportionally
        let elec = fc26.elec * ratio;
        const wood = fc26.wood * ratio;
        const diesel = fc26.diesel * ratio;
        const lpg = fc26.lpg * ratio;

        // For PT: solar directly reduces electricity consumption
        if (solarMWH > 0) {
            // Solar produces solarMWH MWh = solarMWH*1000 kWh of electricity
            // This offsets grid electricity
            elec = fc26.elec - solarMWH * 1000; // grid elec reduced by solar
            // But still need to hit target — the tCO2e saving from solar reduces S2
            // Remaining S1+S2 target after solar = target_s12 - solar_tCO2e
            // S2 after solar = (fc26.elec - solarMWH*1000) * efElec
            // S1 stays same as fc26 if ratio allows
            const s2_after_solar = elec * efElec;
            const s1_fc = fc26.wood * efWood * 1000 + fc26.diesel * EF_DIESEL_VN + fc26.lpg * EF_LPG;
            const s12_after_solar = s1_fc + s2_after_solar;
            if (s12_after_solar > target_s12) {
                // Still need more reduction beyond solar
                const extra_ratio = target_s12 / s12_after_solar;
                elec = elec * extra_ratio;
            }
        }

        const gas = Math.round(lpg * 12800);
        const other = Math.round(wood * 4000 + diesel * 10.7);
        const note = solar > 0 ? 'SBTi target + PT Solar ' + Math.round(solar) + ' tCO2e' : 'SBTi linear reduction target';
        console.log(`${plant}|${year}|${Math.round(elec)}|${gas}|${other}|N/A|${note}`);
    }
}

// Summary
console.log('');
console.log('=== SUMMARY: SBTi Target & PT Solar ===');
console.log('Year|ALL_SBTi_Target_S1S2|PT_Solar_Saving_tCO2e|PT_Solar_MWh');
for (const y of [2026, 2027, 2028, 2029, 2030, 2031, 2032]) {
    const allBase = Object.entries(base).filter(([k]) => k !== 'ALL').reduce((s, [, v]) => s + v.s1 + v.s2, 0);
    console.log(`${y}|${Math.round(sbtiTarget(allBase, y))}|${Math.round(ptSolarSaving(y))}|${Math.round(ptSolarMWH(y))}`);
}
