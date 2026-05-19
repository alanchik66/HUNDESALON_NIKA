/**
 * Quick post-deploy smoke: favicon path and canonical on production + Pages preview.
 */
const urls = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/',
];

const pagesDevHost = process.env.PAGES_DEV_HOST;
if (pagesDevHost) {
  urls.push(`https://${pagesDevHost}/de/`);
}

let failed = false;

for (const url of urls) {
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const text = await response.text();
  const canonical = text.match(/rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] || 'MISSING';
  const faviconOk = text.includes('/favicon.ico') || text.includes('/assets/images/favicon/favicon.ico');

  console.log(url);
  console.log(
    `  status=${response.status} cf-cache=${response.headers.get('cf-cache-status')} age=${response.headers.get('age')}`
  );
  console.log(`  favicon=${faviconOk}`);
  console.log(`  canonical=${canonical}`);

  if (!response.ok || !faviconOk || canonical === 'MISSING') {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
