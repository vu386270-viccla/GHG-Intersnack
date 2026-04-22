const fs = require('fs');

const file = 'src/app/overview/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const colorMap = {
    '#fff': 'var(--ov-surface-low)',
    '#ffffff': 'var(--ov-surface-low)',
    'white': 'var(--ov-text)',
    '#fafafa': 'var(--ov-surface-low)',
    '#f9f9f9': 'var(--ov-glass)',
    '#f5f5f5': 'var(--ov-glass)',
    '#f0f0f0': 'var(--ov-glass-border)',
    '#eee': 'var(--ov-glass-border)',
    '#ddd': 'var(--ov-glass-border)',
    '#ccc': 'var(--ov-text-dim)',
    '#aaa': 'var(--ov-text-muted)',
    '#999': 'var(--ov-text-muted)',
    '#888': 'var(--ov-text-dim)',
    '#666': 'var(--ov-text-dim)',
    '#555': 'var(--ov-text)',
    '#444': 'var(--ov-text)',
    '#333': 'var(--ov-text)',
    '#222': 'var(--ov-text)',
    '#111': 'var(--ov-text)',
    'black': 'var(--ov-text)',
    '#eef2ff': 'rgba(99, 102, 241, 0.05)',
    '#f0f4ff': 'rgba(59, 130, 246, 0.05)',
    '#c0dff5': 'rgba(59, 130, 246, 0.1)',
    '#f5fbff': 'rgba(59, 130, 246, 0.05)',
    '#fff5f5': 'rgba(227, 35, 20, 0.05)',
    '#fce0e0': 'rgba(227, 35, 20, 0.1)',
    '#fffbf0': 'rgba(245, 166, 35, 0.05)',
    '#ffe5a0': 'rgba(245, 166, 35, 0.1)',
    '#f0fdf4': 'rgba(39, 174, 96, 0.05)',
    '#86efac': 'rgba(39, 174, 96, 0.2)',
    '#fca5a5': 'rgba(227, 35, 20, 0.2)',
    '#16a34a': 'var(--ov-target)',
    '#fff5f4': 'rgba(227, 35, 20, 0.05)',
    '#fee2e2': 'rgba(227, 35, 20, 0.05)'
};

// Also fix border definitions with hardcoded colors
content = content.replace(/border:\s*['"]1px solid #[a-f0-9]{3,6}['"]/gi, "border: '1px solid var(--ov-glass-border)'");
content = content.replace(/borderBottom:\s*['"]1px solid #[a-f0-9]{3,6}['"]/gi, "borderBottom: '1px solid var(--ov-glass-border)'");
content = content.replace(/borderTop:\s*['"]2px solid #[a-f0-9]{3,6}['"]/gi, "borderTop: '1px solid var(--ov-glass-border)'");

Object.entries(colorMap).forEach(([k, v]) => {
    const reg1 = new RegExp(`['"]${k}['"]`, 'gi');
    content = content.replace(reg1, `'${v}'`);
});

// Update SVG strokes and fills that might be missed
content = content.replace(/stroke="#[a-f0-9]{3,6}"/g, (match) => {
    const color = match.slice(8, -1).toLowerCase();
    return colorMap[color] ? `stroke="${colorMap[color]}"` : match;
});

content = content.replace(/fill="#[a-f0-9]{3,6}"/g, (match) => {
    const color = match.slice(6, -1).toLowerCase();
    return colorMap[color] ? `fill="${colorMap[color]}"` : match;
});

// Fix specific gradients that look bad in dark mode
content = content.replace(/background:\s*['"]linear-gradient\(.*?, #f0f4ff .*?, #fafafa .*?\)['"]/g, "background: 'var(--ov-surface)'");
content = content.replace(/background:\s*['"]linear-gradient\(.*?, #fff .*?, #f9f9f9 .*?\)['"]/g, "background: 'var(--ov-surface)'");

fs.writeFileSync(file, content);
console.log("Colors successfully rewritten in page.tsx");
