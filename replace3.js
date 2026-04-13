const fs = require('fs');
let b = fs.readFileSync('src/app/opex-report/page.tsx', 'utf8');

// The line is: <strong style={{ color: '#166534' }}>🌞 Planned: PT Rooftop Solar (vận hành cuối 2026)</strong> —{' '}
b = b.replace(/🌞 Planned: PT Rooftop Solar \(vận hành cuối 2026\)/g, `{lang === 'vi' ? '🌞 Dự kiến: ĐMT Áp mái PT (vận hành cuối 2026)' : '🌞 Planned: PT Rooftop Solar (online late 2026)'}`);

// The line is: Tiết kiệm dự kiến <strong style={{ color: '#166534' }}>~{ptSolarSaving(2027).toLocaleString()} tCO₂e/năm</strong> (2027){' '}
b = b.replace(/Tiết kiệm dự kiến <strong/g, `{lang === 'vi' ? 'Tiết kiệm dự kiến' : 'Projected savings'} <strong`);

b = b.replace(/Đã tích hợp vào kế hoạch giảm Scope 2 phía dưới\./g, `{lang === 'vi' ? 'Đã tích hợp vào kế hoạch giảm Scope 2 phía dưới.' : 'Integrated into the Scope 2 reduction plan below.'}`);

// <strong>🌞 PT Rooftop Solar (Scope 2 — từ 2027):</strong>
b = b.replace(/🌞 PT Rooftop Solar \(Scope 2 — từ 2027\):/g, `{lang === 'vi' ? '🌞 ĐMT Áp mái PT (Scope 2 — từ 2027):' : '🌞 PT Rooftop Solar (Scope 2 — from 2027):'}`);

b = b.replace(/tại nhà máy PT dự kiến vận hành cuối năm 2026\./g, `{lang === 'vi' ? 'tại nhà máy PT dự kiến vận hành cuối năm 2026.' : 'at PT factory planned to be operational by late 2026.'}`);

b = b.replace(/tích lũy,/g, `{lang === 'vi' ? 'tích lũy,' : 'cumulative,'}`);
b = b.replace(/góp phần đưa Scope 2 xuống/g, `{lang === 'vi' ? 'góp phần đưa Scope 2 xuống' : 'contributing to reducing Scope 2 down to'}`);
b = b.replace(/vào năm/g, `{lang === 'vi' ? 'vào năm' : 'by'}`);
b = b.replace(/năm đầu,/g, `{lang === 'vi' ? 'năm đầu,' : 'first year,'}`);

fs.writeFileSync('src/app/opex-report/page.tsx', b);
console.log('done 3');
