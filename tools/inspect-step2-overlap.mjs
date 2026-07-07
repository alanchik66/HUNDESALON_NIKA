import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });

await page.goto('http://127.0.0.1:5502/ru/onlayn-bronirovanie.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('#open-booking-btn')?.click());
await page.waitForSelector('#booking-modal.active');
await page.waitForTimeout(700);
await page.evaluate(() => {
  document.querySelector('.service-option')?.click();
  document.querySelector('#next-step-1')?.click();
});
await page.waitForTimeout(900);

const report = await page.evaluate(() => {
  const modal = document.querySelector('#booking-modal.active');
  const content = modal?.querySelector('.modal-content');
  const body = modal?.querySelector('.booking-datetime-body');
  const pairs = [];

  const boxes = (root) =>
    [...root.querySelectorAll('*')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

  const contentKids = [content, ...boxes(content)].filter(Boolean);
  for (let i = 0; i < contentKids.length; i += 1) {
    for (let j = i + 1; j < contentKids.length; j += 1) {
      const a = contentKids[i].getBoundingClientRect();
      const b = contentKids[j].getBoundingClientRect();
      const overlap =
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      if (!overlap) continue;
      const childContains =
        contentKids[i].contains(contentKids[j]) || contentKids[j].contains(contentKids[i]);
      if (childContains) continue;
      pairs.push({
        a: contentKids[i].className || contentKids[i].id,
        b: contentKids[j].className || contentKids[j].id,
      });
    }
  }

  const clipped = [...modal.querySelectorAll('*')]
    .map((el) => {
      const r = el.getBoundingClientRect();
      const pr = el.parentElement?.getBoundingClientRect();
      if (!pr) return null;
      const cs = getComputedStyle(el.parentElement);
      if (!['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflow) && cs.overflowY !== 'auto') {
        return null;
      }
      const cut =
        r.top < pr.top - 0.5 ||
        r.bottom > pr.bottom + 0.5 ||
        r.left < pr.left - 0.5 ||
        r.right > pr.right + 0.5;
      if (!cut) return null;
      return {
        el: el.className || el.id,
        parent: el.parentElement.className || el.parentElement.id,
        elH: Math.round(r.height),
        parentH: Math.round(pr.height),
        scrollH: el.parentElement.scrollHeight,
        clientH: el.parentElement.clientHeight,
      };
    })
    .filter(Boolean)
    .slice(0, 20);

  const buttons = document.querySelector('#step-2 .modal-buttons');
  const contentRect = content?.getBoundingClientRect();
  const buttonsRect = buttons?.getBoundingClientRect();

  return {
    buttonsVisible:
      buttonsRect &&
      contentRect &&
      buttonsRect.bottom <= contentRect.bottom + 1 &&
      buttonsRect.top >= contentRect.top - 1,
    buttonsBottom: Math.round(buttonsRect?.bottom || 0),
    contentBottom: Math.round(contentRect?.bottom || 0),
    content: {
      h: content?.offsetHeight,
      scrollH: content?.scrollHeight,
      clientH: content?.clientHeight,
      maxHeight: getComputedStyle(content).maxHeight,
      overflow: getComputedStyle(content).overflow,
    },
    body: {
      h: body?.offsetHeight,
      scrollH: body?.scrollHeight,
      clientH: body?.clientHeight,
      overflow: getComputedStyle(body).overflow,
      classes: body?.className,
    },
    step2: {
      h: document.querySelector('#step-2')?.offsetHeight,
      scrollH: document.querySelector('#step-2')?.scrollHeight,
    },
    overlapPairs: pairs.slice(0, 15),
    clipped,
  };
});

console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: 'tmp-step2-overlap.png', fullPage: false });
await browser.close();
