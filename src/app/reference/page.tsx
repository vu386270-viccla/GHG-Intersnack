'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  SCOPE_1_EF_BY_COUNTRY,
  GRID_EMISSION_FACTORS,
  SCOPE_1_CATEGORIES,
  SCOPE_3_CATEGORIES,
} from '@/lib/types';
import { supabase } from '@/lib/supabase';

// ── Scope 3 WTT constants (mirrored from data-service) ──
const WTT_FACTORS = [
  { key: 'diesel_VN',  label: 'Diesel (Việt Nam)',  ef: 0.00055,   efUnit: 'tCO₂e/lít',  scope: 'Cat.3 WTT', source: 'DEFRA 2023' },
  { key: 'diesel_IN',  label: 'Diesel (Ấn Độ)',     ef: 0.0008058, efUnit: 'tCO₂e/lít',  scope: 'Cat.3 WTT', source: 'DEFRA 2023' },
  { key: 'lpg',        label: 'LPG (cả hai)',        ef: 0.392,     efUnit: 'tCO₂e/tấn',  scope: 'Cat.3 WTT', source: 'DEFRA 2023' },
  { key: 'elec_VN',   label: 'Điện lưới (VN)',      ef: 0.00006,   efUnit: 'tCO₂e/kWh',  scope: 'Cat.3 WTT', source: 'DEFRA 2023' },
  { key: 'elec_IN',   label: 'Điện lưới (India)',   ef: 0.00012,   efUnit: 'tCO₂e/kWh',  scope: 'Cat.3 WTT', source: 'DEFRA 2023' },
];

const TRANSPORT_FACTORS = [
  { key: 'vessel', label: 'Vận chuyển đường biển', ef: 0.01604, efUnit: 'kg CO₂e/tấn-km', scope: 'Cat.4', source: 'IMO / GLEC 2023' },
  { key: 'road',   label: 'Vận chuyển đường bộ',   ef: 0.07547, efUnit: 'kg CO₂e/tấn-km', scope: 'Cat.4', source: 'DEFRA 2023' },
];

const CASHEW_EF = {
  label: 'Hạt điều thô (RCN) — Hàng hóa mua',
  description: 'Phát thải từ trồng trọt, thu hoạch, sơ chế trước khi nhập nhà máy',
  source: 'ecoinvent / GHG Protocol FLAG',
  scope: 'Cat.1 FLAG',
  unit: 'kg CO₂e/kg',
  note: 'Giá trị được tính từ em_cashew_kg trong bảng scope3_transport_data (CSBP)',
};

// ── Raw Data types ──
interface RawRow {
  factory_id: string;
  factory_name?: string;
  factory_country?: string;
  year: number;
  month: number;
  scope: string;
  category: string;
  activity_data: number;
  emissions_tco2e: number;
}

interface Factory {
  id: string;
  name: string;
  country: string;
}

const SCOPE_COLORS: Record<string, string> = {
  scope_1: '#E32314',
  scope_2: '#F5A623',
  scope_3: '#8CB92D',
};

const CATEGORY_LABELS: Record<string, string> = {
  wood_logs: 'Củi/Gỗ (Boiler)',
  wastewater: 'Nước thải (WWTS)',
  lpg: 'LPG (Xe nâng)',
  diesel: 'Diesel',
  fgas_r22: 'F-Gas R22',
  fgas_r32: 'F-Gas R32',
  fgas_r134a: 'F-Gas R134A',
  fgas_r410a: 'F-Gas R410A',
  fgas_r404a: 'F-Gas R404A',
  co2_cylinder: 'Bình CO₂',
  electricity: 'Điện lưới',
  purchased_goods: 'Hàng hóa mua (Cat.1)',
  upstream_transport: 'Vận tải ngược dòng (Cat.4)',
  fuel_energy_related: 'Năng lượng liên quan (Cat.3)',
};

const MONTHS_VI = ['Th01','Th02','Th03','Th04','Th05','Th06','Th07','Th08','Th09','Th10','Th11','Th12'];

// ── Reusable badge ──
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 700,
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// ═══════════════════════════════════════════
// EF Tab
// ═══════════════════════════════════════════
function EmissionFactorsTab() {
  const [efCountry, setEfCountry] = useState<'Vietnam' | 'India' | 'ALL'>('ALL');
  const [efYear, setEfYear] = useState<number>(2024);

  const filteredS1 = useMemo(() =>
    SCOPE_1_EF_BY_COUNTRY.filter(r => efCountry === 'ALL' || r.country === efCountry),
    [efCountry]
  );

  const gridForYear = GRID_EMISSION_FACTORS.filter(g => g.year === efYear);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Header banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: '48px' }}>⚗️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366F1', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Read-only · Không thể chỉnh sửa
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', fontWeight: 700 }}>
            Emission Factors đang áp dụng
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>
            Nguồn: MONRE VN · MOC VN 2015 · IPCC AR5 · CEA India · MoEFCC India · GHG Protocol · DEFRA 2023 · IMO/GLEC
          </div>
        </div>
        <div style={{
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: '12px',
          padding: '12px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>SBTi ID</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#818cf8', fontWeight: 700 }}>40003759</div>
          <div style={{ fontSize: '10px', color: '#a5b4fc', marginTop: '2px' }}>Base year: 2021</div>
        </div>
      </div>

      {/* ══ SCOPE 1 ══ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '4px', height: '24px', background: SCOPE_COLORS.scope_1, borderRadius: '4px' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
            🔥 Scope 1 — Phát thải trực tiếp
          </span>
          <div style={{ flex: 1 }} />
          {/* Country filter */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ALL', 'Vietnam', 'India'] as const).map(c => (
              <button
                key={c}
                onClick={() => setEfCountry(c)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: `1.5px solid ${efCountry === c ? '#6366F1' : 'var(--color-border)'}`,
                  background: efCountry === c ? '#6366F1' : 'transparent',
                  color: efCountry === c ? '#fff' : 'var(--color-text-muted)',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s',
                }}
              >
                {c === 'ALL' ? '🌐 Tất cả' : c === 'Vietnam' ? '🇻🇳 Việt Nam' : '🇮🇳 Ấn Độ'}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(227,35,20,0.06)', borderBottom: '2px solid rgba(227,35,20,0.2)' }}>
                {['Nguồn phát thải', 'Quy trình', 'Quốc gia', 'Hệ số (EF)', 'Đơn vị', 'Nguồn tham chiếu'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: SCOPE_COLORS.scope_1, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredS1.map((row, i) => {
                const catDef = SCOPE_1_CATEGORIES.find(c => c.key === row.category);
                return (
                  <tr key={`${row.country}-${row.category}`} style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    transition: 'background 0.1s',
                  }}>
                    <td style={{ padding: '10px 14px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{catDef?.icon ?? '•'}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{catDef?.label ?? row.category}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{catDef?.process ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{catDef?.process ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge color={row.country === 'Vietnam' ? '#10b981' : '#f59e0b'}>
                        {row.country === 'Vietnam' ? '🇻🇳 VN' : '🇮🇳 India'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: SCOPE_COLORS.scope_1,
                      }}>{row.ef.toLocaleString('vi-VN', { maximumFractionDigits: 5 })}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{row.efUnit}</td>
                    <td style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      <span style={{ background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px' }}>{row.source}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ghi chú biomass */}
        <div style={{
          marginTop: '10px', padding: '10px 16px',
          background: 'rgba(227,35,20,0.05)', borderRadius: '8px',
          border: '1px solid rgba(227,35,20,0.15)', fontSize: '12px', color: 'var(--color-text-muted)',
        }}>
          ⚠️ <strong>Củi/Gỗ (Biomass)</strong>: EF = 28 kg CO₂e/tấn (VN) — Biomass được coi là tái sinh theo Bộ TN&MT Việt Nam; phát thải CO₂ sinh học không tính vào kiểm kê GHG nhưng CH₄/N₂O vẫn được khai báo.
          India áp dụng BEE wood pellets EF = 35 kg CO₂e/tấn.
        </div>
      </section>

      {/* ══ SCOPE 2 ══ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '4px', height: '24px', background: SCOPE_COLORS.scope_2, borderRadius: '4px' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            ⚡ Scope 2 — Điện lưới (Location-based)
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Năm:</span>
            <select
              value={efYear}
              onChange={e => setEfYear(Number(e.target.value))}
              style={{
                padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--color-border)',
                background: 'var(--color-card-bg)', color: 'var(--color-text)',
                fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {gridForYear.map(g => (
            <div key={`${g.country}-${g.year}`} style={{
              background: 'var(--color-card-bg)',
              border: `2px solid ${g.country === 'Vietnam' ? '#10b98133' : '#f59e0b33'}`,
              borderRadius: '12px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{g.country === 'Vietnam' ? '🇻🇳' : '🇮🇳'}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>{g.country}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Lưới điện quốc gia · {g.year}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: 700, color: SCOPE_COLORS.scope_2 }}>
                  {g.factor}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>kg CO₂e/kWh</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span style={{ background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px' }}>
                  {g.source}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline chart */}
        <div style={{
          marginTop: '16px', background: 'var(--color-card-bg)',
          border: '1px solid var(--color-border)', borderRadius: '12px', padding: '20px 24px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
            Lịch sử Grid EF theo năm
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[2021, 2022, 2023, 2024, 2025, 2026].map(yr => {
              const vnEF = GRID_EMISSION_FACTORS.find(g => g.country === 'Vietnam' && g.year === yr);
              const inEF = GRID_EMISSION_FACTORS.find(g => g.country === 'India' && g.year === yr);
              const maxEF = 0.85;
              return (
                <div key={yr} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', fontSize: '12px', fontWeight: 700, color: yr === efYear ? SCOPE_COLORS.scope_2 : 'var(--color-text-muted)' }}>{yr}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* VN bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', width: '20px', color: '#10b981' }}>VN</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${((vnEF?.factor ?? 0) / maxEF) * 100}%`,
                          height: '100%',
                          background: '#10b981',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', width: '50px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {vnEF?.factor ?? '—'}
                      </span>
                    </div>
                    {/* India bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', width: '20px', color: '#f59e0b' }}>IN</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${((inEF?.factor ?? 0) / maxEF) * 100}%`,
                          height: '100%',
                          background: '#f59e0b',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', width: '50px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {inEF?.factor ?? '—'}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace', width: '56px' }}>kg/kWh</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SCOPE 3 ══ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '4px', height: '24px', background: SCOPE_COLORS.scope_3, borderRadius: '4px' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700 }}>
            🌍 Scope 3 — Chuỗi giá trị
          </span>
        </div>

        {/* Cat.1 */}
        <div style={{
          background: 'var(--color-card-bg)', border: `1px solid ${SCOPE_COLORS.scope_3}33`,
          borderRadius: '12px', padding: '20px 24px', marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{
              background: `${SCOPE_COLORS.scope_3}15`, padding: '10px 14px',
              borderRadius: '10px', fontSize: '28px', lineHeight: 1,
            }}>📦</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{CASHEW_EF.label}</span>
                <Badge color={SCOPE_COLORS.scope_3}>{CASHEW_EF.scope}</Badge>
                <Badge color='#6366F1'>FLAG</Badge>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{CASHEW_EF.description}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                <span style={{ background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', marginRight: '8px' }}>{CASHEW_EF.source}</span>
                {CASHEW_EF.note}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Đơn vị</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: SCOPE_COLORS.scope_3, fontSize: '13px' }}>{CASHEW_EF.unit}</div>
            </div>
          </div>
        </div>

        {/* Cat.3 WTT */}
        <div style={{
          background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
          borderRadius: '12px', overflow: 'hidden', marginBottom: '12px',
        }}>
          <div style={{ background: 'rgba(140,185,45,0.08)', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: SCOPE_COLORS.scope_3, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🔋 Cat. 3 — Well-to-Tank (WTT) · Upstream Fuel &amp; Energy
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Nguồn nhiên liệu', 'EF', 'Đơn vị', 'Nguồn'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WTT_FACTORS.map((row, i) => (
                <tr key={row.key} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '9px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{row.label}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: SCOPE_COLORS.scope_3 }}>
                    {row.ef.toLocaleString('vi-VN', { maximumFractionDigits: 7 })}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{row.efUnit}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', color: 'var(--color-text-muted)' }}>{row.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cat.4 Transport */}
        <div style={{
          background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
          borderRadius: '12px', overflow: 'hidden',
        }}>
          <div style={{ background: 'rgba(140,185,45,0.08)', padding: '10px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: SCOPE_COLORS.scope_3, textTransform: 'uppercase', letterSpacing: '1px' }}>
              🚛 Cat. 4 — Upstream Transportation &amp; Distribution
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', }}>
            {TRANSPORT_FACTORS.map((row, i) => (
              <div key={row.key} style={{
                padding: '20px 24px',
                borderRight: i === 0 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{row.key === 'vessel' ? '🚢' : '🚛'}</div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)', marginBottom: '4px' }}>{row.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: SCOPE_COLORS.scope_3 }}>
                    {row.ef}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{row.efUnit}</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ background: 'var(--color-border)', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {row.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════
// Raw Data Tab
// ═══════════════════════════════════════════

type SortKey = 'factory_name' | 'month' | 'scope' | 'category' | 'activity_data' | 'emissions_tco2e';

function RawDataTab() {
  const [rows, setRows] = useState<RawRow[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterFactory, setFilterFactory] = useState('ALL');
  const [filterScope, setFilterScope] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('month');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('factories').select('id,name,country'),
      supabase
        .from('emissions_data')
        .select('factory_id,year,month,scope,category,activity_data,emissions_tco2e')
        .eq('year', year)
        .limit(5000),
    ]).then(([facRes, emRes]) => {
      const facs = (facRes.data || []) as Factory[];
      const emData = (emRes.data || []) as RawRow[];
      const facMap: Record<string, Factory> = {};
      for (const f of facs) facMap[f.id] = f;
      const enriched = emData.map(r => ({
        ...r,
        factory_name: facMap[r.factory_id]?.name ?? r.factory_id,
        factory_country: facMap[r.factory_id]?.country ?? '—',
      }));
      setFactories(facs);
      setRows(enriched);
      setLoading(false);
    });
  }, [year]);

  const allCategories = useMemo(() => {
    const cats = new Set(rows.map(r => r.category));
    return Array.from(cats).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let data = rows;
    if (filterFactory !== 'ALL') data = data.filter(r => r.factory_id === filterFactory);
    if (filterScope !== 'ALL') data = data.filter(r => r.scope === filterScope);
    if (filterCategory !== 'ALL') data = data.filter(r => r.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        (r.factory_name ?? '').toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.scope.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[r.category] ?? '').toLowerCase().includes(q)
      );
    }
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, filterFactory, filterScope, filterCategory, search, sortKey, sortAsc]);

  const totals = useMemo(() => ({
    totalEmissions: filtered.reduce((s, r) => s + Number(r.emissions_tco2e), 0),
    totalRows: filtered.length,
    byScope: {
      scope_1: filtered.filter(r => r.scope === 'scope_1').reduce((s, r) => s + Number(r.emissions_tco2e), 0),
      scope_2: filtered.filter(r => r.scope === 'scope_2').reduce((s, r) => s + Number(r.emissions_tco2e), 0),
      scope_3: filtered.filter(r => r.scope === 'scope_3').reduce((s, r) => s + Number(r.emissions_tco2e), 0),
    },
  }), [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(prev => !prev);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3 }}>⇅</span>;
    return <span style={{ color: '#6366F1' }}>{sortAsc ? '↑' : '↓'}</span>;
  }

  const unitForCategory = (cat: string): string => {
    const s1 = SCOPE_1_CATEGORIES.find(c => c.key === cat);
    if (s1) return s1.unit;
    if (cat === 'electricity') return 'kWh';
    return '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Summary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Tổng phát thải', value: totals.totalEmissions.toLocaleString('vi-VN', { maximumFractionDigits: 0 }), unit: 'tCO₂e', color: 'var(--color-text)' },
          { label: '🔥 Scope 1', value: totals.byScope.scope_1.toLocaleString('vi-VN', { maximumFractionDigits: 0 }), unit: 'tCO₂e', color: SCOPE_COLORS.scope_1 },
          { label: '⚡ Scope 2', value: totals.byScope.scope_2.toLocaleString('vi-VN', { maximumFractionDigits: 0 }), unit: 'tCO₂e', color: SCOPE_COLORS.scope_2 },
          { label: '🌍 Scope 3', value: totals.byScope.scope_3.toLocaleString('vi-VN', { maximumFractionDigits: 0 }), unit: 'tCO₂e', color: SCOPE_COLORS.scope_3 },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
            borderRadius: '10px', padding: '14px 18px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: k.color }}>{k.value}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
        borderRadius: '12px', padding: '14px 18px',
        display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center',
      }}>
        {/* Year */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>📅 Năm</span>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)', fontSize: '13px', cursor: 'pointer' }}>
            {[2026, 2025, 2024, 2023, 2022, 2021].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

        {/* Factory */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>🏭 Nhà máy</span>
          <select value={filterFactory} onChange={e => setFilterFactory(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)', fontSize: '13px', cursor: 'pointer' }}>
            <option value="ALL">Tất cả</option>
            {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

        {/* Scope pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['ALL', 'scope_1', 'scope_2', 'scope_3'] as const).map(s => (
            <button key={s} onClick={() => setFilterScope(s)}
              style={{
                padding: '4px 12px', borderRadius: '20px',
                border: `1.5px solid ${filterScope === s ? (SCOPE_COLORS[s] ?? '#6366F1') : 'var(--color-border)'}`,
                background: filterScope === s ? (SCOPE_COLORS[s] ?? '#6366F1') : 'transparent',
                color: filterScope === s ? '#fff' : 'var(--color-text-muted)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}
            >
              {s === 'ALL' ? 'Tất cả' : s === 'scope_1' ? '🔥 S1' : s === 'scope_2' ? '⚡ S2' : '🌍 S3'}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

        {/* Category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>📂 Danh mục</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-card-bg)', color: 'var(--color-text)', fontSize: '13px', cursor: 'pointer', maxWidth: '180px' }}>
            <option value="ALL">Tất cả</option>
            {allCategories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', opacity: 0.5 }}>🔍</span>
          <input
            placeholder="Tìm kiếm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 12px 6px 32px', borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-card-bg)', color: 'var(--color-text)',
              fontSize: '13px', width: '180px',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {totals.totalRows.toLocaleString()} dòng
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
          Đang tải dữ liệu...
        </div>
      ) : (
        <div style={{
          background: 'var(--color-card-bg)', border: '1px solid var(--color-border)',
          borderRadius: '12px', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '2px solid var(--color-border)' }}>
                  {[
                    { key: 'factory_name' as SortKey, label: 'Nhà máy' },
                    { key: 'month' as SortKey, label: 'Tháng' },
                    { key: 'scope' as SortKey, label: 'Scope' },
                    { key: 'category' as SortKey, label: 'Danh mục' },
                    { key: 'activity_data' as SortKey, label: 'Activity Data' },
                    { key: 'emissions_tco2e' as SortKey, label: 'Phát thải (tCO₂e)' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{
                        padding: '10px 14px',
                        textAlign: col.key === 'activity_data' || col.key === 'emissions_tco2e' ? 'right' : 'left',
                        fontSize: '11px', fontWeight: 700,
                        color: sortKey === col.key ? '#6366F1' : 'var(--color-text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        cursor: 'pointer', userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label} <SortIcon k={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((row, i) => {
                  const scopeColor = SCOPE_COLORS[row.scope] ?? '#888';
                  return (
                    <tr
                      key={`${row.factory_id}-${row.year}-${row.month}-${row.scope}-${row.category}-${i}`}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}
                    >
                      <td style={{ padding: '8px 14px', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.factory_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {row.factory_country === 'Vietnam' ? '🇻🇳' : '🇮🇳'} {row.factory_country}
                        </div>
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                        {MONTHS_VI[(row.month ?? 1) - 1] ?? row.month}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <Badge color={scopeColor}>
                          {row.scope === 'scope_1' ? '🔥 S1' : row.scope === 'scope_2' ? '⚡ S2' : '🌍 S3'}
                        </Badge>
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: '13px' }}>
                        <div style={{ color: 'var(--color-text)' }}>{CATEGORY_LABELS[row.category] ?? row.category}</div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{unitForCategory(row.category)}</div>
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {Number(row.activity_data).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: scopeColor }}>
                          {Number(row.emissions_tco2e).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr style={{ background: 'rgba(99,102,241,0.06)', borderTop: '2px solid var(--color-border)' }}>
                  <td colSpan={5} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    TỔNG ({filtered.length > 500 ? `Hiển thị 500/${filtered.length}` : `${filtered.length} dòng`})
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: '#6366F1' }}>
                    {totals.totalEmissions.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {filtered.length > 500 && (
            <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
              ⚠️ Chỉ hiển thị 500 dòng đầu. Dùng bộ lọc để thu hẹp kết quả ({filtered.length} dòng phù hợp).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════
type TabId = 'ef' | 'rawdata';

export default function ReferencePage() {
  const [activeTab, setActiveTab] = useState<TabId>('ef');

  const tabs: { id: TabId; label: string; icon: string; desc: string }[] = [
    { id: 'ef', label: 'Emission Factors', icon: '⚗️', desc: 'Hệ số phát thải đang áp dụng' },
    { id: 'rawdata', label: 'Raw Data', icon: '🗃️', desc: 'Dữ liệu thô từ Supabase' },
  ];

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="section" style={{ marginBottom: '0' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
            Dữ liệu tham chiếu
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--color-text)' }}>
            📚 Reference &amp; Data Explorer
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Xem toàn bộ hệ số EF đang áp dụng và dữ liệu thô dùng để tính toán phát thải GHG
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '4px',
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px', padding: '4px',
          width: 'fit-content',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 20px', borderRadius: '9px',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600,
                background: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-text-muted)',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '16px' }}>{tab.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div>{tab.label}</div>
                <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.75 }}>{tab.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ marginTop: '24px' }}>
        {activeTab === 'ef' && <EmissionFactorsTab />}
        {activeTab === 'rawdata' && <RawDataTab />}
      </div>
    </div>
  );
}
