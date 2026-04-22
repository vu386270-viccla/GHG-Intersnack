const fs = require('fs');
const lines = fs.readFileSync('src/app/globals.css', 'utf8').split('\n');
console.log('Total lines: ' + lines.length);
lines.forEach((l, i) => {
    if (l.includes('.ov-left {')) console.log('.ov-left: ' + i);
    if (l.includes('.ov-grand-kpi {')) console.log('.ov-grand-kpi: ' + i);
    if (l.includes('.ov-bottom-section {')) console.log('.ov-bottom-section: ' + i);
});
