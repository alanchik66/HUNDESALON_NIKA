/** Shared Bing Webmaster Tools constants for automation scripts. */
export const SITE_URL = 'https://hundesalon-nika.com/';
export const WWW_SITE_URL = 'https://www.hundesalon-nika.com/';
export const SITE_HOST = 'hundesalon-nika.com';
export const MAIL_ACCOUNT = 'snaiper1984@mail.ru';
export const GMAIL_ACCOUNT = 'snaiper1984@gmail.com';

/** Session tid from Bing WMT (updates when Microsoft rotates it). */
export const BING_HOME_URL =
  process.env.BING_WEBMASTER_URL || 'https://www.bing.com/webmasters?tid=03b26083-cc40-4e31-8d37-e6f821f0f343';

export function siteQuery(siteUrl = SITE_URL) {
  return encodeURIComponent(siteUrl);
}

export function sectionUrl(section, { siteUrl = SITE_URL, extra = '' } = {}) {
  const path = section.replace(/^\//, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `https://www.bing.com/webmasters/${path}?siteUrl=${siteQuery(siteUrl)}${extra}`;
}
