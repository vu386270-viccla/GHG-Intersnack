const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a3pwZmt4b2ptbXBkYWJyd2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNzE1MDMsImV4cCI6MjA1OTc0NzUwM30.kSqhDuNi4A7JKZoYIByMt8LL2lBTqQC5Y7GjW4UlK38';

function fetch(path) {
  return new Promise((res, rej) => {
    const opts = {
      hostname: 'hxkzpfkxojmmpdabrwgu.supabase.co',
      path,
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    };
    https.get(opts, r => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => res(JSON.parse(data)));
    }).on('error', rej);
  });
}

const CORRECT_EF = {
  wood_logs: 28,       // kg CO2e/tonne -> /1000 = 0.028 tCO2e/tonne
  wastewater: 0.2013,  // kg CO2e/m3   -> /1000
  lpg: 2909.26,        // kg CO2e/tonne -> /1000
  diesel: 2.68,        // kg CO2e/litre -> /1000
  fgas_r410a: 2088,    // kg CO2e/kg    -> /1000
  co2_cylinder: 1,     // kg CO2e/kg    -> /1000
};

async function main() {
  const cats = ['wood_logs','wastewater','lpg','diesel','fgas_r410a','co2_cylinder','fgas_r22','fgas_r32','fgas_r134a','fgas_r404a'];
  console.log('Category'.padEnd(20), 'Count'.padStart(6), 'Activity'.padStart(14), 'Stored_tCO2e'.padStart(14), 'Correct_tCO2e'.padStart(14), 'Ratio'.padStart(8));
  console.log('-'.repeat(80));
  for (const cat of cats) {
    const data = await fetch(`/rest/v1/emissions_data?scope=eq.scope_1&category=eq.${cat}&select=activity_data,emissions_tco2e&limit=1000`);
    if (!Array.isArray(data) || data.length === 0) continue;
    let act = 0, em = 0;
    data.forEach(r => { act += (r.activity_data || 0); em += (r.emissions_tco2e || 0); });
    const ef = CORRECT_EF[cat];
    const correct = ef ? act * ef / 1000 : null;
    const ratio = correct ? (em / correct).toFixed(3) : '—';
    console.log(
      cat.padEnd(20),
      String(data.length).padStart(6),
      act.toFixed(2).padStart(14),
      em.toFixed(2).padStart(14),
      correct !== null ? correct.toFixed(2).padStart(14) : '—'.padStart(14),
      ratio.padStart(8)
    );
  }
}
main().catch(console.error);
