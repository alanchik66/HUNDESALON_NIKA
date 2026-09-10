import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';

const baseUrl = new URL(process.argv.find(argument => /^https?:\/\//.test(argument)) || 'http://127.0.0.1:8788');
const locales = ['de', 'en', 'ru', 'uk'];
const viewports = [
  { name: 'desktop', options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile', options: { ...devices['Pixel 7'] } },
];

const completedCopy = {
  de: 'Datei wurde sicher übermittelt.',
  en: 'The file was sent securely.',
  ru: 'Файл безопасно отправлен сотруднику.',
  uk: 'Файл безпечно надіслано співробітнику.',
};

const failedCopy = {
  de: 'Die Datei konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  en: 'The file could not be sent. Please try again.',
  ru: 'Не удалось отправить файл. Повторите попытку.',
  uk: 'Не вдалося надіслати файл. Спробуйте ще раз.',
};

async function installUploadMock(page, state) {
  await page.route('**/api/ai-chat', async route => {
    state.chatRequests += 1;
    if (state.chatRequests === 1) {
      await route.fulfill({
        status: 429,
        headers: { 'Retry-After': '1' },
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many requests' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: `rate-limit-retry-ok-${state.locale}`, available: true, handoff: false }),
    });
  });
  await page.route('**/api/ai-chat-upload*', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/ai-chat-upload-chunk')) {
      assert.equal(route.request().method(), 'POST');
      assert.equal(
        route.request().headers()['x-upload-url'],
        'https://qa.up.1drv.com/upload/session'
      );
      assert.equal(route.request().headers()['x-upload-signature'], 'qa-signature');
      assert.match(route.request().headers()['content-range'] || '', /^bytes 0-\d+\/\d+$/);
      state.puts += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, complete: true, file: { id: 'qa-file-id-12345' } }),
      });
      return;
    }
    const payload = route.request().postDataJSON();
    if (state.failNextStart && payload.action === 'start') {
      state.failNextStart = false;
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      return;
    }
    if (payload.action === 'start') {
      state.starts += 1;
      assert.equal(payload.fileName, 'paperclip-qa.txt');
      assert.equal(payload.mimeType, 'text/plain');
      assert.equal(payload.kind, 'file');
      assert.ok(payload.size > 0);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadUrl: 'https://qa.up.1drv.com/upload/session',
          uploadSignature: 'qa-signature',
          mimeType: payload.mimeType,
          chunkSize: 10 * 1024 * 1024,
        }),
      });
      return;
    }
    if (payload.action === 'transcript') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    assert.equal(payload.action, 'complete');
    assert.equal(payload.fileId, 'qa-file-id-12345');
    state.completes += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, notified: true }) });
  });

}

async function testUpload(page, locale, state) {
  await page.goto(new URL(`/${locale}/`, baseUrl).href, { waitUntil: 'networkidle' });
  const necessaryCookies = page.locator('[data-cookie-choice="necessary"]');
  if (await necessaryCookies.isVisible()) await necessaryCookies.click();
  const chat = page.locator('#hundesalon-ai-chat');
  const launcher = chat.locator('.hn-ai-launcher');
  if ((await launcher.getAttribute('aria-expanded')) !== 'true') await launcher.click();
  const attach = chat.locator('.hn-ai-tools > .hn-ai-tool').nth(2);
  const input = chat.locator('input[type="file"]');
  const transfer = chat.locator('.hn-ai-transfer');
  const status = chat.locator('.hn-ai-status');

  await attach.waitFor({ state: 'visible' });
  assert.equal(await attach.isEnabled(), true);

  await input.evaluate(element => {
    element.addEventListener('click', () => {
      element.dataset.qaPaperclipClicks = String(Number(element.dataset.qaPaperclipClicks || 0) + 1);
    });
  });
  await attach.click();
  assert.equal(await input.getAttribute('data-qa-paperclip-clicks'), '1');
  await input.setInputFiles({
    name: 'paperclip-qa.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('HUNDESALON_NIKA paperclip browser QA'),
  });

  await status.getByText(completedCopy[locale], { exact: true }).waitFor();
  assert.equal(await transfer.isVisible(), false);
  const attachmentBubble = chat.locator('.hn-ai-bubble-attachment').last();
  assert.equal(await attachmentBubble.isVisible(), true);
  assert.match(await attachmentBubble.innerText(), /paperclip-qa\.txt/);
  assert.equal(await attach.isEnabled(), true);
  assert.equal(await input.inputValue(), '');

  state.failNextStart = true;
  await input.setInputFiles({
    name: 'paperclip-qa.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('failure recovery check'),
  });
  await status.getByText(failedCopy[locale], { exact: true }).waitFor();
  assert.equal(await attach.isEnabled(), true);
  assert.equal(await input.inputValue(), '');

  const textarea = chat.locator('textarea');
  await textarea.fill(`rate limit QA ${locale}`);
  await chat.locator('.hn-ai-send').click();
  await chat.getByText(`rate-limit-retry-ok-${locale}`, { exact: true }).waitFor({ timeout: 5_000 });
  assert.equal(state.chatRequests, 2);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    for (const locale of locales) {
      const context = await browser.newContext(viewport.options);
      const page = await context.newPage();
      const state = { locale, starts: 0, puts: 0, completes: 0, chatRequests: 0, failNextStart: false };
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await installUploadMock(page, state);
      await testUpload(page, locale, state);
      assert.deepEqual({ starts: state.starts, puts: state.puts, completes: state.completes }, { starts: 1, puts: 1, completes: 1 });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`[ai-chat-attachment] ${locale} ${viewport.name}: ok`);
    }
  }
} finally {
  await browser.close();
}
