import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langs = ['de', 'en', 'ru', 'uk'];

const seoReplacements = [
  ['https://hundesalon-nika.com/de/blog.html', 'https://hundesalon-nika.com/de/blog/'],
  ['https://hundesalon-nika.com/en/blog.html', 'https://hundesalon-nika.com/en/blog/'],
  ['https://hundesalon-nika.com/ru/blog.html', 'https://hundesalon-nika.com/ru/blog/'],
  ['https://hundesalon-nika.com/uk/blog.html', 'https://hundesalon-nika.com/uk/blog/'],
];

for (const lang of langs) {
  const filePath = path.join(root, lang, 'blog', 'index.html');
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of seoReplacements) {
    content = content.split(from).join(to);
  }

  const articleSlugs = [
    'kak-podgotovit-sobaku',
    'preimushchestva-ekspress-linki',
    'plokhaya-strizhka',
    'strizhka-koshek',
    'zashchita-ot-parazitov',
  ];

  content = content.replace(/href="blog\//g, 'href="');
  for (const slug of articleSlugs) {
    content = content.replaceAll(`href="../${slug}.html"`, `href="${slug}.html"`);
    content = content.replaceAll(`href="${slug}.html"`, `href="${slug}.html"`);
  }

  const localePages = [
    'o-nas.html',
    'nashi-uslugi.html',
    'prays-list.html',
    'kontakty.html',
    'social.html',
    'impressum.html',
    'datenschutz.html',
    'onlayn-bronirovanie.html',
  ];
  for (const page of localePages) {
    content = content.replaceAll(`href="${page}"`, `href="../${page}"`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed links in ${lang}/blog/index.html`);
}

for (const lang of langs) {
  const filePath = path.join(root, lang, 'social.html');
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  content = content.replace(
    /href="(kak-podgotovit-sobaku|preimushchestva-ekspress-linki|plokhaya-strizhka|strizhka-koshek|zashchita-ot-parazitov)\.html"/g,
    'href="blog/$1.html"'
  );
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed social blog links in ${lang}/social.html`);
  }
}
