/**
 * Import RCN & CK production data into production_data table
 */
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://irbvgsyzidqnzhpetmdk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYnZnc3l6aWRxbnpocGV0bWRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjQ3NjUsImV4cCI6MjA5MTEwMDc2NX0.4WW7fytqC5KB-CVoYo7WURcUnOxTsvITZ3WHLEAFASE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseDate(dateStr) {
  const m = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const p = dateStr.replace(/[/-]/g,' ').split(' ');
  let y = parseInt(p[1]); if (y<100) y+=2000;
  return { month: m[p[0]], year: y };
}
function parseNum(v) { if(!v||!v.trim()) return 0; return parseFloat(v.replace(/[",\s]/g,''))||0; }

async function main() {
  console.log('📦 Importing RCN & CK into production_data...\n');
  const { data: factories } = await supabase.from('factories').select('*');
  const fm = {};
  for (const f of factories) {
    if (f.code==='FAC-A') fm['PhanThiet']=f.id;
    if (f.code==='FAC-B') fm['LongAn']=f.id;
    if (f.code==='FAC-C') fm['TayNinh']=f.id;
    if (f.code==='FAC-D') fm['Tuticorin']=f.id;
  }

  const csv = require('fs').readFileSync(require('path').join(__dirname,'RAW_DATA.csv'),'utf-8');
  const lines = csv.split('\n').filter(l=>l.trim());
  const hi = lines.findIndex(l=>l.startsWith('MIX,Plant'));
  const data = lines.slice(hi+1);
  const records = [];

  for (const line of data) {
    const fields = []; let cur='',inQ=false;
    for (const c of line) {
      if(c==='"'){inQ=!inQ;continue;} if(c===','&&!inQ){fields.push(cur.trim());cur='';continue;} if(c==='\r')continue;
      cur+=c;
    }
    fields.push(cur.trim());
    const plant = fields[1], dateStr = fields[2];
    if (!plant||!dateStr||!fm[plant]) continue;
    const {month,year} = parseDate(dateStr);
    const fid = fm[plant];
    const rcn = parseNum(fields[13]); // RCN đầu vào
    const ck = parseNum(fields[14]);  // CK đầu ra

    if (rcn>0) records.push({factory_id:fid,year,month,category:'rcn_input',quantity:rcn,unit:'MT'});
    if (ck>0) records.push({factory_id:fid,year,month,category:'ck_output',quantity:ck,unit:'MT'});
  }

  console.log(`📊 Parsed ${records.length} records`);
  let ok=0;
  for (let i=0;i<records.length;i+=50) {
    const batch = records.slice(i,i+50);
    const {error} = await supabase.from('production_data').upsert(batch,{onConflict:'factory_id,year,month,category'});
    if (error) console.error('❌',error.message);
    else { ok+=batch.length; process.stdout.write(`  ✅ ${ok}/${records.length}\r`); }
  }
  console.log(`\n🎉 Done! ${ok} records`);
  
  // Verify
  const {data:check} = await supabase.from('production_data').select('category,quantity').limit(10);
  console.log('Sample:', check?.slice(0,5));
}
main().catch(console.error);
