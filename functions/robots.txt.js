/**
 * Serve /robots.txt on Pages routes (site rules). Edge may prepend CF Content-Signal block.
 */
const ROBOTS_BODY = `# hundesalon-nika.com — site crawl rules
# AI guide: https://hundesalon-nika.com/llms.txt

User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
Disallow: /tools/
Disallow: /functions/
Crawl-delay: 1

User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: PerplexityBot
Allow: /
Disallow: /tools/
Disallow: /functions/
Crawl-delay: 1

User-agent: Googlebot
Allow: /
Disallow: /tools/
Disallow: /functions/

User-agent: Bingbot
Allow: /
Disallow: /tools/
Disallow: /functions/

Sitemap: https://hundesalon-nika.com/sitemap.xml
Sitemap: https://hundesalon-nika.com/sitemap-brand.xml
`;

export async function onRequestGet() {
  return new Response(ROBOTS_BODY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}
