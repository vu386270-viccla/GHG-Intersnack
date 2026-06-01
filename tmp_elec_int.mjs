import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let e=[];let off=0;while(true){const {data,error}=await s.from('emissions_data').select('year,scope,category,activity_data').in('year',[2023,2024,2025]).eq('scope','scope_2').eq('category','electricity').range(off,off+999); if(error)throw error; if(!data?.length)break; e=e.concat(data); if(data.length<1000)break; off+=1000;}
let p=[];off=0;while(true){const {data,error}=await s.from('production_data').select('year,quantity').eq('category','rcn_input').in('year',[2023,2024,2025]).range(off,off+999); if(error)throw error; if(!data?.length)break; p=p.concat(data); if(data.length<1000)break; off+=1000;}
for(const y of [2023,2024,2025]){const kwh=e.filter(r=>r.year===y).reduce((a,r)=>a+Number(r.activity_data||0),0); const rcn=p.filter(r=>r.year===y).reduce((a,r)=>a+Number(r.quantity||0),0); console.log(y,{kwh,rcn,int:kwh/rcn});}
