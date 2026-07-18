/**
 * Sync sameAs + LocalBusiness description from config/brand-profiles.mjs into index pages.
 * npm run brand:profiles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAME_AS, NAP } from '../config/brand-profiles.mjs';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexFiles = ['de/index.html', 'en/index.html', 'ru/index.html', 'uk/index.html'];

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

function updateJsonLd(html, lang) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, raw) => {
    try {
      const json = JSON.parse(raw);
      const graph = Array.isArray(json['@graph']) ? json['@graph'] : [json];
      for (const node of graph) {
        if (!node || typeof node !== 'object') continue;
        if (node['@type'] === 'Organization' || node['@type'] === 'LocalBusiness') {
          node.sameAs = [...SAME_AS];
        }
        if (node['@type'] === 'LocalBusiness') {
          node.description = businessDesc[lang] || businessDesc.de;
          node.url = `https://hundesalon-nika.com/${lang}/`;
        }
      }
      const indent = match.match(/^(\s*)<script/)?.[1] ?? '    ';
      const body = JSON.stringify(json, null, 2)
        .split('\n')
        .map(line => `${indent}${line}`)
        .join('\n');
      return `<script type="application/ld+json">\n${body}\n${indent}</script>`;
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
for (const rel of indexFiles) {
  const full = path.join(root, rel);
  const lang = langFromPath(rel);
  const before = fs.readFileSync(full, 'utf8');
  const after = updateJsonLd(before, lang);
  if (after !== before) {
    fs.writeFileSync(full, after, 'utf8');
    report.updated.push(rel);
  }
}

updateLlmsTxt();
console.log(JSON.stringify({ ...report, sameAsCount: SAME_AS.length }, null, 2));
