/**
 * Check Google Maps listing for website / NAP via Edge CDP.
 * npm run backlinks:google-maps
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';
import { BRAND_PROFILES, NAP } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);

try {
  await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error('Run: npm run bing:edge');
  process.exit(1);
}

const session = await openCdpSession({ port, fallbackAny: true });
try {
  await session.send('Page.navigate', { url: BRAND_PROFILES.googleMaps, transitionType: 'reload' });
  await sleep(8000);
  await session.evaluate(`(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!visible(el)) continue;
      const t = (el.innerText || '').trim();
      if (/accept all|alle akzeptieren|принять все|прийняти все/i.test(t)) { el.click(); return true; }
    }
    return false;
  })()`);
  await sleep(8000);
  const probe = await session.evaluate(`(() => {
    const body = document.body?.innerText || '';
    const html = document.documentElement?.innerHTML || '';
    return {
      url: location.href,
      title: document.title,
      hasWebsite: /hundesalon-nika\\.com/i.test(body + html),
      hasPhone: /1515|1708888/.test(body),
      hasAddress: /04299|Eichst|Leipzig/i.test(body),
      hasReview: /bewert|review|rezension|отзыв/i.test(body),
      sample: body.slice(0, 1200),
    };
  })()`);

  const report = { at: new Date().toISOString(), nap: NAP, maps: probe };
  const out = path.join(root, 'temp', 'google-maps-listing-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  if (!probe.hasWebsite) {
    console.error('\nAction: open https://business.google.com/ and add website:', NAP.url);
    console.error('Or: npm run backlinks:open-registrations');
    process.exit(2);
  }
} finally {
  session.close();
}
