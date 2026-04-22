const fs = require('fs');

const file = 'src/app/overview/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /(background|backgroundColor|color|border|borderBottom|borderTop|borderLeft|borderRight):\s*['"]?([^'",}]+)['"]?/gi;
const matches = new Set();
let match;
while ((match = regex.exec(content)) !== null) {
    matches.add(match[0]);
}
console.log(Array.from(matches).join('\n'));
