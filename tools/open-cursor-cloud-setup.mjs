/**
 * Open Cursor Cloud Agents setup (environments + secrets).
 */
import { exec } from 'node:child_process';

const urls = [
  'https://cursor.com/dashboard/cloud-agents#environments',
  'https://cursor.com/dashboard/cloud-agents',
];

console.log('Cursor Cloud Agents — завершите шаг «Set up your cloud environment»:\n');
console.log('1. Environments → Create / Connect repository: alanchik66/HUNDESALON_NIKA');
console.log('2. Cursor подхватит .cursor/environment.json (install: npm install)');
console.log('3. Secrets → OPENROUTER_API_KEY (и опционально CLOUDFLARE_API_TOKEN)');
console.log('4. Дождитесь install, сохраните snapshot → Environment ready\n');
console.log('Подробнее: docs/cursor-cloud-secrets.md\n');

for (const url of urls) {
  console.log(url);
}

const url = urls[0];
const start =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log('\nОткройте вручную:', url);
});
