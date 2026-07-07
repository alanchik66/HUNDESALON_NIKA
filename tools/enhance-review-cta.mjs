/**
 * Google Maps review CTA with website mention on reyting.html (4 langs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_PROFILES } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'data-review-website-cta';
const mapsUrl = BRAND_PROFILES.googleMaps;

const COPY = {
  de: 'Bewerten Sie uns auf Google Maps — erwähnen Sie gern auch unsere Website',
  en: 'Rate us on Google Maps — feel free to mention our website in your review',
  ru: 'Оставьте отзыв в Google Maps — в тексте можно указать наш сайт',
  uk: 'Залиште відгук у Google Maps — у тексті можна вказати наш сайт',
};

const LINK = {
  de: 'https://hundesalon-nika.com/de/',
  en: 'https://hundesalon-nika.com/en/',
  ru: 'https://hundesalon-nika.com/ru/',
  uk: 'https://hundesalon-nika.com/uk/',
};

function cta(lang) {
  return `        <p class="review-website-cta" ${marker}>
          ${COPY[lang]}:
          <a href="${LINK[lang]}">${LINK[lang]}</a>
        </p>
`;
}

for (const lang of ['de', 'en', 'ru', 'uk']) {
  const file = path.join(root, lang, 'reyting.html');
  let html = fs.readFileSync(file, 'utf8');
  const block = cta(lang);

  html = html.replace(
    /href="https:\/\/www\.google\.com\/maps\/place\/[^"]+"/g,
    `href="${mapsUrl}"`
  );

  if (html.includes(marker)) {
    html = html.replace(
      new RegExp(`\\s*<p class="review-website-cta" ${marker}>[\\s\\S]*?</p>\\s*`),
      `\n${block}`
    );
  } else {
    html = html.replace(/(\s*<\/a>\s*\n\s*<div class="complaint-form">)/, `\n${block}$1`);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log(`review CTA: ${lang}/reyting.html`);
}
