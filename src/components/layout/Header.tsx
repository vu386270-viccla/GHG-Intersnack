'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, { title: string; accent?: string }> = {
  '/': { title: 'Tổng quan', accent: 'GHG Emissions' },
  '/scope-1': { title: 'Scope 1', accent: 'Phát thải trực tiếp' },
  '/scope-2': { title: 'Scope 2', accent: 'Năng lượng mua' },
  '/scope-3': { title: 'Scope 3', accent: 'Chuỗi giá trị' },
  '/factories': { title: 'Nhà máy', accent: 'So sánh' },
  '/input': { title: 'Nhập dữ liệu', accent: 'Emissions Data' },
  '/targets': { title: 'Mục tiêu', accent: 'SBTi Progress' },
};

export default function Header() {
  const pathname = usePathname();
  const pageInfo = PAGE_TITLES[pathname] || PAGE_TITLES['/'];
  const currentYear = new Date().getFullYear();

  return (
    <header className="header">
      <div className="header-title">
        {pageInfo.title}
        {pageInfo.accent && <> — <span>{pageInfo.accent}</span></>}
      </div>
      <div className="header-actions">
        {/* Intersnack logo in header */}
        <img
          src="/intersnack-logo.svg"
          alt="Intersnack"
          style={{ height: '28px', width: 'auto', opacity: 0.9, marginRight: '4px' }}
        />
        <div className="header-badge">
          📅 {currentYear}
        </div>
        <div className="header-badge sbti">
          🎯 SBTi Near-term
        </div>
        <div className="header-badge">
          🏭 4 Nhà máy
        </div>
      </div>
    </header>
  );
}
