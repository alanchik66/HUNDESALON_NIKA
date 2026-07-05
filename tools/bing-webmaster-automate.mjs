/**
 * Bing Webmaster manual URL submit via Edge CDP (port 9224).
 * Start Edge: msedge --remote-debugging-port=9224
 * Sign in to Microsoft account, then: npm run bing:automate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCdpSession, sleep as wait } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_EDGE_PORT || 9224);
const site = 'https://hundesalon-nika.com/';
const submitUrl = `https://www.bing.com/webmasters/submiturl?siteUrl=${encodeURIComponent(site)}`;
const inspectUrl = `https://www.bing.com/webmasters/urlinspection?siteUrl=${encodeURIComponent(site)}`;
const listPath = path.join(root, 'tools', 'bing-submit-urls.txt');

const priorityUrls = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/',
  'https://hundesalon-nika.com/favicon.ico',
];

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result.value;
}

function loadUrlBatch() {
  if (!fs.existsSync(listPath)) return priorityUrls;
  const fromFile = fs
    .readFileSync(listPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('https://'));
  return [...new Set([...priorityUrls, ...fromFile])].slice(0, 50);
}

async function submitUrls(send, urls) {
  const payload = JSON.stringify(urls);
  return evaluate(
    send,
    `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const setNativeValue = (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor?.set) descriptor.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const urls = ${payload};

      const textarea =
        document.querySelector('textarea') ||
        Array.from(document.querySelectorAll('input, textarea')).find(el => visible(el) && !el.disabled);

      if (!textarea) {
        return { ok: false, reason: 'NO_TEXTAREA', url: location.href, title: document.title };
      }

      setNativeValue(textarea, urls.join('\\n'));
      await sleep(800);

      const buttonText = el =>
        (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();

      const clickButton = pattern => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
          .filter(el => visible(el) && !el.disabled);
        const match = buttons.find(el => pattern.test(buttonText(el)));
        if (match) match.click();
        return !!match;
      };

      clickButton(/submit urls|отправить url/i);
      await sleep(1500);

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .filter(el => visible(el) && !el.disabled);
      const confirm = buttons.find(el => /^(submit|отправить|send|einreichen)$/i.test(buttonText(el)));
      const fallback = buttons.find(el => /submit|send|отправ|надісл|einreichen/i.test(buttonText(el)) && !/submit urls|отправить url/i.test(buttonText(el)));

      if (!confirm && !fallback) {
        return { ok: false, reason: 'NO_SUBMIT', url: location.href, title: document.title };
      }

      (confirm || fallback).click();
      await sleep(5000);
      return {
        ok: true,
        count: urls.length,
        url: location.href,
        title: document.title,
        text: document.body ? document.body.innerText.slice(0, 2000) : '',
      };
    })()`
  );
}

async function inspectHome(send) {
  return evaluate(
    send,
    `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const setNativeValue = (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor?.set) descriptor.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const target = 'https://hundesalon-nika.com/de/';
      const label = el => (el.innerText || el.getAttribute('aria-label') || '').trim();
      const input =
        document.querySelector('input[placeholder*="URL" i]') ||
        Array.from(document.querySelectorAll('input[type="url"], input[type="search"], input[type="text"]')).find(
          el => visible(el) && !el.disabled
        );

      if (input) {
        setNativeValue(input, target);
        await sleep(600);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await sleep(2500);
      }

      const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(
        el => visible(el) && !el.disabled
      );
      const inspectBtn = buttons.find(el => /^inspect$/i.test(label(el)) || /inspect url|prüfen|провер/i.test(label(el)));
      if (inspectBtn) {
        inspectBtn.click();
        await sleep(4000);
      }

      const requestBtn = buttons.find(el =>
        /request indexing|indexieren|индекс|запросить|indexing anfordern/i.test(label(el))
      );
      if (requestBtn) {
        requestBtn.click();
        await sleep(2500);
        return { ok: true, action: 'REQUEST_INDEXING_CLICKED', url: location.href, title: document.title };
      }
      return { ok: false, reason: 'NO_REQUEST_INDEXING', url: location.href, title: document.title };
    })()`
  );
}

let session;
try {
  session = await openCdpSession({ port, targetPattern: /bing\.com\/webmaster|login\.live\.com/i });
} catch {
  console.error(`No Edge on port ${port}. Start: msedge --remote-debugging-port=${port}`);
  console.error('Sign in at bing.com/webmasters, then run: npm run bing:automate');
  process.exit(1);
}

const { send } = session;

try {
  const urls = loadUrlBatch();

  await send('Page.navigate', { url: submitUrl });
  await wait(7000);

  let summary = await evaluate(
    send,
    `(() => ({ url: location.href, title: document.title, text: (document.body?.innerText || '').slice(0, 1500) }))()`
  );

  if (/login\.live|sign in|anmelden/i.test(`${summary.url} ${summary.title} ${summary.text}`)) {
    console.log(
      JSON.stringify(
        {
          status: 'LOGIN_REQUIRED',
          message: 'Sign in to Microsoft in the Edge debug window, then run npm run bing:automate again.',
          url: summary.url,
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const submitResult = await submitUrls(send, urls);

  await send('Page.navigate', { url: inspectUrl });
  await wait(6000);
  const inspectResult = await inspectHome(send);

  console.log(
    JSON.stringify(
      {
        status: submitResult.ok && inspectResult.ok ? 'OK' : 'PARTIAL',
        submit: submitResult,
        inspect: inspectResult,
      },
      null,
      2
    )
  );

  if (!submitResult.ok && !inspectResult.ok) process.exit(1);
} finally {
  session.close();
}
