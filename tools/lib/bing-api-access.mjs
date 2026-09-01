import { createHash } from 'node:crypto';

const API_KEY_RE = /(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[0-9a-f]{32,64}\b)/i;

function accessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function extractBingApiKey(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') {
    return payload.match(API_KEY_RE)?.[0] || '';
  }
  if (Array.isArray(payload)) {
    for (const value of payload) {
      const key = extractBingApiKey(value);
      if (key) return key;
    }
    return '';
  }
  if (typeof payload === 'object') {
    for (const value of Object.values(payload)) {
      const key = extractBingApiKey(value);
      if (key) return key;
    }
  }
  return '';
}

export function bingApiKeyFingerprint(apiKey) {
  return createHash('sha256').update(String(apiKey || '').trim()).digest('hex').slice(0, 12);
}

export async function readBingApiAccessState(session) {
  return session.eval(`
    const roots = [...document.querySelectorAll('[role="dialog"], .ms-Panel.is-open')].filter(visible);
    const scope = roots.at(-1) || document;
    const controls = [...scope.querySelectorAll('button, [role="button"], a')].filter(visible);
    const apiKeyControl = controls.find(el => /api\\s*key|api-?schl(?:u|ü)ssel|ключ\\s*api/i.test(txt(el)));
    const keyField = [...scope.querySelectorAll('input, textarea')]
      .filter(visible)
      .find(el => /api\\s*key|api-?schl(?:u|ü)ssel|ключ\\s*api/i.test(
        norm(el.getAttribute('aria-label') || el.getAttribute('title') || '')
      ));
    const controlText = apiKeyControl ? txt(apiKeyControl) : '';
    const panelText = norm(scope.innerText || scope.textContent || '');
    const safeText = panelText
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[REDACTED_UUID]')
      .replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED_TOKEN]');
    return {
      hasApiKeyControl: Boolean(apiKeyControl || keyField),
      hasReadableKey: Boolean(keyField?.value),
      keyLength: keyField?.value ? String(keyField.value).length : 0,
      canGenerate: /generate|create|erstellen|generieren|создать|сгенерировать/i.test(controlText),
      canView: Boolean(keyField?.value) || /view|show|anzeigen|просмотр|показать/i.test(controlText),
      controlText: controlText.replace(/[0-9a-f-]{36}/gi, '[REDACTED_UUID]'),
      safeText: safeText.slice(0, 900),
      url: location.href,
    };
  `);
}

export async function openBingApiAccess(session, { expectedHost = 'hundesalon-nika.com' } = {}) {
  await session.nav('home');

  const expected = JSON.stringify(expectedHost.toLowerCase());
  const account = await session.eval(`
    const body = norm(document.body?.innerText || '').toLowerCase();
    const expectedHost = ${expected};
    return {
      hasExpectedSite: body.includes(expectedHost) || location.href.toLowerCase().includes(expectedHost),
      needsLogin: /sign in|anmelden|войти|login/i.test(body) && !body.includes(expectedHost),
      url: location.href,
    };
  `);

  if (!account?.hasExpectedSite || account?.needsLogin) {
    throw accessError(
      'BING_SESSION_NOT_READY',
      `Bing Webmaster session is not signed in to the verified ${expectedHost} property.`
    );
  }

  const initialState = await readBingApiAccessState(session);
  if (initialState.hasApiKeyControl) {
    return {
      account,
      settingsClicked: null,
      apiAccessClicked: null,
      alreadyOpen: true,
      ...initialState,
    };
  }

  const settingsResult = await session.eval(`
    let apiAccess = document.querySelector('.apiAccess[aria-labelledby="apiAccessTitle"]');
    if (apiAccess && visible(apiAccess)) return { clicked: null, apiAccessReady: true };

    const clicked = clickMatch('^settings$|^einstellungen$|^настройки$');
    if (!clicked) return { clicked: null, apiAccessReady: false };

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(500);
      apiAccess = document.querySelector('.apiAccess[aria-labelledby="apiAccessTitle"]');
      if (apiAccess && visible(apiAccess)) return { clicked, apiAccessReady: true };
    }
    return { clicked, apiAccessReady: false };
  `);
  if (!settingsResult?.clicked && !settingsResult?.apiAccessReady) {
    throw accessError('BING_SETTINGS_NOT_FOUND', 'Bing Webmaster Settings control was not found.');
  }
  if (!settingsResult?.apiAccessReady) {
    throw accessError('BING_SETTINGS_TIMEOUT', 'Bing Webmaster Settings panel did not finish loading.');
  }

  const apiAccessClicked = await session.eval(`
    const target = document.querySelector('.apiAccess[aria-labelledby="apiAccessTitle"]') ||
      [...document.querySelectorAll('[role="button"], button, a')]
        .find(el => visible(el) && /api\\s*access|api-?zugriff|доступ.*api/i.test(txt(el)));
    if (!target || !visible(target)) return null;
    const label = txt(target);
    target.click();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(500);
      const roots = [...document.querySelectorAll('[role="dialog"], .ms-Panel.is-open')].filter(visible);
      const scope = roots.at(-1) || document;
      const hasApiKey = [...scope.querySelectorAll('button, [role="button"], a')]
        .filter(visible)
        .some(el => /api\\s*key|api-?schl(?:u|ü)ssel|ключ\\s*api/i.test(txt(el)));
      if (hasApiKey) return label;
    }
    return null;
  `);
  if (!apiAccessClicked) {
    throw accessError('BING_API_ACCESS_NOT_FOUND', 'Bing Webmaster API access panel was not found.');
  }

  return {
    account,
    settingsClicked: settingsResult.clicked,
    apiAccessClicked,
    alreadyOpen: false,
    ...(await readBingApiAccessState(session)),
  };
}

export async function readOrGenerateBingApiKey(session, { allowGenerate = false } = {}) {
  const initial = await readBingApiAccessState(session);
  if (!initial.hasApiKeyControl) {
    throw accessError('BING_API_KEY_CONTROL_NOT_FOUND', 'Bing Webmaster API Key control was not found.');
  }
  if (initial.canGenerate && !allowGenerate) {
    return { ...initial, apiKey: '', action: 'generation-required' };
  }

  if (initial.hasReadableKey) {
    return {
      ...initial,
      apiKey: await readVisibleBingApiKey(session),
      action: 'read-existing',
      confirmation: null,
    };
  }

  const action = await session.eval(`
    const roots = [...document.querySelectorAll('[role="dialog"], .ms-Panel.is-open')].filter(visible);
    const scope = roots.at(-1) || document;
    const control = [...scope.querySelectorAll('button, [role="button"], a')]
      .filter(visible)
      .find(el => /api\\s*key|api-?schl(?:u|ü)ssel|ключ\\s*api/i.test(txt(el)));
    if (!control) return null;
    const label = txt(control);
    control.click();
    await sleep(1600);
    return label;
  `);

  if (!action) {
    throw accessError('BING_API_KEY_ACTION_FAILED', 'Bing Webmaster API Key control could not be opened.');
  }

  let confirmation = null;
  if (allowGenerate) {
    confirmation = await session.eval(`
      const roots = [...document.querySelectorAll('[role="dialog"], .ms-Panel.is-open')].filter(visible);
      const scope = roots.at(-1) || document;
      const checkbox = [...scope.querySelectorAll('input[type="checkbox"], [role="checkbox"]')].find(visible);
      if (checkbox) {
        const checked = checkbox.type === 'checkbox'
          ? checkbox.checked
          : checkbox.getAttribute('aria-checked') === 'true';
        if (!checked) checkbox.click();
      }
      const buttons = [...scope.querySelectorAll('button, [role="button"]')].filter(visible);
      const target = buttons.find(el =>
        /^(generate|generate key|generate api key|create|create key|generieren|schlüssel erstellen|создать|создать ключ|сгенерировать ключ)$/i.test(txt(el))
      );
      if (!target) return null;
      const label = txt(target);
      target.click();
      await sleep(1800);
      return label;
    `);
  }

  return {
    ...initial,
    apiKey: await readVisibleBingApiKey(session),
    action,
    confirmation,
  };
}

async function readVisibleBingApiKey(session) {
  const payload = await session.eval(`
    const roots = [...document.querySelectorAll('[role="dialog"], .ms-Panel.is-open')].filter(visible);
    const scope = roots.at(-1) || document;
    const reveal = [...scope.querySelectorAll('button, [role="button"], a')]
      .filter(visible)
      .find(el => /^(view|view key|show|show key|anzeigen|показать|показать ключ)$/i.test(txt(el)));
    if (reveal) {
      reveal.click();
      await sleep(1000);
    }

    const candidates = [];
    for (const el of scope.querySelectorAll('input, textarea, code, pre, [data-copy], [data-clipboard-text]')) {
      if (!visible(el)) continue;
      const value = el.value || el.textContent || el.getAttribute('data-clipboard-text') || el.getAttribute('data-copy') || '';
      const trimmed = norm(value);
      if (trimmed.length >= 32) candidates.push(trimmed);
    }
    const panelText = norm(scope.innerText || scope.textContent || '');
    const bodyMatch = panelText.match(/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\\b[0-9a-f]{32,64}\\b)/i);
    return {
      candidates: [...new Set(candidates)].slice(0, 8),
      bodyMatch: bodyMatch?.[0] || '',
    };
  `);
  return extractBingApiKey(payload);
}
