const fs = require('fs');
let c = fs.readFileSync('src/app/overview/page.tsx', 'utf8');
c = c.replace(/'#fff8f8'/g, "'rgba(227, 35, 20, 0.05)'");
c = c.replace(/'#fffcf0'/g, "'rgba(245, 166, 35, 0.05)'");
fs.writeFileSync('src/app/overview/page.tsx', c);
