// Rewrite only owned loader markup in trusted repository HTML. Other scripts
// remain part of the authored document and are preserved byte for byte.
export function stripOwnedSiteLoaderMarkup(markup) {
  let previous;
  do {
    previous = markup;
    markup = markup
      .replace(/<div\s+id=["']preloader["']\s*>\s*<div\s+class=["']loader["']\s*>\s*<\/div>\s*<\/div>/gi, '')
      .replace(/\s*<link\b[^>]*href=["'][^"']*\/site-loader\.css(?:\?[^"']*)?["'][^>]*>/gi, '')
      .replace(/\s*<script\b[^>]*src=["'][^"']*\/paw-loader-scene\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, '')
      .replace(/\s*<script\b[^>]*src=["'][^"']*\/site-loader\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, '');
  } while (markup !== previous);
  return markup;
}
