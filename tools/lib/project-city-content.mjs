const outdatedCityPattern = new RegExp('\\b' + 'Ber' + 'lin' + '\\b', 'i');

export function hasOutdatedBusinessCity(relativePath, content) {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\.\//u, '');
  if (/^(?:docs|knowledge|memory-bank|graphify-out|tools)(?:\/|$)/iu.test(normalized) || /\.test\.[cm]?js$/iu.test(normalized)) return false;
  return outdatedCityPattern.test(content.replaceAll('Europe/Berlin', 'Europe/Timezone'));
}
