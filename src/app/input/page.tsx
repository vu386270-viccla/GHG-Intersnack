'use client';

import { useState, useEffect } from 'react';
import { getDashboardData, formatTCO2e } from '@/lib/data-service';
import { supabase } from '@/lib/supabase';
import {
  SCOPE_1_CATEGORIES, SCOPE_2_CATEGORIES, SCOPE_3_CATEGORIES,
  GRID_EMISSION_FACTORS, SCOPE_COLORS,
} from '@/lib/types';
import type { Factory } from '@/lib/types';

interface InputRow {
  category: string;
  label: string;
  icon: string;
  unit: string;
  ef: number;
  efUnit: string;
  value: string;
  emissions: number;
}

export default function InputPage() {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [selectedFactory, setSelectedFactory] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeScope, setActiveScope] = useState<'scope_1' | 'scope_2' | 'scope_3'>('scope_1');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData().then(data => {
      setFactories(data.factories);
      if (data.factories.length > 0) setSelectedFactory(data.factories[0].id);
      setLoading(false);
    });
  }, []);

  const factory = factories.find(f => f.id === selectedFactory);
  const gridEF = GRID_EMISSION_FACTORS.find(
    ef => ef.country === factory?.country && ef.year === selectedYear
  );

  const buildRows = (): InputRow[] => {
    if (activeScope === 'scope_1') {
      return SCOPE_1_CATEGORIES.map(cat => ({
        category: cat.key, label: cat.label, icon: cat.icon, unit: cat.unit,
        ef: cat.ef, efUnit: cat.efUnit, value: '', emissions: 0,
      }));
    }
    if (activeScope === 'scope_2') {
      return [{
        category: 'electricity', label: `Điện lưới (${factory?.country || 'Vietnam'})`, icon: '⚡', unit: 'kWh',
        ef: gridEF?.factor || 0.6855, efUnit: 'kg CO₂e/kWh', value: '', emissions: 0,
      }];
    }
    return SCOPE_3_CATEGORIES.map(cat => ({
      category: cat.key, label: `${cat.ghgCategory} — ${cat.label}`, icon: cat.icon, unit: cat.unit,
      ef: 0, efUnit: 'tCO₂e (trực tiếp)', value: '', emissions: 0,
    }));
  };

  const [rows, setRows] = useState<InputRow[]>(buildRows());

  const handleScopeChange = (scope: 'scope_1' | 'scope_2' | 'scope_3') => {
    setActiveScope(scope);
    if (scope === 'scope_1') {
      setRows(SCOPE_1_CATEGORIES.map(cat => ({
        category: cat.key, label: cat.label, icon: cat.icon, unit: cat.unit,
        ef: cat.ef, efUnit: cat.efUnit, value: '', emissions: 0,
      })));
    } else if (scope === 'scope_2') {
      setRows([{
        category: 'electricity', label: `Điện lưới (${factory?.country || 'Vietnam'})`, icon: '⚡', unit: 'kWh',
        ef: gridEF?.factor || 0.6855, efUnit: 'kg CO₂e/kWh', value: '', emissions: 0,
      }]);
    } else {
      setRows(SCOPE_3_CATEGORIES.map(cat => ({
        category: cat.key, label: `${cat.ghgCategory} — ${cat.label}`, icon: cat.icon, unit: cat.unit,
        ef: 0, efUnit: 'tCO₂e (nhập trực tiếp)', value: '', emissions: 0,
      })));
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

  const totalEmissions = rows.reduce((sum, r) => sum + r.emissions, 0);

  const handleSave = async () => {
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
      }));

    if (records.length > 0) {
      const { error } = await supabase
        .from('emissions_data')
        .upsert(records, { onConflict: 'factory_id,year,month,scope,category' });

      if (error) {
        alert('Lỗi khi lưu: ' + error.message);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    }
    setSaving(false);
  };

  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
  ];

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}><div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span></div>;
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
          <div style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Grid EF ({factory?.country})</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--color-scope-2)', fontWeight: 700 }}>{gridEF?.factor.toFixed(4) || 'N/A'}</div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>kg CO₂e/kWh</div>
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
          <thead><tr><th style={{ width: '40px' }}></th><th>Nguồn / Hạng mục</th><th>Đơn vị</th><th>Hệ số EF</th><th style={{ width: '160px' }}>Số liệu hoạt động</th><th style={{ textAlign: 'right' }}>Phát thải (tCO₂e)</th></tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.category}>
                <td style={{ fontSize: '18px' }}>{row.icon}</td>
                <td style={{ fontWeight: 600 }}>{row.label}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{row.unit}</td>
                <td><code style={{ background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{row.ef > 0 ? row.ef : '—'} {row.efUnit}</code></td>
                <td><input type="number" className="form-input" placeholder="0" value={row.value} onChange={e => updateValue(i, e.target.value)} style={{ width: '100%', textAlign: 'right' }} /></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: row.emissions > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {row.emissions > 0 ? row.emissions.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>Tổng phát thải trong kỳ:</td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--color-primary)', borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                {totalEmissions > 0 ? totalEmissions.toFixed(2) : '0'}
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>tCO₂e</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary">Xóa dữ liệu</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: 'var(--space-sm) var(--space-2xl)', fontSize: '15px' }}>
          {saving ? '⏳ Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu vào Supabase'}
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
    </div>
  );
}
