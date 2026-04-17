const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://irbvgsyzidqnzhpetmdk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);

const WTT = {
    diesel_VN: 0.00055, diesel_IN: 0.0006058,
    lpg: 0.2, elec_VN: 0.00008, elec_IN: 0.00012,
    wood_VN: 0.05214, wood_IN: 0.24,
};

async function main() {
    const map = {};
    [2021, 2022, 2023, 2024, 2025, 2026].forEach(y => map[y] = { s1: 0, s2: 0, s3_1: 0, s3_3: 0, s3_4: 0 });

    // 1. Fetch factories to know who is India
    const { data: factories } = await s.from('factories').select('id,country');
    const isFacIndia = {};
    factories.forEach(f => isFacIndia[f.id] = (f.country === 'India'));

    // 2. Scope 1, 2, and fuels for Cat 3
    const { data: d21 } = await s.from('emissions_data')
        .select('factory_id,scope,category,activity_data,emissions_tco2e,year')
        .gte('year', 2021)
        .lte('year', 2026)
        .limit(10000);

    d21.forEach(r => {
        if (map[r.year]) {
            if (r.scope === 'scope_1') map[r.year].s1 += r.emissions_tco2e;
            if (r.scope === 'scope_2') map[r.year].s2 += r.emissions_tco2e;

            // Cat 3 (WTT) calculation
            if (['diesel', 'lpg', 'electricity', 'wood_logs'].includes(r.category)) {
                const isIndia = isFacIndia[r.factory_id];
                const act = r.activity_data || 0;
                if (r.category === 'diesel') map[r.year].s3_3 += act * (isIndia ? WTT.diesel_IN : WTT.diesel_VN);
                else if (r.category === 'lpg') map[r.year].s3_3 += act * WTT.lpg;
                else if (r.category === 'electricity') map[r.year].s3_3 += act * (isIndia ? WTT.elec_IN : WTT.elec_VN);
                else if (r.category === 'wood_logs') map[r.year].s3_3 += act * (isIndia ? WTT.wood_IN : WTT.wood_VN);
            }
        }
    });

    // 3. Scope 3 Cat 1 & Cat 4
    const { data: s3Data } = await s.from('scope3_transport_data')
        .select('year,em_cashew_kg,km_ton_vessel,km_ton_road')
        .gte('year', 2021)
        .lte('year', 2026)
        .limit(5000);

    s3Data.forEach(r => {
        if (map[r.year]) {
            map[r.year].s3_1 += (r.em_cashew_kg || 0) / 1000;
            map[r.year].s3_4 += (r.km_ton_vessel || 0) * 0.01604 / 1000 + (r.km_ton_road || 0) * 0.07547 / 1000;
        }
    });

    // 4. PLAN
    const b1 = map[2021].s1;
    const b2 = map[2021].s2;
    const b3 = map[2021].s3_1 + map[2021].s3_3 + map[2021].s3_4;
    console.log('\nPLAN TARGETS from 2021 baseline:');
    console.log("Base 2021 S1: " + Math.round(b1) + " | S2: " + Math.round(b2) + " | S3: " + Math.round(b3));
    [2026, 2027, 2028].forEach(y => {
        const elapsed = y - 2021;
        const s1Plan = b1 * (1 - 0.50 * (elapsed / 11));
        const s2Plan = b2 * (1 - 0.50 * (elapsed / 11));
        const s3Plan = b3 * (1 - 0.30 * (elapsed / 11));
        console.log("Plan " + y + ":");
        console.log("  Scope 1 limit: " + Math.round(s1Plan));
        console.log("  Scope 2 limit: " + Math.round(s2Plan));
        console.log("  Scope 3 limit: " + Math.round(s3Plan));
    });
}
main();
