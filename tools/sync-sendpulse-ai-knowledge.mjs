/**
 * Synchronize the generated HUNDESALON_NIKA knowledge file with the OpenAI
 * vector store selected by the SendPulse AI Agent.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_PATH = path.join(ROOT, 'knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md');
const DEFAULT_STORE_NAME = 'HUNDESAL_NIKA Website Knowledge';
const MANAGED_BY = 'hundesalon_nika_knowledge_sync_v1';
const DEFAULT_API_BASE = 'https://api.openai.com';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function safeError(payload, status) {
  const message = payload?.error?.message || payload?.message || `HTTP ${status}`;
  return String(message).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
}

function createClient({ apiKey, apiBase = DEFAULT_API_BASE, fetchImpl = fetch }) {
  return async function request(pathname, { method = 'GET', json, form } = {}) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const init = { method, headers };
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (form) {
      init.body = form;
    }

    const response = await fetchImpl(`${apiBase}${pathname}`, init);
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }
    if (!response.ok) throw new Error(`OpenAI ${method} ${pathname} failed: ${safeError(payload, response.status)}`);
    return payload;
  };
}

async function listAll(request, pathname) {
  const entries = [];
  let after = '';
  for (let page = 0; page < 50; page += 1) {
    const separator = pathname.includes('?') ? '&' : '?';
    const payload = await request(`${pathname}${separator}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    entries.push(...(payload.data || []));
    if (!payload.has_more || !payload.last_id) break;
    after = payload.last_id;
  }
  return entries;
}

async function resolveVectorStore(request, { vectorStoreId, vectorStoreName }) {
  if (vectorStoreId) return { id: vectorStoreId, name: vectorStoreName || '' };
  const stores = await listAll(request, '/v1/vector_stores');
  const matches = stores.filter(store => store.name === vectorStoreName);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Multiple OpenAI vector stores are named “${vectorStoreName}”. Set SENDPULSE_AI_VECTOR_STORE_ID.`);
  }
  throw new Error(
    `OpenAI vector store “${vectorStoreName}” was not found. Select an OpenAI File Search store in SendPulse or set SENDPULSE_AI_VECTOR_STORE_ID.`,
  );
}

async function waitUntilIndexed(request, vectorStoreId, fileId, { delay = sleep, pollMilliseconds = 1_500 } = {}) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const file = await request(`/v1/vector_stores/${vectorStoreId}/files/${fileId}`);
    if (file.status === 'completed') return file;
    if (file.status === 'failed' || file.status === 'cancelled') {
      throw new Error(`OpenAI File Search indexing ended with status ${file.status}.`);
    }
    await delay(pollMilliseconds);
  }
  throw new Error('OpenAI File Search indexing did not complete within two minutes.');
}

export async function syncKnowledge({
  apiKey,
  vectorStoreId = '',
  vectorStoreName = DEFAULT_STORE_NAME,
  legacyFileIds = [],
  content = readFileSync(KNOWLEDGE_PATH, 'utf8'),
  fetchImpl = fetch,
  delay = sleep,
  apiBase = DEFAULT_API_BASE,
} = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
  const request = createClient({ apiKey, apiBase, fetchImpl });
  const store = await resolveVectorStore(request, { vectorStoreId, vectorStoreName });
  const digest = sha256(content);
  const vectorFiles = await listAll(request, `/v1/vector_stores/${store.id}/files`);
  const managed = vectorFiles.filter(file => file.attributes?.managed_by === MANAGED_BY);
  let current = managed.find(file => file.attributes?.sha256 === digest && file.status !== 'failed');

  if (current && current.status !== 'completed') {
    current = await waitUntilIndexed(request, store.id, current.id, { delay });
  }

  let uploaded = false;
  if (!current) {
    const filename = `HUNDESALON_NIKA-website-knowledge-${digest.slice(0, 12)}.md`;
    const form = new FormData();
    form.set('purpose', 'assistants');
    form.set('file', new Blob([content], { type: 'text/markdown' }), filename);
    const uploadedFile = await request('/v1/files', { method: 'POST', form });

    current = await request(`/v1/vector_stores/${store.id}/files`, {
      method: 'POST',
      json: {
        file_id: uploadedFile.id,
        attributes: {
          managed_by: MANAGED_BY,
          sha256: digest,
          source: 'hundesalon-nika.com',
          locales: 'de,en,ru,uk',
        },
        chunking_strategy: {
          type: 'static',
          static: {
            max_chunk_size_tokens: 400,
            chunk_overlap_tokens: 80,
          },
        },
      },
    });
    current = current.status === 'completed'
      ? current
      : await waitUntilIndexed(request, store.id, uploadedFile.id, { delay });
    uploaded = true;
  }

  const explicitlyReplaceable = new Set(legacyFileIds.filter(Boolean));
  const stale = vectorFiles.filter(file =>
    file.id !== current.id
    && (
      (file.attributes?.managed_by === MANAGED_BY && file.attributes?.sha256 !== digest)
      || explicitlyReplaceable.has(file.id)
    )
  );
  for (const file of stale) {
    await request(`/v1/vector_stores/${store.id}/files/${file.id}`, { method: 'DELETE' });
  }

  return {
    vectorStoreId: store.id,
    vectorStoreName: store.name || vectorStoreName,
    fileId: current.id,
    sha256: digest,
    uploaded,
    detachedStaleFiles: stale.length,
  };
}

export async function runCli(argv = process.argv.slice(2)) {
  loadDevVars();
  const optional = argv.includes('--optional');
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey && optional) {
    console.log('[sendpulse-knowledge] sync skipped: OPENAI_API_KEY is not configured.');
    return { skipped: true };
  }

  const result = await syncKnowledge({
    apiKey,
    vectorStoreId: process.env.SENDPULSE_AI_VECTOR_STORE_ID?.trim() || '',
    vectorStoreName: process.env.SENDPULSE_AI_VECTOR_STORE_NAME?.trim() || DEFAULT_STORE_NAME,
    legacyFileIds: (process.env.SENDPULSE_AI_LEGACY_FILE_IDS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  });
  console.log(`[sendpulse-knowledge] vector store: ${result.vectorStoreName || result.vectorStoreId}`);
  console.log(`[sendpulse-knowledge] content hash: ${result.sha256.slice(0, 16)}`);
  console.log(`[sendpulse-knowledge] ${result.uploaded ? 'uploaded and indexed' : 'already current'}; stale detached: ${result.detachedStaleFiles}`);
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    await runCli();
  } catch (error) {
    console.error(`[sendpulse-knowledge] ${error.message}`);
    process.exitCode = 1;
  }
}
