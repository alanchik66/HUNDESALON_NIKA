const SUPPORTED_LANGS = new Set(['de', 'ru', 'uk', 'en']);

const COUNTRY_LANGUAGE_MAP = new Map([
  ['de', new Set(['DE', 'AT', 'CH', 'LI', 'LU'])],
  ['en', new Set(['US', 'GB', 'IE', 'CA', 'AU', 'NZ'])],
  ['ru', new Set(['RU', 'BY', 'KZ', 'KG'])],
  ['uk', new Set(['UA'])],
]);

const MARKDOWN_PAGE_PATH = /^\/(?:index\.html)?$|^\/(?:de|en|ru|uk)\/(?:index\.html)?$/;

const FUNCTION_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' https://telegram.org https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.clarity.ms https://cdn.pulse.is https://static.sppopups.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.sunrise-sunset.org https://nominatim.openstreetmap.org https://worldtimeapi.org https://timeapi.io https://server.arcgisonline.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://google.com https://*.clarity.ms https://cdn.pulse.is https://lc.pulse.is wss://lc.pulse.is https://cb-wpayload.pulse.is https://geoip.sendpulse.com https://api.sppopups.com https://static-data.sppopups.com https://geo.sppopups.com",
    'frame-src https://open.spotify.com https://embed.music.apple.com',
    "worker-src 'self' blob:",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
});

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(FUNCTION_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function pickLanguage(acceptLanguage = '', country = '') {
  const candidates = String(acceptLanguage || '')
    .split(',')
    .map(item => item.split(';')[0].trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const primary = candidate.split('-')[0];
    if (primary === 'ua') return 'uk';
    if (SUPPORTED_LANGS.has(primary)) return primary;
  }

  const countryCode = String(country || '')
    .trim()
    .toUpperCase();
  if (countryCode) {
    for (const [lang, countries] of COUNTRY_LANGUAGE_MAP.entries()) {
      if (countries.has(countryCode)) {
        return lang;
      }
    }
  }

  return 'de';
}

function redirectResponse(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Accept-Language, CF-IPCountry',
    },
  });
}

function appendVary(headers, value) {
  const current = headers.get('Vary');
  if (!current) {
    headers.set('Vary', value);
    return;
  }

  const parts = new Set(
    current
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
  for (const item of value.split(',')) {
    const trimmed = item.trim();
    if (trimmed) parts.add(trimmed);
  }
  headers.set('Vary', [...parts].join(', '));
}

function wantsMarkdown(request) {
  return String(request.headers.get('Accept') || '')
    .toLowerCase()
    .split(',')
    .some(item => item.trim().startsWith('text/markdown'));
}

function decodeHtml(value) {
  let text = String(value || '');
  const replacements = [
    ['&nbsp;', ' '],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&quot;', '"'],
    ['&#39;', "'"],
    ['&amp;', '&'], // must be last to avoid double-unescaping &amp;lt; → &lt; → <
  ];

  for (const [needle, replacement] of replacements) {
    text = text.split(needle).join(replacement);
  }

  let output = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '&' || text[index + 1] !== '#') {
      output += text[index];
      continue;
    }

    const semicolonIndex = text.indexOf(';', index + 2);
    if (semicolonIndex < 0) {
      output += text[index];
      continue;
    }

    const entity = text.slice(index + 2, semicolonIndex);
    const isHex = entity.startsWith('x') || entity.startsWith('X');
    const code = Number.parseInt(isHex ? entity.slice(1) : entity, isHex ? 16 : 10);
    if (Number.isFinite(code)) {
      output += String.fromCodePoint(code);
      index = semicolonIndex;
      continue;
    }

    output += text[index];
  }

  return output;
}

function stripTags(html) {
  let output = '';
  let inTag = false;
  for (const char of String(html || '')) {
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (!inTag) {
      output += char;
    }
  }
  return output;
}

function collapseWhitespace(value) {
  let output = '';
  let previousWasSpace = false;
  for (const char of String(value || '')) {
    const isSpace = /\s/.test(char);
    if (isSpace) {
      if (!previousWasSpace) {
        output += ' ';
      }
      previousWasSpace = true;
      continue;
    }
    output += char;
    previousWasSpace = false;
  }
  return output.trim();
}

function extractTagText(html, tagName) {
  const source = String(html || '');
  const lower = source.toLowerCase();
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  const start = lower.indexOf(openTag);
  if (start < 0) {
    return '';
  }

  const startEnd = lower.indexOf('>', start);
  if (startEnd < 0) {
    return '';
  }

  const end = lower.indexOf(closeTag, startEnd + 1);
  if (end < 0) {
    return '';
  }

  return source.slice(startEnd + 1, end);
}

function removeTagSection(html, tagName) {
  const source = String(html || '');
  const lower = source.toLowerCase();
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let index = 0;
  let output = '';

  while (index < source.length) {
    const start = lower.indexOf(openTag, index);
    if (start < 0) {
      output += source.slice(index);
      break;
    }

    output += source.slice(index, start);
    const startEnd = lower.indexOf('>', start);
    if (startEnd < 0) {
      break;
    }

    const end = lower.indexOf(closeTag, startEnd + 1);
    if (end < 0) {
      break;
    }

    index = end + closeTag.length;
  }

  return output;
}

function htmlToMarkdown(html, sourceUrl) {
  const title = collapseWhitespace(decodeHtml(extractTagText(html, 'title') || 'HUNDESALON NIKA'));
  const bodyHtml = removeTagSection(removeTagSection(removeTagSection(String(html || ''), 'script'), 'style'), 'svg');
  const body = collapseWhitespace(decodeHtml(stripTags(bodyHtml)));
  const description = '';

  return [`# ${title}`, description, `Source: ${sourceUrl}`, body].filter(Boolean).join('\n\n');
}

async function markdownResponse(context, url) {
  const response = await context.next();
  const contentType = response.headers.get('Content-Type') || '';
  if (!response.ok || !contentType.includes('text/html')) {
    return response;
  }

  const markdown = htmlToMarkdown(await response.text(), url.toString());
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('X-Markdown-Tokens', String(markdown.split(/\s+/).filter(Boolean).length));
  headers.delete('Content-Length');
  appendVary(headers, 'Accept');

  return new Response(context.request.method === 'HEAD' ? null : markdown, {
    status: response.status,
    headers,
  });
}

/** Root language routing + www/robots.txt canonicalization. */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.startsWith('www.') && url.pathname === '/robots.txt') {
    const apexHost = url.hostname.slice(4);
    return withSecurityHeaders(redirectResponse(`https://${apexHost}/robots.txt`, 301));
  }

  if (
    ['GET', 'HEAD'].includes(context.request.method) &&
    wantsMarkdown(context.request) &&
    MARKDOWN_PAGE_PATH.test(url.pathname)
  ) {
    return withSecurityHeaders(await markdownResponse(context, url));
  }

  if (
    ['GET', 'HEAD'].includes(context.request.method) &&
    (url.pathname === '/' || url.pathname === '/index.html') &&
    (context.request.headers.get('Accept') || '').includes('text/html')
  ) {
    const lang = pickLanguage(context.request.headers.get('Accept-Language'), context.request.cf?.country);
    const target = new URL(`/${lang}/`, url.origin);
    target.search = url.search;
    return withSecurityHeaders(redirectResponse(target.toString(), 302));
  }

  return withSecurityHeaders(await context.next());
}
