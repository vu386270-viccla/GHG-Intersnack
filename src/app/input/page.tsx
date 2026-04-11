'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getDashboardData, invalidateCache } from '@/lib/data-service';
import { supabase } from '@/lib/supabase';
import {
  SCOPE_1_CATEGORIES, SCOPE_1_EF_BY_COUNTRY, SCOPE_2_CATEGORIES, SCOPE_3_CATEGORIES,
  GRID_EMISSION_FACTORS, SCOPE_COLORS,
} from '@/lib/types';
import type { Factory } from '@/lib/types';

// ── Password gate (client-side, session-scoped) ──
const AUTH_KEY = 'ghg_editor_v1';
function checkAuth(): boolean {
  try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch { return false; }
}
function setAuth() {
  try { sessionStorage.setItem(AUTH_KEY, '1'); } catch { /* noop */ }
}
const SAVE_PWD = atob('UGh1b25ndnUwOTFA'); // Phuongvu091@

function PasswordModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const attempt = () => {
    if (pwd === SAVE_PWD) { setAuth(); onSuccess(); }
    else { setErr(true); setPwd(''); setTimeout(() => setErr(false), 1500); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '32px 36px', width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 28 }}>🔐</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>Xác thực để lưu</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Nhập mật khẩu để lưu dữ liệu</div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Mật khẩu..."
          style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box',
            border: `1.5px solid ${err ? '#ef4444' : 'var(--color-border)'}`,
            outline: 'none', background: err ? '#fff5f5' : 'white',
            transition: 'border-color 0.2s',
          }}
        />
        {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>Mật khẩu không đúng</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Hủy</button>
          <button onClick={attempt} style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Xác nhận lưu</button>
        </div>
      </div>
    </div>
  );
}

interface InputRow {
  category: string;
  label: string;
  icon: string;
  unit: string;
  ef: number;
  efUnit: string;
  value: string;
  emissions: number;
  costUsd: string; // optional USD cost
}

type ScopeKey = 'scope_1' | 'scope_2' | 'scope_3';

function buildScope1Rows(country?: string): InputRow[] {
  return SCOPE_1_CATEGORIES.map(cat => {
    const regional = country
      ? SCOPE_1_EF_BY_COUNTRY.find(r => r.country === country && r.category === cat.key)
      : undefined;
    return {
      category: cat.key, label: cat.label, icon: cat.icon, unit: cat.unit,
      ef: regional?.ef ?? cat.ef,
      efUnit: regional?.efUnit ?? cat.efUnit,
      value: '', emissions: 0, costUsd: '',
    };
  });
}

function buildScope2Rows(country: string, ef: number): InputRow[] {
  return [{
    category: 'electricity', label: `Điện lưới (${country})`, icon: '⚡', unit: 'kWh',
    ef, efUnit: 'kg CO₂e/kWh', value: '', emissions: 0, costUsd: '',
  }];
}

function buildScope3Rows(): InputRow[] {
  return SCOPE_3_CATEGORIES.map(cat => ({
    category: cat.key, label: `${cat.ghgCategory} — ${cat.label}`, icon: cat.icon, unit: cat.unit,
    ef: 0, efUnit: 'tCO₂e (nhập trực tiếp)', value: '', emissions: 0, costUsd: '',
  }));
}

export default function InputPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selectedFactory, setSelectedFactory] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeScope, setActiveScope] = useState<ScopeKey>('scope_1');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [prevMonthData, setPrevMonthData] = useState<Record<string, number>>({}); // category → emissions

  // Fetch previous month's data for comparison
  const fetchPrevMonth = useCallback(async (factoryId: string, year: number, month: number, scope: ScopeKey) => {
    if (!factoryId) return;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const { data } = await supabase
      .from('emissions_data')
      .select('category,emissions_tco2e,activity_data')
      .eq('factory_id', factoryId)
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .eq('scope', scope);
    const map: Record<string, number> = {};
    for (const row of data || []) map[row.category] = Number(row.emissions_tco2e);
    setPrevMonthData(map);
  }, []);

  // Bug 6: preserve entered data across scope switches
  const savedRowsRef = useRef<Partial<Record<ScopeKey, InputRow[]>>>({});
  const [rows, setRows] = useState<InputRow[]>(buildScope1Rows());

  useEffect(() => {
    getDashboardData()
      .then(data => {
        setFactories(data.factories);
        if (data.factories.length > 0) setSelectedFactory(data.factories[0].id);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  const factory = factories.find(f => f.id === selectedFactory);
  const gridEF = GRID_EMISSION_FACTORS.find(
    ef => ef.country === factory?.country && ef.year === selectedYear
  );

  // Rebuild Scope 1 rows when factory changes (regional EF)
  useEffect(() => {
    if (activeScope !== 'scope_1') return;
    const country = factory?.country || 'Vietnam';
    setRows(buildScope1Rows(country));
  }, [selectedFactory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch prev month data when context changes
  useEffect(() => {
    fetchPrevMonth(selectedFactory, selectedYear, selectedMonth, activeScope);
  }, [selectedFactory, selectedYear, selectedMonth, activeScope, fetchPrevMonth]);

  // Bug 2: rebuild Scope 2 row when factory or year changes
  useEffect(() => {
    if (activeScope !== 'scope_2') return;
    const country = factory?.country || 'Vietnam';
    const ef = gridEF?.factor || 0.6855;
    setRows(prev => prev.map(row =>
      row.category === 'electricity'
        ? { ...row, label: `Điện lưới (${country})`, ef, emissions: parseFloat(row.value) > 0 ? (parseFloat(row.value) * ef) / 1000 : 0 }
        : row
    ));
  }, [selectedFactory, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScopeChange = (scope: ScopeKey) => {
    // Bug 6: save current rows before switching
    savedRowsRef.current[activeScope] = rows;
    setActiveScope(scope);
    // Restore saved rows or build fresh
    const saved = savedRowsRef.current[scope];
    if (saved) {
      setRows(saved);
    } else if (scope === 'scope_1') {
      setRows(buildScope1Rows(factory?.country || 'Vietnam'));
    } else if (scope === 'scope_2') {
      setRows(buildScope2Rows(factory?.country || 'Vietnam', gridEF?.factor || 0.6855));
    } else {
      setRows(buildScope3Rows());
    }
  };

  const updateValue = (index: number, val: string) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const num = parseFloat(val) || 0;
      const emissions = activeScope === 'scope_3' ? num : (num * row.ef) / 1000;
      return { ...row, value: val, emissions };
    }));
  };

  const updateCost = (index: number, val: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, costUsd: val } : row));
  };

  // Bug 1: clear all entered values for current scope
  const handleClear = () => {
    setRows(prev => prev.map(row => ({ ...row, value: '', emissions: 0 })));
    savedRowsRef.current[activeScope] = undefined;
  };

  const totalEmissions = rows.reduce((sum, r) => sum + r.emissions, 0);

  const doSave = async () => {
    if (!factory) return;
    setSaving(true);

    const records = rows
      .filter(r => parseFloat(r.value) > 0)
      .map(r => ({
        factory_id: factory.id,
        year: selectedYear,
        month: selectedMonth,
        scope: activeScope,
        category: r.category,
        activity_data: parseFloat(r.value),
        activity_unit: r.unit,
        emissions_tco2e: Math.round(r.emissions * 10000) / 10000,
        cost_usd: parseFloat(r.costUsd) > 0 ? Math.round(parseFloat(r.costUsd) * 100) / 100 : null,
      }));

    if (records.length > 0) {
      const { error } = await supabase
        .from('emissions_data')
        .upsert(records, { onConflict: 'factory_id,year,month,scope,category' });

      if (error) {
        alert('Lỗi khi lưu: ' + error.message);
      } else {
        invalidateCache();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    }
    setSaving(false);
  };

  const handleSave = () => {
    if (!factory) return;
    if (checkAuth()) { doSave(); return; }
    setShowPwdModal(true);
  };

  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ];

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
  }

  if (error) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}><div style={{ color: 'var(--color-primary)', background: 'var(--color-primary-alpha-10)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)' }}>⚠️ Lỗi tải dữ liệu: {error}</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">📝 <span className="page-title-accent">Nhập dữ liệu</span></div>
        <div className="page-subtitle">Nhập dữ liệu hoạt động hàng tháng cho từng nhà máy — Lưu trực tiếp vào Supabase</div>
      </div>

      <div className="card mb-xl animate-fade-in-up">
        <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '200px' }}>
            <label className="form-label">Nhà máy</label>
            <select className="form-select" value={selectedFactory} onChange={e => setSelectedFactory(e.target.value)}>
              {factories.map(f => (
                <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name} — {f.location}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '120px' }}>
            <label className="form-label">Năm</label>
            <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {[2021, 2022, 2023, 2024, 2025, 2026].map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '140px' }}>
            <label className="form-label">Tháng</label>
            <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {months.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          {/* EF badge area */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeScope === 'scope_1' && (
              <div style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>EF Scope 1 ({factory?.country || 'VN'})</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--color-scope-1)', fontWeight: 700 }}>Theo vùng 🌏</div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Mặc định: {factory?.country === 'India' ? 'MoEFCC India' : 'MONRE VN'}</div>
              </div>
            )}
            <div style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Grid EF ({factory?.country})</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--color-scope-2)', fontWeight: 700 }}>{gridEF?.factor.toFixed(4) || 'N/A'}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>kg CO₂e/kWh</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs mb-xl">
        {[
          { key: 'scope_1' as const, label: 'Scope 1', color: SCOPE_COLORS.scope_1 },
          { key: 'scope_2' as const, label: 'Scope 2', color: SCOPE_COLORS.scope_2 },
          { key: 'scope_3' as const, label: 'Scope 3', color: SCOPE_COLORS.scope_3 },
        ].map(tab => (
          <button key={tab.key} className={`tab ${activeScope === tab.key ? 'active' : ''}`} onClick={() => handleScopeChange(tab.key)} style={activeScope === tab.key ? { color: tab.color } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card mb-xl animate-fade-in-up">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Nguồn / Hạng mục</th>
              <th>Đơn vị</th>
              <th>Hệ số EF</th>
              <th style={{ width: '160px' }}>Số liệu hoạt động</th>
              <th style={{ textAlign: 'right' }}>Phát thải (tCO₂e)</th>
              {activeScope !== 'scope_3' && (
                <th style={{ textAlign: 'right', color: '#b45309', fontSize: '11px', fontWeight: 600, width: '110px' }}>
                  💰 Chi phí (USD)
                </th>
              )}
              <th style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>
                T.trước {selectedMonth === 1 ? `(T12/${selectedYear - 1})` : `(T${selectedMonth - 1}/${selectedYear})`}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const prev = prevMonthData[row.category];
              const diff = row.emissions > 0 && prev !== undefined ? row.emissions - prev : null;
              return (
                <tr key={row.category}>
                  <td style={{ fontSize: '18px' }}>{row.icon}</td>
                  <td style={{ fontWeight: 600 }}>{row.label}</td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{row.unit}</td>
                  <td><code style={{ background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    {row.ef > 0 ? row.ef : '—'} {row.efUnit}
                  </code>
                  {activeScope === 'scope_1' && (() => {
                    const src = SCOPE_1_EF_BY_COUNTRY.find(r => r.country === (factory?.country || 'Vietnam') && r.category === row.category);
                    return src ? <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{src.source}</div> : null;
                  })()}
                  </td>
                  <td><input type="number" className="form-input" placeholder="0" value={row.value} onChange={e => updateValue(i, e.target.value)} style={{ width: '100%', textAlign: 'right' }} /></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: row.emissions > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {row.emissions > 0 ? row.emissions.toFixed(2) : '—'}
                    {diff !== null && (
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-body)', fontWeight: 600, marginTop: 2, color: diff > 0 ? '#ef4444' : '#22c55e' }}>
                        {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)}
                      </div>
                    )}
                  </td>
                  {activeScope !== 'scope_3' && (
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="tuỳ chọn"
                        value={row.costUsd}
                        onChange={e => updateCost(i, e.target.value)}
                        style={{ width: '100%', textAlign: 'right', fontSize: '12px', color: '#b45309', borderColor: row.costUsd ? '#fcd34d' : undefined }}
                      />
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}>
                    {prev !== undefined && prev > 0 ? prev.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>Tổng phát thải trong kỳ:</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                {totalEmissions > 0 ? totalEmissions.toFixed(2) : '0'}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
              </td>
              {activeScope !== 'scope_3' && (() => {
                const totalCost = rows.reduce((s, r) => s + (parseFloat(r.costUsd) || 0), 0);
                return (
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: '#b45309', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                    {totalCost > 0 ? `$${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                );
              })()}
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--color-text-muted)', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                {Object.values(prevMonthData).reduce((s, v) => s + v, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={handleClear}>Xóa dữ liệu</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: 'var(--space-sm) var(--space-2xl)', fontSize: '15px' }}>
          {saving ? '⏳ Đang lưu...' : saved ? '✅ Đã lưu!' : '🔐 Lưu vào Supabase'}
        </button>
      </div>

      {saved && (
        <div className="card mt-lg animate-fade-in-up" style={{ background: 'linear-gradient(135deg, #2ECC7111, #2ECC7105)', border: '1px solid #2ECC7144', textAlign: 'center', padding: 'var(--space-md)' }}>
          <span style={{ fontSize: '16px' }}>✅</span>{' '}
          <span style={{ fontWeight: 600, color: '#1E8449' }}>
            Dữ liệu đã được lưu thành công cho {factory?.name} — {months[selectedMonth - 1]} {selectedYear}
          </span>
        </div>
      )}

      {showPwdModal && (
        <PasswordModal
          onSuccess={() => { setShowPwdModal(false); doSave(); }}
          onClose={() => setShowPwdModal(false)}
        />
      )}
    </div>
  );
}
