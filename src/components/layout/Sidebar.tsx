'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    section: 'Tổng quan',
    items: [
      { href: '/', label: 'Dashboard', icon: '📊' },
      { href: '/overview', label: 'Overview (PPT)', icon: '📽️' },
    ],
  },
  {
    section: 'Phạm vi phát thải',
    items: [
      { href: '/scope-1', label: 'Scope 1 — Trực tiếp', icon: '🔥', scopeClass: 'scope-1' },
      { href: '/scope-2', label: 'Scope 2 — Năng lượng', icon: '⚡', scopeClass: 'scope-2' },
      { href: '/scope-3', label: 'Scope 3 — Chuỗi giá trị', icon: '🌍', scopeClass: 'scope-3' },
    ],
  },
  {
    section: 'Nhà máy',
    items: [
      { href: '/factories', label: 'Tất cả nhà máy', icon: '🏭' },
    ],
  },
  {
    section: 'Quản lý',
    items: [
      { href: '/input', label: 'Nhập dữ liệu', icon: '📝' },
      { href: '/targets', label: 'Mục tiêu SBTi', icon: '🎯' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-light)' }}>
        {/* Intersnack logo — place intersnack-logo.png in public/ */}
        <img
          src="/intersnack-logo.png"
          alt="Intersnack"
          style={{ width: '120px', height: 'auto', display: 'block', objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
          <div className="sidebar-logo-icon" style={{ width: '18px', height: '18px', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-logo-text" style={{ fontSize: '13px' }}>
              <span>GHG</span> Tracker
            </div>
            <div className="sidebar-logo-sub" style={{ fontSize: '10px' }}>Carbon Emissions Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  {'scopeClass' in item && item.scopeClass ? (
                    <span className={`scope-dot ${item.scopeClass}`} />
                  ) : (
                    <span className="nav-icon">{item.icon}</span>
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{
        padding: 'var(--space-md) var(--space-lg)',
        borderTop: '1px solid var(--color-border-light)',
      }}>
        <div style={{
          padding: 'var(--space-md)',
          background: 'var(--color-primary-alpha-10)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            SBTi Approved
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
            Science Based Targets
          </div>
        </div>
      </div>
    </aside>
  );
}
