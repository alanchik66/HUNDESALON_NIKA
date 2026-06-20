const SUPPORTED_LANGS = new Set(['de', 'ru', 'uk', 'en']);

function pickLanguage(acceptLanguage = '') {
  const candidates = String(acceptLanguage || '')
    .split(',')
    .map((item) => item.split(';')[0].trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const primary = candidate.split('-')[0];
    if (primary === 'ua') return 'uk';
    if (SUPPORTED_LANGS.has(primary)) return primary;
  }

  return 'de';
}

/** www /robots.txt → apex (www only received CF managed block without site rules). */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.hundesalon-nika.com' && url.pathname === '/robots.txt') {
    return Response.redirect('https://hundesalon-nika.com/robots.txt', 301);
  }

  if (
    context.request.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html') &&
    (context.request.headers.get('Accept') || '').includes('text/html')
  ) {
    const lang = pickLanguage(context.request.headers.get('Accept-Language'));
    return Response.redirect(`${url.origin}/${lang}/${url.search}`, 302);
  }

  return context.next();
}
