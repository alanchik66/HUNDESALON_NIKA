import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langs = ['de', 'en', 'ru', 'uk'];
const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'agent-tools', '.wrangler']);

const replacements = [
  ['https://hundesalon-nika.com/de/blog.html', 'https://hundesalon-nika.com/de/blog/'],
  ['https://hundesalon-nika.com/en/blog.html', 'https://hundesalon-nika.com/en/blog/'],
  ['https://hundesalon-nika.com/ru/blog.html', 'https://hundesalon-nika.com/ru/blog/'],
  ['https://hundesalon-nika.com/uk/blog.html', 'https://hundesalon-nika.com/uk/blog/'],
  ['https://www.hundesalon-nika.com/de/blog.html', 'https://www.hundesalon-nika.com/de/blog/'],
  ['https://www.hundesalon-nika.com/en/blog.html', 'https://www.hundesalon-nika.com/en/blog/'],
  ['https://www.hundesalon-nika.com/ru/blog.html', 'https://www.hundesalon-nika.com/ru/blog/'],
  ['https://www.hundesalon-nika.com/uk/blog.html', 'https://www.hundesalon-nika.com/uk/blog/'],
  ['/de/blog.html', '/de/blog/'],
  ['/en/blog.html', '/en/blog/'],
  ['/ru/blog.html', '/ru/blog/'],
  ['/uk/blog.html', '/uk/blog/'],
  ['href="../blog.html"', 'href="index.html"'],
  ['${pathPrefix}blog.html', '${pathPrefix}blog/'],
  ['href="blog/', 'href="'],
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

for (const lang of langs) {
  const source = path.join(root, lang, 'blog.html');
  const targetDir = path.join(root, lang, 'blog');
  const target = path.join(targetDir, 'index.html');
  if (!fs.existsSync(source)) continue;
  fs.mkdirSync(targetDir, { recursive: true });
  let content = fs.readFileSync(source, 'utf8');
  content = content.replaceAll('../assets/', '../../assets/');
  content = content.replaceAll('../3d-weather-codrops-main/', '../../3d-weather-codrops-main/');
  fs.writeFileSync(target, content, 'utf8');
  fs.unlinkSync(source);
  console.log(`Moved ${lang}/blog.html -> ${lang}/blog/index.html`);
}

let updatedFiles = 0;
for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  if (ignoreDirs.has(relative.split('/')[0])) continue;
  if (relative.endsWith('/blog/index.html')) continue;
  if (!/\.(?:html|js|mjs|xml|txt|json|css|md)$/i.test(relative)) continue;
  if (relative === 'tools/move-blog-to-folder.mjs') continue;

  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of replacements) {
    content = content.split(from).join(to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    updatedFiles += 1;
  }
}

console.log(`Updated ${updatedFiles} files with blog/ paths.`);
