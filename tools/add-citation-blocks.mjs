/**
 * Add official profiles / citation block to kontakty pages (4 langs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_PROFILES } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'data-citation-profiles';

const COPY = {
  de: {
    title: 'Offizielle Profile & Zitation',
    lead: 'Verlinken Sie HUNDESALON NIKA mit unserer Haupt-URL und verifizierten Profilen:',
    maps: 'Google Maps — HUNDESALON NIKA Leipzig',
    social: 'Alle Social-Media-Kanäle',
  },
  en: {
    title: 'Official profiles & citation',
    lead: 'Link to HUNDESALON NIKA using our canonical URL and verified profiles:',
    maps: 'Google Maps — HUNDESALON NIKA Leipzig',
    social: 'All social channels',
  },
  ru: {
    title: 'Официальные профили и цитирование',
    lead: 'Ссылайтесь на HUNDESALON NIKA через основной URL и подтверждённые профили:',
    maps: 'Google Maps — HUNDESALON NIKA Leipzig',
    social: 'Все соцсети салона',
  },
  uk: {
    title: 'Офіційні профілі та цитування',
    lead: 'Посилання на HUNDESALON NIKA через основну URL та перевірені профілі:',
    maps: 'Google Maps — HUNDESALON NIKA Leipzig',
    social: 'Усі соцмережі салону',
  },
};

function block(lang) {
  const t = COPY[lang];
  const home = `https://hundesalon-nika.com/${lang}/`;
  return `      <div class="container contact-citations" ${marker}>
        <div class="section-block">
          <h2 class="section-title">${t.title}</h2>
          <p>${t.lead}</p>
          <ul>
            <li><a href="${home}" rel="canonical">${home}</a></li>
            <li>
              <a href="${BRAND_PROFILES.googleMaps}" rel="me noopener noreferrer" target="_blank">${t.maps}</a>
            </li>
            <li>
              <a href="${BRAND_PROFILES.instagram}" rel="me noopener noreferrer" target="_blank">Instagram @hundesalon_nika</a>
            </li>
            <li><a href="social.html">${t.social}</a></li>
          </ul>
        </div>
      </div>
`;
}

for (const lang of ['de', 'en', 'ru', 'uk']) {
  const file = path.join(root, lang, 'kontakty.html');
  let html = fs.readFileSync(file, 'utf8');
  const brokenInner = /\s*<\/div>\s*\n\s*<div class="container contact-citations"/;
  if (brokenInner.test(html) && !html.includes(`</div>\n      <div class="container contact-citations"`)) {
    html = html.replace(brokenInner, '\n      </div>\n      <div class="container contact-citations"');
  }

  html = html.replace(/\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<div class="container">\s*\n\s*<div class="contact-form">/, `
      </div>
      <div class="container">
        <div class="contact-form">`);

  if (html.includes(marker)) {
    html = html.replace(
      new RegExp(`\\s*<div class="container contact-citations" ${marker}>[\\s\\S]*?</div>\\s*(?=\\s*<div class="container">\\s*\\n\\s*<div class="contact-form">)`),
      `\n${block(lang)}`
    );
  } else {
    html = html.replace(
      /(\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<div class="container">\s*\n\s*<div class="contact-form">)/,
      `\n      </div>\n${block(lang)}$1`
    );
  }
  html = html.replace(
    'href="https://maps.google.com/?q=Walter-Markov-Ring+1%2C+04288+Leipzig"',
    `href="${BRAND_PROFILES.googleMaps}"`
  );
  fs.writeFileSync(file, html, 'utf8');
  console.log(`citation block: ${lang}/kontakty.html`);
}
