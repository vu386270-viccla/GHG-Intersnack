/**
 * verify_kpi_table.mjs
 * So sánh số liệu trong bảng KPI Overview (slide) với dữ liệu thực từ Supabase.
 * Các chỉ số cần verify:
 *   - CO2 Scope 1 (ton) — Act 2023, 2024, 2025, Q1 2026
 *   - CO2 Scope 2 (ton) — Act 2023, 2024, 2025, Q1 2026
 *   - CO2 Scope 3 (ton) — Act 2023, 2024, 2025, Q1 2026
 *   - Total Saleable Volume (ton) — Act 2023, 2024, 2025, Q1 2026
 *   - Electricity Consumption (kWh/RCN MT) — Act 2023, 2024, 2025, Q1 2026
 *   - Water Consumption (m³/RCN MT) — Act 2023, 2024, 2025, Q1 2026
 *   - Gas Consumption (kWh/RCN MT) — Act 2023, 2024, 2025, Q1 2026
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [key, ...rest] = t.split('=');
    if (key && rest.length) env[key] = rest.join('=').replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// ─── KPI Target values (from slide) ─────────────────────────────────────────
const SLIDE = {
  scope1:  { 2023: 379,     2024: 323,     2025: 291,     'Q1_2026': 49      },
  scope2:  { 2023: 9243,    2024: 6556,    2025: 8967,    'Q1_2026': 1897    },
  scope3:  { 2023: 666650,  2024: 668395,  2025: 684042,  'Q1_2026': 222192  },
  volume:  { 2023: 19191,   2024: 19423,   2025: 17744,   'Q1_2026': 3852    },
  elec_int:{ 2023: 275,     2024: 270,     2025: 244,     'Q1_2026': 227     }, // kWh/RCN MT
  water_int:{2023: 1.27,    2024: 1.28,    2025: 1.11,    'Q1_2026': 1.14    }, // m³/RCN MT
  gas_int: { 2023: 3.05,    2024: 1.54,    2025: 0.47,    'Q1_2026': 0.37    }, // kWh/RCN MT
};

// ─── Pagination helper ────────────────────────────────────────────────────────
async function fetchAll(query) {
  const PAGE = 1000;
  let offset = 0;
  let rows = [];
  while (true) {
    const { data, error } = await query(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

// ─── Fetch emissions_data (S1 + S2) ─────────────────────────────────────────
async function fetchS1S2() {
  return fetchAll((from, to) =>
    supabase
      .from('emissions_data')
      .select('factory_id,year,month,scope,emissions_tco2e')
      .in('scope', ['scope_1', 'scope_2'])
      .gte('year', 2023)
      .lte('year', 2026)
      .range(from, to)
  );
}

// ─── Fetch scope3 ────────────────────────────────────────────────────────────
async function fetchS3() {
  return fetchAll((from, to) =>
    supabase
      .from('scope3_transport_data')
      .select('year,month,em_cashew_kg,km_ton_vessel,km_ton_road,wtt_tco2e')
      .gte('year', 2023)
      .lte('year', 2026)
      .range(from, to)
  );
}

// ─── Fetch production (volume, electricity, water, gas) ──────────────────────
async function fetchProduction() {
  return fetchAll((from, to) =>
    supabase
      .from('production_data')
      .select('factory_id,year,month,rcn_processed_ton,electricity_kwh,water_m3,gas_kwh')
      .gte('year', 2023)
      .lte('year', 2026)
      .range(from, to)
  );
}

// ─── WTT factors (from get_totals.js) ────────────────────────────────────────
const WTT = {
  diesel_VN: 0.00055, diesel_IN: 0.0006058,
  lpg: 0.2, elec_VN: 0.00008, elec_IN: 0.00012,
  wood_VN: 0.05214, wood_IN: 0.24,
};

async function fetchS3WTT() {
  // Also fetch activity data for Cat3 WTT
  return fetchAll((from, to) =>
    supabase
      .from('emissions_data')
      .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
      .in('category', ['diesel', 'lpg', 'electricity', 'wood_logs'])
      .gte('year', 2023)
      .lte('year', 2026)
      .range(from, to)
  );
}

async function fetchFactories() {
  const { data } = await supabase.from('factories').select('id,country');
  return data || [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║      KPI TABLE VERIFICATION — vs Supabase opex data     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  let s1s2Rows, s3Rows, prodRows, wttRows, factories;

  try { s1s2Rows    = await fetchS1S2();      console.log(`S1/S2 rows: ${s1s2Rows.length}`); }
  catch(e) { console.error('❌ fetchS1S2 failed:', e.message || e); s1s2Rows = []; }

  try { s3Rows      = await fetchS3();        console.log(`S3 rows: ${s3Rows.length}`); }
  catch(e) { console.error('❌ fetchS3 failed:', e.message || e); s3Rows = []; }

  try { wttRows     = await fetchS3WTT();     console.log(`WTT rows: ${wttRows.length}`); }
  catch(e) { console.error('❌ fetchS3WTT failed:', e.message || e); wttRows = []; }

  try { factories   = await fetchFactories(); console.log(`Factories: ${factories.length}`); }
  catch(e) { console.error('❌ fetchFactories failed:', e.message || e); factories = []; }

  // Try production_data; fall back if table doesn't exist
  try { prodRows = await fetchProduction();   console.log(`Production rows: ${prodRows.length}`); }
  catch(e) { console.error('⚠️  fetchProduction failed (table may not exist):', e.message || e); prodRows = []; }

  const isFacIndia = {};
  factories.forEach(f => isFacIndia[f.id] = (f.country === 'India'));

  // ── Accumulate per year/month ──────────────────────────────────────────────
  const acc = {};
  const init = (y, m) => {
    const k = `${y}_${m || 'ALL'}`;
    if (!acc[k]) acc[k] = { s1: 0, s2: 0, s3: 0, vol: 0, elec: 0, water: 0, gas: 0 };
    return acc[k];
  };

  // S1 + S2
  for (const r of s1s2Rows) {
    const a = init(r.year, null);
    const m = r.month ? init(r.year, r.month) : null;
    const v = Number(r.emissions_tco2e) || 0;
    if (r.scope === 'scope_1') { a.s1 += v; if (m) m.s1 += v; }
    if (r.scope === 'scope_2') { a.s2 += v; if (m) m.s2 += v; }
  }

  // S3 Cat1 + Cat4
  for (const r of s3Rows) {
    const a = init(r.year, null);
    const m = r.month ? init(r.year, r.month) : null;
    const cat1 = (r.em_cashew_kg || 0) / 1000;
    const cat4 = (r.km_ton_vessel || 0) * 0.01604 / 1000 + (r.km_ton_road || 0) * 0.07547 / 1000;
    const v = cat1 + cat4;
    a.s3 += v; if (m) m.s3 += v;
  }

  // S3 Cat3 (WTT)
  for (const r of wttRows) {
    const a = init(r.year, null);
    const m = r.month ? init(r.year, r.month) : null;
    const isIndia = isFacIndia[r.factory_id];
    const act = r.activity_data || 0;
    let wtt = 0;
    if (r.category === 'diesel')      wtt = act * (isIndia ? WTT.diesel_IN : WTT.diesel_VN);
    else if (r.category === 'lpg')    wtt = act * WTT.lpg;
    else if (r.category === 'electricity') wtt = act * (isIndia ? WTT.elec_IN : WTT.elec_VN);
    else if (r.category === 'wood_logs')   wtt = act * (isIndia ? WTT.wood_IN : WTT.wood_VN);
    a.s3 += wtt; if (m) m.s3 += wtt;
  }

  // Production
  for (const r of prodRows) {
    const a = init(r.year, null);
    const m = r.month ? init(r.year, r.month) : null;
    a.vol   += Number(r.rcn_processed_ton) || 0;
    a.elec  += Number(r.electricity_kwh)   || 0;
    a.water += Number(r.water_m3)          || 0;
    a.gas   += Number(r.gas_kwh)           || 0;
    if (m) {
      m.vol   += Number(r.rcn_processed_ton) || 0;
      m.elec  += Number(r.electricity_kwh)   || 0;
      m.water += Number(r.water_m3)          || 0;
      m.gas   += Number(r.gas_kwh)           || 0;
    }
  }

  // Q1 2026 = months 1,2,3 of 2026
  const q1 = { s1: 0, s2: 0, s3: 0, vol: 0, elec: 0, water: 0, gas: 0 };
  for (const mo of [1, 2, 3]) {
    const k = `2026_${mo}`;
    if (acc[k]) {
      for (const field of ['s1', 's2', 's3', 'vol', 'elec', 'water', 'gas'])
        q1[field] += acc[k][field];
    }
  }

  // Intensity calculations
  function intensity(num, vol) { return vol > 0 ? num / vol : 0; }

  const result = {};
  for (const yr of [2023, 2024, 2025]) {
    const d = acc[`${yr}_ALL`] || {};
    result[yr] = {
      s1: Math.round(d.s1 || 0),
      s2: Math.round(d.s2 || 0),
      s3: Math.round(d.s3 || 0),
      vol: Math.round(d.vol || 0),
      elec_int: d.vol > 0 ? Math.round(d.elec / d.vol) : 0,
      water_int: d.vol > 0 ? +((d.water / d.vol).toFixed(2)) : 0,
      gas_int: d.vol > 0 ? +((d.gas / d.vol).toFixed(2)) : 0,
    };
  }
  result['Q1_2026'] = {
    s1: Math.round(q1.s1),
    s2: Math.round(q1.s2),
    s3: Math.round(q1.s3),
    vol: Math.round(q1.vol),
    elec_int: q1.vol > 0 ? Math.round(q1.elec / q1.vol) : 0,
    water_int: q1.vol > 0 ? +((q1.water / q1.vol).toFixed(2)) : 0,
    gas_int: q1.vol > 0 ? +((q1.gas / q1.vol).toFixed(2)) : 0,
  };

  // ── Print comparison table ─────────────────────────────────────────────────
  const cols = [2023, 2024, 2025, 'Q1_2026'];
  const metrics = [
    { key: 's1',        label: 'CO2 Scope 1 (ton)',          slideKey: 'scope1',   fmt: v => Math.round(v).toLocaleString() },
    { key: 's2',        label: 'CO2 Scope 2 (ton)',          slideKey: 'scope2',   fmt: v => Math.round(v).toLocaleString() },
    { key: 's3',        label: 'CO2 Scope 3 (ton)',          slideKey: 'scope3',   fmt: v => Math.round(v).toLocaleString() },
    { key: 'vol',       label: 'Total Volume (ton RCN)',     slideKey: 'volume',   fmt: v => Math.round(v).toLocaleString() },
    { key: 'elec_int',  label: 'Electricity (kWh/RCN MT)',   slideKey: 'elec_int', fmt: v => Math.round(v).toString() },
    { key: 'water_int', label: 'Water (m³/RCN MT)',          slideKey: 'water_int',fmt: v => v.toFixed(2) },
    { key: 'gas_int',   label: 'Gas (kWh/RCN MT)',           slideKey: 'gas_int',  fmt: v => v.toFixed(2) },
  ];

  for (const m of metrics) {
    console.log(`\n── ${m.label} ──`);
    console.log(`${'Period'.padEnd(10)} ${'Slide'.padStart(12)} ${'DB Calc'.padStart(12)} ${'Delta'.padStart(10)} ${'Match?'.padStart(8)}`);
    console.log('─'.repeat(56));
    for (const col of cols) {
      const slideVal = SLIDE[m.slideKey]?.[col] ?? '—';
      const dbVal    = result[col]?.[m.key] ?? '—';
      const delta    = (typeof slideVal === 'number' && typeof dbVal === 'number')
        ? dbVal - slideVal : '—';
      const pct      = (typeof delta === 'number' && typeof slideVal === 'number' && slideVal !== 0)
        ? ` (${((delta/slideVal)*100).toFixed(1)}%)` : '';
      const match    = typeof delta === 'number' ? (Math.abs(delta) <= Math.abs(slideVal) * 0.01 ? '✅ OK' : '❌ DIFF') : '—';
      console.log(
        `${String(col).padEnd(10)} ${String(slideVal).padStart(12)} ${String(m.fmt(dbVal)).padStart(12)} ${String(delta + pct).padStart(18)} ${match.padStart(8)}`
      );
    }
  }

  console.log('\n\n── Raw DB numbers (no rounding) ──');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n✅ Verification complete.');
})();
