/** Verify robots.txt: apex must have sitemaps; www should 301 to apex or match. */
const APEX = 'https://hundesalon-nika.com';
const WWW = 'https://www.hundesalon-nika.com';

function bodyOk(text) {
  return (
    /Sitemap:\s*https:\/\/hundesalon-nika\.com\/sitemap\.xml/i.test(text) &&
    /sitemap-brand\.xml/i.test(text) &&
    (!/User-agent:\s*Bingbot/i.test(text) || /Allow:\s*\//m.test(text))
  );
}

let failed = 0;

try {
  const r = await fetch(`${APEX}/robots.txt`, { signal: AbortSignal.timeout(20000) });
  const text = await r.text();
  if (r.ok && bodyOk(text)) {
    console.log(`OK apex (${text.length} bytes, ${text.split('\n').length} lines)`);
  } else {
    failed += 1;
    console.error(`FAIL apex HTTP ${r.status}`);
  }
} catch (e) {
  failed += 1;
  console.error(`FAIL apex: ${e.message}`);
}

try {
  const head = await fetch(`${WWW}/robots.txt`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  const loc = head.headers.get('location') || '';
  let wwwOk =
    head.status >= 301 && head.status < 400 && loc.includes('hundesalon-nika.com/robots.txt');
  if (!wwwOk && process.platform === 'win32') {
    const { execFileSync } = await import('node:child_process');
    const raw = execFileSync(
      'curl',
      ['-sS', '-I', `${WWW}/robots.txt`],
      { encoding: 'utf8', timeout: 20000 }
    );
    const status = Number(raw.match(/HTTP\/\S+\s+(\d+)/)?.[1] || 0);
    const curlLoc = raw.match(/^location:\s*(.+)$/im)?.[1]?.trim() || '';
    wwwOk = status >= 301 && status < 400 && curlLoc.includes('hundesalon-nika.com/robots.txt');
    if (wwwOk) console.log(`OK www → ${status} ${curlLoc} (curl)`);
  } else if (wwwOk) {
    console.log(`OK www → ${head.status} ${loc}`);
  }
  if (!wwwOk) {
    console.warn(
      'WARN www: edge may serve CF-only robots — Bing must use https://hundesalon-nika.com/robots.txt'
    );
  }
} catch (e) {
  console.warn(`WARN www check: ${e.message}`);
}

process.exit(failed ? 1 : 0);
