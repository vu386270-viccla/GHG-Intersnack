export type ComparisonRow = {
  site: string;
  category: string;
  appActivity?: number;
  appUnit?: string;
  appTco2e?: number;
  appEf?: number;
  appEfUnit?: string;
  groupActivity?: number;
  groupUnit?: string;
  groupTco2e?: number;
  groupKwhFactor?: number;
  groupKwhFactorUnit?: string;
  groupEf?: number;
  groupEfUnit?: string;
  inferredRaw?: number;
  inferredRawUnit?: string;
  status: 'match' | 'unit_gap' | 'missing_app' | 'missing_group' | 'ef_gap' | 'needs_factor';
  note: string;
};

export const GROUP_SCOPE1_TOTAL_CLAIM = 470;
export const APP_SCOPE1_TOTAL = 413.49;
export const GROUP_CACHED_TCO2E = 159.07;

export const comparisonRows: ComparisonRow[] = [
  { site: 'Long An', category: 'Fuel / diesel', appActivity: 1700, appUnit: 'litre', appTco2e: 4.56, appEf: 2.68, appEfUnit: 'kgCO2e/litre', groupActivity: 16932, groupUnit: 'kWh', groupKwhFactor: 9.96, groupKwhFactorUnit: 'kWh/litre', inferredRaw: 1700, inferredRawUnit: 'litre', status: 'unit_gap', note: 'Group stores kWh; reverse calculation = 1,700 litre, matching app.' },
  { site: 'Phan Thiet', category: 'Fuel / diesel', appActivity: 1008.19, appUnit: 'litre', appTco2e: 2.7, appEf: 2.68, appEfUnit: 'kgCO2e/litre', groupActivity: 10041.48, groupUnit: 'kWh', groupKwhFactor: 9.96, groupKwhFactorUnit: 'kWh/litre', inferredRaw: 1008.18, inferredRawUnit: 'litre', status: 'unit_gap', note: 'Group reverse calculation = 1,008.18 litre, matching app.' },
  { site: 'Tay Ninh', category: 'Fuel / diesel', appActivity: 14294, appUnit: 'litre', appTco2e: 38.31, appEf: 2.68, appEfUnit: 'kgCO2e/litre', groupActivity: 142368.24, groupUnit: 'kWh', groupKwhFactor: 9.96, groupKwhFactorUnit: 'kWh/litre', inferredRaw: 14294, inferredRawUnit: 'litre', status: 'unit_gap', note: 'Stationary fuel matches after kWh / 9.96; fleet diesel differs separately.' },
  { site: 'Tuticorin', category: 'Fuel / diesel', appActivity: 48534, appUnit: 'litre', appTco2e: 130.07, appEf: 2.68, appEfUnit: 'kgCO2e/litre', groupActivity: 483398.64, groupUnit: 'kWh', groupKwhFactor: 9.96, groupKwhFactorUnit: 'kWh/litre', inferredRaw: 48534, inferredRawUnit: 'litre', status: 'unit_gap', note: 'Group reverse calculation = 48,534 litre, matching app.' },
  { site: 'Long An', category: 'Wood / boiler', appActivity: 1564.74, appUnit: 'ton', appTco2e: 43.81, appEf: 28, appEfUnit: 'kgCO2e/ton', groupActivity: 7667226, groupUnit: 'kWh', groupKwhFactor: 4.9, groupKwhFactorUnit: 'kWh/kg', inferredRaw: 1564.74, inferredRawUnit: 'ton', groupEf: 0, groupEfUnit: 'kgCO2e/kWh', status: 'unit_gap', note: 'Group reverse calculation = 1,564.74 ton; CO2 factor in workbook is 0/blank.' },
  { site: 'Phan Thiet', category: 'Wood / boiler', appActivity: 1604.13, appUnit: 'ton', appTco2e: 44.92, appEf: 28, appEfUnit: 'kgCO2e/ton', groupActivity: 6416512, groupUnit: 'kWh', groupKwhFactor: 4, groupKwhFactorUnit: 'kWh/kg', inferredRaw: 1604.13, inferredRawUnit: 'ton', groupEf: 0, groupEfUnit: 'kgCO2e/kWh', status: 'unit_gap', note: 'Group uses 4.0 kWh/kg here instead of 4.9; reverse calculation matches app tonnage.' },
  { site: 'Tay Ninh', category: 'Wood / boiler', appActivity: 1886.97, appUnit: 'ton', appTco2e: 52.84, appEf: 28, appEfUnit: 'kgCO2e/ton', groupActivity: 9245908, groupUnit: 'kWh', groupKwhFactor: 4.9, groupKwhFactorUnit: 'kWh/kg', inferredRaw: 1886.92, inferredRawUnit: 'ton', groupEf: 0, groupEfUnit: 'kgCO2e/kWh', status: 'unit_gap', note: 'Group reverse calculation = 1,886.92 ton, near app.' },
  { site: 'Tuticorin', category: 'Biomass / boiler', appActivity: 1366.04, appUnit: 'ton', appTco2e: 47.81, appEf: 35, appEfUnit: 'kgCO2e/ton', groupActivity: 6693596, groupUnit: 'kWh', groupKwhFactor: 4.9, groupKwhFactorUnit: 'kWh/kg', inferredRaw: 1366.04, inferredRawUnit: 'ton', status: 'unit_gap', note: 'Group reverse calculation = 1,366.04 ton, matching app.' },
  { site: 'Tuticorin', category: 'Gas', groupActivity: 34367.2, groupUnit: 'kWh', groupKwhFactor: 13.6, groupKwhFactorUnit: 'kWh/unit', inferredRaw: 2527, inferredRawUnit: 'unit', status: 'needs_factor', note: 'Group has gas kWh but CO2 factor is blank; source activity = 2,527 units.' },
  { site: 'HCM Office', category: 'Fuel consumption', groupActivity: 76297.13, groupUnit: 'kWh', groupKwhFactor: 9.96, groupKwhFactorUnit: 'kWh/litre if diesel-equivalent', inferredRaw: 7660.36, inferredRawUnit: 'litre estimate', status: 'missing_app', note: 'Office data exists only in group file; reverse estimate is ~7,660 litre if same 9.96 kWh/litre factor is used.' },
  { site: 'HCM Office', category: 'Electricity', groupActivity: 13338, groupUnit: 'kWh', status: 'missing_app', note: 'Office Scope 2 raw data appears in group file; app factory comparison does not include HCM Office.' },
  { site: 'HCM Office', category: 'Water', groupActivity: 68, groupUnit: 'm3', status: 'missing_app', note: 'Office water raw exists in group file; waste rows are mostly blank.' },
  { site: 'HCM', category: 'Petrol fleet', groupActivity: 7629.71, groupUnit: 'litre', status: 'missing_app', note: 'Group car fleet includes HCM petrol; app has no HCM factory/site Scope 1 row.' },
  { site: 'Tay Ninh', category: 'Fleet diesel', appActivity: 14294, appUnit: 'litre', appTco2e: 38.31, groupActivity: 12664, groupUnit: 'litre', status: 'ef_gap', note: 'Group fleet litre is lower than app total diesel; app also includes stationary diesel mapping.' },
  { site: 'Long An', category: 'Fleet diesel / bus', appActivity: 1700, appUnit: 'litre', appTco2e: 4.56, groupActivity: 153696, groupUnit: 'km', status: 'unit_gap', note: 'Group has km-only leased bus data, so a distance EF or fuel economy is needed.' },
  { site: 'Phan Thiet', category: 'Fleet diesel / bus & truck', appActivity: 1008.19, appUnit: 'litre', appTco2e: 2.7, groupActivity: 110204, groupUnit: 'km', status: 'unit_gap', note: 'Group has km-only fleet data, not litres.' },
  { site: 'Tay Ninh', category: 'R-410A refrigerant', groupActivity: 33, groupUnit: 'kg', groupTco2e: 68.89, groupEf: 2087.5, groupEfUnit: 'kgCO2e/kg', appEf: 3943, appEfUnit: 'kgCO2e/kg', status: 'missing_app', note: 'Group has calculated refrigerant emissions; app has no matching activity row.' },
  { site: 'Long An', category: 'R-410A refrigerant', groupActivity: 23, groupUnit: 'kg', groupTco2e: 48.01, groupEf: 2087.5, groupEfUnit: 'kgCO2e/kg', appEf: 3943, appEfUnit: 'kgCO2e/kg', status: 'missing_app', note: 'Group EF differs from app EF table.' },
  { site: 'Phan Thiet', category: 'R-410A refrigerant', groupActivity: 3.2, groupUnit: 'kg', groupTco2e: 6.68, groupEf: 2087.5, groupEfUnit: 'kgCO2e/kg', appEf: 3943, appEfUnit: 'kgCO2e/kg', status: 'missing_app', note: 'Group calculated; app missing activity.' },
  { site: 'Tuticorin', category: 'R-410A refrigerant', groupActivity: 17, groupUnit: 'kg', groupTco2e: 35.49, groupEf: 2087.5, groupEfUnit: 'kgCO2e/kg', appEf: 3943, appEfUnit: 'kgCO2e/kg', status: 'missing_app', note: 'Group calculated; app missing activity.' },
  { site: 'Tay Ninh', category: 'R-32 refrigerant', groupActivity: 10.38, groupUnit: 'kg', appEf: 675, appEfUnit: 'kgCO2e/kg', status: 'needs_factor', note: 'Group has activity but reporting row has blank GWP/tCO2e.' },
  { site: 'Long An', category: 'R-22 refrigerant', groupActivity: 1, groupUnit: 'kg', appEf: 1810, appEfUnit: 'kgCO2e/kg', status: 'needs_factor', note: 'Group has activity but blank GWP/tCO2e.' },
  { site: 'Phan Thiet', category: 'R-22 / R-32 refrigerant', groupActivity: 2.13, groupUnit: 'kg', status: 'needs_factor', note: 'Group has R-22 and R-32 activity but blank calculated emissions.' },
  { site: 'All factories', category: 'Wastewater', appActivity: 50658.94, appUnit: 'm3', appTco2e: 10.19, appEf: 0.201, appEfUnit: 'kgCO2e/m3', status: 'missing_group', note: 'App includes wastewater Scope 1; group Scope 1 raw files do not show matching wastewater emissions.' },
  { site: 'Tuticorin', category: 'LPG', appActivity: 2.53, appUnit: 'ton', appTco2e: 7.54, appEf: 2983, appEfUnit: 'kgCO2e/ton', status: 'missing_group', note: 'App includes LPG; group files reviewed do not show matching LPG raw.' },
];

export const officeRows = comparisonRows.filter((row) => row.site === 'HCM Office' || row.site === 'HCM');

