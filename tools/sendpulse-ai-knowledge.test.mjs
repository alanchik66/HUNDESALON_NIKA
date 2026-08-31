import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { buildKnowledgeDocument, extractPublicText, normalizeSourceText } from './generate-sendpulse-ai-knowledge.mjs';
import { buildAiChatKnowledgeIndex, renderAiChatKnowledgeModule } from './generate-ai-chat-index.mjs';
import { syncKnowledge } from './sync-sendpulse-ai-knowledge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.html') ? [absolutePath] : [];
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('knowledge generator includes canonical prices and all supported locales', () => {
  const { content, fingerprint, sourcePaths } = buildKnowledgeDocument();
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(sourcePaths.length > 40);
  assert.match(content, /DE — published catalog/);
  assert.match(content, /EN — published catalog/);
  assert.match(content, /RU — published catalog/);
  assert.match(content, /UK — published catalog/);
  assert.match(content, /Komplettpflege — ab 80 €/);
  assert.match(content, /Full grooming — from €80/);
  assert.match(content, /Комплексный груминг — от 80 €/);
  assert.match(content, /Комплексний грумінг — від 80 €/);
  assert.match(content, /SENDPULSE_AUTO_SITE_START/);
  const germanCatalog = content.split('### DE — published catalog ###')[1].split('### EN — published catalog ###')[0];
  assert.doesNotMatch(germanCatalog, /groom(?:ing|er)/i);
});

test('knowledge generator refreshes the stored source fingerprint', () => {
  const knowledgePath = path.join(ROOT, 'knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md');
  const staleTemplate = readFileSync(knowledgePath, 'utf8').replace(
    /^Generated source fingerprint:.*$/m,
    `Generated source fingerprint: sha256:${'0'.repeat(64)}`
  );
  const { content, fingerprint } = buildKnowledgeDocument({ template: staleTemplate });
  assert.match(content, new RegExp(`^Generated source fingerprint: sha256:${fingerprint}$`, 'm'));
  assert.doesNotMatch(content, /^Generated source fingerprint: sha256:0{64}$/m);
  assert.equal(content.match(/^Generated source fingerprint:/gm)?.length, 1);
});

test('bot knowledge uses the same published service details as the price modal in every locale', () => {
  const { content, sourcePaths } = buildKnowledgeDocument();
  assert.ok(sourcePaths.includes('assets/js/price-catalog.js'));
  const context = vm.createContext({ window: {} });
  for (const relativePath of sourcePaths.filter(value => value.startsWith('assets/js/'))) {
    vm.runInContext(readFileSync(path.join(ROOT, relativePath), 'utf8'), context, { filename: relativePath });
  }
  const index = buildAiChatKnowledgeIndex(content);
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const puppy = context.window.PriceCatalog.build(locale).services.find(service => service.key === 'puppy-intro');
    const entries = index.filter(entry => entry.locale === locale && entry.title.endsWith('— service details'));
    const publishedKeys = new Set(context.window.PricePageCatalog.categoriesByLocale[locale]
      .flatMap(category => category.priceRows || []).map(row => row.key).filter(Boolean));
    assert.equal(entries.length, publishedKeys.size);
    const puppyEntry = entries.find(entry => entry.text.includes(puppy.note));
    assert.ok(puppyEntry);
    assert.ok(puppyEntry.text.includes(puppy.description));
    assert.equal((puppyEntry.text.match(/^- Price:/gm) || []).length, 7);
    assert.doesNotMatch(puppyEntry.text, /\+15 €|light coat shaping|nails, eye and ear care/i);
  }
  assert.doesNotMatch(content, /It can include light brushing, careful bathing and drying, nails/);
  assert.doesNotMatch(content, /Für Maine Coons und große Katzen kann ein Zuschlag von \+15 €/);
});

test('checked-in bot knowledge and retrieval index stay synchronized with website sources', () => {
  const stored = normalizeSourceText(readFileSync(path.join(ROOT, 'knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md'), 'utf8'));
  const { content } = buildKnowledgeDocument();
  assert.ok(stored === content, 'Bot knowledge is stale. Run npm run knowledge:build.');
  const module = normalizeSourceText(readFileSync(path.join(ROOT, 'functions/_generated/ai-chat-knowledge.js'), 'utf8'));
  assert.ok(module === renderAiChatKnowledgeModule(content).content, 'Bot retrieval index is stale. Run npm run knowledge:build.');
});

test('knowledge source normalization is stable across platforms', () => {
  assert.equal(normalizeSourceText('\uFEFFalpha\r\nbeta\rgamma\n'), 'alpha\nbeta\ngamma\n');
});

test('public text extraction removes executable and navigation content', () => {
  const lines = extractPublicText(`
    <html><body><header>Menu</header><main><h1>Salon care</h1><p>Safe &amp;
    calm.</p><p>From 40&nbsp;<span class="site-icon currency-inline" aria-label="euro"></span>.</p>
    <script>secret()</script><ul><li>Bathing</li></ul></main><footer>Footer</footer></body></html>
  `);
  assert.deepEqual(lines, ['Salon care', 'Safe & calm.', 'From 40 €.', '- Bathing']);
});

test('German customer-facing content avoids English grooming terminology', () => {
  for (const htmlPath of listHtmlFiles(path.join(ROOT, 'de'))) {
    assert.doesNotMatch(readFileSync(htmlPath, 'utf8'), /groom(?:ing|er)/i, path.relative(ROOT, htmlPath));
  }
});

test('AI chat index is deterministic and contains localized exact-price sections', () => {
  const knowledge = readFileSync(path.join(ROOT, 'knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md'), 'utf8');
  const first = renderAiChatKnowledgeModule(knowledge);
  const second = renderAiChatKnowledgeModule(knowledge);
  const index = buildAiChatKnowledgeIndex(knowledge);

  assert.equal(first.content, second.content);
  assert.equal(first.index.length, index.length);
  assert.ok(index.length > 100);
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    assert.ok(
      index.some(entry => entry.locale === locale),
      `missing ${locale} knowledge chunks`
    );
  }
  const germanPoodle = index.find(entry => entry.locale === 'de' && /Zwergpudel/.test(entry.text));
  assert.ok(germanPoodle);
  assert.match(germanPoodle.text, /Komplettpflege — ab 90 €/);
  assert.doesNotMatch(germanPoodle.text, /groom(?:ing|er)/i);
});

test('custom AI chat keeps the human SendPulse widget as a working fallback', () => {
  const aiSource = readFileSync(path.join(ROOT, 'assets/js/ai-chat.js'), 'utf8');
  const sendPulseSource = readFileSync(path.join(ROOT, 'assets/js/sendpulse-integrations.js'), 'utf8');
  const buildSource = readFileSync(path.join(ROOT, 'tools/build-production.js'), 'utf8');

  assert.match(aiSource, /fetch\('\/api\/ai-chat'/);
  assert.match(aiSource, /function openHumanChat\(\)/);
  assert.match(aiSource, /\.widget-fab, \.button-open-widget/);
  assert.match(aiSource, /attempts >= 60/);
  assert.match(aiSource, /handoffTimer/);
  assert.match(aiSource, /SpeechRecognition\s*=\s*window\.SpeechRecognition/);
  assert.match(sendPulseSource, /data-hundesalon-ai-ready/);
  assert.match(buildSource, /ai-chat\.css/);
  assert.match(buildSource, /ai-chat\.js/);
});

test('mobile SendPulse welcome toast does not block page interactions', () => {
  const source = readFileSync(path.join(ROOT, 'assets/js/sendpulse-integrations.js'), 'utf8');
  assert.match(
    source,
    /@media \(max-width: 560px\)[\s\S]*?\.widget-toast\s*\{[\s\S]*?pointer-events:\s*none !important;[\s\S]*?\.widget-toast \.button-close\s*\{[\s\S]*?pointer-events:\s*auto !important;/
  );
});

test('SendPulse live chat keeps native uploads and adds accessible brand controls', () => {
  const source = readFileSync(path.join(ROOT, 'assets/js/sendpulse-integrations.js'), 'utf8');
  assert.match(source, /LIVE_CHAT_BRAND_LOGO_URL\s*=\s*'\/assets\/images\/brand\/logo\.png'/);
  assert.match(source, /\.widget-chat-message-owner::before[\s\S]*?logo\.png/);
  assert.match(source, /data-action="expand"|action:\s*'expand'/);
  assert.match(source, /action:\s*'download'/);
  assert.match(source, /action:\s*'new-conversation'/);
  assert.match(source, /window\.localStorage\.removeItem\('spSubscriberId'\)/);
  assert.match(source, /window\.SpeechRecognition\s*\|\|\s*window\.webkitSpeechRecognition/);
  assert.match(source, /\.widget-upload-button input\[type="file"\]/);
  assert.match(source, /setAttribute\('aria-label', copy\.attach\)/);
  assert.match(source, /document\.addEventListener\('pointerdown'/);
});

// A small tree for exercising the real header helpers without loading the provider.
function createChatTestElement(tagName) {
  const element = {
    tagName,
    children: [],
    parentNode: null,
    className: '',
    dataset: {},
    hidden: false,
    textWrites: 0,
    attributes: new Map(),
    listeners: new Map(),
    append(...nodes) {
      for (const node of nodes) {
        node.parentNode = this;
        this.children.push(node);
      }
    },
    appendChild(node) {
      this.append(node);
      return node;
    },
    insertBefore(node, reference) {
      node.parentNode = this;
      this.children.splice(this.children.indexOf(reference), 0, node);
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    addEventListener(type, listener) {
      this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
    },
    click() {
      for (const listener of this.listeners.get('click') || []) listener({ stopPropagation() {} });
    },
    focus() {},
    getRootNode() {
      return this.parentNode?.getRootNode() || this;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = node => {
        if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
        if (selector === 'main.root') return node.tagName === 'main' && node.classList.contains('root');
        const action = selector.match(/^\[data-action="([^"]+)"\]$/);
        return action ? node.dataset.action === action[1] : node.tagName === selector;
      };
      return this.children.flatMap(node => [...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)]);
    },
  };
  element.classList = {
    contains: name => element.className.split(/\s+/).includes(name),
    add: name => {
      if (!element.classList.contains(name)) element.className = `${element.className} ${name}`.trim();
    },
    remove: name => {
      element.className = element.className
        .split(/\s+/)
        .filter(value => value !== name)
        .join(' ');
    },
    toggle: name => {
      const added = !element.classList.contains(name);
      element.classList[added ? 'add' : 'remove'](name);
      return added;
    },
  };
  let text = '';
  Object.defineProperty(element, 'textContent', {
    get: () => text,
    set: value => {
      text = String(value);
      element.textWrites += 1;
      element.children = [];
    },
  });
  return element;
}

function createLiveChatHeaderHarness(locale) {
  const source = readFileSync(path.join(ROOT, 'assets/js/sendpulse-integrations.js'), 'utf8');
  const section = (startMarker, endMarker) => {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `Missing live-chat section: ${startMarker}`);
    return source.slice(start, end);
  };
  const context = vm.createContext({
    document: {
      createElement: createChatTestElement,
      createElementNS: (_namespace, tag) => createChatTestElement(tag),
      addEventListener() {},
    },
    getPageLanguage: () => locale,
    downloadLiveChatTranscript() {},
    resetLiveChatConversation() {},
  });
  const { enhance, copy, installEvents } = vm.runInContext(
    [
      section('  const LIVE_CHAT_BRAND_LOGO_URL =', '  const LIVE_CHAT_THEME_CSS ='),
      section('  const getLiveChatCopy =', '  const setLiveChatStatus ='),
      section('  const closeLiveChatPopovers =', '  const insertLiveChatText ='),
      section('  const setLiveChatExpanded =', '  const startLiveChatVoiceInput ='),
      section('  const installLiveChatRootEvents =', '  const enhanceLiveChatDom ='),
      '({ enhance: enhanceLiveChatHeader, copy: getLiveChatCopy(), installEvents: installLiveChatRootEvents });',
    ].join('\n'),
    context,
    { filename: 'sendpulse-integrations.js:header' }
  );
  const root = createChatTestElement('root');
  const main = createChatTestElement('main');
  main.className = 'root';
  const header = createChatTestElement('div');
  header.className = 'widget-header-content-body';
  const heading = createChatTestElement('h5');
  heading.textContent = 'Provider title';
  header.append(heading);
  const nativeClose = createChatTestElement('div');
  nativeClose.className = 'button-close-widget';
  nativeClose.hidden = true;
  const emojiPicker = createChatTestElement('div');
  emojiPicker.className = 'hundesalon-chat-emoji-picker';
  const emojiToggle = createChatTestElement('button');
  emojiToggle.className = 'hundesalon-chat-emoji-toggle';
  main.append(header, nativeClose, emojiPicker, emojiToggle);
  root.append(main);
  const closeStates = [];
  nativeClose.addEventListener('click', () => {
    closeStates.push({
      expanded: main.classList.contains('hundesalon-chat-expanded'),
      menuHidden: root.querySelector('.hundesalon-chat-actions-menu').hidden,
      emojiHidden: emojiPicker.hidden,
    });
  });
  enhance(root);
  return {
    root,
    main,
    header,
    heading,
    copy,
    closeStates,
    enhance: () => enhance(root),
    installEvents: () => installEvents(root),
  };
}

for (const [locale, label] of Object.entries({
  de: 'Chat minimieren',
  en: 'Minimize chat',
  ru: 'Минимизировать чат',
  uk: 'Згорнути чат',
})) {
  test(`SendPulse ${locale}: visible minimize closes natively once after resetting expanded state`, () => {
    const { root, main, copy, closeStates } = createLiveChatHeaderHarness(locale);
    const actions = root.querySelector('.hundesalon-chat-actions');
    const menu = root.querySelector('.hundesalon-chat-actions-menu');
    const minimize = root.querySelector('.hundesalon-chat-minimize');
    const expand = root.querySelector('[data-action="expand"]');
    const toggle = root.querySelector('.hundesalon-chat-actions-toggle');
    assert.equal(minimize.tagName, 'button');
    assert.equal(minimize.type, 'button');
    assert.equal(minimize.parentNode, actions);
    assert.equal(minimize.hidden, false);
    assert.equal(menu.hidden, true);
    assert.equal(menu.querySelector('.hundesalon-chat-minimize'), null);
    assert.equal(root.querySelector('[data-action="minimize"]'), null);
    assert.equal(minimize.getAttribute('role'), null);
    assert.equal(minimize.getAttribute('aria-label'), label);
    assert.equal(minimize.title, label);
    assert.equal(minimize.querySelector('svg').getAttribute('aria-hidden'), 'true');

    expand.click();
    assert.equal(main.classList.contains('hundesalon-chat-expanded'), true);
    toggle.click();
    assert.equal(menu.hidden, false);
    root.querySelector('.hundesalon-chat-emoji-picker').hidden = false;
    root.querySelector('.hundesalon-chat-emoji-toggle').setAttribute('aria-expanded', 'true');
    minimize.click();
    assert.deepEqual(closeStates, [{ expanded: false, menuHidden: true, emojiHidden: true }]);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(root.querySelector('.hundesalon-chat-emoji-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(expand.querySelector('.hundesalon-chat-action-label').textContent, copy.expand);
    assert.equal(expand.getAttribute('aria-label'), copy.expand);
  });
}

test('SendPulse header enhancement is idempotent for observer callbacks and click handlers', () => {
  const harness = createLiveChatHeaderHarness('en');
  const headingWrites = harness.heading.textWrites;
  for (let index = 0; index < 5; index += 1) harness.enhance();
  assert.equal(harness.heading.textContent, 'HUNDESALON_NIKA');
  assert.equal(harness.heading.textWrites, headingWrites);
  for (const className of ['hundesalon-chat-brand-logo', 'hundesalon-chat-actions', 'hundesalon-chat-minimize']) {
    assert.equal(harness.root.querySelectorAll(`.${className}`).length, 1);
  }
  harness.root.querySelector('.hundesalon-chat-minimize').click();
  assert.deepEqual(harness.closeStates, [{ expanded: false, menuHidden: true, emojiHidden: true }]);
});

test('SendPulse Escape resets expanded labels and popovers without closing the native chat', () => {
  const harness = createLiveChatHeaderHarness('en');
  harness.installEvents();
  const expand = harness.root.querySelector('[data-action="expand"]');
  const toggle = harness.root.querySelector('.hundesalon-chat-actions-toggle');
  const menu = harness.root.querySelector('.hundesalon-chat-actions-menu');
  const emojiPicker = harness.root.querySelector('.hundesalon-chat-emoji-picker');
  const emojiToggle = harness.root.querySelector('.hundesalon-chat-emoji-toggle');
  expand.click();
  toggle.click();
  emojiPicker.hidden = false;
  emojiToggle.setAttribute('aria-expanded', 'true');
  assert.equal(harness.main.classList.contains('hundesalon-chat-expanded'), true);
  assert.equal(expand.getAttribute('aria-label'), harness.copy.collapse);
  assert.equal(menu.hidden, false);

  harness.root.listeners.get('keydown')[0]({ key: 'Escape' });

  assert.equal(harness.main.classList.contains('hundesalon-chat-expanded'), false);
  assert.equal(expand.querySelector('.hundesalon-chat-action-label').textContent, harness.copy.expand);
  assert.equal(menu.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(emojiPicker.hidden, true);
  assert.equal(emojiToggle.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(harness.closeStates, []);
  assert.equal(expand.getAttribute('aria-label'), harness.copy.expand);
});

test('vector-store sync is a no-op when the matching indexed version exists', async () => {
  const content = 'current knowledge';
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    return jsonResponse({
      data: [
        {
          id: 'file_current',
          status: 'completed',
          attributes: {
            managed_by: 'hundesalon_nika_knowledge_sync_v1',
            sha256: 'cd350fe5c7f3fb158547dbe5b7f652548b6555bd55e69594cb500afda94385d3',
          },
        },
      ],
      has_more: false,
    });
  };

  const result = await syncKnowledge({ apiKey: 'test-key', vectorStoreId: 'vs_test', content, fetchImpl });
  assert.equal(result.uploaded, false);
  assert.equal(result.detachedStaleFiles, 0);
  assert.equal(calls.length, 1);
});

test('vector-store sync indexes a new version before detaching an explicitly allowed legacy version', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const pathname = new URL(url).pathname;
    const method = init.method || 'GET';
    calls.push(`${method} ${pathname}`);
    if (method === 'GET' && pathname === '/v1/vector_stores/vs_test/files') {
      return jsonResponse({
        data: [
          {
            id: 'file_old',
            status: 'completed',
            attributes: {},
          },
        ],
        has_more: false,
      });
    }
    if (method === 'POST' && pathname === '/v1/files') return jsonResponse({ id: 'file_new' });
    if (method === 'POST' && pathname === '/v1/vector_stores/vs_test/files') {
      return jsonResponse({ id: 'file_new', status: 'in_progress' });
    }
    if (method === 'GET' && pathname === '/v1/vector_stores/vs_test/files/file_new') {
      return jsonResponse({ id: 'file_new', status: 'completed' });
    }
    if (method === 'DELETE' && pathname === '/v1/vector_stores/vs_test/files/file_old') {
      return jsonResponse({ deleted: true });
    }
    return jsonResponse({ error: { message: `Unexpected ${method} ${pathname}` } }, 500);
  };

  const result = await syncKnowledge({
    apiKey: 'test-key',
    vectorStoreId: 'vs_test',
    content: 'new knowledge',
    fetchImpl,
    delay: async () => {},
    legacyFileIds: ['file_old'],
  });
  assert.equal(result.uploaded, true);
  assert.equal(result.detachedStaleFiles, 1);
  assert.ok(
    calls.indexOf('GET /v1/vector_stores/vs_test/files/file_new') <
      calls.indexOf('DELETE /v1/vector_stores/vs_test/files/file_old')
  );
});
