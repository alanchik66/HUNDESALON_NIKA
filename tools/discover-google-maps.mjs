/**
 * Search Google Maps for HUNDESALON NIKA listing via Edge CDP.
 * node tools/discover-google-maps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';
import { NAP } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);

try {
  await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error('Run: npm run bing:edge');
  process.exit(1);
}

const queries = [
  `${NAP.name} ${NAP.street} ${NAP.locality}`,
  `${NAP.name} Leipzig`,
  `Hundesalon Nika ${NAP.postalCode}`,
];

const session = await openCdpSession({ port, fallbackAny: true });
const results = [];

try {
  for (const q of queries) {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
    await session.send('Page.navigate', { url, transitionType: 'reload' });
    await sleep(7000);
    await session.evaluate(`(() => {
      for (const el of document.querySelectorAll('button, [role="button"]')) {
        const t = (el.innerText || '').trim();
        if (/accept all|alle akzeptieren|принять все/i.test(t)) { el.click(); return; }
      }
    })()`);
    await sleep(5000);

    const probe = await session.evaluate(`(() => {
      const body = document.body?.innerText || '';
      const html = document.documentElement?.innerHTML || '';
      const placeLinks = [...new Set(
        [...document.querySelectorAll('a[href*="/maps/place/"]')]
          .map(a => a.href)
          .filter(h => h.includes('google.com/maps/place'))
      )].slice(0, 8);
      return {
        query: ${JSON.stringify(q)},
        url: location.href,
        title: document.title,
        hasNika: /hundesalon\\s*nika|nika.*hundesalon/i.test(body),
        hasLeipzig: /leipzig|04299/i.test(body),
        hasWrongTeplice: /teplice|strihanipsu/i.test(body),
        hasWebsite: /hundesalon-nika\\.com/i.test(body + html),
        placeLinks,
        sample: body.slice(0, 1500),
      };
    })()`);
    results.push(probe);
  }
} finally {
  session.close();
}

const out = path.join(root, 'temp', 'google-maps-discover.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({ at: new Date().toISOString(), results }, null, 2)}\n`);
console.log(JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
