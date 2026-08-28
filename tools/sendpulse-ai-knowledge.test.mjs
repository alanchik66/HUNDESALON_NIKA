import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildKnowledgeDocument,
  extractPublicText,
  normalizeSourceText,
} from './generate-sendpulse-ai-knowledge.mjs';
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
    `Generated source fingerprint: sha256:${'0'.repeat(64)}`,
  );
  const { content, fingerprint } = buildKnowledgeDocument({ template: staleTemplate });
  assert.match(content, new RegExp(`^Generated source fingerprint: sha256:${fingerprint}$`, 'm'));
  assert.doesNotMatch(content, /^Generated source fingerprint: sha256:0{64}$/m);
  assert.equal(content.match(/^Generated source fingerprint:/gm)?.length, 1);
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

test('mobile SendPulse welcome toast does not block page interactions', () => {
  const source = readFileSync(path.join(ROOT, 'assets/js/sendpulse-integrations.js'), 'utf8');
  assert.match(
    source,
    /@media \(max-width: 560px\)[\s\S]*?\.widget-toast\s*\{[\s\S]*?pointer-events:\s*none !important;[\s\S]*?\.widget-toast \.button-close\s*\{[\s\S]*?pointer-events:\s*auto !important;/
  );
});

test('vector-store sync is a no-op when the matching indexed version exists', async () => {
  const content = 'current knowledge';
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET' });
    return jsonResponse({
      data: [{
        id: 'file_current',
        status: 'completed',
        attributes: {
          managed_by: 'hundesalon_nika_knowledge_sync_v1',
          sha256: 'cd350fe5c7f3fb158547dbe5b7f652548b6555bd55e69594cb500afda94385d3',
        },
      }],
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
        data: [{
          id: 'file_old',
          status: 'completed',
          attributes: {},
        }],
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
  assert.ok(calls.indexOf('GET /v1/vector_stores/vs_test/files/file_new') < calls.indexOf('DELETE /v1/vector_stores/vs_test/files/file_old'));
});
