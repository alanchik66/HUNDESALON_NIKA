const PAGES_ORIGIN = 'hundesalon-nika.pages.dev';
const PUBLIC_HOSTS = new Set(['hundesalon-nika.com', 'www.hundesalon-nika.com']);

function publicUrlFromPages(location, requestUrl) {
  if (!location) return location;

  try {
    const next = new URL(location, requestUrl);
    if (next.hostname === PAGES_ORIGIN) {
      next.hostname = new URL(requestUrl).hostname;
      return next.toString();
    }
  } catch {
    return location;
  }

  return location;
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);

    if (!PUBLIC_HOSTS.has(requestUrl.hostname)) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex',
        },
      });
    }

    const originUrl = new URL(request.url);
    originUrl.hostname = PAGES_ORIGIN;
    originUrl.protocol = 'https:';

    const originRequest = new Request(originUrl.toString(), request);
    originRequest.headers.set('X-Forwarded-Host', requestUrl.hostname);
    originRequest.headers.set('X-Forwarded-Proto', 'https');

    const response = await fetch(originRequest, { redirect: 'manual' });
    const headers = new Headers(response.headers);
    headers.set('X-Hundesalon-Origin', 'cloudflare-pages-proxy');

    const location = publicUrlFromPages(headers.get('Location'), request.url);
    if (location) headers.set('Location', location);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
