'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const PAGE_TITLES: Record<string, { title: string; accent?: string }> = {
  '/': { title: 'Tổng quan', accent: 'GHG Emissions' },
  '/scope-1': { title: 'Scope 1', accent: 'Phát thải trực tiếp' },
  '/scope-2': { title: 'Scope 2', accent: 'Năng lượng mua' },
  '/scope-3': { title: 'Scope 3', accent: 'Chuỗi giá trị' },
  '/factories': { title: 'Nhà máy', accent: 'So sánh' },
  '/input': { title: 'Nhập dữ liệu', accent: 'Emissions Data' },
  '/targets': { title: 'Mục tiêu', accent: 'SBTi Progress' },
  '/opex-report': { title: 'Opex Report', accent: 'SBTi Annual' },
};

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageInfo = PAGE_TITLES[pathname] || PAGE_TITLES['/'];

  const isOpex = pathname === '/opex-report';
  const showIntensity = searchParams.get('intensity') === '1';
  const showOrigin    = searchParams.get('origin')    === '1';

  const toggle = (key: string, current: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (current) params.delete(key); else params.set(key, '1');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <header className="header">
      <div className="header-title">
        {pageInfo.title}
        {pageInfo.accent && <> &mdash; <span>{pageInfo.accent}</span></>}
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
