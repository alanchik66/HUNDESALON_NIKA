/** Google Search Console constants for browser automation. */
export const GSC_PROPERTY = 'sc-domain:hundesalon-nika.com';
export const GSC_ACCOUNT = 'snaiper1984@gmail.com';

export function gscUrl(section = '', extra = '') {
  const path = section.replace(/^\//, '');
  const base = path
    ? `https://search.google.com/search-console/${path}`
    : 'https://search.google.com/search-console';
  return `${base}?resource_id=${encodeURIComponent(GSC_PROPERTY)}${extra}`;
}

export const GSC_SECTIONS = {
  overview: '',
  indexing: 'index',
  sitemaps: 'sitemaps',
  https: 'https',
  coreWebVitals: 'core-web-vitals',
  manualActions: 'manual-actions',
  security: 'security-issues',
};
