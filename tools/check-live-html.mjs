/**
 * Quick post-deploy smoke: favicon path and canonical on production + Pages preview.
 */
const htmlUrls = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/ru/',
];

const redirectChecks = [
  {
    from: 'https://hundesalon-nika.com/',
    to: 'https://hundesalon-nika.com/de/',
  },
];

const pagesDevHost = process.env.PAGES_DEV_HOST;
if (pagesDevHost) {
  htmlUrls.push(`https://${pagesDevHost}/de/`);
  htmlUrls.push(`https://${pagesDevHost}/ru/`);
  redirectChecks.push({
    from: `https://${pagesDevHost}/`,
    to: `https://${pagesDevHost}/de/`,
  });
}

let failed = false;

for (const { from, to } of redirectChecks) {
  const response = await fetch(from, {
    redirect: 'manual',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  const location = response.headers.get('location') || '';
  const resolved = location ? new URL(location, from).href : 'MISSING';

  console.log(from);
  console.log(
    `  status=${response.status} cf-cache=${response.headers.get('cf-cache-status')} age=${response.headers.get('age')}`
  );
  console.log(`  redirect=${resolved}`);

  if (![301, 302, 307, 308].includes(response.status) || resolved !== to) {
    failed = true;
  }
}

for (const url of htmlUrls) {
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
