import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skip = new Set(['node_modules', 'dist', '.git', '.wrangler', '3d-weather-codrops-main']);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (skip.has(name)) continue;
      walk(full, acc);
    } else if (name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const short = [];
const broken = [];

for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/name=["']description["'][\s\S]*?content=["']([^"']+)["']/i);
  if (!match) continue;
  const desc = match[1].replace(/\s+/g, ' ').trim();
  if (/Hashtable/i.test(desc)) broken.push(path.relative(root, file));
  else if (desc.length < 120) short.push({ file: path.relative(root, file), len: desc.length, desc });
}

short.sort((a, b) => a.len - b.len);
console.log(JSON.stringify({ shortCount: short.length, brokenCount: broken.length, short, broken }, null, 2));
