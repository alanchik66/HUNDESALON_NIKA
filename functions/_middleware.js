/** www /robots.txt → apex (www only received CF managed block without site rules). */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'www.hundesalon-nika.com' && url.pathname === '/robots.txt') {
    return Response.redirect('https://hundesalon-nika.com/robots.txt', 301);
  }
  return context.next();
}
