import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const years=[2021,2025,2026];
const {data: factories,error:fe}=await s.from('factories').select('id,name,country'); if(fe) throw fe;
let rows=[]; let off=0; while(true){const {data,error}=await s.from('emissions_data').select('factory_id,year,scope,emissions_tco2e').in('year',years).in('scope',['scope_1','scope_2']).range(off,off+999); if(error) throw error; if(!data?.length) break; rows=rows.concat(data); if(data.length<1000) break; off+=1000;}
let prod=[]; off=0; while(true){const {data,error}=await s.from('production_data').select('factory_id,year,quantity').eq('category','rcn_input').in('year',years).range(off,off+999); if(error) throw error; if(!data?.length) break; prod=prod.concat(data); if(data.length<1000) break; off+=1000;}
function agg(fid,y,scope){return rows.filter(r=>(!fid||r.factory_id===fid)&&r.year===y&&r.scope===scope).reduce((a,r)=>a+Number(r.emissions_tco2e||0),0)}
function rcn(fid,y){return prod.filter(r=>(!fid||r.factory_id===fid)&&r.year===y).reduce((a,r)=>a+Number(r.quantity||0),0)}
const PT_SOLAR_ANNUAL_MWH=1614, PT_SOLAR_EF_VN=0.6592, DEG=0.01;
function solar(y){if(y<2027)return 0; return Math.round(PT_SOLAR_ANNUAL_MWH*Math.pow(1-DEG,y-2027)*PT_SOLAR_EF_VN)}
const yearsToTarget=2031-2025;
function strip(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function facProj(f){const b1=agg(f.id,2021,'scope_1'), b2=agg(f.id,2021,'scope_2'), s1=agg(f.id,2025,'scope_1'), s2=agg(f.id,2025,'scope_2'); const s1Final=s1<=b1*.5?s1*.75:b1*.5; const s2Final=s2<=b2*.5?s2*.75:b2*.5; const s1Cut=(s1-s1Final)/yearsToTarget; const s2Cut=(s2-s2Final)/yearsToTarget; const isSolar=strip(f.name).includes('phan thiet')||strip(f.name).startsWith('pt'); return {s1Proj:y=>Math.max(s1-s1Cut*(y-2025),s1Final), s2Proj:y=>Math.max(s2-s2Cut*(y-2025)- (isSolar?solar(y):0),s2Final), b1,b2,s1,s2};}
const projs=factories.map(f=>facProj(f));
function s2Proj(y){return Math.round(projs.reduce((a,p)=>a+p.s2Proj(y),0))}
function s1Proj(y){return Math.round(projs.reduce((a,p)=>a+p.s1Proj(y),0))}
console.log('actuals', {s1_2025:Math.round(agg(null,2025,'scope_1')), s2_2025:Math.round(agg(null,2025,'scope_2')), q1s1:Math.round(agg(null,2026,'scope_1')), q1s2:Math.round(agg(null,2026,'scope_2')), q1rcn:Math.round(rcn(null,2026))});
console.log('s1 targets', [2026,2027,2028].map(y=>[y,s1Proj(y)]));
console.log('s2 targets', [2026,2027,2028].map(y=>[y,s2Proj(y)]));
console.log('solar', [2026,2027,2028].map(y=>[y,solar(y)]));

