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
  '/opex-report': { title: 'Opex Report', accent: 'SBTi Annual Slide' },
};

function HeaderInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageInfo = PAGE_TITLES[pathname] || PAGE_TITLES['/'];
  const currentYear = new Date().getFullYear();

  const isOpex = pathname === '/opex-report';
  const showIntensity = searchParams.get('intensity') === '1';
  const showOrigin = searchParams.get('origin') === '1';

  const toggle = (key: string, current: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (current) params.delete(key);
    else params.set(key, '1');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <header className="header">
      <div className="header-title">
        {pageInfo.title}
        {pageInfo.accent && <> &mdash; <span>{pageInfo.accent}</span></>}
      </div>
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {/* ── Opex-only toggles ── */}
        {isOpex && (
          <>
            <button
              onClick={() => toggle('intensity', showIntensity)}
              title="Toggle: CO₂e absolute vs CO₂e/RCN intensity"
              style={{
                padding: '4px 11px', fontSize: '11.5px', fontWeight: 600,
                border: `1.5px solid ${showIntensity ? '#2E6B2E' : '#aaa'}`,
                borderRadius: '6px', cursor: 'pointer',
                background: showIntensity ? '#eaf5ea' : '#fff',
                color: showIntensity ? '#2E6B2E' : '#666',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.18s',
                lineHeight: 1.3,
              }}
            >
              <span>&#128202;</span>
              {showIntensity ? 'tCO\u2082e/RCN' : 'Absolute tCO\u2082e'}
            </button>
            <button
              onClick={() => toggle('origin', showOrigin)}
              title="Phan tich Cat.1 theo nguon goc xuat xu"
              style={{
                padding: '4px 11px', fontSize: '11.5px', fontWeight: 600,
                border: `1.5px solid ${showOrigin ? '#C8281A' : '#aaa'}`,
                borderRadius: '6px', cursor: 'pointer',
                background: showOrigin ? '#fff0f0' : '#fff',
                color: showOrigin ? '#C8281A' : '#666',
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.18s',
                lineHeight: 1.3,
              }}
            >
              <span>&#127757;</span> Origin Risk
            </button>
          </>
        )}

        <img
          src="/intersnack-logo.png"
          alt="Intersnack"
          style={{ height: '36px', width: 'auto', objectFit: 'contain', marginRight: '4px' }}
        />
        <div className="header-badge">
          &#128197; {currentYear}
        </div>
        <div className="header-badge sbti">
          &#127919; SBTi Near-term
        </div>
        <div className="header-badge">
          &#127981; 4 Nh&#224; m&#225;y
        </div>
      </div>
    </header>
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
