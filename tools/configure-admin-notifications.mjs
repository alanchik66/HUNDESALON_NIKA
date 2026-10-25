import { spawnSync } from 'node:child_process';
import { loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required');
await refreshWranglerOAuth(loadWranglerOAuth());
const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;
const values = {
  ADMIN_NOTIFICATION_EMAILS: 'ryndenko1982@gmail.com,snaiper1984@gmail.com',
  SITE_NOTIFICATIONS_ENABLED: 'true',
};
for (const [key, value] of Object.entries(values)) {
  const result = spawnSync(process.execPath, [
    'node_modules/wrangler/bin/wrangler.js', 'pages', 'secret', 'put', key,
    '--project-name', 'hundesalon-nika',
  ], { input: value, encoding: 'utf8', env });
  if (result.status !== 0) throw new Error(`Configuration failed: ${key}; CLI output withheld`);
  console.log(`Updated ${key}`);
}
