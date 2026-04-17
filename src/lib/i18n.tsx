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
  'nearest_year_s3': { en: 'Nearest year data — S3 annual', vi: 'Dữ liệu năm gần nhất — S3 annual' },
  // ─── Scope 3 Page ───
  's3_value_chain': { en: 'Value Chain', vi: 'Chuỗi giá trị' },
  's3_loading': { en: 'Loading Scope 3...', vi: 'Đang tải Scope 3...' },
  's3_partial_title': { en: 'Partial Data — YTD', vi: 'Dữ liệu tạm — YTD' },
  's3_partial_body': { en: 'Data incomplete · Cannot compare YoY · Will update when new data arrives', vi: 'Dữ liệu chưa đủ năm · Chưa thể so sánh YoY · Sẽ cập nhật thêm khi có data mới' },
  's3_estimated_title': { en: 'Cat.1 & Cat.4 — Estimated from', vi: 'Cat.1 & Cat.4 — Ước tính từ' },
  's3_estimated_body_pre': { en: 'Full procurement data not yet available for', vi: 'Chưa có đủ dữ liệu thu mua cho năm' },
  's3_estimated_body_post': { en: 'Showing nearest year as reference.', vi: 'Hiển thị năm gần nhất làm tham chiếu.' },
  's3_total_ytd': { en: '⚠️ Total Scope 3 (YTD)', vi: '⚠️ Tổng Scope 3 (YTD)' },
  's3_total': { en: 'Total Scope 3', vi: 'Tổng Scope 3' },
  's3_cat1_label': { en: '🌿 Cat.1 FLAG — Cashew', vi: '🌿 Cat.1 FLAG — Hạt điều' },
  's3_cat1_sub': { en: 'at-farm LUC', vi: 'phát thải tại nương rẫy' },
  's3_cat4_label': { en: '🚢 Cat.4 — Transport', vi: '🚢 Cat.4 — Vận chuyển' },
  's3_cat4_sub': { en: 'ocean + road', vi: 'biển + bộ' },
  's3_cat3_label': { en: '⚡ Cat.3 — WTT', vi: '⚡ Cat.3 — WTT' },
  's3_cat3_sub': { en: 'diesel + LPG + electricity', vi: 'diesel + LPG + điện' },
  's3_progress_lbl': { en: 'Progress → target', vi: 'Tiến độ → target' },
  's3_current': { en: 'Current', vi: 'Hiện tại' },
  's3_chart_title': { en: 'Scope 3 Emissions by Year — Stacked (tCO₂e)', vi: 'Phát thải Scope 3 theo năm — Stacked (tCO₂e)' },
  's3_breakdown_title': { en: 'Scope 3 Breakdown', vi: 'Phân bổ Scope 3' },
  's3_cat1_ocean_label': { en: 'Cat.1 Cashew (FLAG)', vi: 'Cat.1 Hạt điều (FLAG)' },
  's3_cat1_ocean_note': { en: 'at-farm LUC emission', vi: 'Phát thải tại trang trại (LUC)' },
  's3_cat4_ocean_label': { en: 'Cat.4 Ocean Freight', vi: 'Cat.4 Vận tải biển' },
  's3_cat4_ocean_note': { en: 'upstream ocean freight', vi: 'vận tải biển thượng nguồn' },
  's3_cat4_road_label': { en: 'Cat.4 Road Freight', vi: 'Cat.4 Vận tải bộ' },
  's3_cat4_road_note': { en: 'road freight', vi: 'vận tải đường bộ' },
  's3_cat3_wtt_label': { en: 'Cat.3 WTT Fuel', vi: 'Cat.3 WTT Nhiên liệu' },
  's3_cat3_wtt_note': { en: 'diesel + LPG + electricity upstream', vi: 'diesel + LPG + điện thượng nguồn' },
  's3_table_title': { en: 'Annual Detail', vi: 'Chi tiết theo năm' },
  's3_col_year': { en: 'Year', vi: 'Năm' },
  's3_col_total': { en: 'Total', vi: 'Tổng' },
  's3_col_vs2021': { en: 'vs 2021', vi: 'vs 2021' },
  's3_flag_target': { en: 'FLAG target', vi: 'FLAG target' },
  's3_nonflag_target': { en: 'Non-FLAG', vi: 'Non-FLAG' },
  's3_no_cat14_title': { en: 'No Cat.1 & Cat.4 data', vi: 'Chưa có dữ liệu Cat.1 & Cat.4' },
  's3_no_cat14_body': { en: 'Procurement & transport records for this year were not collected. Only Cat.3 WTT (fuel upstream) is available.', vi: 'Dữ liệu thu mua & vận chuyển năm này chưa được thu thập. Chỉ có Cat.3 WTT (nhiên liệu thượng nguồn).' },
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

  // ─── SHARED (Scope 1 & 2 common) ───
  'direct_emissions': { en: 'Direct emissions', vi: 'Phát thải trực tiếp' },
  'purchased_energy': { en: 'Purchased energy (Location-based)', vi: 'Năng lượng mua (Location-based)' },
  'tab_overview': { en: 'Overview', vi: 'Tổng quan' },
  'tab_by_source': { en: 'By Source', vi: 'Theo nguồn' },
  'tab_compare': { en: 'Factory Compare', vi: 'So sánh NM' },
  'tab_vs_rcn': { en: 'vs RCN', vi: 'vs RCN' },
  'tab_multi_year': { en: 'Multi-year', vi: 'Nhiều năm' },
  'tab_ef_ref': { en: 'Grid EF', vi: 'Hệ số điện' },
  'total_scope': { en: 'Total Scope', vi: 'Tổng Scope' },
  'cost_label': { en: 'Cost', vi: 'Chi phí' },
  'ytd_label': { en: 'YTD', vi: 'YTD' },
  'proportion': { en: 'Proportion', vi: 'Tỷ trọng' },
  'in_total_emissions': { en: 'of total emissions', vi: 'trong tổng phát thải' },
  'vs_last_year': { en: 'vs Previous year', vi: 'vs Năm trước' },
  'decrease': { en: '▼ Decrease', vi: '▼ Giảm' },
  'increase': { en: '▲ Increase', vi: '▲ Tăng' },
  'intensity_label': { en: 'Intensity', vi: 'Cường độ' },
  'main_source': { en: 'Main source', vi: 'Nguồn chính' },
  'analyzing_cost': { en: '💰 Analyzing Cost', vi: '💰 Đang phân tích Chi phí' },
  'convert_cost_usd': { en: '💰 Convert to USD', vi: '💰 Quy đổi Chi phí USD' },
  'loading_text': { en: 'Loading...', vi: 'Đang tải...' },
  'loading_multi_year': { en: 'Loading multi-year data...', vi: 'Đang tải dữ liệu nhiều năm...' },
  'viewing_badge': { en: 'Viewing', vi: 'Đang xem' },
  'of_scope': { en: 'of', vi: 'của' },
  'total_cost_s': { en: 'of total cost', vi: 'tổng tiền' },

  // ─── SCOPE 1 SPECIFIC ───
  's1_trend_by_factory': { en: '📈 Trend by factory', vi: '📈 Xu hướng theo nhà máy' },
  's1_cost_trend_by_factory': { en: '📈 Cost trend by factory', vi: '📈 Xu hướng chi phí theo nhà máy' },
  's1_analysis_by_source': { en: 'Analysis by source', vi: 'Phân tích theo nguồn' },
  's1_source_trend': { en: 'Trend by source', vi: 'Xu hướng theo nguồn' },
  's1_source_col': { en: 'Source', vi: 'Nguồn' },
  's1_select_source': { en: '☝️ Select at least one source', vi: '☝️ Chọn ít nhất một nguồn' },
  's1_source_filter': { en: 'Source:', vi: 'Nguồn:' },
  's1_peak_month': { en: 'Peak month', vi: 'Tháng cao nhất' },
  's1_pct_total': { en: '% total', vi: '% tổng' },
  's1_intensity_rank': { en: 'Emission intensity ranking', vi: 'Xếp hạng cường độ phát thải' },
  's1_cost_intensity_rank': { en: 'Cost intensity ranking', vi: 'Xếp hạng cường độ chi phí' },
  's1_grouped_bar': { en: 'Grouped bar', vi: 'Grouped bar' },
  's1_per_month': { en: '/month', vi: '/ tháng' },
  's1_total_s1': { en: 'total S1', vi: 'tổng S1' },
  's1_multi_year_title': { en: '📅 Scope 1 trend — annual emissions (tCO₂e)', vi: '📅 Xu hướng Scope 1 — tổng phát thải theo năm (tCO₂e)' },
  's1_year_col': { en: 'Year', vi: 'Năm' },
  's1_vs_prev_year_col': { en: 'vs Previous year', vi: 'vs Năm trước' },
  's1_vs_baseline_col': { en: 'vs Baseline 2021', vi: 'Tỷ lệ so baseline 2021' },

  // ─── SCOPE 2 SPECIFIC ───
  's2_trend_by_factory': { en: '📈 Electricity consumption trend by factory', vi: '📈 Xu hướng điện tiêu thụ theo nhà máy' },
  's2_compare_monthly': { en: 'Compare monthly electricity consumption', vi: 'So sánh điện tiêu thụ hàng tháng' },
  's2_ef_vn': { en: 'Grid EF VN', vi: 'EF Điện VN' },
  's2_country_col': { en: 'Country', vi: 'Quốc gia' },
  's2_ef_col': { en: 'Grid EF', vi: 'EF Điện' },
  's2_active_badge': { en: 'Active', vi: 'Active' },
  's2_pct_total_s2': { en: 'total S2', vi: 'tổng S2' },
  's2_vietnam': { en: '🇻🇳 Vietnam', vi: '🇻🇳 Việt Nam' },
  's2_india': { en: '🇮🇳 India', vi: '🇮🇳 Ấn Độ' },
  's2_multi_year_title': { en: '📅 Scope 2 trend — annual emissions (tCO₂e)', vi: '📅 Xu hướng Scope 2 — tổng phát thải theo năm (tCO₂e)' },
  's2_year_col': { en: 'Year', vi: 'Năm' },
  's2_scope2_col': { en: 'Scope 2 (tCO₂e)', vi: 'Scope 2 (tCO₂e)' },
  's2_ef_vn_col': { en: 'Grid EF VN', vi: 'EF Điện VN' },
  's2_vs_prev_year_col': { en: 'vs Previous year', vi: 'vs Năm trước' },
  's2_vs_baseline_col': { en: 'vs Baseline 2021', vi: 'vs Baseline 2021' },

  // ─── SCOPE 2 vs RCN ───
  's2_emission_vs_rcn': { en: 'Scope 2 Emission vs RCN — monthly correlation', vi: 'Phát thải Scope 2 vs RCN nhập — tương quan hàng tháng' },
  's2_cost_vs_rcn': { en: 'Scope 2 Cost vs RCN — monthly correlation', vi: 'Chi phí Scope 2 vs RCN nhập — tương quan hàng tháng' },
  'total_rcn': { en: 'Total RCN:', vi: 'Tổng RCN:' },
  'avg_intensity': { en: 'Avg intensity:', vi: 'Cường độ TB:' },

  // ─── SCOPE 1 vs RCN ───
  's1_emission_vs_rcn': { en: 'Scope 1 Emission vs RCN — monthly correlation', vi: 'Phát thải Scope 1 vs RCN nhập — tương quan hàng tháng' },
  's1_cost_vs_rcn': { en: 'Scope 1 Cost vs RCN — monthly correlation', vi: 'Chi phí Scope 1 vs RCN nhập — tương quan hàng tháng' },
  's1_emission_intensity_rank': { en: 'Scope 1 emission intensity ranking', vi: 'Xếp hạng cường độ phát thải Scope 1' },
  's1_cost_intensity_rank_full': { en: 'Scope 1 cost intensity ranking', vi: 'Xếp hạng cường độ chi phí Scope 1' },

  // ─── SCOPE 3 REMAINING ───
  's3_vs_2021': { en: 'vs 2021', vi: 'vs 2021' },
  's3_base_2021': { en: '2021 base', vi: '2021 base' },
  's3_target_year': { en: 'target', vi: 'target' },
  's3_base_badge': { en: 'BASE', vi: 'BASE' },
  's3_active_badge': { en: 'ACTIVE', vi: 'ACTIVE' },
  's3_cat3_only_badge': { en: 'Cat.3 only', vi: 'Chỉ Cat.3' },
  's3_no_data_tooltip': { en: '(no data)', vi: '(không có data)' },
};

interface I18nCtx {
  lang: Lang;
  t: (key: string) => string;
  toggle: () => void;
}

const Context = createContext<I18nCtx>({ lang: 'en', t: (k) => k, toggle: () => { } });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  const toggle = useCallback(() => setLang(l => l === 'en' ? 'vi' : 'en'), []);
  const t = useCallback((key: string) => translations[key]?.[lang] ?? key, [lang]);
  return <Context.Provider value={{ lang, t, toggle }}>{children}</Context.Provider>;
}

export const useI18n = () => useContext(Context);
