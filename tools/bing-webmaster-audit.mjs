/**
 * List Bing Webmaster sites and signed-in account hints via Edge CDP (port 9224).
 * Run: npm run bing:edge  (sign in)  then  npm run bing:audit
 */
import { openCdpSession, sleep as wait } from './lib/browser-cdp.mjs';

const port = Number(process.env.BING_EDGE_PORT || 9224);
const targets = ['https://www.bing.com/webmasters/home', 'https://www.bing.com/webmasters/settings/user'];

async function scrapePage(session) {
  return session.evaluate(
    `(() => {
      const text = document.body ? document.body.innerText : '';
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 120) }))
        .filter(l => l.href.includes('webmaster') || /hundesalon|nika/i.test(l.text + l.href));
      const siteCards = Array.from(document.querySelectorAll('[class*="site"], [data-site], li, tr'))
        .map(el => (el.innerText || '').trim())
        .filter(t => t && t.length < 400 && /hundesalon|\\.com|nika/i.test(t));
      const emails = [...text.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0]);
      const microsoftIds = [...text.matchAll(/[a-z0-9._%+-]+@(outlook|hotmail|live|msn)\\.com/gi)].map(m => m[0]);
      return {
        url: location.href,
        title: document.title,
        emails: [...new Set(emails)].slice(0, 10),
        microsoftEmails: [...new Set(microsoftIds)].slice(0, 10),
        hundesalonLinks: links.filter(l => /hundesalon|nika/i.test(l.href + l.text)),
        siteSnippets: [...new Set(siteCards)].slice(0, 20),
        textSample: text.slice(0, 3500),
      };
    })()`
  );
}

let session;
try {
  session = await openCdpSession({ port, targetPattern: /bing\.com\/webmaster/i });
} catch {
  console.error(`Edge not on port ${port}. Run: npm run bing:edge`);
  process.exit(1);
}

const { send } = session;

try {
  const report = { scrapedAt: new Date().toISOString(), pages: [] };

  for (const url of targets) {
    await send('Page.navigate', { url });
    await wait(6000);
    const data = await scrapePage(session);
    report.pages.push(data);
  }

  const hundesalonEntries = report.pages.flatMap(p => p.hundesalonLinks || []);
  const uniqueSites = [...new Set(hundesalonEntries.map(l => l.href))];
  const allEmails = [...new Set(report.pages.flatMap(p => [...(p.emails || []), ...(p.microsoftEmails || [])]))];

  report.summary = {
    uniqueHundesalonUrls: uniqueSites,
    hundesalonLinkCount: hundesalonEntries.length,
    possibleDuplicateSite: uniqueSites.length > 1 || hundesalonEntries.length > 2,
    emailsFound: allEmails,
    projectVerification: {
      msvalidate: 'B67A37AB236F9D14E1F99A12DDCA531C',
      bingSiteAuthXml: 'BingSiteAuth.xml on site root',
      canonicalDomain: 'https://hundesalon-nika.com/',
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  session.close();
}
