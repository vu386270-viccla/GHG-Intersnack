'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOpex = pathname === '/opex-report';
  const showIntensity = searchParams.get('intensity') === '1';
  const showOrigin = searchParams.get('origin') === '1';

  const toggle = (key: string, current: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (current) params.delete(key); else params.set(key, '1');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { user, role, signOut } = useAuth();
  const { lang, t, toggle: toggleLang } = useI18n();

  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  const PAGE_TITLES: Record<string, { titleKey: string; accent?: string }> = {
    '/': { titleKey: 'nav_dashboard', accent: 'GHG Emissions' },
    '/scope-1': { titleKey: 'nav_scope1', accent: 'Phát thải trực tiếp' },
    '/scope-2': { titleKey: 'nav_scope2', accent: 'Năng lượng mua' },
    '/scope-3': { titleKey: 'nav_scope3', accent: 'Chuỗi giá trị' },
    '/factories': { titleKey: 'nav_all_factories', accent: 'So sánh' },
    '/input': { titleKey: 'nav_input', accent: 'Emissions Data' },
    '/targets': { titleKey: 'nav_targets', accent: 'SBTi Progress' },
    '/opex-report': { titleKey: 'nav_opex_report', accent: 'SBTi Annual' },
    '/reference': { titleKey: 'nav_reference', accent: 'Emission Factors' },
    '/overview': { titleKey: 'nav_overview_ppt', accent: 'PPT Slide' },
    '/initiatives': { titleKey: 'nav_initiatives', accent: 'Giảm phát thải' },
    '/financials': { titleKey: 'nav_financials', accent: 'Chi phí & Carbon' },
  };

  const pageInfo = PAGE_TITLES[pathname] || PAGE_TITLES['/'];
  const translatedTitle = t(pageInfo.titleKey);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) {
        setShowGuide(false);
      }
    };
    if (showGuide) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGuide]);

  const guideText = t(`guide_${pathname}`);
  const hasGuide = guideText !== `guide_${pathname}`;

  if (pathname === '/login') return null;

  return (
    <header className="header">
      <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {pathname !== '/' && pathname !== '/overview' && pathname !== '/login' && (
          <button
            onClick={() => router.push('/')}
            title={t('nav_dashboard')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)',
              cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e7eb'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-secondary)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {translatedTitle}
          {pageInfo.accent && <> &mdash; <span style={{ marginLeft: '4px' }}>{pageInfo.accent}</span></>}
        </div>
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          title={lang === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang tiếng Anh'}
          style={{
            padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700,
            color: '#6b7280', transition: 'all 0.15s', letterSpacing: '0.5px',
          }}
        >
          {lang === 'en' ? '🇻🇳 VI' : '🇬🇧 EN'}
        </button>

        {/* Page Guide Toggle */}
        {hasGuide && (
          <div ref={guideRef} style={{ position: 'relative' }}>
            <button
              className="guide-button"
              onClick={() => setShowGuide(!showGuide)}
              title={t('guide_title')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
            {showGuide && (
              <div className="guide-popover">
                <div className="guide-popover-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  {t('guide_title')}
                </div>
                <div className="guide-popover-text">
                  {guideText}
                </div>
              </div>
            )}
          </div>
        )}
        {isOpex && (
          /* ── Pill-style toggle group ── */
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: '#f4f4f4', border: '1px solid #e0e0e0',
            borderRadius: '8px', padding: '3px',
          }}>
            <ToggleChip
              active={showIntensity}
              onClick={() => toggle('intensity', showIntensity)}
              label={showIntensity ? 'tCO₂e/RCN' : 'Absolute'}
              icon="📊"
              activeColor="#2E6B2E"
              activeBg="#eaf5ea"
            />
            <div style={{ width: 1, height: 16, background: '#ddd', margin: '0 1px' }} />
            <ToggleChip
              active={showOrigin}
              onClick={() => toggle('origin', showOrigin)}
              label="Origin Risk"
              icon="🌍"
              activeColor="#C8281A"
              activeBg="#fff0f0"
            />
          </div>
        )}

        {/* ── User badge + logout ── */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8,
              background: role === 'admin' ? '#fef3c7' : '#f0fdf4',
              border: `1px solid ${role === 'admin' ? '#fcd34d' : '#bbf7d0'}`,
              fontSize: 11, fontWeight: 600,
              color: role === 'admin' ? '#92400e' : '#166534',
            }}>
              <span>{role === 'admin' ? '🔑' : '👁'}</span>
              <span>{user.email?.split('@')[0]}</span>
              <span style={{ fontWeight: 400, opacity: 0.7 }}>{role}</span>
            </div>
            <button
              onClick={signOut}
              title={t('logout')}
              style={{
                padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                color: '#6b7280', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#fee2e2'; (e.target as HTMLElement).style.color = '#dc2626'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = '#fff'; (e.target as HTMLElement).style.color = '#6b7280'; }}
            >
              {t('logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function ToggleChip({
  active, onClick, label, icon, activeColor, activeBg
}: {
  active: boolean; onClick: () => void; label: string; icon: string;
  activeColor: string; activeBg: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px',
        fontSize: '11.5px', fontWeight: active ? 700 : 500,
        border: 'none', borderRadius: '6px', cursor: 'pointer',
        background: active ? activeBg : 'transparent',
        color: active ? activeColor : '#666',
        transition: 'all 0.2s ease',
        outline: active ? `1.5px solid ${activeColor}40` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );
}

export default function Header() {
  return (
    <Suspense fallback={
      <header className="header">
        <div className="header-title">Loading...</div>
        <div className="header-actions" />
      </header>
    }>
      <HeaderInner />
    </Suspense>
  );
}
