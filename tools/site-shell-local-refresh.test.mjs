import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const source = await readFile(new URL('../assets/js/local-dev-refresh.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  for (const hostname of ['127.0.0.1', 'localhost', 'shell-refresh.example']) {
    const page = await browser.newPage();
    let generation = 0;
    let pollCount = 0;
    let unavailable = false;
    let color = 'red';
    const changes = [];
    const change = (pathname, revision) => changes.push({ path: pathname, revision, at: Date.now() });
    const local = hostname !== 'shell-refresh.example';

    // Serve a controlled resource through the real browser HTTP cache/reload
    // path, without editing the user's file or calling any external service.
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.port === '5512') {
        pollCount += 1;
        await route.fulfill({
          status: unavailable ? 503 : 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': `http://${hostname}` },
          body: JSON.stringify({ project: 'HUNDESALON_NIKA', boot: 'test', changes }),
        });
      } else if (url.pathname === '/assets/js/local-dev-refresh.js') {
        await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: source });
      } else if (url.pathname === '/assets/test.css') {
        await route.fulfill({ contentType: 'text/css', body: `body { color: ${color}; }` });
      } else if (url.pathname === '/assets/test.js') {
        await route.fulfill({ contentType: 'text/javascript', body: 'window.testResource = true;' });
      } else if (url.pathname === '/assets/test.svg') {
        await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>' });
      } else {
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><body data-generation="${++generation}">
            <link rel="stylesheet" href="/assets/test.css"><img src="/assets/test.svg" srcset="/assets/test.svg 1x">
            <div id="background" style="background-image:url('/assets/test.svg')"></div>
            <form><input name="draft"><button type="reset">Reset</button></form>
            <script src="/assets/test.js"></script>
            <script src="/assets/js/local-dev-refresh.js"></script></body></html>`,
        });
      }
    });
    await page.goto(`http://${hostname}/ru/do-i-posle.html`);

    if (local) {
      await page.waitForResponse(response => new URL(response.url()).port === '5512');
      unavailable = true;
      await page.waitForResponse(response => response.status() === 503);
      assert.equal(generation, 1, `${hostname}: server restart must not reload the page`);

      unavailable = false;
      change('/de/unrelated.html', 'another-task');
      await page.locator('input').fill('Do not lose this draft');
      color = 'blue';
      change('/assets/test.css', 'css-v2');
      await page.waitForFunction(() => getComputedStyle(document.body).color === 'rgb(0, 0, 255)');
      assert.equal(generation, 1, 'CSS and unrelated edits must not reload');
      assert.equal(await page.locator('input').inputValue(), 'Do not lose this draft');
      change('/assets/test.svg', 'image-v2');
      await page.waitForFunction(() => document.querySelector('img').src.includes('dev-refresh=image-v2'));
      assert.match(await page.locator('img').getAttribute('srcset'), /dev-refresh=image-v2/);
      assert.match(await page.locator('#background').getAttribute('style'), /dev-refresh=image-v2/);
      assert.equal(generation, 1, 'image refresh must not reload');
      change('/assets/test.js', 'js-v2');
      await page.waitForTimeout(2000);
      assert.equal(generation, 1, 'JS refresh must wait while a form has unsaved input');
      await page.getByRole('button', { name: 'Reset' }).click();
      await page.waitForFunction(() => document.body.dataset.generation === '2', null, { timeout: 15_000 });
      await page.waitForResponse(response => new URL(response.url()).port === '5512');
      assert.equal(generation, 2, `${hostname}: one edit must trigger exactly one reload`);
      assert.ok(pollCount >= 3);
    } else {
      await page.waitForTimeout(3000);
      assert.equal(pollCount, 0, 'production must not poll the script');
      assert.equal(generation, 1, 'production must not reload');
    }
    console.log(`${hostname}: ${local ? 'CSS/image hot refresh, JS reload, draft preservation, unrelated changes and server recovery' : 'no polling'} passed`);
    await page.close();
  }
} finally {
  await browser.close();
}
