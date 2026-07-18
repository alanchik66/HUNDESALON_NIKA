/**
 * Probe German directories + Google Maps for HUNDESALON NIKA listing.
 * npm run backlinks:directories
 * Requires: npm run bing:edge (port 9224)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';
import { BRAND_PROFILES, NAP } from '../config/brand-profiles.mjs';
import { LOCAL_DIRECTORIES } from '../config/local-directories.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);

async function ensureCdp() {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function probeUrl(session, url, matchSource) {
  await session.send('Page.navigate', { url, transitionType: 'reload' });
  await sleep(9000);
  const napProbe = '04299|1515|Eichst';
  return session.evaluate(`(() => {
    const body = document.body?.innerText || '';
    const re = new RegExp(${JSON.stringify(matchSource)}, 'i');
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ text: (a.innerText||'').trim().slice(0,80), href: a.href }))
      .filter(x => x.href && /hundesalon|nika|grooming/i.test(x.text + x.href))
      .slice(0, 8);
    return {
      url: location.href,
      title: document.title,
      hasMatch: re.test(body),
      hasOurSite: /hundesalon-nika\\.com/i.test(body),
      hasNap: /${napProbe}/i.test(body),
      links,
      sample: body.slice(0, 900),
    };
  })()`);
}

const report = { at: new Date().toISOString(), nap: NAP, directories: {}, googleMaps: null };

try {
  const mapsRes = await fetch(BRAND_PROFILES.googleMaps, {
    headers: { 'User-Agent': 'HUNDESALON-NIKA-citation-check/1.0' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  const mapsHtml = await mapsRes.text();
  report.googleMaps = {
    status: mapsRes.status,
    hasWebsite: /hundesalon-nika\.com/i.test(mapsHtml),
    hasPhone: /151\s*72450988|72450988|4915172450988/.test(mapsHtml),
    hasAddress: /04299|Eichst/i.test(mapsHtml),
    url: BRAND_PROFILES.googleMaps,
  };
} catch (e) {
  report.googleMaps = { error: String(e.message) };
}

if (!(await ensureCdp())) {
  report.cdp = { ok: false, note: 'Run: npm run bing:edge' };
} else {
  const session = await openCdpSession({ port, fallbackAny: true });
  try {
    report.cdp = { ok: true };
    for (const dir of LOCAL_DIRECTORIES) {
      console.log(`Probe ${dir.name}…`);
      const search = await probeUrl(session, dir.searchUrl, dir.match.source.replace(/^\^|\$?$/g, ''));
      let register = null;
      if (!search.hasMatch && !search.hasOurSite) {
        await session.send('Page.navigate', { url: dir.registerUrl });
        await sleep(6000);
        register = await session.evaluate(`(() => ({
          url: location.href,
          title: document.title,
          canRegister: /eintrag|regist|anmeld|kostenlos|jetzt/i.test(document.body?.innerText||''),
          sample: (document.body?.innerText||'').slice(0, 500),
        }))()`);
      }
      report.directories[dir.id] = { name: dir.name, search, registerUrl: dir.registerUrl, register };
    }
  } finally {
    session.close();
  }
}

const out = path.join(root, 'temp', 'local-citations-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
