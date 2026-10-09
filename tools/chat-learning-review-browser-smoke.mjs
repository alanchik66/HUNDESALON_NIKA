import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createFixtureReviewStore, startReviewServer } from './chat-learning-review.mjs';

const store = await createFixtureReviewStore();
const instance = await startReviewServer({ store });
const artifactDirectory = new URL('../output/playwright/chat-learning-review/', import.meta.url);
await mkdir(artifactDirectory, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await store.query('UPDATE chat_learning_examples SET customer_message = ? WHERE id = ?', [
    'Fixture Person asks about poodle care. <img src=x onerror="window.reviewXss=true">',
    '11111111-1111-4111-8111-111111111111',
  ]);
  await page.goto(instance.origin);
  await page.locator('article').first().waitFor();
  assert.equal(await page.locator('article').count(), 2);
  assert.deepEqual(await page.locator('textarea').evaluateAll(nodes => nodes.map(node => node.value)), [
    '',
    '',
    '',
    '',
  ]);
  await page.getByRole('button', { name: 'Одобрить общий FAQ' }).first().click();
  assert.equal(
    (
      await store.query(
        "SELECT review_status FROM chat_learning_examples WHERE id = '11111111-1111-4111-8111-111111111111'"
      )
    ).results[0].review_status,
    'pending'
  );
  await page.getByText('Исходный материал — приватный', { exact: true }).first().click();
  assert.match(await page.locator('pre').first().textContent(), /<img src=x/);
  assert.equal(await page.locator('img').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.reviewXss)), false);
  await page.screenshot({ path: fileURLToPath(new URL('desktop.png', artifactDirectory)), fullPage: true });
  const first = page.locator('article').first();
  await first
    .getByLabel('Общий вопрос FAQ', { exact: true })
    .fill('How can I prepare a poodle for a grooming appointment?');
  await first
    .getByLabel('Общий ответ FAQ', { exact: true })
    .fill('Brush gently before the visit and describe the coat condition when requesting an appointment.');
  await first.getByRole('checkbox').check();
  await first.getByRole('button', { name: 'Одобрить общий FAQ' }).click();
  await page.getByText('Общий FAQ одобрен.', { exact: true }).waitFor();
  assert.equal(await page.locator('article').count(), 1);
  const approved = (
    await store.query(
      "SELECT customer_message, staff_reply FROM chat_learning_examples WHERE id = '11111111-1111-4111-8111-111111111111' AND review_status = 'approved'"
    )
  ).results[0];
  assert.equal(JSON.stringify(approved).includes('Fixture Person'), false);
  assert.equal(
    (await store.query('SELECT body FROM chat_messages')).results[0].body,
    'Fixture Person at Fixture Street asks about poodle care.'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: fileURLToPath(new URL('mobile.png', artifactDirectory)), fullPage: true });
  await page.getByRole('button', { name: 'Отклонить пример' }).click();
  await page.getByText('Пример отклонён.', { exact: true }).waitFor();
  assert.equal(await page.locator('article').count(), 0);
  await page.getByRole('button', { name: 'Обновить список' }).click();
  await page.getByText('Ожидающих примеров нет.', { exact: true }).waitFor();
  assert.equal(
    (
      await store.query(
        "SELECT review_status FROM chat_learning_examples WHERE id = '22222222-2222-4222-8222-222222222222'"
      )
    ).results[0].review_status,
    'rejected'
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: 'PASS',
      fixtureOnly: true,
      checks: [
        'empty FAQ fields',
        'explicit review',
        'literal private text',
        'approve',
        'CRM retained',
        'mobile overflow',
        'reject',
        'reload',
      ],
      artifacts: fileURLToPath(artifactDirectory),
    })
  );
} finally {
  await browser?.close();
  await instance.close();
  store.close();
}
