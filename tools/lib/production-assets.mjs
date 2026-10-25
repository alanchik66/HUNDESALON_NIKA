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
  if (PUBLIC_PATH_EXCEPTIONS.has(relativePath)) return false;
  if (SOURCE_ONLY_PATHS.has(relativePath)) return true;
  return SOURCE_ONLY_PREFIXES.some(prefix => relativePath.startsWith(prefix));
}
