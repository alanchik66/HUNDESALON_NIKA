/**
 * Create OpenRouter inference key via persistent Edge (CDP) and sync to .dev.vars.
 * Does not print the secret.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateInferenceKey } from './lib/service-gateway-key.mjs';

const CDP = process.env.OPENROUTER_CDP_URL || 'http://127.0.0.1:9222';
const ROOT = process.cwd();
const DEV_VARS = join(ROOT, '.dev.vars');
const KEY_NAME = `hundesalon-nika-${new Date().toISOString().slice(0, 10)}`;

function upsertDevVar(name, value) {
  const raw = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
  const lines = raw.split(/\r?\n/);
  let found = false;
  const next = lines.map(line => {
    if (line.startsWith(`${name}=`)) {
      found = true;
      return `${name}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(`${name}=${value}`);
  }
  // Keep legacy alias in sync for older scripts.
  let legacyFound = false;
  const withLegacy = next.map(line => {
    if (line.startsWith('OPENROUTER_API_KEY=')) {
      legacyFound = true;
      return `OPENROUTER_API_KEY=${value}`;
    }
    return line;
  });
  if (!legacyFound) {
    withLegacy.push(`OPENROUTER_API_KEY=${value}`);
  }
  writeFileSync(DEV_VARS, `${withLegacy.join('\n').replace(/\n+$/, '\n')}`, 'utf8');
}

async function extractKeyFromPage(page) {
  const candidates = await page.evaluate(() => {
    const out = [];
    const push = value => {
      const matches = String(value || '').match(/sk-or-v1-[A-Za-z0-9_-]{20,}/g) || [];
      out.push(...matches);
    };
    const walk = node => {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) push(node.textContent);
      for (const child of node.childNodes || []) walk(child);
    };
    walk(document.body);
    for (const el of document.querySelectorAll('input, textarea')) {
      push(el.value);
    }
    return out;
  });

  const unique = [...new Set(candidates.filter(k => k && k.length >= 40))];
  unique.sort((a, b) => b.length - a.length);
  return unique[0] || '';
}

async function createKey(page) {
  await page.goto('https://openrouter.ai/keys', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  const body = await page.locator('body').innerText();
  if (/sign in|log in|continue with/i.test(body) && !/create/i.test(body)) {
    throw new Error('OpenRouter session is not signed in in the persistent Edge profile.');
  }

  // Open create dialog
  const createBtn = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /create\s*(new\s*)?(api\s*)?key|create key|new key/i })
    .first();
  await createBtn.waitFor({ state: 'visible', timeout: 30000 });
  await createBtn.click();
  await page.waitForTimeout(1000);

  // Fill name (required to enable Create)
  const nameInput = page.locator('#name, input[placeholder*="Chatbot" i]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.click();
  await nameInput.fill('');
  await nameInput.type(KEY_NAME, { delay: 20 });
  await nameInput.dispatchEvent('input');
  await nameInput.dispatchEvent('change');
  await page.waitForTimeout(400);

  const confirm = page.locator('button').filter({ hasText: /^Create$/i }).last();
  await confirm.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')];
      const create = buttons.find(b => /^Create$/i.test((b.innerText || '').trim()));
      return create && !create.disabled;
    },
    { timeout: 15000 }
  );
  await confirm.click();

  await page.waitForTimeout(2000);

  // Sometimes key is shown once with a copy button
  let key = await extractKeyFromPage(page);
  if (!key) {
    const copyBtn = page.locator('button, [role="button"]').filter({ hasText: /copy/i }).first();
    if (await copyBtn.count()) {
      await copyBtn.click();
      await page.waitForTimeout(500);
      key = await extractKeyFromPage(page);
    }
  }

  if (!key) {
    // Wait a bit longer for modal content
    await page.waitForTimeout(3000);
    key = await extractKeyFromPage(page);
  }

  if (!key) {
    const snip = (await page.locator('body').innerText()).slice(0, 2000);
    throw new Error(`Could not capture new OpenRouter key from UI. Body snip: ${JSON.stringify(snip)}`);
  }

  return key;
}

const browser = await chromium.connectOverCDP(CDP);
const context = browser.contexts()[0] || (await browser.newContext());
const page = context.pages().find(p => /openrouter\.ai/i.test(p.url())) || context.pages()[0] || (await context.newPage());

const key = await createKey(page);
const check = await validateInferenceKey(key);
if (!check.ok) {
  throw new Error(`Created key failed validation: ${check.reason}`);
}

upsertDevVar('SERVICE_GATEWAY_API_KEY', key);
upsertDevVar('OPENROUTER_API_KEY', key);

console.log(`OpenRouter key created and written to .dev.vars (${KEY_NAME}).`);
console.log(`Key length: ${key.length}; validation: OK`);
// Leave browser open for OAuth/session continuity.
