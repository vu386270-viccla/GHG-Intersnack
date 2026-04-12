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
  'logout': { en: 'Logout', vi: 'Đăng xuất' },
  // S3 categories
  'cat4_transport': { en: 'Transport', vi: 'Vận chuyển' },
  'cat1_materials': { en: 'Materials', vi: 'Nguyên liệu' },
  // Sidebar Sections
  'nav_overview': { en: 'Overview', vi: 'Tổng quan' },
  'nav_scopes': { en: 'Emission Scopes', vi: 'Phạm vi phát thải' },
  'nav_factories': { en: 'Factories', vi: 'Nhà máy' },
  'nav_management': { en: 'Management', vi: 'Quản lý' },
  // Sidebar Items
  'nav_dashboard': { en: 'Dashboard', vi: 'Dashboard' },
  'nav_overview_ppt': { en: 'Overview (PPT)', vi: 'Overview (PPT)' },
  'nav_scope1': { en: 'Scope 1 — Direct', vi: 'Scope 1 — Trực tiếp' },
  'nav_scope2': { en: 'Scope 2 — Energy', vi: 'Scope 2 — Năng lượng' },
  'nav_scope3': { en: 'Scope 3 — Value Chain', vi: 'Scope 3 — Chuỗi giá trị' },
  'nav_all_factories': { en: 'All Factories', vi: 'Tất cả nhà máy' },
  'nav_input': { en: 'Data Entry', vi: 'Nhập dữ liệu' },
  'nav_targets': { en: 'SBTi Targets', vi: 'Mục tiêu SBTi' },
  'nav_initiatives': { en: 'Reduction Initiatives', vi: 'Sáng kiến giảm phát thải' },
  'nav_predictor': { en: 'Emission Predictor', vi: 'Dự báo Phát thải' },
  'nav_opex_report': { en: 'Opex Report', vi: 'Opex Report' },
  'nav_financials': { en: 'Financials', vi: 'Financials' },
  'nav_reference': { en: 'Reference & EF', vi: 'Reference & EF' },
  // nearest year data
  // nearest year data
  'nearest_year_s3': { en: 'Nearest year data — S3 annual', vi: 'Dữ liệu năm gần nhất — S3 annual' },
  // ─── GUIDE TEXTS ───
  'guide_title': { en: 'Page Guide', vi: 'Hướng dẫn Trang' },
  'guide_/': { 
    en: 'Welcome to the GHG Dashboard. This overview displays the total carbon emissions (Scope 1, 2, 3) compared to our 2032 targets. You can filter data by specific months.', 
    vi: 'Chào mừng bạn đến với GHG Dashboard. Trang tổng quan này hiển thị tổng lượng phát thải carbon (Scope 1, 2, 3) so với mục tiêu năm 2032. Bạn có thể lọc dữ liệu theo từng tháng.' 
  },
  'guide_/overview': {
    en: 'Overview (PPT Slide) provides a high-level summary suitable for presentations, consolidating all emissions and costs on one screen.',
    vi: 'Tổng quan (PPT Slide) cung cấp tóm tắt cấp cao phù hợp cho các buổi thuyết trình, kết hợp tất cả dữ liệu phát thải và chi phí trên một màn hình.'
  },
  'guide_/scope-1': { 
    en: 'Scope 1 tracks our direct emissions from owned sources (e.g., Boilers, Diesel generators). Here you can see emissions broken down by fuel type and factory.', 
    vi: 'Scope 1 theo dõi phát thải trực tiếp từ các nguồn nội bộ (VD: Lò hơi, Máy phát Diesel). Tại đây bạn thấy chiết tính lượng phát thải theo loại nhiên liệu và nhà máy.' 
  },
  'guide_/scope-2': { 
    en: 'Scope 2 tracks indirect emissions from purchased electricity. The system applies grid emission factors (EF) to calculate our carbon footprint from power usage.', 
    vi: 'Scope 2 theo dõi phát thải gián tiếp từ điện năng mua ngoài. Hệ thống áp dụng hệ số phát thải (EF) của lưới điện để tính toán dấu chân carbon từ việc sử dụng điện.' 
  },
  'guide_/scope-3': { 
    en: 'Scope 3 covers our value chain emissions (Transportation, Purchased Materials). Note: Scope 3 is tracked at the company level, not per individual factory.', 
    vi: 'Scope 3 bao gồm phát thải chuỗi giá trị (Vận chuyển, Nguyên vật liệu mua vào). Lưu ý: Scope 3 được theo dõi ở cấp độ toàn công ty, không chia theo từng nhà máy.' 
  },
  'guide_/factories': { 
    en: 'Analyze and compare specific factories (NM, DA, DC, TN). You can drill down to identify which site is contributing the most to our overall emissions.', 
    vi: 'Phân tích và so sánh các nhà máy cụ thể (NM, DA, DC, TN). Bạn có thể xem chi tiết để xác định nhà máy nào đang đóng góp nhiều nhất vào tổng lượng phát thải.' 
  },
  'guide_/targets': { 
    en: 'Tracks our Science Based Targets initiative (SBTi) progress. It displays our current emission trajectory against the required 42% reduction pathway by 2032.', 
    vi: 'Theo dõi tiến trình Sáng kiến Mục tiêu Dựa trên Cơ sở Khoa học (SBTi). Trang này hiển thị quỹ đạo phát thải hiện tại so với lộ trình giảm 42% yêu cầu vào năm 2032.' 
  },
  'guide_/opex-report': { 
    en: 'Summarizes operational costs versus emissions in an annual view. Critical for executives to visualize the financial correlations with carbon emissions.', 
    vi: 'Tổng hợp chi phí vận hành so với lượng phát thải theo dạng xem thường niên. Quan trọng cho ban quản lý để hình dung mối tương quan tài chính với phát thải carbon.' 
  },
  'guide_/financials': { 
    en: 'Deep dive into financial metrics, highlighting Carbon cost impacts and actual spending on various energy types across our facilities.', 
    vi: 'Đi sâu vào các chỉ số phân tích tài chính, nhấn mạnh tác động của chi phí Carbon và mức chi thực tế cho các loại năng lượng khác nhau tại các cơ sở.' 
  },
  'guide_/input': { 
    en: 'Data Entry form for authorized users. Input monthly consumption data here; it automatically calculates tCO2e based on predefined emission factors.', 
    vi: 'Biểu mẫu nhập liệu dành cho người dùng được cấp quyền. Việc nhập dữ liệu tiêu thụ hàng tháng ở đây sẽ tự động tính tCO2e dựa trên các hệ số gốc đã định sẵn.' 
  },
  'guide_/predictor': { 
    en: 'Uses historical data patterns to forecast our carbon emissions through year-end, helping to identify potential gap-to-target risks early.', 
    vi: 'Sử dụng các mô hình dữ liệu quá khứ để dự báo lượng phát thải carbon đến cuối năm, giúp nhận diện sớm các nguy cơ sai lệch so với mục tiêu.' 
  },
  'guide_/initiatives': { 
    en: 'Track active emissions-reduction projects (e.g., Solar panels, Biomass upgrade) and review their estimated carbon savings and ROI.', 
    vi: 'Theo dõi các dự án giảm phát thải đang triển khai (VD: Điện mặt trời, nâng cấp Sinh khối) và xem xét mức carbon dự kiến tiết kiệm được cùng ROI.' 
  },
  'guide_/reference': { 
    en: 'A centralized lookup table for all Emission Factors (EF), Global Warming Potentials (GWP), and unit conversions used mathematically across the system.', 
    vi: 'Bảng tra cứu tập trung tất cả Hệ số Phát thải (EF), Tiềm năng Nóng lên Toàn cầu (GWP), và quy đổi đơn vị được sử dụng trên toàn hệ thống tính toán.' 
  },
  // ─── END GUIDE TEXTS ───
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
