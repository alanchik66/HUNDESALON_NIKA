import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langs = ['de', 'en', 'ru', 'uk'];

const labelText = {
  de: 'E-Mail-Adresse',
  en: 'Email address',
  ru: 'Email',
  uk: 'Email',
};

function collectHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

let updated = 0;
let skipped = 0;

for (const lang of langs) {
  const langDir = path.join(root, lang);
  if (!fs.existsSync(langDir)) continue;

  const files = collectHtmlFiles(langDir);
  const text = labelText[lang];
  const inputId = `newsletter-email-${lang}`;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-newsletter-form')) {
      continue;
    }
    if (html.includes('newsletter-form__label')) {
      skipped += 1;
      continue;
    }

    const pattern = new RegExp(
      String.raw`(<input type="hidden" name="page" value="" />\s*\n\s*)<input type="email" name="email" placeholder="([^"]*)" autocomplete="email" required />`,
      'g'
    );

    const next = html.replace(
      pattern,
      `$1<label class="newsletter-form__label" for="${inputId}">${text}</label>\n            <input\n              id="${inputId}"\n              type="email"\n              name="email"\n              placeholder="$2"\n              autocomplete="email"\n              required\n            />`
    );

    if (next === html) {
      console.warn(`No match: ${path.relative(root, file)}`);
      continue;
    }

    fs.writeFileSync(file, next, 'utf8');
    updated += 1;
  }
}

console.log(`Updated ${updated} files, skipped ${skipped} (already labeled).`);
