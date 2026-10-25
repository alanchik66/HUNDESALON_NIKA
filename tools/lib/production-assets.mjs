import fs from 'node:fs';
import path from 'node:path';

const normalizePath = value =>
  String(value || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');

const PUBLIC_PATH_EXCEPTIONS = new Set(['assets/images/ads/work/logo-from-card-crown-512.png']);

const SOURCE_ONLY_PREFIXES = [
  'assets/images/ads/work/',
  'assets/images/brand/cards/',
  'assets/images/brand/favicon/',
  'assets/video/ads/',
];

const SOURCE_ONLY_PATHS = new Set([
  'assets/images/brand/google-business-logo-square.png',
  'assets/images/brand/hero-dog-source.jpg',
  'assets/images/brand/logo-beige-bg.png',
  'assets/images/brand/mailru-avatar-180.png',
  'assets/images/icons/cyclist-original.png',
  'assets/images/icons/gradient-heart.png',
  'assets/images/icons/heart-outline.png',
  'assets/images/icons/ink-pen.png',
  'assets/images/icons/locomotive-legacy.png',
  'assets/images/reviews/review-qr-salon-sticker.png',
]);

export function isProductionSourceOnlyPath(value) {
  const relativePath = normalizePath(value);
  if (
    /(?:^|\/)\.(?:env(?:\.|$)|dev\.vars(?:\.|$)|secrets(?:\/|$)|git(?:\/|$))|\.(?:token|pem|key|p12|pfx|sqlite|db)$/i.test(
      relativePath
    )
  )
    return true;
  if (PUBLIC_PATH_EXCEPTIONS.has(relativePath)) return false;
  if (SOURCE_ONLY_PATHS.has(relativePath)) return true;
  return SOURCE_ONLY_PREFIXES.some(prefix => relativePath.startsWith(prefix));
}

export function assertProductionSourcePath(root, source) {
  const relative = path.relative(root, source);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error('Refusing production input outside the project root');
  }
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing symbolic production input: ${normalizePath(relative)}`);
  }
  return stat;
}
