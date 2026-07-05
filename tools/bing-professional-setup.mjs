/**
 * Full Bing Webmaster Tools setup for hundesalon-nika.com (mail.ru account).
 * Requires Edge CDP: npm run bing:edge → sign in as snaiper1984@mail.ru
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalPage, getJson, sleep, withCdpSession } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);
const mailAccount = 'snaiper1984@mail.ru';
const gmailAccount = 'snaiper1984@gmail.com';
const wrongSiteUrl = 'https://hundesalon-nika.com/sitemap.xml';

const inspectUrls = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/',
  'https://hundesalon-nika.com/favicon.ico',
  'https://hundesalon-nika.com/en/',
  'https://hundesalon-nika.com/de/onlayn-bronirovanie.html',
];

const withCdp = task => withCdpSession({ port, targetPattern: /bing|live\.com/i }, ({ send }) => task(send));

async function runNpm(script) {
  return new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', script], { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

const report = { startedAt: new Date().toISOString(), steps: {} };

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error(`Edge CDP not on port ${port}. Run: npm run bing:edge`);
  process.exit(1);
}

report.steps.account = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/home?siteUrl=${siteQ}` });
  await wait(7000);
  return evalPage(
    send,
    `
    clickMatch('profile|профиль|^AR$');
    await sleep(2000);
    const body = document.body?.innerText || '';
    const emails = [...new Set([...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase()))];
    return { emails, isMail: emails.some(e => e.includes('mail.ru')), isGmail: emails.some(e => e.includes('gmail.com')) };
  `
  );
});

if (report.steps.account?.isGmail && !report.steps.account?.isMail) {
  console.error(
    JSON.stringify({ error: 'WRONG_ACCOUNT', hint: `Sign in as ${mailAccount} in Edge (npm run bing:edge)` }, null, 2)
  );
  process.exit(2);
}

report.steps.removeWrongProperty = await withCdp(async send => {
  await send('Page.navigate', { url: 'https://www.bing.com/webmasters/home' });
  await wait(7000);
  return evalPage(
    send,
    `
    const wrong = '${wrongSiteUrl}';
    let removed = 0;
    for (const row of document.querySelectorAll('tr, li, [role="row"]')) {
      const t = row.innerText || '';
      if (!t.includes('sitemap.xml') || !t.includes('hundesalon')) continue;
      for (const el of row.querySelectorAll('button, a, [role="button"]')) {
        if (!visible(el)) continue;
        const label = txt(el);
        if (/remove|delete|удалить|entfernen|remove site/i.test(label)) {
          el.click();
          removed++;
          await sleep(1500);
          clickMatch('confirm|yes|удалить|да|ok');
          await sleep(2000);
          break;
        }
      }
    }
    return { removed, body: (document.body?.innerText||'').slice(0, 900) };
  `
  );
});

report.steps.sitemaps = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/sitemaps?siteUrl=${siteQ}` });
  await wait(6000);
  return evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    const hasSitemap = /sitemap\\.xml/i.test(body);
    if (!hasSitemap) {
      const input = document.querySelector('input[type="url"], input[type="text"]');
      if (input) { setNativeValue(input, 'https://hundesalon-nika.com/sitemap.xml'); await sleep(500); }
      clickMatch('submit|add|добав|отправ');
      await sleep(3000);
    }
    return { hasSitemap: /sitemap\\.xml/i.test(document.body?.innerText||''), url: location.href };
  `
  );
});

report.steps.users = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/usermgmt?siteUrl=${siteQ}` });
  await wait(6000);
  return evalPage(
    send,
    `
    const gmail = '${gmailAccount}';
    let removed = 0;
    const userEmails = [];
    for (const row of document.querySelectorAll('tr, li, [role="row"]')) {
      const t = row.innerText || '';
      const m = t.match(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi);
      if (!m) continue;
      for (const e of m) userEmails.push(e.toLowerCase());
      if (!t.includes(gmail)) continue;
      for (const el of row.querySelectorAll('button, a, [aria-label]')) {
        const label = txt(el) + ' ' + (el.getAttribute('aria-label') || '');
        if (visible(el) && /remove|delete|удалить|удал/i.test(label)) {
          el.click(); removed++; await sleep(1500);
          clickMatch('confirm|yes|удалить|да|ok'); await sleep(1500);
        }
      }
    }
    return {
      gmailRemoved: removed,
      userEmails: [...new Set(userEmails)],
      gmailAsUser: userEmails.some(e => e.includes('gmail.com')),
    };
  `
  );
});

report.steps.inspections = [];
for (const url of inspectUrls) {
  const step = await withCdp(async send => {
    await send('Page.navigate', {
      url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent(url)}`,
    });
    await wait(8000);
    return evalPage(
      send,
      `
      const target = '${url}';
      const input =
        document.querySelector('input[placeholder*="URL" i]') ||
        document.querySelector('input[type="url"], input[type="search"], input[type="text"]');
      if (input) {
        setNativeValue(input, target);
        await sleep(600);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(4500);
      }
      let inspected = clickMatch('^inspect$|inspect url|проверить url|url prüfen|провер');
      if (!inspected) {
        for (const b of document.querySelectorAll('button')) {
          if (visible(b) && /^inspect$/i.test(txt(b))) { b.click(); inspected = txt(b); break; }
        }
      }
      await sleep(5500);
      const req = clickMatch('request indexing|запросить индексирование|indexierung anfordern|индексирование');
      await sleep(2500);
      const body = document.body?.innerText || '';
      return {
        url: target,
        inspected,
        requestIndexing: req,
        canIndex: /can be indexed|может быть проиндексирован|indexiert werden|url is on bing/i.test(body),
        snippet: body.slice(0, 400),
      };
    `
    );
  });
  report.steps.inspections.push(step);
  await wait(1500);
}

report.steps.submitUrls = await withCdp(async send => {
  const listPath = path.join(root, 'tools', 'bing-submit-urls.txt');
  const urls = fs.existsSync(listPath)
    ? [
        ...new Set(
          fs
            .readFileSync(listPath, 'utf8')
            .split(/\r?\n/)
            .filter(l => l.startsWith('https://'))
        ),
      ].slice(0, 100)
    : inspectUrls;
  const payload = JSON.stringify(urls);
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/submiturl?siteUrl=${siteQ}` });
  await wait(7000);
  return evalPage(
    send,
    `
    const urls = ${payload};
    const textarea = document.querySelector('textarea') || document.querySelector('input');
    if (!textarea) return { ok: false, reason: 'NO_INPUT' };
    setNativeValue(textarea, urls.join('\\n'));
    await sleep(800);
    clickMatch('submit urls|отправить url');
    await sleep(1500);
    let final = clickMatch('^submit$|^отправить$|^send$|^einreichen$');
    if (!final) final = clickMatch('submit|отправ|send');
    await sleep(6000);
    const body = document.body?.innerText || '';
    const quotaUsed = /отправлено сегодня|submitted today/i.test(body) && !/0\\s*\\n.*28 days|не было отправлено/i.test(body.slice(0, 2500));
    return { ok: !!final, count: urls.length, quotaHint: body.match(/квота|quota|submitted today[^\\n]*/i)?.[0], url: location.href };
  `
  );
});

report.steps.indexnowPage = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/indexnow?siteUrl=${siteQ}` });
  await wait(5000);
  return evalPage(send, `return { url: location.href, text: (document.body?.innerText||'').slice(0, 800) };`);
});

try {
  await runNpm('seo:indexnow');
  report.steps.indexnowCli = { ok: true };
} catch (e) {
  report.steps.indexnowCli = { ok: false, error: String(e.message) };
}

try {
  await runNpm('bing:api');
  report.steps.bingApi = { ok: true };
} catch (e) {
  report.steps.bingApi = { ok: false, skipped: true, note: 'Set BING_WEBMASTER_API_KEY in .dev.vars for API submit' };
}

report.steps.finalAudit = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/home?siteUrl=${siteQ}` });
  await wait(6000);
  return evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    return {
      dashboard: /search performance|эффективность в поиске|clicks|клик/i.test(body),
      notVerified: /not verified|не проверено/i.test(body),
      hasStats: /\\d+/.test(body) && /impression|показ|click|клик/i.test(body),
      url: location.href,
      title: document.title,
    };
  `
  );
});

report.finishedAt = new Date().toISOString();
report.ok = report.steps.account?.isMail && report.steps.finalAudit?.dashboard && !report.steps.finalAudit?.notVerified;

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
