/**
 * Check & Update Phan Thiet (PT) all years vs screenshot
 * IGNORE: Water (nước cấp), refrigerant gas
 * Columns: Electricity(kWh) | Wood(kg) | Water(ignore) | Diesel(L) | LPG(kg)
 */
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://irbvgsyzidqnzhpetmdk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE'
);
const FAC_ID = '0a586cb1-60e9-4d36-8073-ddc002c88c0d'; // Phan Thiet

const EF = {
  electricity: 0.0006592,
  wood_logs:   0.028,
  diesel:      0.00268,
  lpg:         0.001716,
};

// null = blank/skip, explicit number (incl 0) = update
const SC = {
  // 2026
  '2026-3': { elec:397899, wood:167150, diesel:102,  lpg:0   },
  '2026-2': { elec:154414, wood: 80050, diesel:0,    lpg:0   },
  '2026-1': { elec:180166, wood: 49510, diesel:114,  lpg:0   },
  // 2025
  '2025-12':{ elec:244261, wood: 65898, diesel:null, lpg:null },
  '2025-11':{ elec:329826, wood:153110, diesel:98,   lpg:null },
  '2025-10':{ elec:400676, wood:162640, diesel:105,  lpg:null },
  '2025-9': { elec:342320, wood:142500, diesel:105,  lpg:null },
  '2025-8': { elec:375751, wood:150850, diesel:100,  lpg:null },
  '2025-7': { elec:347697, wood:129930, diesel:null, lpg:null },
  '2025-6': { elec:360835, wood:155400, diesel:99,   lpg:null },
  '2025-5': { elec:362491, wood:128980, diesel:100,  lpg:null },
  '2025-4': { elec:315278, wood:117990, diesel:100,  lpg:null },
  '2025-3': { elec:288272, wood:127190, diesel:100,  lpg:null },
  '2025-2': { elec:258409, wood: 91350, diesel:100,  lpg:null },
  '2025-1': { elec:185926, wood:178290, diesel:100,  lpg:null },
  // 2024
  '2024-12':{ elec:307347, wood:103180, diesel:100,  lpg:null },
  '2024-11':{ elec:318293, wood:136560, diesel:99,   lpg:null },
  '2024-10':{ elec:312947, wood:136530, diesel:100,  lpg:516  },
  '2024-9': { elec:302341, wood:130010, diesel:null, lpg:576  },
  '2024-8': { elec:294975, wood:118960, diesel:100,  lpg:516  },
  '2024-7': { elec:299833, wood:120370, diesel:100,  lpg:504  },
  '2024-6': { elec:277600, wood:114400, diesel:100,  lpg:468  },
  '2024-5': { elec:285757, wood:121360, diesel:100,  lpg:504  },
  '2024-4': { elec:262778, wood:146630, diesel:91,   lpg:468  },
  '2024-3': { elec:155019, wood: 36540, diesel:100,  lpg:252  },
  '2024-2': { elec:102381, wood: 24000, diesel:null, lpg:180  },
  '2024-1': { elec:134311, wood: 56090, diesel:100,  lpg:216  },
  // 2023
  '2023-12':{ elec:146341, wood: 82640, diesel:100,  lpg:216  },
  '2023-11':{ elec:253627, wood: 83580, diesel:null, lpg:360  },
  '2023-10':{ elec:378072, wood:119590, diesel:100,  lpg:576  },
  '2023-9': { elec:333035, wood:146010, diesel:100,  lpg:504  },
  '2023-8': { elec:391032, wood:150470, diesel:100,  lpg:648  },
  '2023-7': { elec:373888, wood:146840, diesel:110,  lpg:720  },
  '2023-6': { elec:402818, wood:141650, diesel:100,  lpg:684  },
  '2023-5': { elec:361718, wood:131160, diesel:100,  lpg:648  },
  '2023-4': { elec:351439, wood:120320, diesel:129,  lpg:612  },
  '2023-3': { elec:412900, wood:109780, diesel:100,  lpg:720  },
  '2023-2': { elec:340408, wood:152720, diesel:100,  lpg:720  },
  '2023-1': { elec:222853, wood: 76380, diesel:100,  lpg:432  },
  // 2022
  '2022-12':{ elec:353178, wood:176280, diesel:null, lpg:756  },
  '2022-11':{ elec:373852, wood:142910, diesel:null, lpg:720  },
  '2022-10':{ elec:378000, wood:177500, diesel:null, lpg:792  },
  '2022-9': { elec:382790, wood:151390, diesel:null, lpg:720  },
  '2022-8': { elec:357573, wood:156400, diesel:null, lpg:720  },
  '2022-7': { elec:324638, wood:182900, diesel:null, lpg:648  },
  '2022-6': { elec:330263, wood:167830, diesel:null, lpg:646  },
  '2022-5': { elec:310886, wood:140070, diesel:null, lpg:792  },
  '2022-4': { elec:342542, wood:143010, diesel:null, lpg:720  },
  '2022-3': { elec:285614, wood:152593, diesel:null, lpg:720  },
  '2022-2': { elec:231701, wood: 93350, diesel:null, lpg:504  },
  '2022-1': { elec:298187, wood:104520, diesel:null, lpg:504  },
  // 2021
  '2021-12':{ elec:291952, wood:151720, diesel:null, lpg:432  },
  '2021-11':{ elec:272002, wood:137950, diesel:null, lpg:576  },
  '2021-10':{ elec:262308, wood:143460, diesel:null, lpg:432  },
  '2021-9': { elec:178908, wood:109690, diesel:null, lpg:288  },
  '2021-8': { elec:178945, wood: 47910, diesel:null, lpg:288  },
  '2021-7': { elec:326787, wood:179022, diesel:null, lpg:576  },
  '2021-6': { elec:340894, wood:164110, diesel:null, lpg:576  },
  '2021-5': { elec:305095, wood:147250, diesel:null, lpg:576  },
  '2021-4': { elec:308526, wood:112290, diesel:null, lpg:432  },
  '2021-3': { elec:262826, wood:172400, diesel:null, lpg:429  },
  '2021-2': { elec:179507, wood: 74750, diesel:null, lpg:288  },
  '2021-1': { elec:246462, wood:161160, diesel:null, lpg:390  },
};

const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ok  = (a,b,tol)=> b==null || Math.abs((a||0)-b)<=tol;
const fmt = (label,a,b,tol)=> {
  if(b==null) return null;
  const d=(a||0)-b, pct=(b>0?(d/b*100).toFixed(1):'-');
  return Math.abs(d)<=tol ? null : `${label}:❌DB=${(a||0).toFixed(0)} SC=${b} Δ=${d>=0?'+':''}${d.toFixed(0)}(${pct}%)`;
};

async function main() {
  const { data: rows } = await s
    .from('emissions_data').select('year,month,category,activity_data')
    .eq('factory_id', FAC_ID).limit(5000);

  const db={};
  for(const r of rows||[]){
    const k=`${r.year}-${r.month}`;
    if(!db[k]) db[k]={};
    db[k][r.category]=+r.activity_data;
  }

  const diffs=[];
  let pass=0, fail=0;
  console.log('\n══ Phan Thiet: DB vs MIS Screenshot ══════════════════════\n');

  for(const [key,sc] of Object.entries(SC).sort((a,b)=>b[0]<a[0]?1:-1)){
    const [yr,mo]=key.split('-').map(Number);
    const d=db[key]||{};
    const dbE=d.electricity||0, dbW=(d.wood_logs||0)*1000, dbD=d.diesel||0, dbL=(d.lpg||0)*1000;

    const issues=[
      fmt('Elec',   dbE,sc.elec,  1),
      fmt('Wood(kg)',dbW,sc.wood,  2),
      fmt('Diesel',  dbD,sc.diesel,2),
      fmt('LPG(kg)', dbL,sc.lpg,  5),
    ].filter(Boolean);

    const tag=`${yr}-${MONTHS[mo]}`;
    if(issues.length===0){console.log(`✅ ${tag}`);pass++;}
    else{console.log(`❌ ${tag.padEnd(9)}: ${issues.join(' | ')}`);fail++;}

    const push=(cat,raw,scope,unit,ef,dbRaw)=>{
      if(raw==null) return;
      if(!ok(dbRaw,raw,cat==='lpg'?5:cat==='wood_logs'?2:2)){
        const act=(cat==='wood_logs'||cat==='lpg')?raw/1000:raw;
        diffs.push({year:yr,month:mo,category:cat,newAct:act,scope,unit,ef});
      }
    };
    push('electricity',sc.elec,  'scope_2','kWh',  EF.electricity,dbE);
    push('wood_logs',  sc.wood,  'scope_1','ton',  EF.wood_logs,  dbW);
    push('diesel',     sc.diesel,'scope_1','litre',EF.diesel,     dbD);
    push('lpg',        sc.lpg,   'scope_1','ton',  EF.lpg,        dbL);
  }

  console.log(`\n── ✅${pass} matched / ❌${fail} need fix (${diffs.length} records) ──\n`);
  if(diffs.length===0){console.log('All good!');return;}

  let updated=0,inserted=0,errors=0;
  for(const u of diffs){
    const newEm=+(u.newAct*u.ef).toFixed(6);
    const {data:upd,error}=await s.from('emissions_data')
      .update({activity_data:u.newAct,emissions_tco2e:newEm})
      .eq('factory_id',FAC_ID).eq('year',u.year).eq('month',u.month).eq('category',u.category)
      .select('id');

    if(error){console.log(`❌ ${u.year}-${u.month} ${u.category}: ${error.message}`);errors++;continue;}
    if(upd&&upd.length>0){
      console.log(`✅ Updated  ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`);
      updated++;
    } else {
      const {error:ie}=await s.from('emissions_data').insert({
        factory_id:FAC_ID,year:u.year,month:u.month,
        scope:u.scope,category:u.category,
        activity_data:u.newAct,activity_unit:u.unit,emissions_tco2e:newEm,
      });
      if(ie){console.log(`❌ Insert ${u.year}-${u.month} ${u.category}: ${ie.message}`);errors++;}
      else{console.log(`➕ Inserted ${u.year}-${String(u.month).padStart(2)} ${u.category.padEnd(13)}: ${u.newAct}`);inserted++;}
    }
  }
  console.log(`\n✅ Done — Updated:${updated} | Inserted:${inserted} | Errors:${errors}`);
}
main().catch(console.error);
