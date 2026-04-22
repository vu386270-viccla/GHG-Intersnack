const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/app/overview/page.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const replacements = [
    // Backgrounds
    { regex: /background:\s*['"]#fafafa['"]/g, replacement: "background: 'var(--ov-surface-low)'" },
    { regex: /background:\s*['"]#f9f9f9['"]/g, replacement: "background: 'var(--ov-surface)'" },
    { regex: /background:\s*['"]#ffffff['"]/g, replacement: "background: 'var(--ov-surface-high)'" },
    { regex: /background:\s*['"]#fff['"]/g, replacement: "background: 'var(--ov-surface)'" },
    { regex: /background:\s*['"]#f5f5f5['"]/g, replacement: "background: 'var(--ov-glass)'" },
    { regex: /background:\s*['"]#eee['"]/g, replacement: "background: 'var(--ov-outline-ghost)'" },
    { regex: /background:\s*['"]#e0e0e0['"]/g, replacement: "background: 'var(--ov-surface-high)'" },
    { regex: /background:\s*['"]#fffbf0['"]/g, replacement: "background: 'rgba(245, 158, 11, 0.05)'" },
    { regex: /background:\s*['"]#fff5f5['"]/g, replacement: "background: 'rgba(227, 6, 19, 0.05)'" },
    { regex: /background:\s*['"]#f5fbff['"]/g, replacement: "background: 'rgba(59, 130, 246, 0.05)'" },

    // Borders
    { regex: /border:\s*['"]1px solid #eee['"]/g, replacement: "border: '1px solid var(--ov-outline-ghost)'" },
    { regex: /border:\s*['"]1px solid #e0e0e0['"]/g, replacement: "border: '1px solid var(--ov-glass-border)'" },
    { regex: /borderBottom:\s*['"]1px solid #eee['"]/g, replacement: "borderBottom: '1px solid var(--ov-glass-border)'" },
    { regex: /borderBottom:\s*['"]1px solid #f9f9f9['"]/g, replacement: "borderBottom: '1px solid var(--ov-outline-ghost)'" },
    { regex: /borderTop:\s*['"]2px solid #eee['"]/g, replacement: "borderTop: '1px solid var(--ov-glass-border)'" },

    // Text Colors
    { regex: /color:\s*['"]#333['"]/g, replacement: "color: 'var(--ov-text)'" },
    { regex: /color:\s*['"]#444['"]/g, replacement: "color: 'var(--ov-text)'" },
    { regex: /color:\s*['"]#555['"]/g, replacement: "color: 'var(--ov-text-muted)'" },
    { regex: /color:\s*['"]#666['"]/g, replacement: "color: 'var(--ov-text-muted)'" },
    { regex: /color:\s*['"]#888['"]/g, replacement: "color: 'var(--ov-text-dim)'" },
    { regex: /color:\s*['"]#999['"]/g, replacement: "color: 'var(--ov-text-dim)'" },
    { regex: /color:\s*['"]#aaa['"]/g, replacement: "color: 'var(--ov-text-dim)'" },
    { regex: /color:\s*['"]#bbb['"]/g, replacement: "color: 'rgba(255,255,255,0.3)'" },
    { regex: /color:\s*['"]#ccc['"]/g, replacement: "color: 'rgba(255,255,255,0.2)'" },

    // SVG Fills/Strokes
    { regex: /fill="none"\s+stroke="#6366F1"/g, replacement: 'fill="none" stroke="var(--ov-blue)"' },
    { regex: /stroke="#f0f0f0"/g, replacement: 'stroke="var(--ov-glass-border)"' },
    { regex: /fill="#ccc"/g, replacement: 'fill="var(--ov-text-dim)"' },
    { regex: /fill="#a5b4fc"/g, replacement: 'fill="var(--ov-blue)"' },
    { regex: /fill="#333"/g, replacement: 'fill="var(--ov-text)"' },
    { regex: /fill="#999"/g, replacement: 'fill="var(--ov-text-dim)"' }
];

let modified = content;
replacements.forEach(r => {
    modified = modified.replace(r.regex, r.replacement);
});

fs.writeFileSync(targetPath, modified);
console.log('✅ Updated colors to dark glassmorphism mappings');
