'use client';

import { APP_SCOPE1_TOTAL, GROUP_CACHED_TCO2E, GROUP_SCOPE1_TOTAL_CLAIM, comparisonRows, officeRows } from '@/lib/group-data-comparison';

const statusMeta = {
  match: { label: 'Khop sau quy doi', color: '#10B981', bg: '#ECFDF5' },
  unit_gap: { label: 'Khac unit', color: '#F59E0B', bg: '#FFFBEB' },
  missing_app: { label: 'Group co / App thieu', color: '#EF4444', bg: '#FEF2F2' },
  missing_group: { label: 'App co / Group thieu', color: '#6366F1', bg: '#EEF2FF' },
  ef_gap: { label: 'Khac EF / mapping', color: '#A855F7', bg: '#FAF5FF' },
  needs_factor: { label: 'Thieu EF de tinh', color: '#64748B', bg: '#F8FAFC' },
} as const;

function fmt(value?: number, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function KpiCard({ label, value, sub, tone = '#111827' }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="gd-card gd-kpi">
      <div className="gd-muted">{label}</div>
      <div className="gd-kpi-value" style={{ color: tone }}>{value}</div>
      <div className="gd-muted">{sub}</div>
    </div>
  );
}

function StatusChip({ status }: { status: keyof typeof statusMeta }) {
  const meta = statusMeta[status];
  return <span className="gd-chip" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>;
}

export default function GroupDataPage() {
  const deltaVsClaim = GROUP_SCOPE1_TOTAL_CLAIM - APP_SCOPE1_TOTAL;
  const uncapturedInWorkbook = GROUP_SCOPE1_TOTAL_CLAIM - GROUP_CACHED_TCO2E;
  const grouped = comparisonRows.reduce<Record<string, typeof comparisonRows>>((acc, row) => {
    const bucket = row.status;
    acc[bucket] = acc[bucket] || [];
    acc[bucket].push(row);
    return acc;
  }, {});
  const bars = [
    { label: 'App', value: APP_SCOPE1_TOTAL, color: '#E32314' },
    { label: 'Group claim', value: GROUP_SCOPE1_TOTAL_CLAIM, color: '#F59E0B' },
    { label: 'Group cached in files', value: GROUP_CACHED_TCO2E, color: '#6366F1' },
  ];
  const maxBar = Math.max(...bars.map((bar) => bar.value));

  return (
    <main className="gd-page">
      <div className="gd-hero">
        <div>
          <div className="gd-eyebrow">Scope 1 reconciliation</div>
          <h1>Group Data vs App Data</h1>
          <p>
            Trang nay giai thich vi sao Scope 1 trong app khac so group bao cao. Bang ben duoi the hien raw data group,
            data dang co trong app, he so quy doi kWh, emission factor neu workbook co, va phan HCM Office group gui them.
          </p>
        </div>
      </div>

      <section className="gd-kpi-grid">
        <KpiCard label="Scope 1 trong app" value={`${fmt(APP_SCOPE1_TOTAL)} tCO2e`} sub="Tong 2025 dang hien thi trong app" tone="#E32314" />
        <KpiCard label="Group noi Scope 1" value={`${fmt(GROUP_SCOPE1_TOTAL_CLAIM)} tCO2e`} sub={`Cao hon app ${fmt(deltaVsClaim)} tCO2e`} tone="#F59E0B" />
        <KpiCard label="CO2e thay san trong file group" value={`${fmt(GROUP_CACHED_TCO2E)} tCO2e`} sub="Chu yeu refrigerants R-410A" tone="#6366F1" />
        <KpiCard label="Group claim chua thay truc tiep" value={`${fmt(uncapturedInWorkbook)} tCO2e`} sub="Can EF ngoai file / mapping them" tone="#64748B" />
      </section>

      <section className="gd-grid-2">
        <div className="gd-card">
          <h2>Bridge tong Scope 1</h2>
          <div className="gd-bars">
            {bars.map((bar) => (
              <div key={bar.label} className="gd-bar-row">
                <div className="gd-bar-label">{bar.label}</div>
                <div className="gd-bar-track"><span style={{ width: `${(bar.value / maxBar) * 100}%`, background: bar.color }} /></div>
                <div className="gd-bar-value">{fmt(bar.value)} t</div>
              </div>
            ))}
          </div>
          <p className="gd-note">
            Neu chi doc CO2e da tinh san trong workbook group thi moi thay 159.07 tCO2e. De ra 470 tCO2e,
            group phai dang cong them raw activity chua co CO2e san nhu fuel kWh, fleet km/litre, R-32/R-22 hoac dung EF ngoai file.
          </p>
        </div>

        <div className="gd-card">
          <h2>Phan loai nguyen nhan chenh</h2>
          <div className="gd-status-list">
            {Object.keys(statusMeta).map((status) => (
              <div key={status} className="gd-status-row">
                <StatusChip status={status as keyof typeof statusMeta} />
                <strong>{grouped[status]?.length || 0}</strong>
                <span className="gd-muted">dong</span>
              </div>
            ))}
          </div>
          <p className="gd-note">
            Chenh lech chinh khong phai do mot loi don le, ma do khac unit, thieu EF trong workbook group,
            HCM Office nam ngoai app factory scope, va refrigerants chua duoc map day du vao app.
          </p>
        </div>
      </section>

      <section className="gd-card">
        <div className="gd-section-head">
          <div>
            <h2>HCM Office group gui them</h2>
            <p>Office data khong nam trong 4 factory chinh cua app, nhung xuat hien trong file group.</p>
          </div>
        </div>
        <div className="gd-office-grid">
          {officeRows.map((row) => (
            <div key={`${row.site}-${row.category}`} className="gd-office-card">
              <div className="gd-office-title">{row.category}</div>
              <div className="gd-office-value">{fmt(row.groupActivity)} <span>{row.groupUnit}</span></div>
              {row.inferredRaw && <div className="gd-muted">Inferred raw: {fmt(row.inferredRaw)} {row.inferredRawUnit}</div>}
              <div className="gd-muted">{row.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="gd-card">
        <div className="gd-section-head">
          <div>
            <h2>Bang so sanh chi tiet</h2>
            <p>Inferred raw = group kWh / kWh factor. EF hieu dung trong app = tCO2e x 1000 / activity neu co.</p>
          </div>
        </div>
        <div className="gd-table-wrap">
          <table className="gd-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Category</th>
                <th>App activity</th>
                <th>App tCO2e</th>
                <th>App EF</th>
                <th>Group raw</th>
                <th>Inferred raw</th>
                <th>kWh factor</th>
                <th>Group tCO2e</th>
                <th>Group EF</th>
                <th>Status</th>
                <th>Ghi chu</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={`${row.site}-${row.category}-${row.note}`}>
                  <td>{row.site}</td>
                  <td>{row.category}</td>
                  <td>{fmt(row.appActivity)} {row.appUnit || ''}</td>
                  <td>{fmt(row.appTco2e)}</td>
                  <td>{row.appEf ? `${fmt(row.appEf, 4)} ${row.appEfUnit || ''}` : '-'}</td>
                  <td>{fmt(row.groupActivity)} {row.groupUnit || ''}</td>
                  <td>{row.inferredRaw ? `${fmt(row.inferredRaw)} ${row.inferredRawUnit || ''}` : '-'}</td>
                  <td>{row.groupKwhFactor ? `${fmt(row.groupKwhFactor, 4)} ${row.groupKwhFactorUnit || ''}` : '-'}</td>
                  <td>{fmt(row.groupTco2e)}</td>
                  <td>{row.groupEf !== undefined ? `${fmt(row.groupEf, 4)} ${row.groupEfUnit || ''}` : '-'}</td>
                  <td><StatusChip status={row.status} /></td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
