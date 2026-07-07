/**
 * Submit sitemap-brand.xml in Bing Webmaster (Edge CDP 9224).
 */
import { sleep as wait, withCdpSession } from './lib/browser-cdp.mjs';

const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const sitemaps = ['https://hundesalon-nika.com/sitemap.xml', 'https://hundesalon-nika.com/sitemap-brand.xml'];

const withCdp = task => withCdpSession({ port, targetPattern: /.*/ }, ({ send }) => task(send));

const results = [];
for (const sm of sitemaps) {
  const r = await withCdp(async send => {
    await send('Page.navigate', { url: `https://www.bing.com/webmasters/sitemaps?siteUrl=${siteQ}` });
    await wait(6000);
    const sitemapLiteral = JSON.stringify(sm);
    const result = await send('Runtime.evaluate', {
      expression: `(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const body = document.body?.innerText || '';
        const sitemap = ${sitemapLiteral};
        if (body.includes(sitemap)) return { already: true, sm: sitemap };
        const input = document.querySelector('input[type="url"], input');
        if (input) {
          const proto = Object.getPrototypeOf(input);
          const d = Object.getOwnPropertyDescriptor(proto, 'value');
          if (d?.set) d.set.call(input, sitemap);
          else input.value = sitemap;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(500);
        for (const el of document.querySelectorAll('button, a')) {
          const t = (el.innerText || '').trim();
          if (/submit|add|добав|отправ/i.test(t)) { el.click(); break; }
        }
        await sleep(3000);
        return { added: true, sm: sitemap, has: (document.body?.innerText||'').includes('sitemap-brand') };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result?.value;
  });
  results.push(r);
}

console.log(JSON.stringify(results, null, 2));
