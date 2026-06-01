import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'mis_data_export.json');
const csvPath = path.join(__dirname, 'RAW_DATA.csv');
const dbPath = path.join(__dirname, '..', 'ghg.db');

// Fixed factory definitions
const FACTORIES = [
  { id: '7040a994-d776-410b-a429-19c0269e2697', name: 'Long An', location: 'Long An', country: 'Vietnam', code: 'FAC-B' },
  { id: '0a586cb1-60e9-4d36-8073-ddc002c88c0d', name: 'Phan Thiet', location: 'Bình Dương', country: 'Vietnam', code: 'FAC-A' },
  { id: '041d71b2-f002-438d-b711-3f6195f0c4e5', name: 'Tay Ninh', location: 'Đồng Nai', country: 'Vietnam', code: 'FAC-C' },
  { id: '6a400f3d-059a-43e7-88ae-d5441ae7c7b5', name: 'Tuticorin', location: 'Maharashtra', country: 'India', code: 'FAC-D' }
];

// Helper to generate UUID-like strings if needed
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Scope 3 transport raw data and EF
const CASHEW_EF = {
  'BENIN':        2.13,
  'BISSAU':       9.82,
  'GHANA':        2.2,
  'INDIA':        4.24971,
  'IVORY COAST':  11.2396,
  'CAMBODIA':     2.7,
  'TANZANIA':     14.96,
  'CONAKRY':      9.82,
  'INDONESIA':    24.74,
  'SENEGAL':      9.82,
  'VIETNAM':      11.2396,
  'NIGERIA':      1.56,
};

const SCOPE3_RAW = [
  // 2021
  ['India', 2021, 'BENIN',        4219.435,   66046816.05,   118144.18],
  ['India', 2021, 'BISSAU',      12655.400,  167608117.60,   354351.20],
  ['India', 2021, 'GHANA',        5128.359,   78889546.50,   143594.05],
  ['India', 2021, 'INDIA',        1173.774,          0.00,  1432004.28],
  ['India', 2021, 'IVORY COAST', 10998.735,  164387093.31,   307964.58],
  ['VN',    2021, 'CAMBODIA',     4788.658,          0.00,  1556313.85],
  ['VN',    2021, 'GHANA',        9657.741,  187124758.31,  1545238.56],
  ['VN',    2021, 'IVORY COAST', 24413.118,  462349104.73,  3887233.64],
  ['VN',    2021, 'TANZANIA',     4054.482,   35194217.41,   648717.12],
  // 2022
  ['India', 2022, 'BISSAU',      15844.051,  209838611.44,   443633.43],
  ['India', 2022, 'IVORY COAST', 21272.078,  317932477.79,   595618.18],
  ['VN',    2022, 'BISSAU',       5058.493,   87191038.34,   809358.88],
  ['VN',    2022, 'CAMBODIA',     3218.544,          0.00,  1046026.80],
  ['VN',    2022, 'CONAKRY',      1061.780,   18694722.24,   169884.80],
  ['VN',    2022, 'GHANA',        9916.871,  192145563.75,  1535081.00],
  ['VN',    2022, 'IVORY COAST', 10909.613,  206612273.10,  1742114.76],
  ['VN',    2022, 'SENEGAL',      2015.361,   33857041.00,   322457.76],
  ['VN',    2022, 'TANZANIA',    13734.870,  119223121.70,  2197579.20],
  // 2023
  ['India', 2023, 'GHANA',        5096.950,   78406381.85,   142714.60],
  ['India', 2023, 'IVORY COAST', 11219.891,  167692490.89,   314156.95],
  ['VN',    2023, 'BISSAU',       7320.763,  126184799.98,  1041631.36],
  ['VN',    2023, 'CAMBODIA',     8358.156,          0.00,  1053127.66],
  ['VN',    2023, 'GHANA',         500.420,    8317831.11,    80067.20],
  ['VN',    2023, 'INDONESIA',    1454.815,    3241263.81,   183306.69],
  ['VN',    2023, 'IVORY COAST', 11669.190,  220997561.61,  1763202.92],
  ['VN',    2023, 'SENEGAL',      1069.222,   17962386.44,   171075.52],
  ['VN',    2023, 'TANZANIA',    15381.260,  133514320.33,  2021047.38],
  ['VN',    2023, 'VIETNAM',      1025.840,          0.00,         0.00],
  // 2024
  ['India', 2024, 'BISSAU',      11896.928,   70131027.46,  6114313.98],
  ['India', 2024, 'GHANA',        1543.215,   14043256.50,    43210.02],
  ['India', 2024, 'IVORY COAST',  2461.170,   23262978.84,    68912.76],
  ['India', 2024, 'TANZANIA',     2409.342,    1138240.35,    67461.58],
  ['VN',    2024, 'BISSAU',       4644.537,   66196622.90,   631723.66],
  ['VN',    2024, 'CAMBODIA',     2429.389,          0.00,   306103.01],
  ['VN',    2024, 'GHANA',        1490.565,   26867671.89,   204764.61],
  ['VN',    2024, 'INDONESIA',    4098.460,   37831188.33,   586065.16],
  ['VN',    2024, 'IVORY COAST',  9001.417,  159897817.92,  1268135.04],
  ['VN',    2024, 'SENEGAL',      1315.548,   22683401.73,   206875.86],
  ['VN',    2024, 'TANZANIA',    13178.755,  115835641.43,  1752502.79],
  ['VN',    2024, 'VIETNAM',       484.435,    4040853.88,    61038.81],
  // 2025
  ['India', 2025, 'BISSAU',       7835.910,   73006976.32,   219405.48],
  ['India', 2025, 'GHANA',        4809.167,   82390649.04,   134656.68],
  ['India', 2025, 'IVORY COAST',  5541.000,   91225153.80,   155148.00],
  ['India', 2025, 'NIGERIA',      1060.288,   20622601.60,    29688.06],
  ['India', 2025, 'TANZANIA',     2105.350,   25163143.20,    58949.80],
  ['VN',    2025, 'BISSAU',       7472.335,   69738452.65,   989342.79],
  ['VN',    2025, 'CAMBODIA',     3241.040,          0.00,   408371.04],
  ['VN',    2025, 'CONAKRY',      1276.164,   19431851.46,   204186.24],
  ['VN',    2025, 'GHANA',        2978.571,   51188929.53,   417197.67],
  ['VN',    2025, 'INDONESIA',     983.860,     826994.54,   123966.36],
  ['VN',    2025, 'IVORY COAST', 10988.664,  167922832.58,  1555829.83],
  ['VN',    2025, 'NIGERIA',      1139.757,   18746279.15,   143609.38],
  ['VN',    2025, 'SENEGAL',      3321.460,   58999913.07,   418503.96],
  ['VN',    2025, 'TANZANIA',    13386.824,  127562019.77,  1863410.11],
  ['VN',    2025, 'VIETNAM',       205.371,          0.00,    25876.75],
  // 2026 (partial)
  ['India', 2026, 'TANZANIA',     3249.968,   16214090.35,    90999.10],
  ['VN',    2026, 'BISSAU',        610.001,   11774815.84,    76860.13],
  ['VN',    2026, 'CAMBODIA',        0.000,          0.00,        0.00],
  ['VN',    2026, 'INDONESIA',     156.350,        418.55,    19700.10],
  ['VN',    2026, 'IVORY COAST',   950.000,          0.00,   119700.00],
  ['VN',    2026, 'TANZANIA',    10156.195,   17518685.80,   316667.13],
  ['VN',    2026, 'VIETNAM',         0.000,          0.00,        0.00],
];

// Delete existing SQLite DB if it exists, to start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑️ Deleted existing ghg.db');
}

const db = new DatabaseSync(dbPath);
console.log('📂 Created local SQLite database at:', dbPath);

// Initialize schemas
db.exec(`
CREATE TABLE IF NOT EXISTS factories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  country TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emissions_data (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  scope TEXT NOT NULL,
  category TEXT NOT NULL,
  activity_data REAL NOT NULL DEFAULT 0,
  activity_unit TEXT NOT NULL,
  emissions_tco2e REAL NOT NULL DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(factory_id, year, month, scope, category)
);

CREATE TABLE IF NOT EXISTS production_data (
  id TEXT PRIMARY KEY,
  factory_id TEXT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'MT',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(factory_id, year, month, category)
);

CREATE TABLE IF NOT EXISTS reduction_initiatives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  factory_id TEXT REFERENCES factories(id),
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  start_date TEXT,
  target_date TEXT,
  estimated_reduction_tco2e REAL DEFAULT 0,
  actual_reduction_tco2e REAL DEFAULT 0,
  estimated_cost_vnd REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scope3_transport_data (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  year INTEGER NOT NULL,
  origin_country TEXT NOT NULL,
  shipped_qty_mts REAL NOT NULL,
  km_ton_vessel REAL DEFAULT 0,
  km_ton_road REAL DEFAULT 0,
  em_vessel_kg REAL GENERATED ALWAYS AS (km_ton_vessel * 0.01604) STORED,
  em_road_kg REAL GENERATED ALWAYS AS (km_ton_road * 0.07547) STORED,
  em_cashew_kg REAL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

console.log('✅ SQLite schemas initialized successfully.');

// ── 1. Seed Factories ──
const insertFactory = db.prepare(`
  INSERT INTO factories (id, name, location, country, code) 
  VALUES (?, ?, ?, ?, ?)
`);
for (const f of FACTORIES) {
  insertFactory.run(f.id, f.name, f.location, f.country, f.code);
}
console.log(`🏭 Seeded ${FACTORIES.length} factories.`);

// ── 2. Seed Emissions Data ──
const CATEGORY_BY_SOURCE = {
  Wood: 'wood_logs',
  'Waste Water': 'wastewater',
  LPG: 'lpg',
  Diesel: 'diesel',
  R134A: 'fgas_r134a',
  R410A: 'fgas_r410a',
  R404A: 'fgas_r404a',
  'CO2 Packing': 'co2_packing',
  'CO2 PCCC': 'co2_pccc',
  Electricity: 'electricity',
};

const UNIT_BY_CATEGORY = {
  wood_logs: 'kg',
  wastewater: 'm3',
  lpg: 'kg',
  diesel: 'litre',
  fgas_r134a: 'kg',
  fgas_r410a: 'kg',
  fgas_r404a: 'kg',
  co2_packing: 'kg',
  co2_pccc: 'kg',
  electricity: 'kWh',
};

const GRID_EF = {
  Vietnam: { 2021: 0.7221, 2022: 0.6766, 2023: 0.6592, 2024: 0.6592, 2025: 0.6592, 2026: 0.6592 },
  India: { 2021: 0.7030, 2022: 0.7150, 2023: 0.7160, 2024: 0.7270, 2025: 0.7100, 2026: 0.7100 },
};

const EF_BY_CATEGORY = {
  Vietnam: {
    wood_logs: 0.0280,
    wastewater: 0.2013,
    lpg: 1.5710,
    diesel: 2.7000,
    fgas_r134a: 1300.0000,
    fgas_r410a: 2088.0000,
    fgas_r404a: 3920.0000,
    co2_packing: 1.0000,
    co2_pccc: 1.0000,
  },
  India: {
    wood_logs: 0.0350,
    wastewater: 0.2013,
    lpg: 1.5200,
    diesel: 2.6800,
    fgas_r134a: 1300.0000,
    fgas_r410a: 2088.0000,
    fgas_r404a: 3920.0000,
    co2_packing: 1.0000,
    co2_pccc: 1.0000,
  },
};

const SCOPE_BY_CATEGORY = { electricity: 'scope_2' };

function round4(value) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function plantKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function canonicalPlant(name) {
  const key = plantKey(name);
  if (key === 'phanthiet') return 'Phan Thiet';
  if (key === 'longan') return 'Long An';
  if (key === 'tayninh') return 'Tay Ninh';
  if (key === 'tuticorin') return 'Tuticorin';
  return String(name || '').trim();
}

function countryForPlant(plant) {
  return canonicalPlant(plant) === 'Tuticorin' ? 'India' : 'Vietnam';
}

function emissionFactor(category, country, year) {
  if (category === 'electricity') return GRID_EF[country]?.[year] ?? GRID_EF[country]?.[2025] ?? 0;
  return EF_BY_CATEGORY[country]?.[category] ?? 0;
}

const factoryMap = new Map();
factoryMap.set('Long An', '7040a994-d776-410b-a429-19c0269e2697');
factoryMap.set('Phan Thiet', '0a586cb1-60e9-4d36-8073-ddc002c88c0d');
factoryMap.set('Tay Ninh', '041d71b2-f002-438d-b711-3f6195f0c4e5');
factoryMap.set('Tuticorin', '6a400f3d-059a-43e7-88ae-d5441ae7c7b5');

if (fs.existsSync(jsonPath)) {
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const recordMap = new Map();

  for (const row of rows) {
    const category = CATEGORY_BY_SOURCE[row.source];
    if (!category) continue;

    const plant = canonicalPlant(row.plant);
    const factoryId = factoryMap.get(plant);
    if (!factoryId) throw new Error(`No factory_id found for plant: ${row.plant}`);

    const activity = Number(row.consumption_qty) || 0;
    if (activity <= 0) continue;

    const country = countryForPlant(plant);
    const ef4 = round4(emissionFactor(category, country, Number(row.year)));

    const scope = SCOPE_BY_CATEGORY[category] || 'scope_1';
    const key = [factoryId, row.year, row.month, scope, category].join('|');
    const emission = round4((activity * ef4) / 1000);
    const existing = recordMap.get(key);
    
    // Sum cost if present, or estimate it
    const cost = Number(row.cost_usd) || 0;

    if (existing) {
      existing.activity_data = round4(existing.activity_data + activity);
      existing.emissions_tco2e = round4(existing.emissions_tco2e + emission);
      existing.cost_usd = round4(existing.cost_usd + cost);
    } else {
      recordMap.set(key, {
        id: generateUUID(),
        factory_id: factoryId,
        year: Number(row.year),
        month: Number(row.month),
        scope,
        category,
        activity_data: activity,
        activity_unit: UNIT_BY_CATEGORY[category] || row.unit,
        emissions_tco2e: emission,
        cost_usd: cost,
        notes: `MIS activity source=${row.source}; EF 4dp=${ef4}; previous MIS 3dp=${row.mis_ef_3dp}`,
      });
    }
  }

  const insertEmission = db.prepare(`
    INSERT INTO emissions_data (id, factory_id, year, month, scope, category, activity_data, activity_unit, emissions_tco2e, cost_usd, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const records = [...recordMap.values()];
  db.exec('BEGIN TRANSACTION');
  try {
    for (const r of records) {
      insertEmission.run(r.id, r.factory_id, r.year, r.month, r.scope, r.category, r.activity_data, r.activity_unit, r.emissions_tco2e, r.cost_usd, r.notes);
    }
    db.exec('COMMIT');
    console.log(`📈 Seeded ${records.length} emissions data records.`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Failed seeding emissions_data:', err);
  }
} else {
  console.log('⚠️ mis_data_export.json not found, skipping emissions seeding.');
}

// ── 3. Seed Production Data ──
function parseDate(dateStr) {
  const m = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  const p = dateStr.replace(/[/-]/g,' ').split(' ');
  let y = parseInt(p[1]); if (y<100) y+=2000;
  return { month: m[p[0]], year: y };
}
function parseNum(v) { if(!v||!v.trim()) return 0; return parseFloat(v.replace(/[",\s]/g,''))||0; }

if (fs.existsSync(csvPath)) {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').filter(l => l.trim());
  const hi = lines.findIndex(l => l.startsWith('MIX,Plant'));
  const data = lines.slice(hi + 1);
  const prodRecords = [];

  const fm = {
    'PhanThiet': '0a586cb1-60e9-4d36-8073-ddc002c88c0d',
    'LongAn':    '7040a994-d776-410b-a429-19c0269e2697',
    'TayNinh':   '041d71b2-f002-438d-b711-3f6195f0c4e5',
    'Tuticorin': '6a400f3d-059a-43e7-88ae-d5441ae7c7b5'
  };

  for (const line of data) {
    const fields = []; let cur='', inQ=false;
    for (const c of line) {
      if(c==='"'){inQ=!inQ;continue;} if(c===','&&!inQ){fields.push(cur.trim());cur='';continue;} if(c==='\r')continue;
      cur+=c;
    }
    fields.push(cur.trim());
    const plant = fields[1], dateStr = fields[2];
    if (!plant || !dateStr || !fm[plant]) continue;
    const {month, year} = parseDate(dateStr);
    const fid = fm[plant];
    const rcn = parseNum(fields[13]); // RCN input
    const ck = parseNum(fields[14]);  // CK output

    if (rcn > 0) prodRecords.push({ id: generateUUID(), factory_id: fid, year, month, category: 'rcn_input', quantity: rcn, unit: 'MT' });
    if (ck > 0) prodRecords.push({ id: generateUUID(), factory_id: fid, year, month, category: 'ck_output', quantity: ck, unit: 'MT' });
  }

  const insertProd = db.prepare(`
    INSERT OR REPLACE INTO production_data (id, factory_id, year, month, category, quantity, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const r of prodRecords) {
      insertProd.run(r.id, r.factory_id, r.year, r.month, r.category, r.quantity, r.unit);
    }
    db.exec('COMMIT');
    console.log(`📊 Seeded ${prodRecords.length} production records.`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('❌ Failed seeding production_data:', err);
  }
} else {
  console.log('⚠️ RAW_DATA.csv not found, skipping production seeding.');
}

// ── 4. Seed Scope 3 Transport Data ──
const insertS3 = db.prepare(`
  INSERT INTO scope3_transport_data (id, region, year, origin_country, shipped_qty_mts, km_ton_vessel, km_ton_road, em_cashew_kg, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN TRANSACTION');
try {
  let s3count = 0;
  for (const [region, year, origin, qty, vessel, road] of SCOPE3_RAW) {
    if (qty > 0 || vessel > 0 || road > 0) {
      const ef = CASHEW_EF[origin] ?? null;
      const em_cashew = ef != null ? +(qty * 1000 * ef).toFixed(2) : null;
      insertS3.run(
        generateUUID(),
        region,
        year,
        origin,
        qty,
        vessel,
        road,
        em_cashew,
        ef == null ? 'No EF mapping for ' + origin : null
      );
      s3count++;
    }
  }
  db.exec('COMMIT');
  console.log(`🚢 Seeded ${s3count} Scope 3 transport records.`);
} catch (err) {
  db.exec('ROLLBACK');
  console.error('❌ Failed seeding scope3_transport_data:', err);
}

// ── 5. Seed Default Initiative ──
const insertInitiative = db.prepare(`
  INSERT INTO reduction_initiatives (id, name, description, factory_id, scope, status, start_date, target_date, estimated_reduction_tco2e, actual_reduction_tco2e, estimated_cost_vnd, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
try {
  insertInitiative.run(
    generateUUID(),
    'Điện mặt trời áp mái — Nhà máy Phan Thiết (1,614 MWh/năm)',
    'Hệ thống điện mặt trời áp mái 1,614 MWh/năm tại nhà máy Phan Thiết. Nguồn: Báo cáo khả thi hệ thống điện mặt trời (Cân bằng phát thải CO₂). EF sử dụng: 0.6592 tCO₂/kWh (lưới quốc gia). Tiết kiệm Scope 2 ~1,064 tCO₂e/năm (năm đầu). Dự kiến vận hành: cuối 2026, năm đầy đủ đầu tiên: 2027. Độ suy giảm tấm pin: 1%/năm.',
    '0a586cb1-60e9-4d36-8073-ddc002c88c0d', // Phan Thiet
    'scope_2',
    'in_progress',
    '2026-01-01',
    '2027-01-01',
    1064,
    0,
    0,
    'Nguồn: opex-report solar constants. 1614 MWh × 0.6592 tCO₂/kWh = 1,064 tCO₂e/năm (năm 1). Năm tiếp theo giảm 1%/năm theo độ suy giảm tấm pin.'
  );
  console.log('🌱 Seeded default Solar Rooftop initiative.');
} catch (err) {
  console.error('❌ Failed seeding default initiative:', err);
}

console.log('\n🎉 SQLite database fully populated and ready!');
