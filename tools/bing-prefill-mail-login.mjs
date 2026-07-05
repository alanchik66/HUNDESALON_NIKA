/**
 * Pre-fill snaiper1984@mail.ru on Microsoft login page (Edge 9224). Password still required manually.
 */
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';

const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const email = 'snaiper1984@mail.ru';

let session;
try {
  session = await openCdpSession({ port, targetPattern: /.*/ });
} catch {
  console.error('No Edge on port', port);
  process.exit(1);
}

const { send } = session;
await send('Page.navigate', {
  url: 'https://login.live.com/oauth20_authorize.srf?client_id=0000000048060c6a&response_type=code&scope=service::bingmaster.ms.com::MBI_SSL&redirect_uri=https%3A%2F%2Fwww.bing.com%2Fwebmasters%2F',
});
await sleep(6000);

const result = await send('Runtime.evaluate', {
  expression: `(async () => {
    const email = ${JSON.stringify(email)};
    const input = document.querySelector('input[type="email"], input[name="loginfmt"]');
    if (input) {
      input.focus();
      input.value = email;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const next = document.querySelector('input[type="submit"], button[type="submit"], #idSIButton9');
      if (next) next.click();
      return { ok: true, url: location.href };
    }
    return { ok: false, url: location.href, title: document.title };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
console.log('\nEnter password in Edge, then: npm run bing:mail-setup');
session.close();
