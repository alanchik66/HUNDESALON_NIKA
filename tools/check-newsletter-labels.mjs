import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langs = ['de', 'en', 'ru', 'uk'];
const failures = [];

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

for (const lang of langs) {
  const langDir = path.join(root, lang);
  if (!fs.existsSync(langDir)) continue;

  for (const file of collectHtmlFiles(langDir)) {
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('data-newsletter-form')) continue;

    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    if (!html.includes('newsletter-form__label')) {
      failures.push(`${rel}: missing newsletter-form__label`);
      continue;
    }
    if (!html.includes(`id="newsletter-email-${lang}"`)) {
      failures.push(`${rel}: missing newsletter-email-${lang} input id`);
    }
    if (!html.includes(`for="newsletter-email-${lang}"`)) {
      failures.push(`${rel}: label for attribute does not match newsletter-email-${lang}`);
    }
  }
}

if (failures.length) {
  console.error('Newsletter label checks failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Newsletter label checks passed.');
