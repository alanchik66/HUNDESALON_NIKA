import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { SHOP_COPY } from '../assets/js/shop-catalog.js';

const escape = value =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const bag =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg>';

function art(kind, suffix) {
  const id = `${kind}-${suffix}`;
  const bottle = (x, y, scale, spray = false) =>
    `<g transform="translate(${x} ${y}) scale(${scale})"><rect x="33" y="0" width="54" height="20" rx="4" fill="url(#${id}-gold)"/>${spray ? `<path d="M44 0v-15h59v9H68V0" fill="url(#${id}-gold)"/>` : ''}<path d="M32 18h56v19c0 11 23 14 23 35v132c0 10-8 18-18 18H27c-10 0-18-8-18-18V72c0-21 23-24 23-35Z" fill="url(#${id}-glass)" stroke="#caa65c" stroke-opacity=".7"/><path d="M19 78v111" stroke="#ebd39c" opacity=".3" stroke-width="3"/><rect x="17" y="91" width="86" height="91" rx="2" fill="#09241c" stroke="#bda16c" stroke-opacity=".5"/><path d="m47 108 3 13h20l3-13-10 7-3-10-4 10Z" fill="#dfbf79"/><text x="60" y="147" text-anchor="middle" fill="#e8cd8b" font-family="Georgia,serif" font-size="20" letter-spacing="3">NIKA</text><path d="M38 159h44" stroke="#ba9857"/><text x="60" y="172" text-anchor="middle" fill="#c6ad73" font-family="Arial,sans-serif" font-size="6" letter-spacing="3">CARE RITUAL</text></g>`;
  const brush = `<g transform="translate(139 46) rotate(22 30 75)"><rect x="22" y="125" width="20" height="95" rx="10" fill="url(#${id}-gold)"/><rect x="0" y="10" width="64" height="125" rx="30" fill="#17352a" stroke="#c7a75e" stroke-width="2"/>${[14, 24, 34, 44, 54].map(x => `<path d="M${x} 34v72" stroke="#bda66e" stroke-width="2" stroke-dasharray="2 7"/>`).join('')}<rect x="5" y="16" width="54" height="114" rx="26" fill="none" stroke="#bda66e" stroke-opacity=".35"/></g>`;
  const paw = `<g fill="none" stroke="url(#${id}-gold)" stroke-width="3"><path d="M136 165c-25 0-52 26-47 44 5 20 29 9 47 9s42 11 47-9c5-18-22-44-47-44Z"/><ellipse cx="91" cy="152" rx="14" ry="21" transform="rotate(-28 91 152)"/><ellipse cx="118" cy="133" rx="14" ry="21"/><ellipse cx="150" cy="133" rx="14" ry="21"/><ellipse cx="179" cy="152" rx="14" ry="21" transform="rotate(28 179 152)"/></g>`;
  const cat = `<g fill="none" stroke="url(#${id}-gold)" stroke-width="2.5" stroke-linecap="round"><path d="M91 190c-12-15-16-39-8-59l-1-50 36 29c14-4 30-4 44 0l36-29-1 50c8 20 4 44-8 59-24 31-74 31-98 0Z"/><path d="m104 152 12 4m47 0 12-4m-41 27 6 5 6-5m-6 5v9m-42-17-31-5m31 17-31 5m115-17 31-5m-31 17 31 5"/></g>`;
  const content =
    kind === 'hero' || kind === 'sets'
      ? `${bottle(46, 57, 0.86)}${bottle(157, 94, 0.64, true)}${kind === 'hero' ? `<g opacity=".75">${brush}</g>` : ''}`
      : kind === 'tools'
        ? brush
        : kind === 'cats'
          ? cat
          : kind === 'paws'
            ? `${bottle(24, 112, 0.45)}${paw}`
            : bottle(91, 45, 0.95, kind === 'coat');
  return `<svg class="shop-art shop-art--${kind}" viewBox="0 0 300 300" fill="none" aria-hidden="true"><defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#84612e"/><stop offset=".33" stop-color="#f4df9c"/><stop offset=".6" stop-color="#b68b43"/><stop offset="1" stop-color="#e8cb83"/></linearGradient><linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="#07120f"/><stop offset=".43" stop-color="#294d3b"/><stop offset=".63" stop-color="#15392b"/><stop offset="1" stop-color="#071711"/></linearGradient></defs><ellipse cx="150" cy="270" rx="104" ry="14" fill="#000" opacity=".28"/><circle cx="150" cy="147" r="110" stroke="#c7a75e" stroke-opacity=".1"/>${content}</svg>`;
}

for (const [locale, c] of Object.entries(SHOP_COPY)) {
  const alternates = Object.keys(SHOP_COPY)
    .map(lang => `<link rel="alternate" hreflang="${lang}" href="https://hundesalon-nika.com/${lang}/shop">`)
    .join('\n');
  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(c.title)}</title>
  <meta name="description" content="${escape(c.description)}">
  <link rel="canonical" href="https://hundesalon-nika.com/${locale}/shop">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="https://hundesalon-nika.com/de/shop">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(c.title)}">
  <meta property="og:description" content="${escape(c.description)}">
  <meta property="og:url" content="https://hundesalon-nika.com/${locale}/shop">
  <meta property="og:image" content="https://hundesalon-nika.com/assets/images/brand/hero-dog.webp">
  <meta name="theme-color" content="#071710">
  <link rel="icon" href="/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Forum&family=Great+Vibes&family=Marck+Script&display=swap">
  <link rel="stylesheet" href="../assets/css/style.css?v=20261026-shop">
  <link rel="stylesheet" href="../assets/fonts/fontawesome/all.min.css?v=20260329-0192">
  <link rel="stylesheet" href="../assets/css/shop.css?v=20261026-shop">
  <link rel="stylesheet" href="../assets/css/cookie-consent.css?v=20260620-full-stack-upgrade">
  <script src="../assets/js/analytics.js?v=20260721-ads-all"></script>
</head>
<body class="shop-page">
  <a class="shop-skip" href="#shop-main">${escape(c.catalogTitle)}</a>
  <header class="header"></header>
  <div id="mobile-nav-overlay" hidden aria-hidden="true"></div>
  <nav id="mobile-nav" aria-hidden="true"></nav>
  <main id="shop-main" class="shop-main">
    <button class="header-online-btn online-order-pill shop-basket-trigger" type="button" data-cart-open data-nav-pill aria-haspopup="dialog" aria-controls="shop-cart" hidden><span class="header-online-btn__label">${bag}<span>${escape(c.cart)}</span><span class="shop-basket-count" data-cart-count hidden></span></span></button>
    <section class="shop-hero shop-container" aria-labelledby="shop-title">
      <div class="shop-hero-copy">
        <p class="shop-eyebrow">${escape(c.eyebrow)}</p>
        <h1 id="shop-title">${escape(c.heading)}<br><em>${escape(c.accent)}</em></h1>
        <p class="shop-intro">${escape(c.intro)}</p>
        <div class="shop-actions"><a class="btn-neon shop-button" data-nav-pill href="#collections">${escape(c.explore)}</a><a class="btn-neon shop-button" data-nav-pill href="kontakty.html">${escape(c.consult)}</a></div>
        <p class="shop-launch"><span aria-hidden="true"></span>${escape(c.preparing)}</p>
      </div>
      <figure class="shop-hero-stage">
        <span class="shop-stage-word" aria-hidden="true">NIKA</span>
        <span class="shop-stage-orbit" aria-hidden="true"></span>
        ${art('hero', locale)}
        <div class="shop-stage-seal" aria-hidden="true"><span>N</span><small>CARE<br>AT HOME</small></div>
        <figcaption>${escape(c.art)}</figcaption>
      </figure>
    </section>
    <div class="shop-values shop-container">${c.strip.map((value, i) => `<span><span aria-hidden="true">${['✧', '◇', '✦'][i]}</span>${escape(value)}</span>`).join('')}</div>
    <section class="shop-section shop-container" id="collections" aria-labelledby="collections-title">
      <div class="shop-section-heading"><div><p class="shop-eyebrow">${escape(c.collectionsLabel)}</p><h2 id="collections-title">${escape(c.collectionsTitle)}</h2></div><p>${escape(c.collectionsIntro)}</p></div>
      <div class="shop-collections">${c.categories.map(([id, name, description, subtitle]) => `<a class="service-card shop-collection shop-collection--${id}" href="#catalog" data-collection="${id}"><div class="shop-collection-art">${art(id, locale)}<span class="shop-collection-arrow site-icon-arrow" aria-hidden="true"></span></div><div class="shop-collection-copy"><p class="shop-caption">${escape(subtitle)}</p><h3>${escape(name)}</h3><p>${escape(description)}</p></div></a>`).join('')}</div>
    </section>
    <section class="shop-catalog shop-section shop-container" id="catalog" aria-labelledby="catalog-title">
      <p class="shop-eyebrow">${escape(c.catalogLabel)}</p><h2 id="catalog-title">${escape(c.catalogTitle)}</h2><p class="shop-section-intro">${escape(c.catalogIntro)}</p>
      <div class="shop-catalog-controls" data-catalog-controls hidden>
        <div class="shop-filters" role="group" aria-label="${escape(c.filterLabel)}">${c.filters.map((label, i) => `<button class="btn-neon filter-btn" type="button" data-shop-filter="${['all', 'dog', 'cat', 'tools'][i]}" aria-pressed="${i === 0}">${escape(label)}</button>`).join('')}</div>
        <label class="shop-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="shop-sr-only">${escape(c.search)}</span><input type="search" maxlength="120" placeholder="${escape(c.search)}" data-shop-search></label>
      </div>
      <div class="shop-catalog-meta" data-catalog-controls hidden><p data-shop-results role="status" aria-live="polite">${escape(c.count)}: 0</p><button class="btn-neon shop-reset" type="button" data-shop-reset hidden>${escape(c.reset)}</button></div>
      <div class="shop-product-grid" data-shop-products></div>
      <div class="shop-empty" data-shop-empty><span class="shop-empty-icon" aria-hidden="true">${bag}</span><p class="shop-eyebrow">${escape(c.preparing)}</p><h3>${escape(c.emptyTitle)}</h3><p data-empty-text>${escape(c.emptyText)}</p><a class="btn-neon shop-button" data-nav-pill href="kontakty.html">${escape(c.consult)}</a></div>
    </section>
    <section class="shop-advice shop-container" aria-labelledby="advice-title">
      <div class="shop-advice-copy"><p class="shop-eyebrow">${escape(c.adviceLabel)}</p><h2 id="advice-title">${escape(c.adviceTitle)}</h2><p>${escape(c.adviceText)}</p><a class="btn-neon shop-button" data-nav-pill href="kontakty.html">${escape(c.consult)}</a></div>
      <ol class="shop-steps">${c.steps.map(([title, body], i) => `<li><span aria-hidden="true">0${i + 1}</span><div><h3>${escape(title)}</h3><p>${escape(body)}</p></div></li>`).join('')}</ol>
    </section>
    <section class="shop-faq shop-section shop-container" aria-labelledby="faq-title"><p class="shop-eyebrow">GOOD TO KNOW</p><h2 id="faq-title">${escape(c.faqTitle)}</h2><div class="shop-faq-grid">${c.faq.map(([q, a]) => `<details><summary>${escape(q)}<span aria-hidden="true">+</span></summary><p>${escape(a)}</p></details>`).join('')}</div></section>
  </main>
  <footer class="shop-footer shop-container"><div><a href="index.html" class="shop-footer-brand">HUNDESALON <span>NIKA</span></a><p>${escape(c.footer)}</p></div><nav aria-label="${escape(c.contacts)}"><a href="kontakty.html">${escape(c.contacts)}</a><a href="nashi-uslugi.html">${escape(c.services)}</a>${c.legal.map((text, i) => `<a href="${['impressum', 'datenschutz', 'agb'][i]}.html">${escape(text)}</a>`).join('')}</nav><small>© 2026 HUNDESALON_NIKA</small></footer>
  <dialog id="shop-cart" class="shop-cart" aria-labelledby="cart-title" data-cart-dialog><div class="shop-cart-head"><h2 id="cart-title">${escape(c.cart)}</h2><button class="modal-close shop-icon-button" type="button" data-cart-close aria-label="${escape(c.close)}">×</button></div><div class="shop-cart-content" data-cart-items></div><div class="shop-cart-summary" data-cart-summary hidden><p><span>${escape(c.total)}</span><strong data-cart-total></strong></p><p class="shop-cart-note">${escape(c.checkoutNote)}</p><a class="btn-neon shop-button" data-nav-pill data-cart-order href="kontakty.html">${escape(c.order)}</a></div></dialog>
  <p class="shop-sr-only" role="status" aria-live="polite" data-shop-announcement></p>
  <script src="../assets/js/site-shell.js?v=20261026-shop"></script>
  <script src="../assets/js/main.js?v=20260904-site-arrow-spin"></script>
  <script type="module" src="../assets/js/shop.js?v=20261026-shop"></script>
  <script src="../assets/js/cookie-consent.js?v=20260620-full-stack-upgrade"></script>
  <script src="../assets/js/pwa.js?v=20260707-sw-dev-fix"></script>
</body>
</html>
`;
  await writeFile(
    new URL(`../${locale}/shop.html`, import.meta.url),
    await format(html, { parser: 'html', printWidth: 120, htmlWhitespaceSensitivity: 'ignore' })
  );
  console.log(`${locale}/shop.html`);
}
