const https = require('https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a3pwZmt4b2ptbXBkYWJyd2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNzE1MDMsImV4cCI6MjA1OTc0NzUwM30.kSqhDuNi4A7JKZoYIByMt8LL2lBTqQC5Y7GjW4UlK38';

function fetchUrl(path) {
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

const ORIGIN_MIX_2026 = { 'Tanzania': 14425, 'C.Ivory': 950, 'Guinea-B': 610, 'Indonesia': 156 };
const EF = { 'Tanzania': 14.96, 'C.Ivory': 11.2396, 'Guinea-B': 9.82, 'Indonesia': 24.74 };

async function main() {
  const d = await fetchUrl(`/rest/v1/emissions_data?year=eq.2026&select=scope,emissions_tco2e,category,activity_data,factory_id&limit=5000`);
  let s1 = 0, s2 = 0;
  let cat3wtt = 0;
  
  // Need to know India factory_id or just mock it since I don't fetch factories.
  // wait, from data-service, let's just fetch factories
  const factories = await fetchUrl(`/rest/v1/factories?select=id,country`);
  const facCtry = {};
  factories.forEach(f => facCtry[f.id] = f.country);

  const WTT = {
    diesel_VN: 0.00055, diesel_IN: 0.0006058,
    lpg: 0.2, elec_VN: 0.00008, elec_IN: 0.00012,
    wood_VN: 0.05214, wood_IN: 0.24,
  };

  d.forEach(r => {
    const isIN = facCtry[r.factory_id] === 'India';
    if (r.scope === 'scope_1') s1 += r.emissions_tco2e;
    else if (r.scope === 'scope_2') s2 += r.emissions_tco2e;

    const act = Number(r.activity_data) || 0;
    if (r.category === 'diesel') cat3wtt += act * (isIN ? WTT.diesel_IN : WTT.diesel_VN);
    else if (r.category === 'lpg') cat3wtt += act * WTT.lpg;
    else if (r.category === 'electricity') cat3wtt += act * (isIN ? WTT.elec_IN : WTT.elec_VN);
    else if (r.category === 'wood_logs') cat3wtt += act * (isIN ? WTT.wood_IN : WTT.wood_VN);
  });

  let cat1 = 0;
  for(let k in ORIGIN_MIX_2026) cat1 += ORIGIN_MIX_2026[k] * EF[k];

  let cat4 = 45508011 * 0.01604/1000 + 1862845 * 0.07547/1000;
  let s3 = cat1 + cat4 + cat3wtt;

  console.log(`SCOPE_1=${s1.toFixed(0)}`);
  console.log(`SCOPE_2=${s2.toFixed(0)}`);
  console.log(`SCOPE_3=${s3.toFixed(0)}`);
}
main().catch(console.error);
