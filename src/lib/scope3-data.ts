// ── Origin EFs (kg CO₂e / kg RCN, Cat.1, FLAG) ────────
export const ORIGIN_EF: Record<string, { ef: number; flag: boolean; color: string }> = {
  'Indonesia':  { ef: 24.74,    flag: true, color: '#C8281A' },  // 🔴 highest
  'Tanzania':   { ef: 14.96,    flag: true, color: '#C8281A' },  // 🔴 very high
  'C.Ivory':    { ef: 11.2396,  flag: true, color: '#E8960E' },  // 🟠 high
  'Vietnam':    { ef: 11.2396,  flag: true, color: '#E8960E' },  // 🟠 high
  'Guinea-B':   { ef:  9.82,    flag: true, color: '#E8960E' },  // 🟠 Africa generic
  'Senegal':    { ef:  9.82,    flag: true, color: '#E8960E' },  // 🟠
  'Guinea':     { ef:  9.82,    flag: true, color: '#E8960E' },  // 🟠 
  'India':      { ef:  4.24971, flag: true, color: '#E8960E' },  // 🟡 medium
  'Cambodia':   { ef:  2.7,     flag: true, color: '#3E7B3E' },  // 🟢 lower
  'Ghana':      { ef:  2.2,     flag: true, color: '#3E7B3E' },  // 🟢 lower
  'Benin':      { ef:  2.13,    flag: true, color: '#3E7B3E' },  // 🟢 lower
  'Nigeria':    { ef:  1.56,    flag: true, color: '#3E7B3E' },  // 🟢 lowest
};

// ── Origin Mix per year (MTs) ────────
export const ORIGIN_MIX: Record<number, Record<string, number>> = {
  2021: { 'C.Ivory': 35412, 'Guinea-B': 12655, 'Ghana': 14786, 'Cambodia': 4789, 'Tanzania': 4054, 'Benin': 4219, 'India': 1174 },
  2022: { 'C.Ivory': 32182, 'Guinea-B': 20903, 'Tanzania': 13735, 'Ghana': 9917, 'Cambodia': 3219, 'Senegal': 2015, 'Guinea': 1062 },
  2023: { 'C.Ivory': 22889, 'Tanzania': 15381, 'Cambodia': 8358, 'Guinea-B': 7321, 'Ghana': 5597, 'Indonesia': 1455, 'Senegal': 1069, 'Vietnam': 1026 },
  2024: { 'C.Ivory': 11463, 'Tanzania': 15588, 'Guinea-B': 16541, 'Indonesia': 4098, 'Ghana': 3034, 'Cambodia': 2429, 'Senegal': 1316, 'Vietnam': 484 },
  2025: { 'C.Ivory': 16530, 'Tanzania': 15492, 'Guinea-B': 15308, 'Ghana': 7788, 'Senegal': 3321, 'Cambodia': 3241, 'Nigeria': 2200, 'Guinea': 1276, 'Indonesia': 984, 'Vietnam': 205 },
};

// ── TRANSPORT_STATIC (km×ton) ────────
export const TRANSPORT_STATIC: Record<number, { vessel: number; road: number; qty: number }> = {
  2021: { vessel: 1_161_599_654, road:  9_993_561, qty:  77090 },
  2022: { vessel: 1_185_494_849, road:  8_861_755, qty:  83032 },
  2023: { vessel:   756_317_036, road:  6_770_330, qty:  63097 },
  2024: { vessel:   541_928_701, road: 11_311_107, qty:  54954 },
  2025: { vessel:   806_825_797, road:  6_748_142, qty:  66346 },
};

/** Nearest available year with static Cat.1 data (i.e. has ORIGIN_MIX entry). */
export function nearestStaticYear(year: number): number {
  const available = Object.keys(ORIGIN_MIX).map(Number).sort((a, b) => a - b);
  if (available.includes(year)) return year;
  // Find the closest available year ≤ requested year
  const past = available.filter(y => y <= year);
  if (past.length > 0) return past[past.length - 1];
  return available[0]; // fallback to earliest
}

export function getS3StaticCat1and4(year: number) {
  // If no mix data for this year, use nearest available year
  const resolvedYear = nearestStaticYear(year);
  const isEstimated = resolvedYear !== year;

  let cat1 = 0;
  const mix = ORIGIN_MIX[resolvedYear] || {};
  for (const [origin, qty] of Object.entries(mix)) {
    const ef = ORIGIN_EF[origin]?.ef ?? 2.5; 
    cat1 += qty * ef; // tCO2e
  }

  let cat4 = 0;
  let cat4v = 0;
  let cat4r = 0;
  const transYear = TRANSPORT_STATIC[resolvedYear] ? resolvedYear : nearestStaticYear(year);
  const trans = TRANSPORT_STATIC[transYear];
  if (trans) {
    cat4v = trans.vessel * 0.01604 / 1000;
    cat4r = trans.road * 0.07547 / 1000;
    cat4 = cat4v + cat4r;
  }

  return { cat1, cat4, cat4v, cat4r, isEstimated, resolvedYear };
}
