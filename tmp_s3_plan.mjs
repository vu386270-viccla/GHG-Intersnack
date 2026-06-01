import dotenv from 'dotenv'; dotenv.config({path:'.env.local'});
import { createClient } from '@supabase/supabase-js';
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const ORIGIN_EF={'Indonesia':24.74,'Tanzania':14.96,'C.Ivory':11.2396,'Vietnam':11.2396,'Guinea-B':9.82,'Senegal':9.82,'Guinea':9.82,'India':4.24971,'Cambodia':2.7,'Ghana':2.2,'Benin':2.13,'Nigeria':1.56};
const ORIGIN_MIX={2021:{'C.Ivory':35412,'Guinea-B':12655,'Ghana':14786,'Cambodia':4789,'Tanzania':4054,'Benin':4219,'India':1174},2025:{'C.Ivory':16530,'Tanzania':15492,'Guinea-B':15308,'Ghana':7788,'Senegal':3321,'Cambodia':3241,'Nigeria':2200,'Guinea':1276,'Indonesia':984,'Vietnam':205},2026:{'Tanzania':14425,'C.Ivory':950,'Guinea-B':610,'Indonesia':156}};
const TRANS={2021:{vessel:1161599654,road:9993561},2025:{vessel:806825797,road:6748142},2026:{vessel:45508011,road:1862845}};
const MTC={'Guinea-B':3220+5648+3896+8011,'C.Ivory':4720+5852+2992+2100,'Tanzania':1800+1600+1760+0,'Indonesia':1685,'Cambodia':1430,'Senegal':1610+1496,'Ghana':2860+6400,'Guinea':2992+1955};
const MTC_TOTAL=Object.values(MTC).reduce((a,b)=>a+b,0);
const ROUTE={'Cambodia:VN':{vessel:0,road:126},'Indonesia:VN':{vessel:2228,road:126},'Tanzania:VN':{vessel:8680,road:160},'Guinea:VN':{vessel:12120,road:160},'Senegal:VN':{vessel:16799,road:160},'Guinea-B:VN':{vessel:17237,road:160},'C.Ivory:VN':{vessel:18939,road:160},'Ghana:VN':{vessel:19376,road:160},'Tanzania:IN':{vessel:4989,road:2},'Guinea:IN':{vessel:8120,road:2},'Guinea-B:IN':{vessel:13244,road:2},'C.Ivory:IN':{vessel:14946,road:13},'Ghana:IN':{vessel:15383,road:2}};
const MTC_F={'Tay Ninh':{origins:{'Guinea-B':3220,'Cambodia':1430,'Indonesia':1685,'C.Ivory':4720,'Senegal':1610,'Tanzania':1800}},'Long An':{origins:{'Guinea-B':5648,'C.Ivory':5852,'Senegal':1496,'Tanzania':1600}},'Phan Thiet':{origins:{'Guinea-B':3896,'Guinea':2992,'Ghana':2860,'C.Ivory':2992,'Tanzania':1760}},'Tuticorin':{origins:{'Guinea-B':8011,'Guinea':1955,'Ghana':6400,'C.Ivory':2100}}};
function cat1(y){return Math.round(Object.entries(ORIGIN_MIX[y]).reduce((a,[o,q])=>a+q*(ORIGIN_EF[o]??2.5),0))}
function cat4(y){return Math.round(TRANS[y].vessel*0.01604/1000 + TRANS[y].road*0.07547/1000)}
function mtcCat1(){return Math.round(Object.entries(MTC).reduce((a,[o,q])=>a+q*(ORIGIN_EF[o]??2.5),0))}
function mtcCat4(){let v=0,r=0; for(const [fac,{origins}] of Object.entries(MTC_F)){const reg=fac==='Tuticorin'?'IN':'VN'; for(const [o,q] of Object.entries(origins)){const route=ROUTE[`${o}:${reg}`]; if(!route)continue; v+=q*route.vessel*0.01604/1000; r+=q*route.road*0.07547/1000}} return Math.round(v+r)}
const {data: facs}=await s.from('factories').select('id,country'); const country=Object.fromEntries(facs.map(f=>[f.id,f.country]));
let fuel=[]; let off=0; while(true){const {data,error}=await s.from('emissions_data').select('factory_id,year,month,category,activity_data').in('year',[2021,2025,2026]).in('category',['diesel','lpg','electricity','wood_logs']).range(off,off+999); if(error)throw error; if(!data?.length)break; fuel=fuel.concat(data); if(data.length<1000)break; off+=1000;}
const W={diesel_VN:.00055,diesel_IN:.0006058,lpg:.2,elec_VN:.00008,elec_IN:.00012,wood_VN:.05214,wood_IN:.24};
function wtt(y){let t=0; for(const r of fuel.filter(x=>x.year===y)){const ind=country[r.factory_id]==='India'; const act=Number(r.activity_data)||0; if(r.category==='diesel')t+=act*(ind?W.diesel_IN:W.diesel_VN); else if(r.category==='lpg')t+=act*W.lpg; else if(r.category==='electricity')t+=act*(ind?W.elec_IN:W.elec_VN); else if(r.category==='wood_logs')t+=act*(ind?W.wood_IN:W.wood_VN);} return Math.round(t)}
let prod=[]; off=0; while(true){const {data,error}=await s.from('production_data').select('year,quantity').eq('category','rcn_input').in('year',[2026]).range(off,off+999); if(error)throw error; if(!data?.length)break; prod=prod.concat(data); if(data.length<1000)break; off+=1000;}
const rcn26=prod.reduce((a,r)=>a+Number(r.quantity||0),0);
const s3={}; for(const y of [2021,2025,2026]) s3[y]={cat1:cat1(y),cat4:cat4(y),cat3:wtt(y),total:cat1(y)+cat4(y)+wtt(y)};
const fcCat1=s3[2026].cat1+mtcCat1(); const fcCat4=s3[2026].cat4+mtcCat4(); const fcCat3=s3[2026].cat3+Math.round((s3[2026].cat3/rcn26)*MTC_TOTAL); const fc=fcCat1+fcCat3+fcCat4;
const flagTarget2032=Math.round(s3[2021].cat1*(1-.364)); const nonflagTarget2032=Math.round((s3[2021].cat3+s3[2021].cat4)*(1-.30)); const totalTarget2032=flagTarget2032+nonflagTarget2032; const annualCut=(s3[2025].total-totalTarget2032)/(2032-2025);
console.log({s3,rcn26:Math.round(rcn26),MTC_TOTAL, mtcCat1:mtcCat1(), mtcCat4:mtcCat4(), fcCat1,fcCat3,fcCat4,fc});
console.log('s3 targets', [2026,2027,2028].map(y=>[y,Math.round(s3[2025].total-annualCut*(y-2025))]));
