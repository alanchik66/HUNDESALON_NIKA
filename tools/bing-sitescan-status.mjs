/**
 * Quick Bing Site Scan status (no polling).
 * npm run bing:sitescan-status
 */
import { openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { siteQuery } from './lib/bing-wmt.mjs';

const session = await openBingWebmasterSession({
  port: Number(process.env.BING_MAIL_EDGE_PORT || 9224),
  siteQ: siteQuery(),
  waitMs: Number(process.env.BING_CDP_WAIT_MS || 10_000),
  reloadAttempts: Number(process.env.BING_CDP_RELOAD_ATTEMPTS || 4),
});

try {
  await session.nav('sitescan');
  const data = await session.eval(`
    const body = document.body?.innerText || '';
    const idx = body.search(/HUNDESALON SEO scan/i);
    const slice = idx >= 0 ? body.slice(idx, idx + 500) : '';
    const row = slice.replace(/\\s+/g, ' ').trim();
    const status =
      slice.match(/(Queued|Scanning|In progress|Completed|Failed|Cancelled|Заверш|Сканир|В очереди)/i)?.[1] ||
      'unknown';
    const timeAgo = slice.match(/(\\d+\\s+(?:minutes?|hours?|days?)\\s+ago|\\d+\\s+(?:мин|час|дн).*назад)/i)?.[1] || null;
    const metrics = slice
      .replace(/\\d+\\s+(?:minutes?|hours?|days?)\\s+ago/gi, '')
      .replace(/\\d+\\s+row/gi, '')
      .split(/\\s+/)
      .filter(token => /^\\d+$/.test(token));
    const found = idx >= 0;

    return {
      at: new Date().toISOString(),
      found,
      status,
      timeAgo,
      pages: metrics[0] ?? null,
      errors: metrics[1] ?? null,
      warnings: metrics[2] ?? null,
      row,
      completed: /completed|заверш/i.test(status),
      inProgress: /queued|scanning|progress|очеред|сканир|выполня/i.test(status),
      bodyChars: body.length,
    };
  `);
  console.log(JSON.stringify(data, null, 2));
  if (!data.found) process.exit(2);
} finally {
  session.close();
}
