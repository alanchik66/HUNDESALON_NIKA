import assert from 'node:assert/strict';
import { chromium } from 'playwright';

if (!process.argv.includes('--confirm-live')) {
  throw new Error('This check creates a real Drive file and may send a Telegram notification. Pass --confirm-live.');
}

const baseUrl = new URL(process.argv.find(argument => /^https?:\/\//.test(argument)) || 'https://hundesalon-nika.com');
const browser = await chromium.launch({ headless: true });
const events = [];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('response', response => {
    if (/ai-chat-upload|googleapis\.com\/upload/.test(response.url())) {
      events.push({ type: 'response', status: response.status(), method: response.request().method(), url: response.url() });
    }
  });
  page.on('requestfailed', request => {
    if (/ai-chat-upload|googleapis\.com\/upload/.test(request.url())) {
      events.push({ type: 'requestfailed', method: request.method(), url: request.url(), error: request.failure()?.errorText });
    }
  });

  await page.goto(new URL('/ru/', baseUrl).href, { waitUntil: 'domcontentloaded' });
  const necessaryCookies = page.locator('[data-cookie-choice="necessary"]');
  if (await necessaryCookies.isVisible()) await necessaryCookies.click();
  const chat = page.locator('#hundesalon-ai-chat');
  const launcher = chat.locator('.hn-ai-launcher');
  if ((await launcher.getAttribute('aria-expanded')) !== 'true') await launcher.click();

  const input = chat.locator('input[type="file"]');
  await input.setInputFiles({
    name: `ai-chat-live-browser-qa-${Date.now()}.png`,
    mimeType: 'image/png',
    buffer: Buffer.alloc(2_200_000, 0x51),
  });

  const status = chat.locator('.hn-ai-status');
  await status.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => /(?:безопасно отправлен|Не удалось отправить)/.test(document.querySelector('.hn-ai-status')?.textContent || ''),
    undefined,
    { timeout: 60_000 }
  );
  const result = await status.textContent();
  console.log(JSON.stringify({ baseUrl: baseUrl.origin, result, events }, null, 2));
  assert.equal(result, 'Файл безопасно отправлен сотруднику.');
  await context.close();
} finally {
  await browser.close();
}
