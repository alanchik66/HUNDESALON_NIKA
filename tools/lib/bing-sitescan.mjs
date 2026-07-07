import { openBingWebmasterSession, sleep } from './browser-cdp.mjs';
import { siteQuery } from './bing-wmt.mjs';

export const SCAN_NAME = 'HUNDESALON SEO scan';

export async function readBingSiteScanStatus(options = {}) {
  const port = Number(options.port || process.env.BING_MAIL_EDGE_PORT || 9224);
  const siteQ = siteQuery();
  const session = await openBingWebmasterSession({
    port,
    siteQ,
    waitMs: Number(options.waitMs || 6_000),
    reloadAttempts: Number(options.reloadAttempts || 2),
  });

  try {
    if (!/\/sitescan/i.test(session.target?.url || '')) {
      await session.nav('sitescan');
    } else {
      await sleep(1500);
    }

    const readPayload = () => session.evaluate(`(() => {
      const body = document.body?.innerText || '';
      const rows = [...document.querySelectorAll('tr, [role="row"]')]
        .map(row => (row.innerText || '').replace(/\\s+/g, ' ').trim())
        .filter(text => /HUNDESALON SEO scan/i.test(text));

      const parseRow = text => {
        const status = text.match(/(Queued|Scanning|In progress|Completed|Failed|Cancelled|Stopped)/i)?.[1] || 'unknown';
        const timeAgo =
          text.match(/just now/i)?.[0] ||
          text.match(/(\\d+\\s+(?:minutes?|hours?|days?)\\s+ago)/i)?.[1] ||
          null;
        const metrics = text
          .replace(/just now/gi, '')
          .replace(/\\d+\\s+(?:minutes?|hours?|days?)\\s+ago/gi, '')
          .replace(/\\d+\\s+rows?/gi, '')
          .split(/\\s+/)
          .filter(token => /^\\d+$/.test(token));

        return {
          row: text,
          status,
          timeAgo,
          pages: metrics[0] ?? null,
          errors: metrics[1] ?? null,
          warnings: metrics[2] ?? null,
          completed: /^completed$/i.test(status),
          inProgress: /^(queued|scanning|in progress)$/i.test(status),
          failed: /^(failed|cancelled|stopped)$/i.test(status),
          activeScore: /^(queued|scanning|in progress|completed)$/i.test(status) ? 2 : 0,
        };
      };

      const parsed = rows.map(parseRow);
      const active = parsed.find(item => item.inProgress) || parsed.find(item => item.completed) || parsed[0] || null;
      const slice = active?.row || '';

      return {
        at: new Date().toISOString(),
        found: parsed.length > 0,
        scanName: 'HUNDESALON SEO scan',
        status: active?.status || 'unknown',
        timeAgo: active?.timeAgo || null,
        pages: active?.pages ?? null,
        errors: active?.errors ?? null,
        warnings: active?.warnings ?? null,
        row: slice,
        rows: parsed.length,
        bodyChars: body.length,
        completed: Boolean(active?.completed),
        inProgress: Boolean(active?.inProgress),
        failed: Boolean(active?.failed),
      };
    })()`);

    let payload = await readPayload();

    if (!payload?.found) {
      await session.nav('sitescan');
      await sleep(3000);
      payload = await readPayload();
    }

    return payload;
  } finally {
    session.close();
  }
}

export async function extractBingSiteScanFindings(options = {}) {
  const port = Number(options.port || process.env.BING_MAIL_EDGE_PORT || 9224);
  const siteQ = siteQuery();
  const session = await openBingWebmasterSession({
    port,
    siteQ,
    waitMs: Number(options.waitMs || 10_000),
    reloadAttempts: Number(options.reloadAttempts || 4),
  });

  try {
    await session.nav('sitescan');
    await session.eval(`
      const row = [...document.querySelectorAll('tr, [role="row"]')].find(r => /HUNDESALON SEO scan/i.test(r.innerText || ''));
      if (row) {
        const link = row.querySelector('a');
        if (link && visible(link)) link.click();
        else {
          const cell = [...row.querySelectorAll('td, [role="gridcell"]')].find(c => /HUNDESALON SEO scan/i.test(c.innerText || ''));
          if (cell) cell.click();
        }
      }
      await sleep(6000);
    `);

    return session.eval(`
      const body = document.body?.innerText || '';
      const lines = body.split('\\n').map(l => l.trim()).filter(Boolean);
      const findings = [];
      const seen = new Set();

      const push = (type, text) => {
        const key = type + '|' + text;
        if (!text || seen.has(key)) return;
        seen.add(key);
        findings.push({ type, text });
      };

      for (const line of lines) {
        if (line.length < 12 || line.length > 320) continue;
        if (/^(Skip to|Home|Search Performance|Site Scan|CONFIGURATION|Scan name)/i.test(line)) continue;
        if (/error|warning|issue|missing|duplicate|broken|redirect|canonical|hreflang|meta description|title tag|alt text|http:\\/\\/|4\\d\\d|5\\d\\d|ssl|mobile|sitemap|noindex|robots/i.test(line)) {
          const type = /error|missing|broken|4\\d\\d|5\\d\\d/i.test(line) ? 'error' : /warning|duplicate|http:\\/\\//i.test(line) ? 'warning' : 'info';
          push(type, line);
        }
      }

      for (const row of document.querySelectorAll('table tr, [role="row"]')) {
        const text = (row.innerText || '').replace(/\\s+/g, ' ').trim();
        if (text.length < 15 || /Scan name Status Pages scanned/i.test(text)) continue;
        if (/error|warning|issue/i.test(text)) {
          push(/error/i.test(text) ? 'error' : 'warning', text.slice(0, 400));
        }
      }

      return {
        url: location.href,
        counts: {
          errors: (body.match(/(\\d+)\\s+errors?/i) || [])[1] || null,
          warnings: (body.match(/(\\d+)\\s+warnings?/i) || [])[1] || null,
          pages: (body.match(/(\\d+)\\s+pages?\\s+scanned/i) || [])[1] || null,
        },
        summary: {
          errors: findings.filter(f => f.type === 'error').length,
          warnings: findings.filter(f => f.type === 'warning').length,
          info: findings.filter(f => f.type === 'info').length,
        },
        findings: findings.slice(0, 120),
        bodySample: body.slice(0, 8000),
      };
    `);
  } finally {
    session.close();
  }
}

async function findScanRow(session) {
  return session.evaluate(
    `[...document.querySelectorAll('tr, [role="row"]')].some(r => /HUNDESALON SEO scan/i.test(r.innerText || ''))`
  );
}

async function openScanRowMenu(session) {
  return session.eval(`
    const row = [...document.querySelectorAll('tr, [role="row"]')].find(r => /HUNDESALON SEO scan/i.test(r.innerText || ''));
    const more = row?.querySelector('button[aria-label="More"], button[title="More"]');
    if (more) more.click();
    await sleep(1500);
    return !!more;
  `);
}

async function clickScanMenuItem(session, labelPattern) {
  return session.eval(`
    let clicked = null;
    for (const el of document.querySelectorAll('button, [role="menuitem"], li')) {
      const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!t) continue;
      if (new RegExp(${JSON.stringify(labelPattern)}, 'i').test(t)) {
        const action = el.tagName === 'LI' ? el.querySelector('button, a') || el : el;
        action.click();
        clicked = t;
        break;
      }
    }
    await sleep(2000);
    return clicked;
  `);
}

async function confirmDialog(session, confirmPattern) {
  return session.eval(`
    const dialog = document.querySelector('[role="dialog"], .ms-Dialog, .ms-Modal');
    let clicked = null;
    if (dialog) {
      for (const el of dialog.querySelectorAll('button, [role="button"]')) {
        if (!visible(el)) continue;
        const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
        if (new RegExp(${JSON.stringify(confirmPattern)}, 'i').test(t)) {
          el.click();
          clicked = t;
          break;
        }
      }
    }
    await sleep(4000);
    return { clicked, hasDialog: !!dialog };
  `);
}

export async function stopBingSiteScan(session) {
  const hasRow = await findScanRow(session);
  if (!hasRow) return { skipped: true, reason: 'no scan row' };

  await openScanRowMenu(session);
  const menuClicked = await clickScanMenuItem(session, '^stop scan$');
  const confirmed = await confirmDialog(session, '^stop$');
  return { menuClicked, confirmed };
}

export async function deleteBingSiteScan(session) {
  const hasRow = await findScanRow(session);
  if (!hasRow) return { skipped: true, reason: 'no scan row' };

  await openScanRowMenu(session);
  const menuClicked = await clickScanMenuItem(session, '^delete scan$');
  const confirmed = await confirmDialog(session, '^delete$|^yes$|^удалить$');
  return { menuClicked, confirmed };
}

export async function startBingSiteScan(session, options = {}) {
  const scanName = options.scanName || `${SCAN_NAME} ${new Date().toISOString().slice(0, 10)}`;
  const scanLimit = String(options.scanLimit || 500);

  return session.eval(`
    const opened = clickMatch('start new scan|начать новое сканирование');
    await sleep(2500);

    const nameInput = document.querySelector('#scanNameId');
    const limitInput = document.querySelector('#scanLimit');
    if (nameInput) setNativeValue(nameInput, ${JSON.stringify(scanName)});
    if (limitInput) setNativeValue(limitInput, ${JSON.stringify(scanLimit)});
    await sleep(1000);

    let submit = null;
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!visible(el) || el.disabled) continue;
      const t = txt(el);
      if (/^start scan$/i.test(t)) { el.click(); submit = t; break; }
    }
    if (!submit) submit = clickMatch('^start scan$|^start new scan$|^начать скан|^scan$');
    await sleep(10000);

    const body = document.body?.innerText || '';
    const active = /scanning|сканир|in progress|выполняется|queued|очеред|scheduled|заплан/i.test(body);
    const notStarted = /no scans initiated|сканирование не проводилось|not scanned/i.test(body);

    return {
      opened,
      submit,
      scanName: ${JSON.stringify(scanName)},
      active: active && !notStarted,
      notStarted,
      success: Boolean(submit) && active && !notStarted,
      sample: body.slice(0, 700),
    };
  `);
}

export async function restartBingSiteScan(options = {}) {
  const port = Number(options.port || process.env.BING_MAIL_EDGE_PORT || 9224);
  const siteQ = siteQuery();
  const report = { at: new Date().toISOString(), steps: {} };

  const session = await openBingWebmasterSession({
    port,
    siteQ,
    waitMs: Number(options.waitMs || 10_000),
    reloadAttempts: Number(options.reloadAttempts || 4),
    clickSelectors: 'a, button, [role="button"], input[type="submit"], span[role="button"]',
  });

  try {
    await session.nav('sitescan');
    report.steps.before = await session.evaluate(`(() => {
      const body = document.body?.innerText || '';
      const idx = body.search(/HUNDESALON SEO scan/i);
      const slice = idx >= 0 ? body.slice(idx, idx + 500) : '';
      const status = slice.match(/(Queued|Scanning|In progress|Completed|Failed|Cancelled)/i)?.[1] || 'unknown';
      return {
        found: idx >= 0,
        status,
        inProgress: /^(queued|scanning|in progress)$/i.test(status),
      };
    })()`);

    if (report.steps.before?.found && report.steps.before?.inProgress) {
      console.log('Stopping stuck scan…');
      report.steps.stop = await stopBingSiteScan(session);
      await session.send('Page.reload', { ignoreCache: true });
      await sleep(6000);
    }

    const afterStop = await session.evaluate(`(() => {
      const body = document.body?.innerText || '';
      return {
        hasRow: /HUNDESALON SEO scan/i.test(body),
        cancelled: /cancelled|stopped|failed/i.test(body),
      };
    })()`);

    if (afterStop.hasRow && !afterStop.cancelled) {
      console.log('Deleting old scan row…');
      report.steps.delete = await deleteBingSiteScan(session);
      await session.send('Page.reload', { ignoreCache: true });
      await sleep(6000);
    }

    console.log('Starting new scan…');
    report.steps.start = await startBingSiteScan(session, options);
    await sleep(3000);
    report.steps.after = await session.evaluate(`(() => {
      const body = document.body?.innerText || '';
      const idx = body.search(/HUNDESALON SEO scan/i);
      const slice = idx >= 0 ? body.slice(idx, idx + 500) : '';
      const status = slice.match(/(Queued|Scanning|In progress|Completed|Failed|Cancelled)/i)?.[1] || 'unknown';
      return { status, found: idx >= 0, row: slice.replace(/\\s+/g, ' ').trim().slice(0, 200) };
    })()`);

    report.ok = Boolean(report.steps.start?.success) || /queued|scanning|progress/i.test(report.steps.after?.status || '');
    return report;
  } finally {
    session.close();
  }
}

export function analyzeBingFindings(findingsPayload) {
  const findings = findingsPayload?.findings || [];
  const priorities = { p1: [], p2: [], p3: [] };

  for (const item of findings) {
    const text = item.text || '';
    if (/4\d\d|5\d\d|broken|missing title|missing meta|noindex|canonical|hreflang/i.test(text)) {
      priorities.p1.push(item);
    } else if (/warning|duplicate|http:\/\//i.test(text)) {
      priorities.p2.push(item);
    } else {
      priorities.p3.push(item);
    }
  }

  return {
    total: findings.length,
    priorities,
    recommendation:
      priorities.p1.length > 0
        ? 'Сначала исправить критические ошибки индексации и метаданных.'
        : priorities.p2.length > 0
          ? 'Устранить предупреждения по ссылкам и дублям.'
          : 'Критичных findings нет — поддерживать текущее качество.',
  };
}
