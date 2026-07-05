/**
 * Professional full pass: every Bing Webmaster section for hundesalon-nika.com.
 * npm run bing:edge → sign in snaiper1984@mail.ru → npm run bing:complete
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJson, openBingWebmasterSession, sleep } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const site = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(site);
const gmailAccount = 'snaiper1984@gmail.com';
const reportPath = path.join(root, 'temp', 'bing-webmaster-complete-report.json');

const sections = [
  { id: 'home', path: 'home', action: 'verify' },
  { id: 'searchPerformance', path: 'searchperf', action: 'scrape' },
  { id: 'aiPerformance', path: 'aiperformance', action: 'scrape' },
  { id: 'urlInspection', path: 'urlinspection', action: 'inspect' },
  { id: 'siteExplorer', path: 'siteexplorer', action: 'scrape' },
  { id: 'sitemaps', path: 'sitemaps', action: 'sitemaps' },
  { id: 'indexNow', path: 'indexnow', action: 'scrape' },
  { id: 'backlinks', path: 'backlinks', action: 'getStarted' },
  { id: 'keywordResearch', path: 'keywordresearch', action: 'scrape' },
  { id: 'recommendations', path: 'seoreports', action: 'getStarted' },
  { id: 'siteScan', path: 'sitescan', action: 'runScan' },
  { id: 'submitUrl', path: 'submiturl', action: 'submitUrls' },
  { id: 'robotsTxt', path: 'robotstxttester', action: 'testRobots' },
  { id: 'userManagement', path: 'usermgmt', action: 'users' },
  { id: 'clarity', path: 'clarity', action: 'getStarted' },
  { id: 'settings', path: 'settings/user', action: 'scrape' },
];

const inspectTargets = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/',
  'https://hundesalon-nika.com/favicon.ico',
];

const sitemaps = ['https://hundesalon-nika.com/sitemap.xml', 'https://hundesalon-nika.com/sitemap-brand.xml'];

function loadSubmitUrls() {
  const p = path.join(root, 'tools', 'bing-submit-urls.txt');
  if (!fs.existsSync(p)) return inspectTargets;
  return [
    ...new Set(
      fs
        .readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .filter(l => l.startsWith('https://'))
    ),
  ].slice(0, 100);
}

async function runSection(session, sec) {
  const out = { section: sec.id, path: sec.path };
  try {
    await session.nav(sec.path);

    switch (sec.action) {
      case 'verify':
        out.data = await session.eval(`
          const b = document.body?.innerText||'';
          return {
            verified: !/not verified|не проверено/i.test(b) || /search performance|производительность/i.test(b),
            hasStats: /click|клик|impression|показ/i.test(b),
          };
        `);
        break;
      case 'inspect': {
        out.inspections = [];
        for (const url of inspectTargets) {
          await session.nav('urlinspection', `&urlToInspect=${encodeURIComponent(url)}`);
          const r = await session.eval(`
            const input = document.querySelector('input');
            if (input) { setNativeValue(input, '${url}'); await sleep(500); }
            clickMatch('inspect|провер');
            await sleep(4000);
            return { url: '${url}', requestIndexing: clickMatch('request indexing|запросить индекс'), body: (document.body?.innerText||'').slice(0, 400) };
          `);
          out.inspections.push(r);
        }
        break;
      }
      case 'sitemaps': {
        out.sitemaps = [];
        for (const sm of sitemaps) {
          await session.nav('sitemaps');
          const r = await session.eval(`
            const sm = '${sm}';
            const body = document.body?.innerText||'';
            if (body.includes(sm)) return { sm, already: true };
            const input = document.querySelector('input');
            if (input) { setNativeValue(input, sm); await sleep(400); }
            clickMatch('submit|add|добав|отправ');
            await sleep(2500);
            return { sm, added: true, listed: (document.body?.innerText||'').includes('sitemap') };
          `);
          out.sitemaps.push(r);
        }
        break;
      }
      case 'submitUrls': {
        const urls = loadSubmitUrls();
        const payload = JSON.stringify(urls);
        out.submit = await session.eval(`
          const urls = ${payload};
          const input = document.querySelector('textarea') || document.querySelector('input');
          if (!input) return { ok: false };
          setNativeValue(input, urls.join('\\n'));
          await sleep(800);
          clickMatch('submit urls|отправить url');
          await sleep(1500);
          const buttons = Array.from(document.querySelectorAll('button')).filter(el => visible(el));
          const c = buttons.find(el => /^(submit|отправить)$/i.test(txt(el)));
          if (c) c.click();
          await sleep(4000);
          return { ok: true, count: urls.length };
        `);
        break;
      }
      case 'testRobots':
        out.robots = await session.eval(`
          const input = document.querySelector('input');
          if (input) setNativeValue(input, 'https://hundesalon-nika.com/robots.txt');
          await sleep(500);
          clickMatch('test|провер|fetch|получ');
          await sleep(4000);
          return { tested: true, sample: (document.body?.innerText||'').slice(0, 600) };
        `);
        break;
      case 'runScan':
        out.scan = await session.eval(`
          const start = clickMatch('run scan|start scan|scan now|запустить|начать скан|get started');
          await sleep(3000);
          return { started: start, sample: (document.body?.innerText||'').slice(0, 500) };
        `);
        break;
      case 'users':
        out.users = await session.eval(`
          const gmail = '${gmailAccount}';
          let removed = 0;
          for (const row of document.querySelectorAll('tr, li')) {
            if (!row.innerText?.includes(gmail)) continue;
            for (const el of row.querySelectorAll('button, a')) {
              if (visible(el) && /remove|delete|удалить/i.test(txt(el))) {
                el.click(); removed++; await sleep(1200);
                clickMatch('confirm|yes|да'); await sleep(1000);
              }
            }
          }
          const emails = [...document.body.innerText.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase());
          return { gmailRemoved: removed, emails: [...new Set(emails)] };
        `);
        break;
      case 'getStarted':
        out.data = await session.getStarted();
        break;
      default:
        out.data = await session.scrape();
    }
    out.ok = true;
  } catch (e) {
    out.ok = false;
    out.error = String(e.message);
  }
  return out;
}

function runNpm(script) {
  return new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', script], { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(script))));
  });
}

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error('Edge CDP missing. Run: npm run bing:edge');
  process.exit(1);
}

const report = { at: new Date().toISOString(), site, sections: [] };

console.log('CLI: IndexNow…');
try {
  await runNpm('seo:indexnow');
  report.indexnow = { ok: true };
} catch (e) {
  report.indexnow = { ok: false, error: String(e.message) };
}

const session = await openBingWebmasterSession({ port, siteQ, waitMs: 6500 });
try {
  for (const sec of sections) {
    console.log(`Bing WMT: ${sec.id}…`);
    report.sections.push(await runSection(session, sec));
    await wait(800);
  }
} finally {
  session.close();
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const okCount = report.sections.filter(s => s.ok).length;
console.log(`\nDone: ${okCount}/${report.sections.length} sections. Report: ${path.relative(root, reportPath)}`);
console.log(JSON.stringify(report, null, 2));
