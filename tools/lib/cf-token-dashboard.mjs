/**
 * Cloudflare Dashboard token wizard helpers (CDP + template URLs).
 */
import { ACCOUNT_ID } from './cloudflare-auth.mjs';
import { evalPage, sleep } from './browser-cdp.mjs';
import { extractTokenFromText } from './cf-pages-token.mjs';

/** Permissions for HUNDESALON_NIKA — Automation (official dashboard keys). */
export const UNIFIED_PERMISSION_KEYS = [
  { key: 'page', type: 'edit' },
  { key: 'dns', type: 'edit' },
  { key: 'zone', type: 'read' },
  { key: 'page_rules', type: 'edit' },
  { key: 'cache', type: 'purge' },
];

export function encodePermissionGroupKeys(keys = UNIFIED_PERMISSION_KEYS) {
  return encodeURIComponent(JSON.stringify(keys));
}

/**
 * User-owned token template (official format).
 * accountId=* — required; a concrete account id can trap the wizard on account selection.
 */
export function userTokenTemplateUrl({ name, permissionKeys = UNIFIED_PERMISSION_KEYS }) {
  const permissionGroupKeys = encodePermissionGroupKeys(permissionKeys);
  const tokenName = encodeURIComponent(name);
  return `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${permissionGroupKeys}&accountId=*&zoneId=all&name=${tokenName}`;
}

/**
 * Account-scoped dashboard URL — skips the ":account" picker from ?to=/:account/… links.
 */
export function accountTokenTemplateUrl({ name, permissionKeys = UNIFIED_PERMISSION_KEYS }) {
  const permissionGroupKeys = encodePermissionGroupKeys(permissionKeys);
  const tokenName = encodeURIComponent(name);
  return `https://dash.cloudflare.com/${ACCOUNT_ID}/api-tokens?permissionGroupKeys=${permissionGroupKeys}&name=${tokenName}`;
}

/** Prefer account route; profile URL is the documented fallback. */
export function automationTokenTemplateUrl(name) {
  return accountTokenTemplateUrl({ name });
}

export async function readCreatedTokenFromTab(tab) {
  const raw = await tab.eval(`
    (() => {
      const pick = text => String(text || '').match(/\\b(cfut_[a-zA-Z0-9_-]{20,})\\b/g)?.[0] || '';
      for (const el of document.querySelectorAll('input[readonly], textarea[readonly], code, pre')) {
        const t = pick(el.value || el.textContent || '');
        if (t) return t;
      }
      return pick(document.body.innerText || '');
    })()
  `);
  return extractTokenFromText(raw) || raw;
}

/**
 * Drive the create-token wizard past account picker + empty-permissions UI glitch.
 */
export async function clickThroughCreateTokenWizard(tab) {
  return evalPage(tab.send, `
    const accountHint = /hundesalon|${ACCOUNT_ID.slice(0, 8)}/i;
    const bodyText = norm(document.body.innerText);

    if (/select an account|choose an account|which account/i.test(bodyText)) {
      for (const el of document.querySelectorAll('button, a, [role="button"], [role="option"], li, tr, label')) {
        if (!visible(el)) continue;
        const t = txt(el);
        if (!accountHint.test(t)) continue;
        el.click();
        await sleep(1200);
        break;
      }
      clickMatch('continue|next|select|confirm|done');
      await sleep(1800);
    }

    // Template URL bug: permissions exist but form looks empty until user returns to edit.
    if (/create custom token|custom token/i.test(norm(document.body.innerText))) {
      const edit = clickMatch('edit token|← edit|back to edit');
      if (edit) await sleep(1500);
    }

    if (/account resources|resources/i.test(norm(document.body.innerText))) {
      clickMatch('include all|all accounts|all resources');
      await sleep(600);
      for (const el of document.querySelectorAll('button, a, [role="button"], label, li')) {
        if (!visible(el)) continue;
        const t = txt(el);
        if (!accountHint.test(t)) continue;
        el.click();
        await sleep(800);
        break;
      }
    }

    if (/zone resources|specific zone/i.test(norm(document.body.innerText))) {
      clickMatch('all zones|include all zones|all zones in account');
      await sleep(600);
    }

    clickMatch('continue to summary|continue|next');
    await sleep(1800);
    clickMatch('create token|create');
    await sleep(2200);

    return {
      href: location.href,
      snippet: norm(document.body.innerText).slice(0, 420),
    };
  `);
}

export async function waitForCreatedToken(tab, { maxAttempts = 90, onWaiting } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const loginNeeded = await tab.eval(`!!document.querySelector('input[type="email"], input[name="email"]')`);
    if (loginNeeded) {
      if (attempt === 0 && onWaiting) onWaiting('Sign in to Cloudflare in the CDP browser…');
      await sleep(2000);
      continue;
    }

    const token = await readCreatedTokenFromTab(tab);
    if (token?.startsWith('cfut_')) {
      return token;
    }

    if (!/successfully created|copy this token/i.test(await tab.eval('document.body.innerText'))) {
      await clickThroughCreateTokenWizard(tab);
    }

    await sleep(2000);
  }
  return '';
}
