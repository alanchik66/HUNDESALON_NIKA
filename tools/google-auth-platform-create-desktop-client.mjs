import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';

const PROJECT_ID = 'hundesalon-nika-shell-2026';
const CREATE_URL = `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`;
const CDP_PORT = Number(process.env.GOOGLE_OAUTH_CDP_PORT || process.env.CF_USER_CHROME_PORT || 9222);
const DOWNLOADS = join(homedir(), 'Downloads');
const SECRETS_DIR = join(process.cwd(), '.secrets');

function latestOAuthClientJson() {
  const roots = [DOWNLOADS, SECRETS_DIR];
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.json$/i.test(entry.name)) continue;
      if (!/client_secret|oauth|credentials|desktop/i.test(entry.name)) continue;
      candidates.push({ fullPath: join(root, entry.name), mtimeMs: statSync(join(root, entry.name)).mtimeMs });
    }
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.fullPath || '';
}

const session = await openCdpSession({ port: CDP_PORT, targetPattern: /./, fallbackAny: true });
await session.send('Page.navigate', { url: CREATE_URL });
await sleep(5000);

const step = await session.evalPage(`
  const clickMatch = (pattern) => {
    const re = new RegExp(pattern, 'i');
    for (const el of document.querySelectorAll('button, a, [role="button"], mat-radio-button, label')) {
      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
      if (!text || !re.test(text)) continue;
      el.click();
      return text;
    }
    return '';
  };

  let action = clickMatch('Desktop|Desktop-App|Desktop app|Desktopanwendung');
  if (!action) action = clickMatch('Create client|Client erstellen|Create|Erstellen');
  return {
    url: location.href,
    title: document.title,
    action,
    text: (document.body?.innerText || '').slice(0, 5000),
  };
`);

console.log(JSON.stringify(step, null, 2));

if (!latestOAuthClientJson()) {
  console.log('\nIf Google sign-in is shown, complete it in Chrome, then create Desktop client and download JSON.');
  console.log('After download, run: npm run google:setup-platform -- --wait-for-client-json');
}

session.close();
