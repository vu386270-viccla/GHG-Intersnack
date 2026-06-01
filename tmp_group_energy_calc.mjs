import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const years=[2023,2024,2025,2026,2027];
const {data: factories,error:fe}=await s.from('factories').select('id,name,country'); if(fe) throw fe;
const facById=Object.fromEntries((factories||[]).map(f=>[f.id,f]));
let rows=[]; let off=0; while(true){
  const {data,error}=await s.from('emissions_data').select('factory_id,year,month,scope,category,activity_data').in('year',years).in('category',['diesel','lpg','wood_logs']).range(off,off+999);
  if(error) throw error; if(!data?.length) break; rows=rows.concat(data); if(data.length<1000) break; off+=1000;
}
function norm(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function woodKwhPerTonne(factory){const n=norm(factory?.name); if(n.includes('phan thiet')) return 4000; if(n.includes('long an')||n.includes('tay ninh')) return 4900; return 4000;}
const LPG_KWH_PER_TONNE=12780; // Propane/LPG fallback; no site formula observed in Group files
const DIESEL_KWH_PER_LITRE=9.96;
const result={};
const detail=[];
for(const y of years) result[y]={gas_kwh:0, other_kwh:0, diesel_kwh:0, wood_kwh:0, lpg_kwh:0, lpg_activity_t:0, diesel_l:0, wood_t:0};
for(const r of rows){
  const y=r.year; const act=Number(r.activity_data)||0; const fac=facById[r.factory_id];
  if(!result[y]) continue;
  if(r.category==='lpg') { const kwh=act*LPG_KWH_PER_TONNE; result[y].gas_kwh+=kwh; result[y].lpg_kwh+=kwh; result[y].lpg_activity_t+=act; detail.push({year:y,factory:fac?.name,category:'lpg',activity:act,unit:'tonne',factor:LPG_KWH_PER_TONNE,kwh}); }
  if(r.category==='diesel') { const kwh=act*DIESEL_KWH_PER_LITRE; result[y].other_kwh+=kwh; result[y].diesel_kwh+=kwh; result[y].diesel_l+=act; detail.push({year:y,factory:fac?.name,category:'diesel',activity:act,unit:'litre',factor:DIESEL_KWH_PER_LITRE,kwh}); }
  if(r.category==='wood_logs') { const factor=woodKwhPerTonne(fac); const kwh=act*factor; result[y].other_kwh+=kwh; result[y].wood_kwh+=kwh; result[y].wood_t+=act; detail.push({year:y,factory:fac?.name,category:'wood_logs',activity:act,unit:'tonne',factor,kwh}); }
}
console.log(JSON.stringify({result, detail: detail.slice(0,10), rowCount: rows.length}, null, 2));
