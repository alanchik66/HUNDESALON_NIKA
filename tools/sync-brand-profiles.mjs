/**
 * Sync homepage profiles/NAP, shared fax metadata, and visible fax contact values.
 * npm run brand:profiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAME_AS, NAP } from '../config/brand-profiles.mjs';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexFiles = ['de/index.html', 'en/index.html', 'ru/index.html', 'uk/index.html'];
const serviceFiles = ['de/nashi-uslugi.html', 'en/nashi-uslugi.html', 'ru/nashi-uslugi.html', 'uk/nashi-uslugi.html'];
const contactFiles = ['de', 'en', 'ru', 'uk'].flatMap(lang => [
  `${lang}/kontakty.html`,
  `${lang}/impressum.html`,
]);

const businessDesc = {
  de: META_DESCRIPTIONS['index.html'].de,
  en: META_DESCRIPTIONS['index.html'].en,
  ru: META_DESCRIPTIONS['index.html'].ru,
  uk: META_DESCRIPTIONS['index.html'].uk,
};

function langFromPath(file) {
  return file.split('/')[0];
}

function pickSameAsHost(hostname) {
  return SAME_AS.find(url => {
    try {
      const host = new URL(url).hostname;
      return host === hostname || host.endsWith(`.${hostname}`);
    } catch {
      return false;
    }
  });
}

function updateJsonLd(html, lang, updateHomepage = true) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, raw) => {
    try {
      const json = JSON.parse(raw);
      const before = JSON.stringify(json);
      const graph = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      for (const node of graph) {
        if (!node || typeof node !== 'object') continue;
        if (node['@type'] === 'Organization' || node['@type'] === 'LocalBusiness') {
          node.faxNumber = NAP.fax.replace(/\s/g, '');
          if (updateHomepage) node.sameAs = [...SAME_AS];
        }
        if (node['@type'] === 'LocalBusiness' && updateHomepage) {
          node.description = businessDesc[lang] || businessDesc.de;
          node.url = `https://hundesalon-nika.com/${lang}/`;
          node.telephone = NAP.phone;
          node.email = NAP.email;
          node.address = {
            '@type': 'PostalAddress',
            streetAddress: NAP.street,
            addressLocality: NAP.locality,
            addressRegion: NAP.region,
            postalCode: NAP.postalCode,
            addressCountry: NAP.country,
          };
        }
      }
      if (JSON.stringify(json) === before) return match;
      const indent = raw.match(/(?:^|\n)([ \t]*)\{/)?.[1] ?? '';
      const closingIndent = raw.match(/\n([ \t]*)$/)?.[1] ?? '';
      const body = JSON.stringify(json, null, 2)
        .split('\n')
        .map(line => `${indent}${line}`)
        .join('\n');
      return `<script type="application/ld+json">\n${body}\n${closingIndent}</script>`;
    } catch {
      return match;
    }
  });
}

function updateLlmsTxt() {
  const file = path.join(root, 'llms.txt');
  let text = fs.readFileSync(file, 'utf8');
  const block = `## Official profiles (citation)

- Website: ${NAP.url}
- Google Maps: ${pickSameAsHost('google.com')}
- Instagram: ${pickSameAsHost('instagram.com')}
- Facebook: ${pickSameAsHost('facebook.com')}
- YouTube: ${pickSameAsHost('youtube.com')}
- TikTok: ${pickSameAsHost('tiktok.com')}
- Telegram: ${pickSameAsHost('t.me')}

## Citation (NAP)

- ${NAP.name}
- ${NAP.street}, ${NAP.postalCode} ${NAP.locality}, ${NAP.region}, ${NAP.country}
- Phone: ${NAP.phone}
- Fax: ${NAP.fax}
- Email: ${NAP.email}
`;

  if (/## Official profiles \(citation\)/.test(text)) {
    text = text.replace(/## Official profiles \(citation\)[\s\S]*$/, `${block.trim()}\n`);
  } else {
    text = `${text.replace(/\n*$/, '\n\n')}${block}`;
  }
  fs.writeFileSync(file, text, 'utf8');
}

const report = { updated: [] };
for (const rel of [...indexFiles, ...serviceFiles]) {
  const full = path.join(root, rel);
  const lang = langFromPath(rel);
  const before = fs.readFileSync(full, 'utf8');
  const after = updateJsonLd(before, lang, indexFiles.includes(rel));
  if (after !== before) {
    fs.writeFileSync(full, after, 'utf8');
    report.updated.push(rel);
  }
}

for (const rel of contactFiles) {
  const full = path.join(root, rel);
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(
    /(<span\b[^>]*\bdata-contact-fax\b[^>]*>)[^<]*(<\/span>)/g,
    (_, open, close) => `${open}${NAP.fax}${close}`
  );
  if (after !== before) {
    fs.writeFileSync(full, after, 'utf8');
    report.updated.push(rel);
  }
}

updateLlmsTxt();
console.log(JSON.stringify({ ...report, sameAsCount: SAME_AS.length }, null, 2));
