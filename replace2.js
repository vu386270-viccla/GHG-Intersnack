const fs = require('fs');

const files = [
    'src/app/initiatives/page.tsx',
    'src/app/opex-report/page.tsx',
    'src/app/predictor/page.tsx',
    'src/app/scope-3/page.tsx',
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    if (content.startsWith("import SkeletonDashboard")) {
        // Remove the first line
        const lines = content.split('\n');
        const importLine = lines[0];
        lines.shift(); // remove the import
        const newLines = [];

        for (let i = 0; i < lines.length; i++) {
            newLines.push(lines[i]);
            if (lines[i].includes("'use client'") || lines[i].includes('"use client"')) {
                newLines.push(importLine); // Insert exactly after
            }
        }

        fs.writeFileSync(file, newLines.join('\n'), 'utf8');
        console.log('Fixed ' + file);
    }
}
