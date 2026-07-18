/**
 * Soft-404 self-check: missing paths must not return homepage 200.
 * Run after deploy: node tools/check-soft-404.mjs
 */
const samples = [
  'https://hundesalon-nika.com/missing-soft-404-check-xyz',
  'https://hundesalon-nika.com/ru/price-list.html',
  'https://hundesalon-nika.com/uk/booking.html',
  'https://hundesalon-nika.com/de/gallery.html',
  'https://hundesalon-nika.com/en/legal.html',
];

let failed = 0;
for (const url of samples) {
  const res = await fetch(url, { redirect: 'manual' });
  const status = res.status;
  const location = res.headers.get('location') || '';
  let note = '';
  if (status === 200) {
    const html = await res.text();
    const soft = /canonical" href="https:\/\/hundesalon-nika\.com\/de\/"/.test(html) && !url.endsWith('/de/');
    if (soft) {
      failed += 1;
      note = 'SOFT_404_HOMEPAGE';
    } else {
      note = '200_ok_content';
    }
  } else if (status >= 300 && status < 400) {
    note = `redirect→${location}`;
  } else {
    note = `status_${status}`;
  }
  console.log(`${status}\t${note}\t${url}`);
}

if (failed) {
  console.error(`FAIL: ${failed} soft-404 response(s)`);
  process.exit(1);
}
console.log('OK: no soft-404 homepage responses');
