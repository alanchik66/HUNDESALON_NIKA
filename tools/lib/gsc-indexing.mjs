import { openCdpSession, sleep } from './browser-cdp.mjs';
import { GSC_ACCOUNT, GSC_SECTIONS, gscUrl } from './gsc-wmt.mjs';

const KEY_URLS = [
  'https://hundesalon-nika.com/',
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/en/',
  'https://hundesalon-nika.com/ru/',
  'https://hundesalon-nika.com/uk/',
];

export async function readGscIndexing(options = {}) {
  const port = Number(options.port || process.env.GSC_EDGE_PORT || process.env.BING_MAIL_EDGE_PORT || 9224);
  const session = await openCdpSession({
    port,
    targetPattern: /search\.google\.com\/search-console|accounts\.google\.com|bing\.com\/webmasters/i,
  });

  const { send, close } = session;

  try {
    const sections = {};
    const sectionEntries = options.quick
      ? [
          ['indexing', GSC_SECTIONS.indexing],
          ['manualActions', GSC_SECTIONS.manualActions],
          ['sitemaps', GSC_SECTIONS.sitemaps],
        ]
      : Object.entries(GSC_SECTIONS);

    for (const [id, path] of sectionEntries) {
      const url = gscUrl(path);
      await send('Page.navigate', { url });
      await sleep(Number(options.waitMs || 7000));

      sections[id] = await session.evaluate(`(() => {
        const body = document.body?.innerText || '';
        const loginRequired = /accounts\\.google\\.com/i.test(location.href) || /sign in|войти|anmelden/i.test(body.slice(0, 500));
        const numbers = [...body.matchAll(/\\b(\\d{1,6})\\b/g)].map(m => m[1]);
        const statusHints = [...new Set(
          body.split('\\n').map(l => l.trim()).filter(l =>
            l.length > 4 && l.length < 120 &&
            /indexed|not indexed|crawled|discovered|error|valid|submitted|sitemap|https|manual|security|warning|issue|страниц|проиндекс|ошиб/i.test(l)
          )
        )].slice(0, 40);

        return {
          url: location.href,
          title: document.title,
          loginRequired,
          account: ${JSON.stringify(GSC_ACCOUNT)},
          statusHints,
          bodySample: body.slice(0, 3500),
        };
      })()`);
    }

    const inspections = [];
    const inspectUrls = options.quick ? KEY_URLS.slice(0, 2) : KEY_URLS;
    for (const inspectUrl of inspectUrls) {
      const inspectPage = gscUrl('inspect', `&id=${encodeURIComponent(inspectUrl)}`);
      await send('Page.navigate', { url: inspectPage });
      await sleep(5000);
      const row = await session.evaluate(`(() => {
        const body = document.body?.innerText || '';
        const verdict = body.match(/(URL is on Google|URL is not on Google|URL will be indexed|Indexing requested|Page changed|Crawled|Discovered)/i)?.[0] || null;
        const issues = body.split('\\n').map(l => l.trim()).filter(l =>
          l.length > 8 && l.length < 200 &&
          /error|issue|warning|not indexed|excluded|redirect|canonical|noindex|blocked/i.test(l)
        ).slice(0, 12);
        return { url: ${JSON.stringify(inspectUrl)}, verdict, issues, sample: body.slice(0, 1800) };
      })()`);
      inspections.push(row);
    }

    return { at: new Date().toISOString(), sections, inspections };
  } finally {
    close();
  }
}

export function analyzeGscIndexing(payload) {
  const issues = [];
  const indexing = payload?.sections?.indexing;
  if (indexing?.loginRequired) {
    return { loginRequired: true, issues: ['Требуется вход в Google Search Console (gmail).'] };
  }

  for (const hint of indexing?.statusHints || []) {
    if (/not indexed|error|manual|security|blocked|excluded/i.test(hint)) issues.push({ source: 'indexing', text: hint });
  }

  for (const row of payload?.inspections || []) {
    if (row.verdict && /not on Google|not indexed/i.test(row.verdict)) {
      issues.push({ source: 'inspect', url: row.url, text: row.verdict });
    }
    for (const issue of row.issues || []) {
      issues.push({ source: 'inspect', url: row.url, text: issue });
    }
  }

  return {
    loginRequired: false,
    issueCount: issues.length,
    issues: issues.slice(0, 30),
    recommendation:
      issues.length > 0
        ? 'Проверить страницы с Not indexed и устранить блокировки/canonical/noindex.'
        : 'Индексация ключевых URL в норме — продолжать мониторинг.',
  };
}
