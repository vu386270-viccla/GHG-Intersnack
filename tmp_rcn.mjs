import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let prod=[]; let off=0; while(true){const {data,error}=await s.from('production_data').select('year,month,quantity').eq('category','rcn_input').in('year',[2025,2026]).range(off,off+999); if(error)throw error; if(!data?.length)break; prod=prod.concat(data); if(data.length<1000)break; off+=1000;}
function rcn(y,months=null){return prod.filter(r=>r.year===y&&(!months||months.includes(r.month))).reduce((a,r)=>a+Number(r.quantity||0),0)}
console.log({rcn2025:rcn(2025), q1_2026:rcn(2026,[1,2,3]), ytd2026:rcn(2026)});
