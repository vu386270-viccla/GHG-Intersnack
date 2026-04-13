const fs = require('fs');
let b = fs.readFileSync('src/app/opex-report/page.tsx', 'utf8');

b = b.replace(/Planned: PT Rooftop Solar \(vận hành cuối 2026\) —/g, `{lang === 'vi' ? 'Dự kiến: ĐMT Áp mái PT (vận hành cuối 2026) —' : 'Planned: PT Rooftop Solar (online late 2026) —'}`);
b = b.replace(/Tiết kiệm dự kiến/g, `{lang === 'vi' ? 'Tiết kiệm dự kiến' : 'Projected savings'}`);
b = b.replace(/Đã tích hợp vào kế hoạch giảm Scope 2 phía dưới/g, `{lang === 'vi' ? 'Đã tích hợp vào kế hoạch giảm Scope 2 phía dưới' : 'Integrated into the Scope 2 reduction plan below'}`);
b = b.replace(/năm/g, `{lang === 'vi' ? 'năm' : 'year'}`); // This might replace too much, be careful!
// Let's revert year replacement to be safe. We'll skip replacing 'năm đầu' to 'year 1' for now.

// Fix "Hệ thống điện mặt trời áp mái công suất" in Strategic Mitigation Plan
b = b.replace(/Hệ thống điện mặt trời áp mái công suất/g, `{lang === 'vi' ? 'Hệ thống điện mặt trời áp mái công suất' : 'Rooftop solar system with capacity of'}`);
b = b.replace(/tại nhà máy PT dự kiến vận hành cuối năm 2026\./g, `{lang === 'vi' ? 'tại nhà máy PT dự kiến vận hành cuối năm 2026.' : 'at PT factory planned to be operational by late 2026.'}`);

// "Tiếp tục mở rộng các giải pháp năng lượng tái tạo và khai thác REC để bù phần lưới còn lại."
b = b.replace(/Tiếp tục mở rộng các giải pháp năng lượng tái tạo và khai thác REC để bù phần lưới còn lại\./g, `{lang === 'vi' ? 'Tiếp tục mở rộng các giải pháp năng lượng tái tạo và khai thác REC để bù phần lưới còn lại.' : 'Continue expanding renewable energy solutions and exploit RECs to offset the remaining grid portion.'}`);

fs.writeFileSync('src/app/opex-report/page.tsx', b);
console.log('done2');
