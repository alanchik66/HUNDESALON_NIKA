/**
 * Poll Bing Site Scan until complete, open results, extract findings.
 * npm run bing:sitescan-results
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBingWebmasterSession, sleep } from './lib/browser-cdp.mjs';
import { siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = siteQuery();
const pollMs = Number(process.env.BING_SCAN_POLL_MS || 60_000);
const maxWaitMs = Number(process.env.BING_SCAN_MAX_WAIT_MS || 45 * 60_000);
const reportPath = path.join(root, 'temp', 'bing-sitescan-results-report.json');

async function cdpReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function edgePath() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);
  return candidates[0] || null;
}

function stopStaleProfileEdge() {
  if (process.platform !== 'win32') return;
  const marker = 'hundesalon-nika-edge-debug';
  spawnSync(
    'pwsh',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { encoding: 'utf8' }
  );
}

async function ensureCdp() {
  if (await cdpReady()) return true;

  const edge = edgePath();
  if (!edge) return false;

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  const startUrl = `https://www.bing.com/webmasters/sitescan?siteUrl=${siteQ}`;

  console.log(`Starting Edge CDP on port ${port}…`);
  stopStaleProfileEdge();

  const child = spawn(
    edge,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      startUrl,
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  for (let i = 0; i < 40; i += 1) {
    if (await cdpReady()) {
      console.log('Edge CDP ready.');
      await sleep(5000);
      return true;
    }
    await sleep(500);
  }

  return false;
}

function parseScanRow(body) {
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const idx = lines.findIndex(l => /HUNDESALON SEO scan/i.test(l));
  if (idx === -1) return null;

  const window = lines.slice(idx, idx + 12);
  const statusRe = /^(Queued|Scanning|In progress|Completed|Failed|Cancelled|Заверш|Сканир|В очереди|Ошибка)/i;
  const status = window.find(l => statusRe.test(l)) || null;
  const numbers = window
    .filter(l => /^\d+$/.test(l))
    .filter(l => !window.some(w => new RegExp(`${l}\\s+(?:minutes?|hours?|days?)\\s+ago`, 'i').test(w)));
  const timeAgo = window.find(l => /ago|назад|minute|hour|мин|час/i.test(l)) || null;

  return {
    name: 'HUNDESALON SEO scan',
    status,
    pagesScanned: numbers[0] ?? null,
    errors: numbers[1] ?? null,
    warnings: numbers[2] ?? null,
    timeAgo,
    raw: window.join(' | '),
  };
}

async function readScanList(session) {
  await session.nav('sitescan');
  return session.eval(`
    const body = document.body?.innerText || '';
    const rows = [...document.querySelectorAll('table tr, [role="row"], .ms-DetailsRow')].map(row => ({
      text: (row.innerText || '').replace(/\\s+/g, ' ').trim(),
      links: [...row.querySelectorAll('a, button, [role="button"]')].map(el => ({
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || '').trim(),
        href: el.href || null,
      })),
    })).filter(r => r.text.length > 0);

    const scanRow = rows.find(r => /HUNDESALON SEO scan/i.test(r.text));
    const statusFromBody = (() => {
      const m = body.match(/HUNDESALON SEO scan[\\s\\S]{0,400}/i);
      return m ? m[0].replace(/\\s+/g, ' ').trim() : '';
    })();

    const status = statusFromBody.match(/(Queued|Scanning|In progress|Completed|Failed|Cancelled)/i)?.[1] || '';
    const completed = /^completed$/i.test(status);
    const inProgress = /^(queued|scanning|in progress)$/i.test(status);
    const failed = /^(failed|cancelled)$/i.test(status);

    return {
      url: location.href,
      status,
      completed,
      inProgress,
      failed,
      statusSample: statusFromBody.slice(0, 500),
      scanRow,
      rows: rows.slice(0, 8),
      bodySample: body.slice(0, 1500),
    };
  `);
}

async function openScanDetails(session) {
  return session.eval(`
    const clickScan = () => {
      for (const el of document.querySelectorAll('a, button, [role="button"], td, [role="gridcell"]')) {
        if (!visible(el)) continue;
        const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
        if (/HUNDESALON SEO scan/i.test(t)) {
          const action = el.querySelector('a, button, [role="button"]') || el;
          action.click();
          return t;
        }
      }
      const actionBtn = clickMatch('view|просмотр|details|подроб|report|отчёт|results|результат|action|действ');
      return actionBtn;
    };

    const clicked = clickScan();
    await sleep(5000);

    const body = document.body?.innerText || '';
    const tabs = [...document.querySelectorAll('[role="tab"], button, a')].map(el => txt(el)).filter(t => t.length < 40);
    const issueBlocks = [...document.querySelectorAll('table tr, li, [class*="issue" i], [class*="finding" i], [role="row"]')]
      .map(el => (el.innerText || '').replace(/\\s+/g, ' ').trim())
      .filter(t => t.length > 8 && t.length < 500);

    const counts = {
      errors: (body.match(/(\\d+)\\s+errors?/i) || body.match(/ошибок?:\\s*(\\d+)/i) || [])[1] || null,
      warnings: (body.match(/(\\d+)\\s+warnings?/i) || body.match(/предупреждений?:\\s*(\\d+)/i) || [])[1] || null,
      pages: (body.match(/(\\d+)\\s+pages?\\s+scanned/i) || body.match(/просканировано\\s*(\\d+)/i) || [])[1] || null,
    };

    const categories = [...new Set(issueBlocks.filter(t =>
      /error|warning|issue|meta|title|link|image|redirect|canonical|hreflang|robots|sitemap|performance|mobile|ssl|http/i.test(t)
    ))].slice(0, 80);

    return {
      clicked,
      url: location.href,
      counts,
      tabs: [...new Set(tabs)].slice(0, 20),
      categories,
      bodySample: body.slice(0, 4000),
    };
  `);
}

async function extractFindings(session) {
  return session.eval(`
    const findings = [];
    const seen = new Set();

    const push = (type, text, extra = {}) => {
      const key = type + '|' + text;
      if (!text || seen.has(key)) return;
      seen.add(key);
      findings.push({ type, text, ...extra });
    };

    for (const row of document.querySelectorAll('table tr, [role="row"]')) {
      const text = (row.innerText || '').replace(/\\s+/g, ' ').trim();
      if (text.length < 12) continue;
      if (/error|warning|issue|critical|high|medium|low/i.test(text)) {
        const type = /error|ошиб/i.test(text) ? 'error' : /warning|предупреж/i.test(text) ? 'warning' : 'issue';
        push(type, text.slice(0, 400));
      }
    }

    for (const el of document.querySelectorAll('button, [role="tab"]')) {
      const t = txt(el);
      if (/errors?|warnings?|issues?|ошиб|предупреж/i.test(t)) {
        el.click();
        await sleep(2000);
        break;
      }
    }

    const body = document.body?.innerText || '';
    for (const line of body.split('\\n').map(l => l.trim()).filter(Boolean)) {
      if (line.length < 15 || line.length > 300) continue;
      if (/^(Skip to|Home|Search Performance|Site Scan|CONFIGURATION)/i.test(line)) continue;
      if (/error|warning|missing|duplicate|broken|redirect|canonical|hreflang|noindex|title tag|meta description|alt text|http:\\/\\/|4\\d\\d|5\\d\\d/i.test(line)) {
        const type = /error|missing|broken|4\\d\\d|5\\d\\d/i.test(line) ? 'error' : /warning|duplicate|http:\\/\\//i.test(line) ? 'warning' : 'info';
        push(type, line);
      }
    }

    const summary = {
      errors: findings.filter(f => f.type === 'error').length,
      warnings: findings.filter(f => f.type === 'warning').length,
      info: findings.filter(f => f.type === 'info' || f.type === 'issue').length,
    };

    return { summary, findings: findings.slice(0, 120), bodyTail: body.slice(0, 6000) };
  `);
}

if (!(await ensureCdp())) {
  console.error(`Edge CDP missing on port ${port}. Run: npm run bing:edge`);
  process.exit(1);
}

const report = {
  at: new Date().toISOString(),
  scanName: 'HUNDESALON SEO scan',
  polls: [],
};

const session = await openBingWebmasterSession({
  port,
  siteQ,
  waitMs: Number(process.env.BING_CDP_WAIT_MS || 10_000),
  reloadAttempts: Number(process.env.BING_CDP_RELOAD_ATTEMPTS || 4),
});
const started = Date.now();

try {
  let listState = await readScanList(session);
  report.initial = listState;

  while (listState.inProgress && !listState.failed && Date.now() - started < maxWaitMs) {
    const elapsedMin = Math.round((Date.now() - started) / 60000);
    console.log(`Scan ${listState.status || 'pending'} (${listState.statusSample?.slice(0, 120) || 'unknown'}) — poll again in ${pollMs / 1000}s (elapsed ${elapsedMin}m)…`);
    report.polls.push({
      at: new Date().toISOString(),
      status: listState.status,
      statusSample: listState.statusSample,
      inProgress: true,
    });
    await sleep(pollMs);
    listState = await readScanList(session);
  }

  report.finalList = listState;
  report.completed = Boolean(listState.completed);

  if (!report.completed) {
    report.error = 'Scan still in progress after max wait';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    process.exit(3);
  }

  console.log('Scan completed — opening results…');
  report.details = await openScanDetails(session);
  await sleep(3000);
  report.findings = await extractFindings(session);
  report.parsedRow = parseScanRow(listState.bodySample || listState.statusSample || '');
} finally {
  session.close();
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nReport: ${path.relative(root, reportPath)}`);
console.log(JSON.stringify(report, null, 2));
