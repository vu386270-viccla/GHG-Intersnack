#!/usr/bin/env node
/**
 * Check LA electricity consumption vs RCN volume from 2025
 * Factory: Long An (LA)
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    const env = {};
    for (const line of lines) {
        const m = line.match(/^([^=]+)="?([^"]*)"?$/);
        if (m) env[m[1].trim()] = m[2].trim();
    }
    return env;
}

const MONTHS_VI = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function main() {
    const env = loadEnv();
    const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
    const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    const headers = {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
    };

    // Get LA factory
    const facResp = await fetch(
        `${SUPABASE_URL}/rest/v1/factories?select=id,name,code&name=ilike.*long*`,
        { headers }
    );
    const facData = await facResp.json();
    const la = facData[0];
    if (!la) { console.log('❌ LA factory not found'); process.exit(1); }
    console.log(`Factory: ${la.name} (id: ${la.id})\n`);

    // Query electricity data for LA, 2024-2025
    const elecResp = await fetch(
        `${SUPABASE_URL}/rest/v1/emissions_data?select=year,month,activity_data,activity_unit,emissions_tco2e` +
        `&factory_id=eq.${la.id}&scope=eq.scope_2&category=eq.electricity` +
        `&year=gte.2024&order=year.asc,month.asc`,
        { headers }
    );
    const elecData = await elecResp.json();

    // Query RCN volume data for LA, 2024-2025
    const rcnResp = await fetch(
        `${SUPABASE_URL}/rest/v1/emissions_data?select=year,month,activity_data,activity_unit` +
        `&factory_id=eq.${la.id}&category=eq.rcn_processed` +
        `&year=gte.2024&order=year.asc,month.asc`,
        { headers }
    );
    const rcnData = await rcnResp.json();

    // Also try 'rcn' category name
    const rcnResp2 = await fetch(
        `${SUPABASE_URL}/rest/v1/emissions_data?select=year,month,activity_data,activity_unit,category` +
        `&factory_id=eq.${la.id}&year=gte.2024&category=neq.electricity&category=neq.wood_logs&category=neq.diesel&category=neq.wastewater&category=neq.lpg&category=neq.co2_cylinder&category=neq.f_gas_fugitives_r134a&category=neq.f_gas_fugitives_r410a&category=neq.f_gas_fugitives_r404a&category=neq.wtt_electricity` +
        `&order=year.asc,month.asc`,
        { headers }
    );
    const rcnData2 = await rcnResp2.json();

    console.log('RCN categories found:', [...new Set((Array.isArray(rcnData2) ? rcnData2 : []).map(r => r.category))]);

    // Build lookup maps
    const elecMap = {};
    (Array.isArray(elecData) ? elecData : []).forEach(r => {
        elecMap[`${r.year}-${r.month}`] = { kwh: Number(r.activity_data), tco2e: Number(r.emissions_tco2e) };
    });

    const rcnMap = {};
    (Array.isArray(rcnData) ? rcnData : []).forEach(r => {
        rcnMap[`${r.year}-${r.month}`] = Number(r.activity_data);
    });

    // If rcn_processed empty, try from rcnData2
    if (Object.keys(rcnMap).length === 0 && Array.isArray(rcnData2)) {
        const rcnCat = rcnData2.find(r => r.category?.toLowerCase().includes('rcn'));
        if (rcnCat) {
            rcnData2.filter(r => r.category === rcnCat.category).forEach(r => {
                rcnMap[`${r.year}-${r.month}`] = Number(r.activity_data);
            });
        }
    }

    // Print table
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Year-Mon │  Điện (kWh)  │ tCO₂e │   RCN (MT)  │ kWh/MT RCN  │ Note');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const years = [2024, 2025, 2026];
    let prevKwh = null;
    let prevIntensity = null;

    for (const year of years) {
        for (let month = 1; month <= 12; month++) {
            const key = `${year}-${month}`;
            const elec = elecMap[key];
            const rcn = rcnMap[key];
            if (!elec && !rcn) continue;

            const kwh = elec?.kwh ?? 0;
            const tco2e = elec?.tco2e ?? 0;
            const rcnMT = rcn ?? 0;
            const intensity = (kwh > 0 && rcnMT > 0) ? (kwh / rcnMT).toFixed(1) : '—';

            // Mark post Jun-2025
            const isPostJun25 = (year === 2025 && month >= 6) || year === 2026;
            const marker = isPostJun25 ? '◀ post-Jun25' : '';

            // Change vs previous month
            let changeStr = '';
            if (prevKwh !== null && kwh > 0 && prevKwh > 0) {
                const diff = ((kwh - prevKwh) / prevKwh * 100).toFixed(1);
                changeStr = diff > 0 ? `+${diff}%` : `${diff}%`;
            }

            const mon = MONTHS_VI[month - 1];
            console.log(
                `${year}-${String(month).padStart(2, '0')} ${mon} │` +
                ` ${String(Math.round(kwh)).padStart(12)} │` +
                ` ${String(tco2e.toFixed(1)).padStart(6)} │` +
                ` ${String(rcnMT.toFixed(1)).padStart(11)} │` +
                ` ${String(intensity).padStart(11)} │ ${changeStr} ${marker}`
            );

            if (kwh > 0) prevKwh = kwh;
            if (intensity !== '—') prevIntensity = parseFloat(intensity);

            // Print separator at Jun 2025
            if (year === 2025 && month === 5) {
                console.log('─────────────────────────────────────────────── ← Tháng 6/2025 trở đi');
            }
        }
    }

    // Summary: pre vs post Jun-2025
    const preRows = [];
    const postRows = [];
    for (const [key, val] of Object.entries(elecMap)) {
        const [y, m] = key.split('-').map(Number);
        const rcnVal = rcnMap[key] ?? 0;
        const row = { kwh: val.kwh, rcn: rcnVal, intensity: rcnVal > 0 ? val.kwh / rcnVal : null };
        if ((y === 2025 && m >= 6) || y === 2026) postRows.push(row);
        else if (y === 2024 || (y === 2025 && m < 6)) preRows.push(row);
    }

    const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const preKwh = avg(preRows.map(r => r.kwh));
    const postKwh = avg(postRows.map(r => r.kwh));
    const preInt = avg(preRows.filter(r => r.intensity).map(r => r.intensity));
    const postInt = avg(postRows.filter(r => r.intensity).map(r => r.intensity));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TỔNG KẾT SO SÁNH:');
    console.log(`  Trước T6/2025 (${preRows.length} tháng):`);
    console.log(`    Điện avg:      ${Math.round(preKwh).toLocaleString()} kWh/tháng`);
    console.log(`    Intensity avg: ${preInt > 0 ? preInt.toFixed(1) + ' kWh/MT' : '—'}`);
    console.log(`  Từ T6/2025 (${postRows.length} tháng):`);
    console.log(`    Điện avg:      ${Math.round(postKwh).toLocaleString()} kWh/tháng`);
    console.log(`    Intensity avg: ${postInt > 0 ? postInt.toFixed(1) + ' kWh/MT' : '—'}`);

    if (preKwh > 0 && postKwh > 0) {
        const chg = ((postKwh - preKwh) / preKwh * 100).toFixed(1);
        console.log(`  → Điện thay đổi: ${chg}% (${chg > 0 ? '↑ tăng' : '↓ giảm'})`);
    }
    if (preInt > 0 && postInt > 0) {
        const chgInt = ((postInt - preInt) / preInt * 100).toFixed(1);
        console.log(`  → Intensity thay đổi: ${chgInt}% (${chgInt > 0 ? '↑ kém hiệu quả hơn' : '↓ hiệu quả hơn'})`);
    }
}

main().catch(console.error);
