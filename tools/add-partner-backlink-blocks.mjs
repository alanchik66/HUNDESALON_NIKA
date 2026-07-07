/**
 * Partner backlink / citation block on partnerstvo.html (4 langs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_PROFILES, NAP } from '../config/brand-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = 'data-partner-backlink';

const COPY = {
  de: {
    title: 'Verlinken Sie uns — für Partner & Medien',
    lead: 'Tierärzte, Hundeschulen, Zoohandlungen und lokale Unternehmen: ein Link von Ihrer Website auf unseren Salon stärkt die Sichtbarkeit und hilft Tierbesitzern in Leipzig, uns zu finden.',
    urlLabel: 'Empfohlene URL',
    anchorLabel: 'Ankertext',
    anchor: 'HUNDESALON NIKA — Hundesalon & Grooming in Leipzig',
    snippetLabel: 'HTML zum Kopieren',
    profiles: 'Offizielle Profile & NAP',
  },
  en: {
    title: 'Link to us — for partners & press',
    lead: 'Vets, dog schools, pet shops and local businesses: a link from your website to our salon helps pet owners in Leipzig discover professional grooming.',
    urlLabel: 'Recommended URL',
    anchorLabel: 'Anchor text',
    anchor: 'HUNDESALON NIKA — dog grooming salon in Leipzig',
    snippetLabel: 'HTML to copy',
    profiles: 'Official profiles & NAP',
  },
  ru: {
    title: 'Ссылка на нас — для партнёров и СМИ',
    lead: 'Ветклиники, кинологи, зоомагазины и локальный бизнес: ссылка с вашего сайта на наш салон помогает владельцам питомцев в Лейпциге найти профессиональный груминг.',
    urlLabel: 'Рекомендуемый URL',
    anchorLabel: 'Текст ссылки',
    anchor: 'HUNDESALON NIKA — груминг-салон в Лейпциге',
    snippetLabel: 'HTML для копирования',
    profiles: 'Официальные профили и NAP',
  },
  uk: {
    title: 'Посилання на нас — для партнерів і ЗМІ',
    lead: 'Ветклініки, кінологи, зоомагазини та локальний бізнес: посилання з вашого сайту на наш салон допомагає власникам тварин у Лейпцигу знайти професійний грумінг.',
    urlLabel: 'Рекомендована URL',
    anchorLabel: 'Текст посилання',
    anchor: 'HUNDESALON NIKA — грумінг-салон у Лейпцигу',
    snippetLabel: 'HTML для копіювання',
    profiles: 'Офіційні профілі та NAP',
  },
};

function block(lang) {
  const t = COPY[lang];
  const home = `https://hundesalon-nika.com/${lang}/`;
  const snippet = `&lt;a href="${home}"&gt;${t.anchor}&lt;/a&gt;`;
  return `        <div class="partner-card" ${marker}>
          <h3>${t.title}</h3>
          <p>${t.lead}</p>
          <p><strong>${t.urlLabel}:</strong> <a href="${home}">${home}</a></p>
          <p><strong>${t.anchorLabel}:</strong> ${t.anchor}</p>
          <p><strong>${t.snippetLabel}:</strong></p>
          <pre class="partner-snippet"><code>${snippet}</code></pre>
          <p>
            <a href="kontakty.html">${t.profiles}</a>
            ·
            <a href="${BRAND_PROFILES.googleMaps}" target="_blank" rel="noopener noreferrer">Google Maps</a>
          </p>
          <p class="partner-nap"><small>${NAP.name} · ${NAP.street}, ${NAP.postalCode} ${NAP.locality} · ${NAP.phone}</small></p>
        </div>
`;
}

for (const lang of ['de', 'en', 'ru', 'uk']) {
  const file = path.join(root, lang, 'partnerstvo.html');
  let html = fs.readFileSync(file, 'utf8');
  const card = block(lang);

  const contactHeadings = {
    de: '<h3>Kontakt für Partner</h3>',
    en: '<h3>Partner contacts</h3>',
    ru: '<h3>Контакты для партнеров</h3>',
    uk: '<h3>Контакти для партнерів</h3>',
  };
  const contactAnchor = `        <div class="partner-card">\n          ${contactHeadings[lang]}`;

  if (html.includes(marker)) {
    html = html.replace(
      new RegExp(`\\s*<div class="partner-card" ${marker}>[\\s\\S]*?</div>\\s*(?=\\s*<div class="partner-card">)`),
      `\n${card}`
    );
  } else {
    html = html.replace(contactAnchor, `${card}${contactAnchor}`);
  }

  fs.writeFileSync(file, html, 'utf8');
  console.log(`partner backlink: ${lang}/partnerstvo.html`);
}
