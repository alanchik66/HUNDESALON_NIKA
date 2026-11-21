import { readFormDataBody, readJsonBody, isRequestBodyTooLarge } from './http-security.js';
import { MANAGED_LANGS, disabledSlugs, readSiteSettings, sectionForPath } from './site-settings.js';
import { applyPageCopy, escapeCopy, PAGE_LABELS, validLocale } from './page-copy.js';
import { applyTelegramEditorCopy } from './page-editor-telegram.js';
import { listPublishedSiteMedia } from './admin-media.js';
import { adminDatabase } from './site-admin-auth.js';

const CHANGEABLE_DOCUMENT = /^\/(?:de|en|ru|uk)(?:\/|$)|^\/reviews(?:\.html)?\/?$/;
const TELEGRAM_MENU = /^\/telegram-menu(?:\.html)?\/?$/;
const telegramSections = new Map([
  ['booking', 'booking'],
  ['prices', 'prices'],
  ['contact', 'contacts'],
]);
const endpointSections = new Map([
  ['/blog', 'blog'],
  ['/data/posts.json', 'blog'],
  ['/subscribe', 'newsletter'],
  ['/booking-availability', 'booking'],
  ['/upload', 'booking'],
  ['/payment', 'booking'],
  ['/api/maps-config', 'contacts'],
  ['/api/ai-chat', 'aiChat'],
  ['/api/ai-chat-session', 'aiChat'],
  ['/api/ai-chat-gifs', 'aiChat'],
  ['/api/ai-chat-upload', 'aiChat'],
  ['/api/ai-chat-upload-chunk', 'aiChat'],
]);

function publicError(status, method, api) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
    'Content-Type': api ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
  };
  const message = status === 404 ? 'Not found' : status === 503 ? 'Temporarily unavailable' : 'Invalid request';
  return new Response(method === 'HEAD' ? null : api ? JSON.stringify({ success: false, message }) : message, {
    status,
    headers,
  });
}

function uncacheable(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  for (const name of [
    'Content-Length',
    'Content-Range',
    'ETag',
    'Last-Modified',
    'CDN-Cache-Control',
    'Cloudflare-CDN-Cache-Control',
    'Accept-Ranges',
  ])
    headers.delete(name);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function sourceRequest(context) {
  const headers = new Headers(context.request.headers);
  const conditional = ['If-Modified-Since', 'If-None-Match', 'If-Range', 'Range'];
  if (!conditional.some(name => headers.has(name))) return context.next();
  for (const name of conditional) headers.delete(name);
  return context.next(new Request(context.request, { headers }));
}

async function submissionSection(request, isDraft) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  const copy = request.clone();
  const fields = ct.includes('application/json')
    ? await readJsonBody(copy, 65536)
    : Object.fromEntries(await readFormDataBody(copy, 65536));
  if (isDraft && !fields?.draft) return null;
  const type = String((isDraft ? fields.draft.formType : fields?.form_type) || '')
    .trim()
    .toLowerCase();
  if (type === 'booking' || type === 'client_registration') return 'booking';
  return type === 'feedback' ? 'reviews' : 'contacts';
}

function visibleSitemap(source, state) {
  const origin = 'https://hundesalon-nika.com';
  const published = new Set();
  const xml = source.replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, entry => {
    const loc = entry.match(/<loc>\s*([^<]+)\s*<\/loc>/)?.[1];
    if (!loc) return entry;
    const path = new URL(loc.trim(), origin).pathname;
    if (state.sections[sectionForPath(path)] === false) return '';
    published.add(path);
    return entry;
  });
  if (state.sections.promotions === false) return xml;
  const additions = MANAGED_LANGS.map(lang => '/' + lang + '/promotions')
    .filter(path => !published.has(path))
    .map(path => '<url><loc>' + origin + path + '</loc></url>')
    .join('\n');
  return xml.replace('</urlset>', additions + '\n</urlset>');
}

function transformHTML(response, state, url, path) {
  const disabled = Object.entries(state.sections)
    .filter(([, enabled]) => !enabled)
    .map(([key]) => key);
  const rewriter = new HTMLRewriter().on('html', {
    element(el) {
      el.setAttribute('data-disabled-sections', disabled.join(' '));
      el.setAttribute('data-disabled-paths', disabledSlugs(state).join(' '));
    },
  });
  if (disabled.length) {
    if (TELEGRAM_MENU.test(path)) {
      rewriter.on('button[data-route]', {
        element(el) {
          if (state.sections[telegramSections.get(el.getAttribute('data-route'))] === false) el.remove();
        },
      });
    }
    rewriter.on('a[href]', {
      element(el) {
        let target;
        try {
          target = new URL(el.getAttribute('href'), url);
        } catch {
          return;
        }
        if (
          target.origin !== url.origin &&
          !['https://hundesalon-nika.com', 'https://www.hundesalon-nika.com'].includes(target.origin)
        )
          return;
        if (state.sections[sectionForPath(target.pathname)] === false) el.remove();
      },
    });
    if (state.sections.newsletter === false)
      rewriter.on('[data-newsletter-section]', {
        element(el) {
          el.remove();
        },
      });
  }
  if (sectionForPath(path) === 'promotions') {
    const lang = path.split('/')[1];
    // The shipped cards are empty and hidden. Only explicitly published text is allowed into the response.
    rewriter.on('[data-promotion-id]', {
      element(el) {
        if (state.offers[el.getAttribute('data-promotion-id')]?.enabled) el.removeAttribute('hidden');
        else el.remove();
      },
    });
    let shown = 0;
    for (const offer of Object.values(state.offers)) {
      if (!offer.enabled) continue;
      shown++;
      for (const [field, text] of Object.entries(offer.locales[lang])) {
        rewriter.on('[data-promotion-id="' + offer.id + '"] [data-promo-field="' + field + '"]', {
          element(el) {
            el.setInnerContent(text, { html: false });
          },
        });
      }
    }
    if (shown)
      rewriter.on('[data-promotions-empty]', {
        element(el) {
          el.remove();
        },
      });
  }
  return rewriter.transform(response);
}

const mediaHeading = { de: 'Fotos und Videos', en: 'Photos and videos', ru: 'Фото и видео', uk: 'Фото та відео' };
const documentsHeading = { de: 'Dokumente', en: 'Documents', ru: 'Документы', uk: 'Документи' };
const galleryMediaHeadings = {
  de: ['Galeriefotos', 'Galerievideos'],
  en: ['Gallery photos', 'Gallery videos'],
  ru: ['Фото галереи', 'Видео галереи'],
  uk: ['Фото галереї', 'Відео галереї'],
};
const escapeAttribute = text => escapeCopy(text).replaceAll('"', '&quot;');

function renderMediaSection(items, heading, sectionId) {
  if (!items.length) return '';
  const cards = items.map(({ id, mime, title, alt }) => {
    const source = '/api/site-media?id=' + encodeURIComponent(id);
    const picture = mime.startsWith('video/')
      ? `<video src="${source}" controls playsinline preload="none" aria-label="${escapeAttribute(alt || title || heading)}"></video>`
      : `<img src="${source}" loading="lazy" decoding="async" alt="${escapeAttribute(alt || '')}">`;
    const caption = title ? `<figcaption>${escapeCopy(title)}</figcaption>` : '';
    return `<figure>${picture}${caption}</figure>`;
  });
  return `<section${sectionId ? ` id="${sectionId}"` : ''} class="site-managed-media"><h2>${heading}</h2><div class="site-managed-media__grid">${cards.join('')}</div></section>`;
}

export function renderPageMedia(locale, items, slug) {
  const photo = items.filter(item => item.mime.startsWith('image/'));
  const video = items.filter(item => item.mime.startsWith('video/'));
  const files = items.filter(item => !item.mime.startsWith('image/') && !item.mime.startsWith('video/'));
  const documents = files.length ? `<section class="site-managed-media"><h2>${documentsHeading[locale]}</h2><ul>${files.map(
    ({ id, title }) => `<li><a href="/api/site-media?id=${encodeURIComponent(id)}" download>${escapeCopy(title)}</a></li>`
  ).join('')}</ul></section>` : '';
  if (slug !== 'galereya') {
    return renderMediaSection(items.filter(item => item.mime.startsWith('image/') || item.mime.startsWith('video/')), mediaHeading[locale]) + documents;
  }
  const [photoHeading, videoHeading] = galleryMediaHeadings[locale];
  return renderMediaSection(photo, photoHeading, 'gallery-photos') +
    renderMediaSection(video, videoHeading, 'gallery-videos') + documents;
}

async function applyPageMedia(response, env, path) {
  const [, locale, ...parts] = path.replace(/\.html\/?$/, '').split('/');
  const slug = parts.join('/').replace(/\/$/, '') || 'index';
  if (!env?.CHAT_DB || !validLocale(locale) || (!PAGE_LABELS.has(slug) && slug !== 'promotions')) return response;
  const markup = renderPageMedia(locale, await listPublishedSiteMedia(adminDatabase(env), locale, slug), slug);
  if (!markup) return response;
  let inserted = false;
  return new HTMLRewriter()
    .on('footer.footer', { element(footer) {
      if (inserted) return;
      footer.before(markup, { html: true });
      inserted = true;
    } })
    .on('body', { element(body) {
      body.onEndTag(end => {
        if (!inserted) end.before(markup, { html: true });
      });
    } })
    .transform(response);
}

// Return null for unrelated routes so callbacks and payment fulfilment keep their own lifecycle.
export async function managedSiteResponse(context, url) {
  const { request, env } = context;
  let path;
  try {
    path = decodeURIComponent(url.pathname)
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/');
  } catch {
    return publicError(400, request.method, false);
  }
  // Some Pages build layouts also contain the source tree as assets.
  if (/^\/functions(?:\/|$)/i.test(path)) {
    return publicError(404, request.method, false);
  }
  const document = CHANGEABLE_DOCUMENT.test(path) || TELEGRAM_MENU.test(path);
  const sitemap = path === '/sitemap.xml';
  const route = path.replace(/\/$/, '');
  const isDraft = route === '/message-draft';
  const submission = (isDraft || route === '/sendmail' || route === '/sendmail.php') && request.method === 'POST';
  const endpoint = endpointSections.get(route);
  if (!document && !sitemap && !endpoint && !submission) return null;
  try {
    const state = await readSiteSettings(env);
    let section = endpoint || sectionForPath(path);
    if (submission && ['booking', 'reviews', 'contacts'].some(key => state.sections[key] === false)) {
      try {
        section = await submissionSection(request, isDraft);
      } catch (error) {
        return publicError(isRequestBodyTooLarge(error) ? 413 : 400, request.method, true);
      }
    }
    if (section && state.sections[section] === false) return publicError(404, request.method, !document);
    if (!document && !sitemap) return null;
    const response = uncacheable(await sourceRequest(context));
    if (!response.ok || request.method === 'HEAD') return response;
    if (sitemap) {
      return new Response(visibleSitemap(await response.text(), state), {
        status: response.status,
        headers: response.headers,
      });
    }
    if (!(response.headers.get('Content-Type') || '').includes('text/html')) return response;
    const edited = TELEGRAM_MENU.test(path) ? await applyTelegramEditorCopy(response, env) : await applyPageCopy(response, env, url);
    const marked =
      typeof HTMLRewriter === 'undefined' && !env?.CHAT_DB && !env?.SITE_ADMIN_KEY
        ? edited
        : transformHTML(edited, state, url, path);
    return await applyPageMedia(marked, env, path);
  } catch {
    return publicError(503, request.method, !!(endpoint || submission));
  }
}
