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
    const map = {
        VN: { s3: {} },
        India: { s3: {} }
    };
    [2021, 2022, 2023, 2024, 2025, 2026].forEach(y => {
        map.VN.s3[y] = 0;
        map.India.s3[y] = 0;
    });

    // 1. Fetch factories to know who is India
    const { data: factories, error: fe } = await s.from('factories').select('id,country');
    if (fe) {
        console.error('Fetch factories error', fe);
        return;
    }
    const isFacIndia = {};
    factories.forEach(f => isFacIndia[f.id] = (f.country === 'India'));

    // 2. Scope 1, 2, and fuels for Cat 3
    const { data: d21, error: de } = await s.from('emissions_data')
        .select('factory_id,category,activity_data,year')
        .gte('year', 2021)
        .lte('year', 2026)
        .limit(10000);

    if (de) {
        console.error('Fetch emissions error', de);
        return;
    }

    d21.forEach(r => {
        if (map.VN.s3[r.year] !== undefined) {
            // Cat 3 (WTT) calculation
            if (['diesel', 'lpg', 'electricity', 'wood_logs'].includes(r.category)) {
                const isIndia = isFacIndia[r.factory_id];
                const act = r.activity_data || 0;
                let wtt = 0;
                if (r.category === 'diesel') wtt = act * (isIndia ? WTT.diesel_IN : WTT.diesel_VN);
                else if (r.category === 'lpg') wtt = act * WTT.lpg;
                else if (r.category === 'electricity') wtt = act * (isIndia ? WTT.elec_IN : WTT.elec_VN);
                else if (r.category === 'wood_logs') wtt = act * (isIndia ? WTT.wood_IN : WTT.wood_VN);

                if (isIndia) map.India.s3[r.year] += wtt;
                else map.VN.s3[r.year] += wtt;
            }
        }
    });

    // 3. Scope 3 Cat 1 & Cat 4
    const { data: s3Data, error: s3e } = await s.from('scope3_transport_data')
        .select('year,region,em_cashew_kg,km_ton_vessel,km_ton_road')
        .gte('year', 2021)
        .lte('year', 2026)
        .limit(5000);

    if (s3e) {
        console.error('Fetch scope3 error', s3e);
        return;
    }

    s3Data.forEach(r => {
        if (map.VN.s3[r.year] !== undefined) {
            const s3c1 = (r.em_cashew_kg || 0) / 1000;
            const s3c4v = (r.km_ton_vessel || 0) * 0.01604 / 1000;
            const s3c4r = (r.km_ton_road || 0) * 0.07547 / 1000;
            const total = s3c1 + s3c4v + s3c4r;

            const region = (r.region || '').toLowerCase();
            if (region.includes('in') || region.includes('india')) {
                map.India.s3[r.year] += total;
            } else {
                map.VN.s3[r.year] += total;
            }
        }
    });

    console.log('SCOPE 3 BY REGION:');
    [2021, 2022, 2023, 2024, 2025, 2026].forEach(y => {
        const vn = map.VN.s3[y];
        const ind = map.India.s3[y];
        const total = vn + ind;
        const vnPct = total > 0 ? (vn / total * 100).toFixed(1) : 0;
        const indPct = total > 0 ? (ind / total * 100).toFixed(1) : 0;

        console.log(`Year ${y}: Total ${Math.round(total)}`);
        console.log(`  VN    : ${Math.round(vn)} (${vnPct}%)`);
        console.log(`  India : ${Math.round(ind)} (${indPct}%)`);
    });
}
main();
