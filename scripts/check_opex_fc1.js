/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'opex-report', 'page.tsx');
const page = fs.readFileSync(pagePath, 'utf8');

const checks = [
    {
        name: 'Scope 1 FC1 2026 source-of-truth is 325 tCO2e',
        ok: page.includes('const OPEX_FC1_2026_ALL = { scope1: 325, scope2: 12176 } as const;'),
    },
    {
        name: 'ALL view uses explicit Scope 1 FC1 instead of calculated model',
        ok: page.includes("const fcS1 = selectedFac === 'ALL' ? OPEX_FC1_2026_ALL.scope1 : calculatedFcS1;"),
    },
    {
        name: 'ALL view uses explicit Scope 2 FC1 instead of calculated model',
        ok: page.includes("const fcS2 = selectedFac === 'ALL' ? OPEX_FC1_2026_ALL.scope2 : calculatedFcS2;"),
    },
    {
        name: 'PT Solar has no 2026 full-year saving',
        ok: page.includes('if (year < PT_SOLAR_ONLINE_YEAR) return 0;') && page.includes('const PT_SOLAR_ONLINE_YEAR = 2027;'),
    },
    {
        name: 'Scope 3 target split uses real 2026 YTD instead of 25% placeholder',
        ok: page.includes('splitActualAbsVal: s3_2026ytd?.total && s3_2026ytd.total > 0 ? s3_2026ytd.total : undefined,'),
    },
    {
        name: 'PT Solar wording states no full-year Scope 2 reduction in FC 2026',
        ok: page.includes('không ghi nhận giảm Scope 2 full-year trong FC 2026') && page.includes('no full-year Scope 2 reduction is recognized in FC 2026'),
    },
];

let failed = 0;
console.log('\nOpex FC1 verification');
console.log('='.repeat(32));
for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    if (!check.ok) failed += 1;
}

if (failed > 0) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
}

console.log('\nAll Opex FC1 checks passed.');
