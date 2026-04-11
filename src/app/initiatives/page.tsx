'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getDashboardData } from '@/lib/data-service';
import type { Factory } from '@/lib/types';

// ── Types ──
interface Initiative {
  id: string;
  name: string;
  description: string | null;
  factory_id: string | null;
  scope: 'scope_1' | 'scope_2' | 'scope_3' | 'all';
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  start_date: string | null;
  target_date: string | null;
  estimated_reduction_tco2e: number;
  actual_reduction_tco2e: number;
  estimated_cost_vnd: number;
  notes: string | null;
}

const STATUS_LABELS: Record<Initiative['status'], string> = {
  planned: 'Kế hoạch',
  in_progress: 'Đang triển khai',
  completed: 'Hoàn thành',
  cancelled: 'Hủy',
};
const STATUS_COLORS: Record<Initiative['status'], { bg: string; text: string; border: string }> = {
  planned:     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  in_progress: { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  completed:   { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  cancelled:   { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};
const SCOPE_LABELS: Record<string, string> = {
  scope_1: 'Scope 1',
  scope_2: 'Scope 2',
  scope_3: 'Scope 3',
  all: 'Tất cả',
};
const SCOPE_COLORS: Record<string, string> = {
  scope_1: '#E32314', scope_2: '#F5A623', scope_3: '#8CB92D', all: '#6366F1',
};

const EMPTY_FORM: Omit<Initiative, 'id'> = {
  name: '', description: null, factory_id: null,
  scope: 'scope_2', status: 'planned',
  start_date: null, target_date: null,
  estimated_reduction_tco2e: 0, actual_reduction_tco2e: 0,
  estimated_cost_vnd: 0, notes: null,
};

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' triệu';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toLocaleString();
}

export default function InitiativesPage() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [factories, setFactories]     = useState<Factory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Initiative | null>(null);
  const [form, setForm]               = useState<Omit<Initiative, 'id'>>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterScope, setFilterScope]   = useState<string>('all');

  const load = async () => {
    const [{ data: inits }, dashData] = await Promise.all([
      supabase.from('reduction_initiatives').select('*').order('created_at', { ascending: false }),
      getDashboardData(),
    ]);
    setInitiatives((inits || []) as Initiative[]);
    setFactories(dashData.factories);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (init: Initiative) => {
    setEditing(init);
    const { id, ...rest } = init;
    setForm(rest);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const record = {
      ...form,
      estimated_reduction_tco2e: Number(form.estimated_reduction_tco2e) || 0,
      actual_reduction_tco2e: Number(form.actual_reduction_tco2e) || 0,
      estimated_cost_vnd: Number(form.estimated_cost_vnd) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('reduction_initiatives').update(record).eq('id', editing.id);
    } else {
      await supabase.from('reduction_initiatives').insert(record);
    }
    await load();
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sáng kiến này?')) return;
    await supabase.from('reduction_initiatives').delete().eq('id', id);
    setInitiatives(prev => prev.filter(i => i.id !== id));
  };

  const filtered = initiatives.filter(i =>
    (filterStatus === 'all' || i.status === filterStatus) &&
    (filterScope === 'all' || i.scope === filterScope)
  );

  // KPI aggregates
  const totalEstReduction = initiatives.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.estimated_reduction_tco2e), 0);
  const totalActReduction = initiatives.filter(i => i.status === 'completed').reduce((s, i) => s + Number(i.actual_reduction_tco2e), 0);
  const totalCost = initiatives.filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.estimated_cost_vnd), 0);
  const active = initiatives.filter(i => i.status === 'in_progress').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <div className="loading-spinner" /><span style={{ color: 'var(--color-text-muted)' }}>Đang tải...</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <div className="page-title">🌱 <span className="page-title-accent">Sáng kiến giảm phát thải</span></div>
          <div className="page-subtitle">Theo dõi tiến độ các dự án giảm phát thải — liên kết với mục tiêu SBTi</div>
        </div>
        <button onClick={openNew} style={{
          padding: '9px 20px', background: '#22c55e', color: 'white', border: 'none',
          borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>+ Thêm sáng kiến</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Đang triển khai', value: String(active), color: '#f59e0b', sub: 'sáng kiến' },
          { label: 'Tổng giảm (ước tính)', value: `${Math.round(totalEstReduction).toLocaleString()}`, color: '#22c55e', sub: 'tCO₂e/năm' },
          { label: 'Đã đạt được', value: `${Math.round(totalActReduction).toLocaleString()}`, color: '#10b981', sub: 'tCO₂e hoàn thành' },
          { label: 'Tổng đầu tư', value: fmt(totalCost), color: '#6366f1', sub: 'VND ước tính' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--color-bg-secondary)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
          {['all', 'planned', 'in_progress', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '3px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filterStatus === s ? 'var(--color-primary)' : 'transparent',
              color: filterStatus === s ? 'white' : 'var(--color-text-muted)',
            }}>{s === 'all' ? 'Tất cả' : STATUS_LABELS[s as Initiative['status']]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-card-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 3 }}>
          {['all', 'scope_1', 'scope_2', 'scope_3'].map(s => (
            <button key={s} onClick={() => setFilterScope(s)} style={{
              padding: '3px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: filterScope === s ? (s === 'all' ? 'var(--color-primary)' : SCOPE_COLORS[s]) : 'transparent',
              color: filterScope === s ? 'white' : 'var(--color-text-muted)',
            }}>{s === 'all' ? 'Tất cả' : SCOPE_LABELS[s]}</button>
          ))}
        </div>
      </div>

      {/* Initiative cards */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Chưa có sáng kiến nào</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Thêm sáng kiến để theo dõi tiến độ giảm phát thải</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(init => {
            const sc = STATUS_COLORS[init.status];
            const scopeColor = SCOPE_COLORS[init.scope];
            const factory = factories.find(f => f.id === init.factory_id);
            const progressPct = init.estimated_reduction_tco2e > 0 && init.actual_reduction_tco2e > 0
              ? Math.min(100, Math.round((init.actual_reduction_tco2e / init.estimated_reduction_tco2e) * 100))
              : 0;
            return (
              <div key={init.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  {/* Left: title + meta */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{init.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {STATUS_LABELS[init.status]}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: `${scopeColor}18`, color: scopeColor, border: `1px solid ${scopeColor}44` }}>
                        {SCOPE_LABELS[init.scope]}
                      </span>
                      {factory && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: 20 }}>
                          {factory.country === 'India' ? '🇮🇳' : '🇻🇳'} {factory.name}
                        </span>
                      )}
                    </div>
                    {init.description && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{init.description}</div>
                    )}
                    {/* Progress bar for in_progress */}
                    {init.status === 'in_progress' && init.estimated_reduction_tco2e > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${progressPct}%`, background: '#22c55e', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{progressPct}%</span>
                      </div>
                    )}
                    {/* Dates */}
                    {(init.start_date || init.target_date) && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {init.start_date && <span>Bắt đầu: {new Date(init.start_date).toLocaleDateString('vi-VN')}</span>}
                        {init.target_date && <span>Mục tiêu: {new Date(init.target_date).toLocaleDateString('vi-VN')}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right: numbers */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Giảm ước tính</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#22c55e' }}>
                        {Number(init.estimated_reduction_tco2e).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>tCO₂e/năm</div>
                    </div>
                    {init.status === 'completed' && (
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Thực tế</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#10b981' }}>
                          {Number(init.actual_reduction_tco2e).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>tCO₂e/năm</div>
                      </div>
                    )}
                    {init.estimated_cost_vnd > 0 && (
                      <div style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Đầu tư</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#6366f1' }}>
                          {fmt(Number(init.estimated_cost_vnd))}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>VND</div>
                      </div>
                    )}
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(init)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: 11 }}>✏️</button>
                      <button onClick={() => handleDelete(init.id)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Form ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>
              {editing ? '✏️ Chỉnh sửa sáng kiến' : '🌱 Thêm sáng kiến mới'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Tên sáng kiến *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Lắp đặt điện mặt trời áp mái 500kWp"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>

              {/* Scope + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Scope</label>
                  <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as Initiative['scope'] }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13 }}>
                    {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Trạng thái</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Initiative['status'] }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13 }}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Factory */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Nhà máy (bỏ trống = tất cả)</label>
                <select value={form.factory_id || ''} onChange={e => setForm(f => ({ ...f, factory_id: e.target.value || null }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13 }}>
                  <option value="">Tất cả nhà máy</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.country === 'India' ? '🇮🇳' : '🇻🇳'} {f.name}</option>)}
                </select>
              </div>

              {/* Numbers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Giảm ước tính (tCO₂e/năm)</label>
                  <input type="number" value={form.estimated_reduction_tco2e}
                    onChange={e => setForm(f => ({ ...f, estimated_reduction_tco2e: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box', textAlign: 'right' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Giảm thực tế (tCO₂e/năm)</label>
                  <input type="number" value={form.actual_reduction_tco2e}
                    onChange={e => setForm(f => ({ ...f, actual_reduction_tco2e: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box', textAlign: 'right' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Đầu tư (VND)</label>
                  <input type="number" value={form.estimated_cost_vnd}
                    onChange={e => setForm(f => ({ ...f, estimated_cost_vnd: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box', textAlign: 'right' }} />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Ngày bắt đầu</label>
                  <input type="date" value={form.start_date || ''}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value || null }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Ngày hoàn thành mục tiêu</label>
                  <input type="date" value={form.target_date || ''}
                    onChange={e => setForm(f => ({ ...f, target_date: e.target.value || null }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Mô tả / ghi chú</label>
                <textarea value={form.description || ''} rows={3}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
                  placeholder="Mô tả chi tiết sáng kiến, phương pháp tính toán..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--color-border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Hủy</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
