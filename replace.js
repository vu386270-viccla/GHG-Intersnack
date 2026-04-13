const fs = require('fs');
let b = fs.readFileSync('src/app/opex-report/page.tsx', 'utf8');

// Replace Scope 1 SBTi Performance
b = b.replace(/<strong>\{s1BeyondTarget \? '🏆' : '📋'\} Scope 1 SBTi Performance \(2025\):<\/strong> Total volume stands at/g, `<strong>{s1BeyondTarget ? '🏆' : '📋'} {lang === 'vi' ? 'Hiệu suất SBTi Scope 1 (2025):' : 'Scope 1 SBTi Performance (2025):'}</strong> {lang === 'vi' ? 'Tổng khối lượng ở mức' : 'Total volume stands at'}`);

// Replace Strategic Mitigation Plan (replace all occurrences)
b = b.replace(/<strong>Strategic Mitigation Plan:<\/strong>/g, `<strong>{lang === 'vi' ? 'Kế hoạch Giảm thiểu Chiến lược:' : 'Strategic Mitigation Plan:'}</strong>`);

// Replace Scope 2 SBTi Performance
b = b.replace(/<strong>\{s2BeyondTarget \? '🏆' : '⚠️'\} Scope 2 SBTi Performance \(2025\):<\/strong> Electricity-driven footprint recorded at/g, `<strong>{s2BeyondTarget ? '🏆' : '⚠️'} {lang === 'vi' ? 'Hiệu suất SBTi Scope 2 (2025):' : 'Scope 2 SBTi Performance (2025):'}</strong> {lang === 'vi' ? 'Phát thải điện tiêu thụ ở mức' : 'Electricity-driven footprint recorded at'}`);

// Replace Scope 3 Emissions Overview
b = b.replace(/<strong>Scope 3 Emissions Overview:<\/strong>/g, `<strong>{lang === 'vi' ? 'Tổng quan Phát thải Scope 3:' : 'Scope 3 Emissions Overview:'}</strong>`);

// Replace Scope 3 Reduction Strategy
b = b.replace(/<strong>Scope 3 Reduction Strategy/g, `<strong>{lang === 'vi' ? 'Chiến lược Giảm phát thải Scope 3' : 'Scope 3 Reduction Strategy'}`);

// Replace "Long-Term Goal:"
b = b.replace(/<strong>Long-Term Goal:<\/strong>/g, `<strong>{lang === 'vi' ? 'Mục tiêu Dài hạn:' : 'Long-Term Goal:'}</strong>`);

// YoY Shift
b = b.replace(/YoY 2024→2025 Shift:/g, `{lang === 'vi' ? 'Mức thay đổi YoY 2024→2025:' : 'YoY 2024→2025 Shift:'}`);

// Intensity Analysis
b = b.replace(/<strong>📊 Intensity Analysis/g, `<strong>📊 {lang === 'vi' ? 'Phân tích Cường độ' : 'Intensity Analysis'}`);
b = b.replace(/Intensity shift:/g, `{lang === 'vi' ? 'Sự thay đổi cường độ:' : 'Intensity shift:'}`);
b = b.replace(/vs Production shift:/g, `{lang === 'vi' ? 'so với thay đổi sản lượng:' : 'vs Production shift:'}`);

// Highest reduction cycle
b = b.replace(/Highest reduction cycle:/g, `{lang === 'vi' ? 'Chu kỳ giảm cao nhất:' : 'Highest reduction cycle:'}`);
b = b.replace(/Peak volume increase:/g, `{lang === 'vi' ? 'Mức tăng cao đỉnh điểm:' : 'Peak volume increase:'}`);
b = b.replace(/Critical escalation identified in/g, `{lang === 'vi' ? 'Phát hiện sự gia tăng nghiêm trọng vào' : 'Critical escalation identified in'}`);
b = b.replace(/Strongest reduction trend seen in/g, `{lang === 'vi' ? 'Xu hướng giảm mạnh nhất vào' : 'Strongest reduction trend seen in'}`);

// Tables
b = b.replace(/Scope 1 — /g, `Scope 1 — `); // leave structure alone, just change "Total Scope"
b = b.replace(/'Total Scope 1'/g, `lang === 'vi' ? 'Tổng Scope 1' : 'Total Scope 1'`);
b = b.replace(/'Total Scope 2'/g, `lang === 'vi' ? 'Tổng Scope 2' : 'Total Scope 2'`);
b = b.replace(/<strong>Scope 1 \(reduce firewood usage\)<\/strong>/g, `<strong>{lang === 'vi' ? 'Scope 1 (Giảm gỗ củi)' : 'Scope 1 (reduce firewood usage)'}</strong>`);
b = b.replace(/<strong>Scope 2 \(grid electricity\)<\/strong>/g, `<strong>{lang === 'vi' ? 'Scope 2 (Điện lưới)' : 'Scope 2 (grid electricity)'}</strong>`);

fs.writeFileSync('src/app/opex-report/page.tsx', b);
console.log("Done replace");
