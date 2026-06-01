import fs from 'node:fs';

const configPath = 'C:\\Users\\Cashew\\.cloudflared\\config.yml';

const correctContent = `tunnel: 066354a2-7fee-4908-b762-2c2a47c1db72
credentials-file: C:\\Users\\Cashew\\.cloudflared\\066354a2-7fee-4908-b762-2c2a47c1db72.json

ingress:
  - hostname: hse.icc.info.vn
    service: http://localhost:9321
  - hostname: deck.icc.info.vn
    service: http://localhost:9808
  - hostname: deck-api.icc.info.vn
    service: http://localhost:9807
  - hostname: security.icc.info.vn
    service: http://localhost:8787
  - hostname: wwt.icc.info.vn
    service: http://localhost:4318
  - hostname: hr.icc.info.vn
    service: http://localhost:8790
  - hostname: ppe.icc.info.vn
    service: http://localhost:8795
  - hostname: app.icc.info.vn
    service: http://localhost:3000
  - hostname: ghg.icc.info.vn
    service: http://localhost:3001
  - service: http_status:404`;

fs.writeFileSync(configPath, correctContent, 'utf8');
console.log('✅ Overwritten config.yml with correct, formatted YAML configuration.');
