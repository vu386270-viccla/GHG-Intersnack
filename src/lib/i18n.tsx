'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type Lang = 'en' | 'vi';

const translations: Record<string, Record<Lang, string>> = {
  // Header / dashboard
  'overview': { en: 'Overview — GHG Emissions', vi: 'Tổng quan — GHG Emissions' },
  'data_until': { en: 'Data until', vi: 'Dữ liệu tới' },
  'months_of': { en: 'months of', vi: 'tháng' },
  'vs_prev_year': { en: 'vs previous year', vi: 'vs năm trước' },
  'all_factories': { en: '🏭 All', vi: '🏭 Tất cả' },
  'ppt_view': { en: '📊 PPT View', vi: '📊 PPT View' },
  // Scope labels
  'scope1_label': { en: 'Scope 1 — Direct', vi: 'Scope 1 — Trực tiếp' },
  'scope2_label': { en: 'Scope 2 — Energy', vi: 'Scope 2 — Năng lượng' },
  'scope3_label': { en: 'Scope 3 — Value Chain', vi: 'Scope 3 — Chuỗi giá trị' },
  'of_total': { en: 'of total', vi: 'of total' },
  'prev_year': { en: '(previous year)', vi: '(năm trước)' },
  'annual_not_per_factory': { en: '* annual, not allocated per factory', vi: '* annual, không phân bổ theo nhà máy' },
  'scope3_combined': { en: '⚠ Scope 3 is company-wide (not factory-specific)', vi: '⚠ Scope 3 hiển thị chung toàn công ty (không theo nhà máy)' },
  // SBTi
  'sbti_progress': { en: 'SBTi Target Progress', vi: 'Tiến độ mục tiêu SBTi' },
  'sbti_s12': { en: 'Scope 1+2 — Operations', vi: 'Scope 1+2 — Vận hành' },
  'sbti_s3': { en: 'Scope 3 — Value Chain', vi: 'Scope 3 — Chuỗi giá trị' },
  'on_track': { en: '✓ On Track', vi: '✓ Đạt' },
  'behind': { en: '✗ Behind', vi: '✗ Chưa đạt' },
  'baseline': { en: 'Baseline', vi: 'Baseline' },
  'current': { en: 'Current', vi: 'Hiện tại' },
  'target_2032': { en: 'Target 2032', vi: 'Target 2032' },
  'reduced_so_far': { en: 'reduced so far', vi: 'đã giảm' },
  'linear_benchmark': { en: 'Linear benchmark for', vi: 'Mốc tuyến tính cho' },
  'need_to_reduce': { en: 'need to reduce', vi: 'cần giảm' },
  'target_vs_baseline': { en: 'vs baseline', vi: 'vs baseline' },
  'track_explain': { en: 'Comparing actual % reduction to linear interpolation from baseline year to 2032 target.', vi: 'So sánh % giảm thực tế với mốc tuyến tính từ năm baseline đến mục tiêu 2032.' },
  // Monthly chart
  'monthly_emissions': { en: 'Monthly Emissions', vi: 'Phát thải theo tháng' },
  's3_see_kpi': { en: 'S3 see KPI card ↗', vi: 'S3 xem KPI card ↗' },
  // Factory table
  'factory_comparison': { en: 'Factory Comparison', vi: 'So sánh nhà máy' },
  'view_detail': { en: 'View detail →', vi: 'Xem chi tiết →' },
  'factory': { en: 'Factory', vi: 'Nhà máy' },
  'total_label': { en: '🏭 Total', vi: '🏭 Tổng' },
  // Factory distribution
  'factory_distribution': { en: 'Emissions by Factory', vi: 'Phân bổ phát thải theo nhà máy' },
  // Loading
  'loading': { en: 'Loading data...', vi: 'Đang tải dữ liệu...' },
  // Baseline warning
  'baseline_warning_title': { en: 'Baseline 2021 has no actual data.', vi: 'Baseline 2021 chưa có dữ liệu thực.' },
  'baseline_warning_body': { en: 'System using estimate (×1.25) — SBTi tracking may be inaccurate. Please input 2021 data.', vi: 'Hệ thống đang dùng ước tính (×1.25) — SBTi target tracking có thể không chính xác. Hãy nhập dữ liệu năm 2021.' },
  // Quick links
  'scope1_detail': { en: 'Scope 1 Detail', vi: 'Scope 1 Detail' },
  'scope2_detail': { en: 'Scope 2 Detail', vi: 'Scope 2 Detail' },
  'scope3_detail': { en: 'Scope 3 Detail', vi: 'Scope 3 Detail' },
  'sbti_targets_link': { en: 'SBTi Targets', vi: 'SBTi Targets' },
  'factory_compare': { en: 'Factory Compare', vi: 'Factory Compare' },
  'opex_report': { en: 'OpEx Report', vi: 'OpEx Report' },
  'reference_ef': { en: 'Reference & EF', vi: 'Reference & EF' },
  // S3 categories
  'cat4_transport': { en: 'Transport', vi: 'Vận chuyển' },
  'cat1_materials': { en: 'Materials', vi: 'Nguyên liệu' },
  // nearest year data
  'nearest_year_s3': { en: 'Nearest year data — S3 annual', vi: 'Dữ liệu năm gần nhất — S3 annual' },
};

interface I18nCtx {
  lang: Lang;
  t: (key: string) => string;
  toggle: () => void;
}

const Context = createContext<I18nCtx>({ lang: 'en', t: (k) => k, toggle: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const toggle = useCallback(() => setLang(l => l === 'en' ? 'vi' : 'en'), []);
  const t = useCallback((key: string) => translations[key]?.[lang] ?? key, [lang]);
  return <Context.Provider value={{ lang, t, toggle }}>{children}</Context.Provider>;
}

export const useI18n = () => useContext(Context);
