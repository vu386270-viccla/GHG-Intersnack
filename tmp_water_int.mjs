import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let w=[];let off=0;while(true){const {data,error}=await s.from('emissions_data').select('year,category,activity_data').in('year',[2023,2024,2025,2026]).eq('category','wastewater').range(off,off+999); if(error)throw error; if(!data?.length)break; w=w.concat(data); if(data.length<1000)break; off+=1000;}
let p=[];off=0;while(true){const {data,error}=await s.from('production_data').select('year,month,quantity').eq('category','rcn_input').in('year',[2023,2024,2025,2026]).range(off,off+999); if(error)throw error; if(!data?.length)break; p=p.concat(data); if(data.length<1000)break; off+=1000;}
for(const y of [2023,2024,2025]){const wm=w.filter(r=>r.year===y).reduce((a,r)=>a+Number(r.activity_data||0),0); const rcn=p.filter(r=>r.year===y).reduce((a,r)=>a+Number(r.quantity||0),0); console.log(y,{water_m3:wm,rcn,int:wm/rcn});}
const q1w=w.filter(r=>r.year===2026).reduce((a,r)=>a+Number(r.activity_data||0),0); const q1r=p.filter(r=>r.year===2026 && [1,2,3].includes(r.month)).reduce((a,r)=>a+Number(r.quantity||0),0); console.log('2026 loaded water', q1w, 'q1rcn', q1r, q1w/q1r);
