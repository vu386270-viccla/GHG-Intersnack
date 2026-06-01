import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local
function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) {
      const value = rest.join('=').replace(/^["']|["']$/g, '');
      env[key] = value;
    }
  }

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Factory mapping
const FACTORIES = [
  { name: 'Tây Ninh', id: '041d71b2-f002-438d-b711-3f6195f0c4e5' },
  { name: 'Long An', id: '7040a994-d776-410b-a429-19c0269e2697' },
  { name: 'Phan Thiết', id: '0a586cb1-60e9-4d36-8073-ddc002c88c0d' },
  { name: 'Tuticorin', id: '6a400f3d-059a-43e7-88ae-d5441ae7c7b5' },
];

async function fetchOpexData() {
  let emissions = [];
  let offset = 0;
  const PAGE = 1000;
  const OPEX_YEARS = [2021, 2022, 2023, 2024, 2025];

  while (true) {
    const { data, error } = await supabase
      .from('emissions_data')
      .select('factory_id,year,scope,emissions_tco2e')
      .in('year', OPEX_YEARS)
      .in('scope', ['scope_1', 'scope_2'])
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    emissions = emissions.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return emissions;
}

// Solar savings for PT (same as OpEx report)
const PT_SOLAR_ANNUAL_MWH = 1614;
const PT_SOLAR_EF_VN = 0.6592;
const PT_SOLAR_DEGRADATION = 0.01;
const PT_SOLAR_ONLINE_YEAR = 2027;

function ptSolarSaving(year) {
  if (year < PT_SOLAR_ONLINE_YEAR) return 0;
  const age = year - PT_SOLAR_ONLINE_YEAR;
  const mwh = PT_SOLAR_ANNUAL_MWH * Math.pow(1 - PT_SOLAR_DEGRADATION, age);
  return Math.round(mwh * PT_SOLAR_EF_VN * 1000); // kg
}

// Compute projection per factory (matching OpEx logic)
function getFacProj(factoryId, annualDataByFactory) {
  const f_get = (y) => (annualDataByFactory[factoryId] && annualDataByFactory[factoryId][y]) || { year: y, scope1: 0, scope2: 0 };

  const f_b1 = f_get(2021).scope1;
  const f_b2 = f_get(2021).scope2;
  const f_s1_2025 = f_get(2025).scope1;
  const f_s2_2025 = f_get(2025).scope2;

  const yearsToTarget = 2031 - 2025;

  const f_s1FinalTarget = f_s1_2025 <= f_b1 * 0.5 ? f_s1_2025 * 0.75 : f_b1 * 0.5;
  const f_s1AnnualCut = yearsToTarget > 0 ? (f_s1_2025 - f_s1FinalTarget) / yearsToTarget : 0;

  const f_s2FinalTargetBase = f_s2_2025 <= f_b2 * 0.5 ? f_s2_2025 * 0.75 : f_b2 * 0.5;
  const f_s2AnnualCut = yearsToTarget > 0 ? (f_s2_2025 - f_s2FinalTargetBase) / yearsToTarget : 0;

  const f_obj = FACTORIES.find((f) => f.id === factoryId);
  const fname = (f_obj?.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isSolar = fname.includes('phan thiet') || fname.startsWith('pt') || fname === 'pt';

  // Debug for PT
  if (factoryId === '0a586cb1-60e9-4d36-8073-ddc002c88c0d') {
    console.log(`PT DEBUG: b1=${f_b1}, s1_2025=${f_s1_2025}, b1*0.5=${Math.round(f_b1*0.5)}, condition=${f_s1_2025 <= f_b1 * 0.5}, finalTarget=${Math.round(f_s1FinalTarget)}`);
  }

  return {
    isSolar,
    s1AnnualCut: f_s1AnnualCut,
    s2AnnualCut: f_s2AnnualCut,
    s1Proj: (year) => Math.max(f_s1_2025 - f_s1AnnualCut * (year - 2025), f_s1FinalTarget),
    s2Proj: (year) => {
      const linearCut = f_s2_2025 - f_s2AnnualCut * (year - 2025);
      const solar = ptSolarSaving(year);
      return Math.max(linearCut - (isSolar ? solar : 0), f_s2FinalTargetBase);
    },
    s1FinalTarget: f_s1FinalTarget,
    s2FinalTargetBase: f_s2FinalTargetBase,
    baselineS1: f_b1,
    baselineS2: f_b2,
  };
}

(async () => {
  try {
    const emissions = await fetchOpexData();

    // Build annual data by factory
    const annualDataByFactory = {};
    const factoryIds = FACTORIES.map((f) => f.id);

    for (const fid of factoryIds) {
      annualDataByFactory[fid] = {};
    }

    for (const row of emissions) {
      if (!factoryIds.includes(row.factory_id)) continue;
      const year = row.year;
      if (!annualDataByFactory[row.factory_id][year]) {
        annualDataByFactory[row.factory_id][year] = { year, scope1: 0, scope2: 0 };
      }
      if (row.scope === 'scope_1') {
        annualDataByFactory[row.factory_id][year].scope1 += Number(row.emissions_tco2e) * 1000;
      } else if (row.scope === 'scope_2') {
        annualDataByFactory[row.factory_id][year].scope2 += Number(row.emissions_tco2e) * 1000;
      }
    }

    console.log('\n=== TARGET TRAJECTORY (kg) ===\n');
    console.log('Based on OpEx report logic: linear reduction from 2025 to 2031 (-50% vs 2021 baseline)');
    console.log('Phan Thiết gets solar savings from 2027 onward (~1,064,000 kg/year decreasing 1% annually)\n');

    for (const factory of FACTORIES) {
      const proj = getFacProj(factory.id, annualDataByFactory);
      console.log(`\n========== ${factory.name} ==========`);
      console.log(`Baseline 2021 S1: ${Math.round(proj.baselineS1).toLocaleString()} kg`);
      console.log(`Baseline 2021 S2: ${Math.round(proj.baselineS2).toLocaleString()} kg`);
      console.log(`2025 Actual S1: ${Math.round(proj.s1Proj(2025)).toLocaleString()} kg`);
      console.log(`2025 Actual S2: ${Math.round(proj.s2Proj(2025)).toLocaleString()} kg`);
      console.log(`S1 Final Target (2031): ${Math.round(proj.s1FinalTarget).toLocaleString()} kg (${proj.s1FinalTarget <= proj.baselineS1 * 0.5 ? '50% of baseline' : '75% of 2025'})`);
      console.log(`S2 Final Target (2031): ${Math.round(proj.s2FinalTargetBase).toLocaleString()} kg (${proj.s2FinalTargetBase <= proj.baselineS2 * 0.5 ? '50% of baseline' : '75% of 2025'})`);
      console.log(`\nYearly Targets (Scope 1 & 2):`);
      console.log('Year | S1 Target (kg) | Δ S1 YoY | S2 Target (kg) | Δ S2 YoY');
      let prevS1 = Math.round(proj.s1Proj(2025));
      let prevS2 = Math.round(proj.s2Proj(2025));
      for (let y = 2026; y <= 2029; y++) {
        const s1t = Math.round(proj.s1Proj(y));
        const s2t = Math.round(proj.s2Proj(y));
        const deltaS1 = s1t - prevS1;
        const deltaS2 = s2t - prevS2;
        console.log(`${y} | ${s1t.toLocaleString()} | ${deltaS1 >= 0 ? '+' : ''}${deltaS1.toLocaleString()} | ${s2t.toLocaleString()} | ${deltaS2 >= 0 ? '+' : ''}${deltaS2.toLocaleString()}`);
        prevS1 = s1t;
        prevS2 = s2t;
      }
    }

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
