const fs = require('fs');

const files = [
    'src/app/factories/page.tsx',
    'src/app/financials/page.tsx',
    'src/app/initiatives/page.tsx',
    'src/app/opex-report/page.tsx',
    'src/app/predictor/page.tsx',
    'src/app/reference/page.tsx',
    'src/app/scope-1/page.tsx',
    'src/app/scope-2/page.tsx',
    'src/app/scope-3/page.tsx',
    'src/app/targets/page.tsx',
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('SkeletonDashboard')) {
        content = `import SkeletonDashboard from '@/components/layout/SkeletonDashboard';\n` + content;
    }

    const looseRegex = /if\s*\(\s*loading\s*\)\s*\{?\s*return\s*\(\s*<div[^>]*>[\s\S]*?className=['"]loading-spinner['"][\s\S]*?<\/div>(\s*<\/div>)?\s*\);\s*\}?/g;

    let newContent = content.replace(looseRegex, 'if (loading) return <SkeletonDashboard />;');

    if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Replaced in ' + file);
    } else {
        console.log('No match for ' + file);
    }
}
