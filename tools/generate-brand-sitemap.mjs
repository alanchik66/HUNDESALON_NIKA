/**
 * sitemap-brand.xml — brand/logo/favicon URLs for Bing & Google crawl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domain = 'https://hundesalon-nika.com';
const today = new Date().toISOString().slice(0, 10);

const brandPaths = [
  '/favicon.ico',
  '/site.webmanifest',
  '/browserconfig.xml',
  '/assets/images/brand/logo.png',
  '/assets/images/brand/search-logo-clear-512.png',
  '/assets/images/brand/search-logo-512.png',
  '/assets/images/brand/search-logo-transparent-512.png',
  '/assets/images/brand/social-preview-1200x630.png',
  '/assets/images/favicon/favicon.ico',
  '/assets/images/favicon/favicon-16x16.png',
  '/assets/images/favicon/favicon-32x32.png',
  '/assets/images/favicon/favicon-48x48.png',
  '/assets/images/favicon/favicon-96x96.png',
  '/assets/images/favicon/favicon-128x128.png',
  '/assets/images/favicon/favicon-256x256.png',
  '/assets/images/favicon/favicon-search-512.png',
  '/assets/images/favicon/android-chrome-192x192.png',
  '/assets/images/favicon/android-chrome-512x512.png',
  '/assets/images/favicon/apple-touch-icon.png',
  '/assets/images/favicon/mstile-150x150.png',
  '/assets/images/favicon/maskable-icon-512x512.png',
];

const urls = brandPaths
  .filter(p => {
    const rel = p.replace(/^\//, '').replace(/\//g, path.sep);
    return fs.existsSync(path.join(root, rel));
  })
  .map(p => `${domain}${p}`);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    loc => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const out = path.join(root, 'sitemap-brand.xml');
fs.writeFileSync(out, xml, 'utf8');
console.log(`Wrote ${urls.length} brand URLs to sitemap-brand.xml`);
