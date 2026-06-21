const SUPPORTED_LANGS = new Set(['de', 'ru', 'uk', 'en']);

const UNSUPPORTED_AGENT_ENDPOINTS = new Map([
  [
    '/.well-known/http-message-signatures-directory',
    'Web Bot Auth request signing is not published for this public marketing site.',
  ],
  [
    '/.well-known/oauth-authorization-server',
    'HUNDESALON NIKA does not operate a public OAuth authorization server for agents.',
  ],
  [
    '/.well-known/openid-configuration',
    'HUNDESALON NIKA does not operate a public OpenID Connect issuer for agents.',
  ],
  [
    '/.well-known/oauth-protected-resource',
    'There is no public protected-resource metadata because the published website API is unauthenticated.',
  ],
  ['/auth.md', 'Agent registration is not available because no public agent OAuth flow is offered.'],
  ['/.well-known/mcp/server-card.json', 'No public MCP server is deployed for this domain.'],
  ['/.well-known/mcp/server-cards.json', 'No public MCP server is deployed for this domain.'],
  ['/.well-known/mcp.json', 'No public MCP server is deployed for this domain.'],
  ['/.well-known/agent-card.json', 'No public A2A agent endpoint is deployed for this domain.'],
  ['/.well-known/ucp', 'No Universal Commerce Protocol profile is published for this salon website.'],
  ['/.well-known/acp.json', 'No Agentic Commerce Protocol discovery document is published for this salon website.'],
]);

const COUNTRY_LANGUAGE_MAP = new Map([
  ['de', new Set(['DE', 'AT', 'CH', 'LI', 'LU'])],
  ['en', new Set(['US', 'GB', 'IE', 'CA', 'AU', 'NZ'])],
  ['ru', new Set(['RU', 'BY', 'KZ', 'KG'])],
  ['uk', new Set(['UA'])],
]);

const MARKDOWN_PAGE_PATH = /^\/(?:index\.html)?$|^\/(?:de|en|ru|uk)\/(?:index\.html)?$/;

function pickLanguage(acceptLanguage = '', country = '') {
  const candidates = String(acceptLanguage || '')
    .split(',')
    .map((item) => item.split(';')[0].trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const primary = candidate.split('-')[0];
    if (primary === 'ua') return 'uk';
    if (SUPPORTED_LANGS.has(primary)) return primary;
  }

  const countryCode = String(country || '').trim().toUpperCase();
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

async function staticAssetAlias(context, pathname) {
  if (!context.env?.ASSETS?.fetch) return context.next();

  const url = new URL(context.request.url);
  url.pathname = pathname;
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request));
}

function unsupportedAgentEndpointResponse(pathname, message, method) {
  const publicDiscovery = [
    '/.well-known/api-catalog',
    '/.well-known/openapi.json',
    '/.well-known/agent-skills/index.json',
    '/llms.txt',
  ];

  if (pathname === '/auth.md') {
    const body = [
      '# HUNDESALON NIKA Agent Authentication',
      '',
      message,
      '',
      'Public discovery documents:',
      ...publicDiscovery.map((path) => `- https://hundesalon-nika.com${path}`),
      '',
    ].join('\n');

    return new Response(method === 'HEAD' ? null : body, {
      status: 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    });
  }

  const body = JSON.stringify(
    {
      error: 'not_available',
      endpoint: pathname,
      message,
      publicDiscovery,
    },
    null,
    2
  );

  return new Response(method === 'HEAD' ? null : body, {
    status: 404,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}

function appendVary(headers, value) {
  const current = headers.get('Vary');
  if (!current) {
    headers.set('Vary', value);
    return;
  }

  const parts = new Set(current.split(',').map((item) => item.trim()).filter(Boolean));
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
    .some((item) => item.trim().startsWith('text/markdown'));
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function inlineText(fragment) {
  return decodeHtml(String(fragment || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function absoluteUrl(href, sourceUrl) {
  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return href;
  }
}

function htmlToMarkdown(html, sourceUrl) {
  const title = inlineText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'HUNDESALON NIKA');
  const description = inlineText(
    html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] || ''
  );
  let content = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;

  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_, alt) => (alt ? ` ${decodeHtml(alt)} ` : ' '))
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = inlineText(label);
      return text ? `[${text}](${absoluteUrl(href, sourceUrl)})` : absoluteUrl(href, sourceUrl);
    })
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => {
      return `\n\n${'#'.repeat(Number(level))} ${inlineText(text)}\n\n`;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, text) => `\n- ${inlineText(text)}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|header|footer|nav|main|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');

  const body = decodeHtml(content)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

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
    statusText: response.statusText,
    headers,
  });
}

/** Root language routing + www/robots.txt canonicalization. */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.startsWith('www.') && url.pathname === '/robots.txt') {
    const apexHost = url.hostname.slice(4);
    return redirectResponse(`https://${apexHost}/robots.txt`, 301);
  }

  if (['GET', 'HEAD'].includes(context.request.method) && url.pathname === '/openapi.json') {
    return staticAssetAlias(context, '/.well-known/openapi.json');
  }

  if (['GET', 'HEAD'].includes(context.request.method) && UNSUPPORTED_AGENT_ENDPOINTS.has(url.pathname)) {
    return unsupportedAgentEndpointResponse(
      url.pathname,
      UNSUPPORTED_AGENT_ENDPOINTS.get(url.pathname),
      context.request.method
    );
  }

  if (['GET', 'HEAD'].includes(context.request.method) && wantsMarkdown(context.request) && MARKDOWN_PAGE_PATH.test(url.pathname)) {
    return markdownResponse(context, url);
  }

  if (
    ['GET', 'HEAD'].includes(context.request.method) &&
    (url.pathname === '/' || url.pathname === '/index.html') &&
    (context.request.headers.get('Accept') || '').includes('text/html')
  ) {
    const lang = pickLanguage(
      context.request.headers.get('Accept-Language'),
      context.request.cf?.country
    );
    const target = new URL(`/${lang}/`, url.origin);
    target.search = url.search;
    return redirectResponse(target.toString(), 302);
  }

  return context.next();
}
