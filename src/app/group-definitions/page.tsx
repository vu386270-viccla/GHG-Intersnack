const sections = [
  {
    title: 'Scope 1 & Scope 2 CO₂e',
    tag: 'Definition Book 4.6.3',
    points: [
      'Scope 1 and Scope 2 emissions are calculated from Energy Sourcing and CO₂e Factors.',
      'Formula: CO₂e (ton) = Energy type (kWh) × CO₂e factor (kgCO₂/kWh) / 1000.',
      'Energy Sourcing is the basis for sustainability reporting and Scope 1/2 CO₂e calculation.',
      'Purchased electricity should use market-based reporting for SBTi views; location-based is for grid-average comparison.',
    ],
  },
  {
    title: 'Scope 3 CO₂e',
    tag: 'Definition Book 4.7',
    points: [
      'The current Definition Book marks Scope 3 CO₂e Emissions as under construction.',
      'Until Group publishes final Scope 3 rules, the app should label Scope 3 as application methodology.',
      'Current app methodology: Cat.1 purchased raw cashew/origin EF, Cat.3 upstream WTT, Cat.4 vessel/road transport.',
      'Do not present current Scope 3 category logic as fully defined by the Group Definition Book yet.',
    ],
  },
  {
    title: 'Gas Consumption & LPG',
    tag: 'Definition Book 4.8.4–4.8.6',
    points: [
      'Gas Consumption includes Natural Gas, LNG, Propane, Biogas, and Hydrogen.',
      'LPG is not Natural Gas.',
      'Because LPG is commonly propane or propane/butane, report LPG under Gas Consumption as Propane / LPG.',
      'Do not label LPG as Natural Gas; only map it to Other Energy/Fuel if Group explicitly confirms that local source-data definition.',
    ],
  },
  {
    title: 'Electricity Consumption',
    tag: 'Definition Book 4.8.1–4.8.3',
    points: [
      'Electricity Consumption covers general areas and process/product-category usage.',
      'General areas include offices, changing rooms, warehouses, electric forklifts, workshops, canteen, and cleaning.',
      'If gas is converted into electricity and heat with own CHP, output electricity/heat is Energy Consumption.',
      'Gas input into own CHP is reported only under Energy Sourcing.',
    ],
  },
  {
    title: 'Other Energy & Bio-Based Energy',
    tag: 'Definition Book 4.8.7–4.8.9 / 4.6.2',
    points: [
      'Other Energy Consumption includes Fuel, District Heating, Steam, and Biomass.',
      'Wood/Biomass input into own powerplant is reported only under Energy Sourcing, not Other Energy Consumption.',
      'For bio-based energy sources such as Biogas, Biomass, and Wood, CO₂ is reported separately.',
      'Only N₂O and CH₄ emissions from bio-based energy are accounted under Scope 1.',
    ],
  },
  {
    title: 'Dashboard Reporting Rules',
    tag: 'App governance',
    points: [
      'Always label number basis: Opex current DB, KPI/slide historical, market-based, location-based, YTD, or forecast.',
      'Avoid mixing hardcoded KPI/slide values with current DB-calculated Opex values in one view without a clear label.',
      'Use Group energy bucket definitions for Scope 1/2 and utility/intensity reporting.',
      'Keep Scope 3 caveated until Group releases a complete Definition Book section.',
    ],
  },
];

const mappings = [
  ['lpg', 'Gas Consumption', 'Propane / LPG', 'Not Natural Gas'],
  ['electricity', 'Electricity Consumption', 'Purchased electricity', 'Scope 2 basis depends on market/location view'],
  ['wood_logs / biomass', 'Other Energy or Energy Sourcing', 'Wood / Biomass', 'Bio CO₂ separate; N₂O/CH₄ in Scope 1'],
  ['diesel / fuel', 'Other Energy Consumption', 'Fuel Purchased', 'Scope 1 energy source where combusted onsite'],
  ['scope3_cat1', 'Scope 3 methodology', 'Purchased raw cashew / origin EF', 'Group book section under construction'],
  ['scope3_cat3', 'Scope 3 methodology', 'Well-to-Tank upstream energy', 'Application methodology'],
  ['scope3_cat4', 'Scope 3 methodology', 'Transport vessel / road', 'Application methodology'],
];

const calculationMethods = [
  ['Scope 1', 'Wood / Biomass', 'ton', 'Wood ton × EF wood', 'VN: 0.028 tCO₂e/ton; India: 0.035 tCO₂e/ton', 'Direct biomass CH₄/N₂O treatment in app calculation. Biogenic CO₂ is not counted as fossil CO₂e here.'],
  ['Scope 1', 'LPG / Gas', 'ton', 'LPG ton × EF LPG', 'VN: 2.9093 tCO₂e/ton; India: 2.983 tCO₂e/ton', 'Direct onsite fuel combustion. For Group kWh reporting, LPG can also be converted as LPG ton × 12,800 kWh/ton.'],
  ['Scope 1', 'Diesel', 'litre', 'Diesel L × EF diesel', 'VN/standard: 0.00268 tCO₂e/L; India: 0.00272 tCO₂e/L', 'Direct onsite fuel combustion. For Group kWh reporting, diesel can be converted as diesel L × 10.7 kWh/L.'],
  ['Scope 1', 'F-gas refrigerants', 'kg', 'Refrigerant kg × GWP / 1,000', 'R134a: 1,300; R410a: 2,088; R404a: 3,920', 'Leakage/top-up based refrigerant emissions.'],
  ['Scope 1', 'CO₂ packing / PCCC', 'kg', 'CO₂ kg × 0.001', '1 kg CO₂ = 0.001 tCO₂e', 'Direct CO₂ usage/release where reported.'],
  ['Scope 1', 'Wastewater / WWTS', 'm³', 'Wastewater m³ × EF wastewater', '0.0002013 tCO₂e/m³', 'Included in app Scope 1 where wastewater activity is reported.'],
  ['Scope 2', 'Purchased electricity', 'kWh', 'Electricity kWh × grid EF / 1,000', 'VN: 0.6592 tCO₂e/MWh; India: 0.7100 tCO₂e/MWh', 'Location/grid-based conversion used for operational view and OPEX electricity kWh bridge.'],
  ['Scope 2', 'SBTi electricity pathway', 'tCO₂e → kWh', 'Electricity kWh = Scope 2 target tCO₂e / grid EF × 1,000', 'VN: divide by 0.6592; India: divide by 0.7100', 'Used to translate Scope 2 SBTi/OPEX target into electricity kWh. PT rooftop solar is deducted from 2027.'],
  ['Scope 3 Cat.1', 'Purchased raw cashew / RCN', 'ton RCN', 'RCN quantity by origin × origin EF', 'Origin EF table in app methodology', 'Main Scope 3 driver. Current Group Definition Book still marks Scope 3 as under construction, so label as app methodology.'],
  ['Scope 3 Cat.3', 'Well-to-Tank upstream energy', 'activity', 'Fuel/electricity/wood activity × WTT EF', 'Diesel, LPG, electricity and wood WTT factors by country', 'Upstream energy emissions linked to Scope 1/2 energy use.'],
  ['Scope 3 Cat.4', 'Transport vessel / road', 'ton-km', 'Ton-km × transport EF', 'Vessel and road freight EF in app methodology', 'Inbound logistics emissions for raw material transport.'],
];

const groupKwhMethods = [
  ['Electricity Consumption', 'Electricity kWh', 'Electricity kWh', 'Group calculates Scope 2 using relevant electricity EF.'],
  ['Gas Consumption', 'LPG ton × 12,800 kWh/ton', 'Natural Gas CO₂e = Gas kWh × 0.18 / 1,000', 'This is Group/Jouko kWh method, not the direct app LPG EF method.'],
  ['Other Energy Consumption', 'Firewood ton × 4,000 kWh/ton + Diesel L × 10.7 kWh/L', 'Biomass CH₄/N₂O CO₂e = Other Energy kWh × 0.01513 / 1,000', 'If diesel is included in Other Energy, explain category mapping difference versus direct app Scope 1.'],
];

export default function GroupDefinitionsPage() {
  return (
    <main style={{ padding: 28, maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Intersnack Definition Book v1.0</div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 34, lineHeight: 1.12, color: '#111827' }}>Group GHG Definitions</h1>
        <p style={{ margin: 0, color: '#4b5563', fontSize: 15, lineHeight: 1.6 }}>
          Working reference for Scope 1/2/3, energy buckets, LPG mapping, and Opex/dashboard reporting basis.
        </p>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
        {sections.map(section => (
          <article key={section.title} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#C8281A', textTransform: 'uppercase', letterSpacing: 0.6 }}>{section.tag}</div>
            <h2 style={{ margin: '6px 0 12px', fontSize: 19, color: '#111827' }}>{section.title}</h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13.5, lineHeight: 1.55 }}>
              {section.points.map(point => <li key={point} style={{ marginBottom: 7 }}>{point}</li>)}
            </ul>
          </article>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
        <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #111827, #374151)', color: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>App Mapping Table</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.86 }}>Use this taxonomy when importing data or explaining dashboard numbers.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#374151' }}>
                <th style={th}>Raw / App Category</th>
                <th style={th}>Group Bucket</th>
                <th style={th}>Reporting Label</th>
                <th style={th}>Rule</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map(row => (
                <tr key={row[0]}>
                  {row.map(cell => <td key={cell} style={td}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
        <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #7f1d1d, #C8281A)', color: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Calculated Method — Scope 1 / 2 / 3</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>Quick reference for how the app calculates emissions and how Group kWh reporting is reconciled.</p>
        </div>
        <div style={{ padding: '12px 18px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#7c2d12', fontSize: 13.5, lineHeight: 1.55 }}>
          <strong>Emission factor source basis:</strong> Emission factors are selected from recognized local regulatory sources, national grid factor publications, international GHG accounting references, and reputable LCA / logistics databases where local factors are not available. The app prioritizes local or country-specific factors first, then applies international references or internal validated calculations as proxy where required. Scope 1/2 follows the Group Definition Book principle of activity or energy sourcing data × CO₂e factor. Scope 3 uses application methodology based on origin, transport, and WTT factors until Group publishes a complete final Scope 3 definition.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#374151' }}>
                <th style={th}>Scope</th>
                <th style={th}>Emission source</th>
                <th style={th}>Activity unit</th>
                <th style={th}>Calculation formula</th>
                <th style={th}>EF / Conversion basis</th>
                <th style={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {calculationMethods.map(row => (
                <tr key={`${row[0]}-${row[1]}`}>
                  {row.map(cell => <td key={cell} style={td}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
        <div style={{ padding: '16px 18px', background: 'linear-gradient(135deg, #0f172a, #1a3d5c)', color: '#fff' }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Group kWh Submission Method</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>Use this when explaining the kWh file submitted to Group and why Jouko output can differ from direct app Scope 1.</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#374151' }}>
                <th style={th}>Group line</th>
                <th style={th}>ICC kWh conversion</th>
                <th style={th}>Group/Jouko CO₂e calculation</th>
                <th style={th}>Reconciliation note</th>
              </tr>
            </thead>
            <tbody>
              {groupKwhMethods.map(row => (
                <tr key={row[0]}>
                  {row.map(cell => <td key={cell} style={td}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 14, color: '#92400e', fontSize: 13.5, lineHeight: 1.6 }}>
        <strong>Important:</strong> Scope 3 in the Definition Book is still under construction. Current Scope 3 numbers should clearly state whether they are Opex current DB, KPI/slide historical, YTD, or forecast methodology.
      </section>
    </main>
  );
}

const th = { padding: '12px 14px', textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb', fontWeight: 900 };
const td = { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#374151', verticalAlign: 'top' as const };
