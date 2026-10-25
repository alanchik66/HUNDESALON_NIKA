import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'https://hundesalon-nika.com';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext();
await context.grantPermissions(['microphone'], { origin });
const page = await context.newPage();

try {
  await page.goto(`${origin}/ru/?voice-live-smoke=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Открыть ассистента HUNDESALON_NIKA' }).click();
  await page.getByRole('button', { name: 'Записать голосовое сообщение' }).click();
  const stopRecording = page.locator('.hn-ai-recorder button[aria-label="Остановить запись"]');
  await stopRecording.waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  const pointerState = await page.locator('sp-live-chat').evaluate((host) => ({
    computed: getComputedStyle(host).pointerEvents,
    inline: host.style.getPropertyValue('pointer-events'),
    priority: host.style.getPropertyPriority('pointer-events'),
    display: getComputedStyle(host).display,
    inlineDisplay: host.style.getPropertyValue('display'),
    displayPriority: host.style.getPropertyPriority('display'),
  }));
  console.log(`SendPulse pointer state: ${JSON.stringify(pointerState)}`);
  await stopRecording.click();
  await page.getByRole('button', { name: 'Отправить голосовое сообщение' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Удалить запись' }).click();
  console.log('Live voice recorder verified with a fake microphone; no audio was uploaded.');
} finally {
  await browser.close();
}
