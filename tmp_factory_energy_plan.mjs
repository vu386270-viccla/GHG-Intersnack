import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const years=[2021,2025,2026];
const {data: factories,error:fe}=await s.from('factories').select('id,name,country'); if(fe) throw fe;
const facs=factories.sort((a,b)=>a.name.localeCompare(b.name));
const facById=Object.fromEntries(facs.map(f=>[f.id,f]));
let rows=[]; let off=0; while(true){const {data,error}=await s.from('emissions_data').select('factory_id,year,scope,category,activity_data,emissions_tco2e').in('year',years).in('category',['diesel','lpg','wood_logs']).range(off,off+999); if(error)throw error; if(!data?.length)break; rows=rows.concat(data); if(data.length<1000)break; off+=1000;}
let allEm=[]; off=0; while(true){const {data,error}=await s.from('emissions_data').select('factory_id,year,scope,emissions_tco2e').in('year',years).in('scope',['scope_1']).range(off,off+999); if(error)throw error; if(!data?.length)break; allEm=allEm.concat(data); if(data.length<1000)break; off+=1000;}
let prod=[]; off=0; while(true){const {data,error}=await s.from('production_data').select('factory_id,year,quantity').eq('category','rcn_input').in('year',[2025,2026]).range(off,off+999); if(error)throw error; if(!data?.length)break; prod=prod.concat(data); if(data.length<1000)break; off+=1000;}
const MTC={'Tay Ninh':14465,'Long An':14596,'Phan Thiet':14500,'Tuticorin':18466};
function strip(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function simpleName(f){const n=strip(f.name); if(n.includes('tay ninh'))return 'Tay Ninh'; if(n.includes('long an'))return 'Long An'; if(n.includes('phan thiet'))return 'Phan Thiet'; if(n.includes('tuti'))return 'Tuticorin'; return f.name;}
function woodFactor(f){const n=simpleName(f); if(n==='Phan Thiet')return 4000; if(n==='Long An'||n==='Tay Ninh')return 4900; return 4000;}
function s1(fid,y){return allEm.filter(r=>r.factory_id===fid&&r.year===y&&r.scope==='scope_1').reduce((a,r)=>a+Number(r.emissions_tco2e||0),0)}
function rcn(fid,y){return prod.filter(r=>r.factory_id===fid&&r.year===y).reduce((a,r)=>a+Number(r.quantity||0),0)}
function energy(fid,y){const f=facById[fid]; let gas=0, other=0; for(const r of rows.filter(x=>x.factory_id===fid&&x.year===y)){const act=Number(r.activity_data)||0; if(r.category==='lpg') gas+=act*12780; if(r.category==='diesel') other+=act*9.96; if(r.category==='wood_logs') other+=act*woodFactor(f);} return {gas,other};}
function projectS1(fid,y){const b=s1(fid,2021), v=s1(fid,2025); const final=v<=b*.5?v*.75:b*.5; const cut=(v-final)/(2031-2025); return Math.max(v-cut*(y-2025), final);}
const out=[];
for(const f of facs){const name=simpleName(f); const e25=energy(f.id,2025); const e26=energy(f.id,2026); const r26=rcn(f.id,2026); const mtc=MTC[name]||0; const fcFactor=r26>0?(r26+mtc)/r26:1; const fc26={gas:e26.gas*fcFactor, other:e26.other*fcFactor};
 for(const y of [2025,2026,2027,2028,2029]){let gas,other,basis; if(y===2025){gas=e25.gas; other=e25.other; basis='Actual';} else if(y===2026){gas=fc26.gas; other=fc26.other; basis='Opex Predict / FC';} else {const ratio=s1(f.id,2025)>0?projectS1(f.id,y)/s1(f.id,2025):1; gas=e25.gas*ratio; other=e25.other*ratio; basis='Opex Target Pathway';} out.push({factory:name,year:y,basis,gas_kwh:Math.round(gas),other_energy_kwh:Math.round(other),total_kwh:Math.round(gas+other)});}
}
console.log(JSON.stringify(out,null,2));
fs.writeFileSync('tmp_factory_energy_plan.json', JSON.stringify(out,null,2));
