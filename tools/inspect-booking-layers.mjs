import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });

await page.goto('http://127.0.0.1:5502/ru/onlayn-bronirovanie.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('#open-booking-btn')?.click());
await page.waitForSelector('#booking-modal.active');
await page.waitForTimeout(700);

const report = await page.evaluate(() => {
  const modal = document.querySelector('#booking-modal.active');
  const content = modal?.querySelector('.modal-content');
  const navBtn = document.querySelector('.nav-main > a, .header .nav-main > .dropdown > a');
  const continueBtn = document.querySelector('#next-step-1');

  const styleOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      className: el.className,
      zIndex: cs.zIndex,
      position: cs.position,
      background: cs.background.slice(0, 80),
      color: cs.color,
      animation: cs.animation.slice(0, 60),
      boxShadow: cs.boxShadow.slice(0, 80),
      textTransform: cs.textTransform,
      fontSize: cs.fontSize,
      hasPlasma: Boolean(el.querySelector('.nav-plasma, .nav-plasma--active')),
    };
  };

  const layers = [...content?.children || []].map((el) => ({
    tag: el.tagName,
    className: el.className,
    zIndex: getComputedStyle(el).zIndex,
    pointerEvents: getComputedStyle(el).pointerEvents,
    rect: (() => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  }));

  const pseudo = content
    ? ['::before', '::after'].map((pseudoEl) => {
        const cs = getComputedStyle(content, pseudoEl);
        return {
          pseudo: pseudoEl,
          zIndex: cs.zIndex,
          opacity: cs.opacity,
          pointerEvents: cs.pointerEvents,
          mixBlendMode: cs.mixBlendMode,
        };
      })
    : [];

  const point = continueBtn?.getBoundingClientRect();
  const topAtBtn = point
    ? document.elementsFromPoint(point.left + point.width / 2, point.top + point.height / 2).slice(0, 8).map((el) => ({
        tag: el.tagName,
        className: el.className?.slice?.(0, 80) || el.id,
      }))
    : [];

  return {
    layers,
    pseudo,
    navBtn: styleOf(navBtn),
    continueBtn: styleOf(continueBtn),
    topAtBtn,
    modalButtons: styleOf(modal?.querySelector('.modal-buttons')),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
