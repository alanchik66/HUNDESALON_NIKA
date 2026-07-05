/**
 * Complete Bing site verification via HTML meta tag (msvalidate.01 on site).
 */
import { evalPage, sleep as wait, withCdpSession } from './lib/browser-cdp.mjs';

const mailPort = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);

const withCdp = task => withCdpSession({ port: mailPort, targetPattern: /.*/ }, ({ send }) => task(send));

const report = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/home?siteUrl=${siteQ}` });
  await wait(7000);

  const start = await evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    return {
      verified: /verified|подтвержд/i.test(body) && !/not verified|не подтвержд/i.test(body),
      pending: /verification pending|ожидает подтвержд/i.test(body),
      hasVerifyBtn: !!clickMatch('verify now|подтвердить|verify'),
    };
  `
  );

  if (start.verified) {
    return { alreadyVerified: true, start };
  }

  const flow = await evalPage(
    send,
    `
    const rowVerify = () => {
      for (const row of document.querySelectorAll('tr, [role="row"], li')) {
        const t = row.innerText || '';
        if (t.includes('hundesalon-nika.com/') && !t.includes('sitemap.xml')) {
          for (const el of row.querySelectorAll('a, button')) {
            if (/verify|проверить/i.test(txt(el))) { el.click(); return 'row-verify'; }
          }
        }
      }
      return clickMatch('verify now|проверить сейчас|proceed to verification|перейти к проверке');
    };
    if (!location.href.includes('verifySite')) rowVerify();
    await sleep(5000);
    const meta = clickMatch('мета-тег html|html meta tag|meta tag');
    await sleep(3000);
    const finalVerify = () => {
      for (const el of document.querySelectorAll('button, a, input[type="submit"]')) {
        if (!visible(el) || el.disabled) continue;
        const t = txt(el);
        if (/проверить сейчас|verify now/i.test(t)) continue;
        if (/^verify$|^проверить$|verify ownership|проверить владение|подтвердить/i.test(t)) {
          el.click();
          return t;
        }
      }
      return clickMatch('verify|подтвердить|check');
    };
    const v = finalVerify();
    await sleep(10000);
    return { metaSelected: meta, verifyClicked: v, url: location.href };
  `
  );

  await wait(5000);
  const after = await evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    return {
      bodySample: body.slice(0, 1200),
      verified: /site verified|verified successfully|подтвержден/i.test(body),
      notVerified: /not verified|не подтвержд/i.test(body),
    };
  `
  );

  return { start, flow, after };
});

console.log(JSON.stringify(report, null, 2));
