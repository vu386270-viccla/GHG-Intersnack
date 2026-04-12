'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    {
      section: t('nav_overview'),
      items: [
        { href: '/', label: t('nav_dashboard'), icon: '📊' },
        { href: '/overview', label: t('nav_overview_ppt'), icon: '📽️' },
      ],
    },
    {
      section: t('nav_scopes'),
      items: [
        { href: '/scope-1', label: t('nav_scope1'), icon: '🔥', scopeClass: 'scope-1' },
        { href: '/scope-2', label: t('nav_scope2'), icon: '⚡', scopeClass: 'scope-2' },
        { href: '/scope-3', label: t('nav_scope3'), icon: '🌍', scopeClass: 'scope-3' },
      ],
    },
    {
      section: t('nav_factories'),
      items: [
        { href: '/factories', label: t('nav_all_factories'), icon: '🏭' },
      ],
    },
    {
      section: t('nav_management'),
      items: [
        { href: '/input', label: t('nav_input'), icon: '📝' },
        { href: '/targets', label: t('nav_targets'), icon: '🎯' },
        { href: '/initiatives', label: t('nav_initiatives'), icon: '🌱' },
        { href: '/predictor', label: t('nav_predictor'), icon: '🔮' },
        { href: '/opex-report', label: t('nav_opex_report'), icon: '📋' },
        { href: '/financials', label: t('nav_financials'), icon: '💰' },
        { href: '/reference', label: t('nav_reference'), icon: '📚' },
      ],
    },
  ];

  if (pathname === '/login') return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'center', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-light)' }}>
        {/* Intersnack logo */}
        <img
          src="/intersnack-logo.jpg"
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
