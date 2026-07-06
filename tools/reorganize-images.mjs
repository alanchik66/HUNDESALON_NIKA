import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const imagesRoot = path.join(root, 'assets', 'images');

const iconRenameMap = {
  'apple_music.png': 'apple-music.png',
  'clash_royale.png': 'clash-royale.png',
  'currency_euro.png': 'currency-euro.png',
  'FA User.png': 'user.png',
  'Facebook.png': 'facebook.png',
  'Globus language.png': 'globe-language.png',
  'Home.png': 'home.png',
  'instagram.png': 'instagram.png',
  'Job.png': 'job.png',
  'Locate.png': 'locate.png',
  'mail.png': 'mail.png',
  'moon_reader.png': 'moon-reader.png',
  'Multimedia.png': 'multimedia.png',
  'phone_alt.png': 'phone.png',
  'sozial-links.png': 'social-links.png',
  'spotify.png': 'spotify.png',
  'sunrise.png': 'sunrise.png',
  'Telegramm.png': 'telegram.png',
  'tiktok.png': 'tiktok.png',
  'unter.png': 'chevron-down.png',
  'Viber.png': 'viber.png',
  'whatsapp_alt3.png': 'whatsapp.png',
  'youtube_alt1.png': 'youtube.png',
};

const oldIconDir = path.join(imagesRoot, 'icon-pak', 'Gotovie iconki dlya saita');
const newIconDir = path.join(imagesRoot, 'icons');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function moveFile(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  if (fs.existsSync(to)) fs.unlinkSync(to);
  fs.renameSync(from, to);
  return true;
}

function removeIfExists(target) {
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

function removeDirIfEmpty(dir) {
  if (!fs.existsSync(dir)) return;
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

// 1) Brand assets
const brandDir = path.join(imagesRoot, 'brand');
ensureDir(brandDir);
for (const name of [
  'logo.png',
  'hero-dog.jpg',
  'search-logo-512.png',
  'search-logo-clear-512.png',
  'search-logo-transparent-512.png',
  'social-preview-1200x630.png',
]) {
  moveFile(path.join(imagesRoot, name), path.join(brandDir, name));
}

// 2) Hero slides
const heroDir = path.join(imagesRoot, 'hero');
ensureDir(heroDir);
for (let i = 1; i <= 6; i += 1) {
  const padded = String(i).padStart(2, '0');
  moveFile(path.join(imagesRoot, `gallery${i}.jpg`), path.join(heroDir, `slide-${padded}.jpg`));
}

// 3) UI icons
ensureDir(newIconDir);
for (const [oldName, newName] of Object.entries(iconRenameMap)) {
  moveFile(path.join(oldIconDir, oldName), path.join(newIconDir, newName));
}
removeDirIfEmpty(oldIconDir);
removeDirIfEmpty(path.join(imagesRoot, 'icon-pak'));

// 4) Before/after duplicates
for (let i = 1; i <= 9; i += 1) {
  const cardDir = path.join(imagesRoot, 'before-after', `card-${String(i).padStart(2, '0')}`);
  removeIfExists(path.join(cardDir, `gallery-before-${i}.jpg`));
  removeIfExists(path.join(cardDir, `gallery-after-${i}.jpg`));
}

const replacements = [
  ['/assets/images/logo.png', '/assets/images/brand/logo.png'],
  ['../assets/images/logo.png', '../assets/images/brand/logo.png'],
  ['../../assets/images/logo.png', '../../assets/images/brand/logo.png'],
  ['/assets/images/hero-dog.jpg', '/assets/images/brand/hero-dog.jpg'],
  ['../assets/images/hero-dog.jpg', '../assets/images/brand/hero-dog.jpg'],
  ['/assets/images/search-logo-clear-512.png', '/assets/images/brand/search-logo-clear-512.png'],
  ['/assets/images/search-logo-512.png', '/assets/images/brand/search-logo-512.png'],
  ['/assets/images/search-logo-transparent-512.png', '/assets/images/brand/search-logo-transparent-512.png'],
  ['https://hundesalon-nika.com/assets/images/search-logo-clear-512.png', 'https://hundesalon-nika.com/assets/images/brand/search-logo-clear-512.png'],
  ['https://hundesalon-nika.com/assets/images/logo.png', 'https://hundesalon-nika.com/assets/images/brand/logo.png'],
  ['/assets/images/social-preview-1200x630.png', '/assets/images/brand/social-preview-1200x630.png'],
  ['https://hundesalon-nika.com/assets/images/social-preview-1200x630.png', 'https://hundesalon-nika.com/assets/images/brand/social-preview-1200x630.png'],
  ["../images/logo.png", "../images/brand/logo.png"],
  ["../images/gallery1.jpg", "../images/hero/slide-01.jpg"],
  ["../images/gallery2.jpg", "../images/hero/slide-02.jpg"],
  ["../images/gallery3.jpg", "../images/hero/slide-03.jpg"],
  ["../images/gallery4.jpg", "../images/hero/slide-04.jpg"],
  ["../images/gallery5.jpg", "../images/hero/slide-05.jpg"],
  ["../images/gallery6.jpg", "../images/hero/slide-06.jpg"],
  ['gallery-before-${index}.jpg', 'before.jpg'],
  ['gallery-after-${index}.jpg', 'after.jpg'],
  ['/gallery-before-${index}.jpg', '/before.jpg'],
  ['/gallery-after-${index}.jpg', '/after.jpg'],
  ['icon-pak/Gotovie iconki dlya saita/apple_music.png', 'icons/apple-music.png'],
  ['icon-pak/Gotovie iconki dlya saita/clash_royale.png', 'icons/clash-royale.png'],
  ['icon-pak/Gotovie iconki dlya saita/currency_euro.png', 'icons/currency-euro.png'],
  ['icon-pak/Gotovie iconki dlya saita/FA User.png', 'icons/user.png'],
  ['icon-pak/Gotovie iconki dlya saita/Facebook.png', 'icons/facebook.png'],
  ['icon-pak/Gotovie iconki dlya saita/Globus language.png', 'icons/globe-language.png'],
  ['icon-pak/Gotovie iconki dlya saita/Home.png', 'icons/home.png'],
  ['icon-pak/Gotovie iconki dlya saita/Job.png', 'icons/job.png'],
  ['icon-pak/Gotovie iconki dlya saita/Locate.png', 'icons/locate.png'],
  ['icon-pak/Gotovie iconki dlya saita/Multimedia.png', 'icons/multimedia.png'],
  ['icon-pak/Gotovie iconki dlya saita/Telegramm.png', 'icons/telegram.png'],
  ['icon-pak/Gotovie iconki dlya saita/Viber.png', 'icons/viber.png'],
  ['icon-pak/Gotovie iconki dlya saita/instagram.png', 'icons/instagram.png'],
  ['icon-pak/Gotovie iconki dlya saita/mail.png', 'icons/mail.png'],
  ['icon-pak/Gotovie iconki dlya saita/moon_reader.png', 'icons/moon-reader.png'],
  ['icon-pak/Gotovie iconki dlya saita/phone_alt.png', 'icons/phone.png'],
  ['icon-pak/Gotovie iconki dlya saita/sozial-links.png', 'icons/social-links.png'],
  ['icon-pak/Gotovie iconki dlya saita/spotify.png', 'icons/spotify.png'],
  ['icon-pak/Gotovie iconki dlya saita/sunrise.png', 'icons/sunrise.png'],
  ['icon-pak/Gotovie iconki dlya saita/tiktok.png', 'icons/tiktok.png'],
  ['icon-pak/Gotovie iconki dlya saita/unter.png', 'icons/chevron-down.png'],
  ['icon-pak/Gotovie iconki dlya saita/whatsapp_alt3.png', 'icons/whatsapp.png'],
  ['icon-pak/Gotovie iconki dlya saita/youtube_alt1.png', 'icons/youtube.png'],
  ['icon-pak/Gotovie%20iconki%20dlya%20saita/unter.png', 'icons/chevron-down.png'],
  ['icon-pak/Gotovie%20iconki%20dlya%20saita/Locate.png', 'icons/locate.png'],
  ['images/icon-pak/Gotovie iconki dlya saita/', 'images/icons/'],
];

const textExtensions = new Set(['.html', '.css', '.js', '.json', '.xml', '.webmanifest', '.ps1', '.mjs', '.cjs', '.txt', '.md']);
const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'agent-tools', '.wrangler', 'temp', 'tmp']);

function walkProject(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkProject(full, files);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

let updatedFiles = 0;
for (const file of walkProject(root)) {
  if (file.includes(`${path.sep}tools${path.sep}reorganize-images.mjs`)) continue;
  const original = fs.readFileSync(file, 'utf8');
  let next = original;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    updatedFiles += 1;
  }
}

console.log('Image folders reorganized.');
console.log(`Updated references in ${updatedFiles} files.`);
