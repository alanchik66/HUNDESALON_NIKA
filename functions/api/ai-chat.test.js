import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAiAnswer, normalizeGermanCareTerms, onRequest, selectAiChatKnowledge } from './ai-chat.js';

function installCacheStub() {
  const original = globalThis.caches;
  globalThis.caches = {
    default: {
      async match() {
        return null;
      },
      async put() {},
    },
  };
  return () => {
    if (original === undefined) delete globalThis.caches;
    else globalThis.caches = original;
  };
}

function requestBody(overrides = {}) {
  return {
    locale: 'de',
    message: 'Was kostet eine Komplettpflege für einen Zwergpudel?',
    history: [],
    pagePath: '/de/prays-list.html',
    sessionId: '12345678-1234-4234-8234-123456789012',
    ...overrides,
  };
}

function createRequest(body) {
  return new Request('https://hundesalon-nika.com/api/ai-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://hundesalon-nika.com',
    },
    body: JSON.stringify(body),
  });
}

test('knowledge retrieval selects the exact German breed and price context', () => {
  const reference = selectAiChatKnowledge('Was kostet eine Komplettpflege für einen Zwergpudel?', 'de');
  assert.match(reference, /Zwergpudel/i);
  assert.match(reference, /Komplettpflege/i);
  assert.match(reference, /€|EUR/);
});

test('knowledge retrieval matches inflected Russian and Ukrainian breed names', () => {
  const russian = selectAiChatKnowledge('Повторите цену ухода за карликовым пуделем.', 'ru');
  assert.match(russian, /Карликовый пудель/i);
  assert.match(russian, /Комплексный груминг — от 90 €/i);

  const ukrainian = selectAiChatKnowledge('Повторіть ціну догляду за карликовим пуделем.', 'uk');
  assert.match(ukrainian, /Карликовий пудель/i);
  assert.match(ukrainian, /Комплексний грумінг — від 90 €/i);
});

for (const { locale, questions, patterns } of [
  {
    locale: 'ru',
    questions: ['Что входит в первый груминг щенка?', 'Щенку 3 месяца. Его будут купать и сушить?', 'Щенок боится фена. Что вы будете делать?', 'Можно ли на первый груминг щенку 5 месяцев?', 'Первый груминг щенка лабрадора — сколько стоит?'],
    patterns: [/до 4 месяцев/, /Если щенок спокоен/, /полностью расчесать/, /искупать/, /подсушить/, /в его темпе/, /от 50 €/],
  },
  {
    locale: 'de',
    questions: ['Was gehört zur Welpen-Eingewöhnung?', 'Mein Welpe hat Angst vor dem Föhn. Wird er gebadet?'],
    patterns: [/bis 4 Monate/, /Wenn der Welpe ruhig/, /vollständig bürsten/, /baden/, /antrocknen/, /in seinem Tempo/, /ab 50 €/],
  },
  {
    locale: 'en',
    questions: ['What is included in first puppy grooming?', 'My puppy is afraid of the dryer. Will you bathe him?'],
    patterns: [/up to 4 months/, /If the puppy stays calm/, /brush the whole coat/, /full bath/, /gently dry/, /at their pace/, /from €50/],
  },
  {
    locale: 'uk',
    questions: ['Що входить у перший грумінг цуценяти?', 'Цуценя боїться фена. Чи будете його купати?'],
    patterns: [/до 4 місяців/, /Якщо цуценя спокійне/, /повністю розчесати/, /викупати/, /підсушити/, /в його темпі/, /від 50 €/],
  },
]) {
  test(`${locale}: puppy questions retrieve the age, conditional care and canonical starting price together`, () => {
    for (const question of questions) {
      const reference = selectAiChatKnowledge(question, locale);
      for (const pattern of patterns) assert.match(reference, pattern, question);
      assert.doesNotMatch(reference, /It can include light brushing, careful bathing and drying, nails/);
    }
  });
}

test('German post-processing removes forbidden English care terminology', () => {
  assert.equal(
    normalizeGermanCareTerms('Unser Groomer empfiehlt Grooming.', 'de'),
    'Unser Hundefriseur empfiehlt Hundepflege.'
  );
  assert.equal(normalizeGermanCareTerms('Grooming', 'en'), 'Grooming');
});

test('AI answer normalization removes unsupported Markdown without changing the brand', () => {
  assert.equal(normalizeAiAnswer('**Ab 90 €** bei `HUNDESALON_NIKA`.', 'de'), 'Ab 90 € bei HUNDESALON_NIKA.');
  assert.equal(normalizeAiAnswer('## Цена\n__От 90 €__', 'ru'), 'Цена\nОт 90 €');
});

test('explicit human request is handed off without an OpenAI call', async () => {
  const restoreCache = installCacheStub();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('unexpected');
  };

  try {
    const response = await onRequest({
      request: createRequest(requestBody({ message: 'Ich möchte mit einem Mitarbeiter sprechen.' })),
      env: {},
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.handoff, true);
    assert.equal(payload.available, true);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCache();
  }
});

test('inflected Russian human request is recognized without a model call', async () => {
  const restoreCache = installCacheStub();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('unexpected');
  };

  try {
    const response = await onRequest({
      request: createRequest(requestBody({ locale: 'ru', message: 'Хочу поговорить со специалистом.' })),
      env: { OPENAI_API_KEY: 'test-key' },
    });
    const payload = await response.json();
    assert.equal(payload.handoff, true);
    assert.equal(payload.available, true);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCache();
  }
});

test('missing OpenAI secret fails safely and offers personal support', async () => {
  const restoreCache = installCacheStub();
  try {
    const response = await onRequest({ request: createRequest(requestBody()), env: {} });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.available, false);
    assert.equal(payload.handoff, true);
    assert.match(payload.answer, /persönliche Beratung/i);
  } finally {
    restoreCache();
  }
});

test('OpenAI request uses bounded context and returns the model answer', async () => {
  const restoreCache = installCacheStub();
  const originalFetch = globalThis.fetch;
  let upstreamPayload;
  globalThis.fetch = async (_url, init) => {
    upstreamPayload = JSON.parse(init.body);
    return new Response(JSON.stringify({ output_text: 'Die Komplettpflege kostet laut Preisliste **ab 80 €**.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await onRequest({
      request: createRequest(
        requestBody({
          history: Array.from({ length: 12 }, (_, index) => ({
            role: index % 2 ? 'assistant' : 'user',
            content: `Nachricht ${index} ${'x'.repeat(1200)}`,
          })),
        })
      ),
      env: { OPENAI_API_KEY: 'test-key' },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.available, true);
    assert.equal(payload.handoff, false);
    assert.match(payload.answer, /ab 80 €/);
    assert.doesNotMatch(payload.answer, /\*\*/);
    assert.equal(upstreamPayload.model, 'gpt-5.6-luna');
    assert.equal(upstreamPayload.store, false);
    assert.equal(upstreamPayload.reasoning.effort, 'low');
    assert.equal(upstreamPayload.text.verbosity, 'low');
    assert.match(upstreamPayload.instructions, /Default to 1-3 short sentences, at most 60 words/);
    assert.match(upstreamPayload.instructions, /Give more detail only when the customer explicitly asks/);
    assert.match(upstreamPayload.instructions, /Preserve essential conditions such as age limits, conditional care/);
    assert.match(upstreamPayload.instructions, /never reproduce entire reference blocks or the full knowledge document/);
    assert.ok(upstreamPayload.instructions.length < 12_500);
    assert.ok(upstreamPayload.input.length < 10_000);
    assert.doesNotMatch(upstreamPayload.instructions, /test-key/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCache();
  }
});

test('invalid locale and oversized messages are rejected', async () => {
  const restoreCache = installCacheStub();
  try {
    const invalidLocale = await onRequest({
      request: createRequest(requestBody({ locale: 'fr' })),
      env: {},
    });
    assert.equal(invalidLocale.status, 400);

    const oversized = await onRequest({
      request: createRequest(requestBody({ message: 'x'.repeat(1500) })),
      env: {},
    });
    assert.equal(oversized.status, 400);
  } finally {
    restoreCache();
  }
});

test('puppy request sends the approved care conditions to the answer model without a live API call', async () => {
  const restoreCache = installCacheStub();
  const originalFetch = globalThis.fetch;
  let instructions;
  globalThis.fetch = async (_url, init) => {
    instructions = JSON.parse(init.body).instructions;
    return new Response(JSON.stringify({ output_text: 'Первый визит — для щенков до 4 месяцев, от 50 €.' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await onRequest({
      request: createRequest(requestBody({ locale: 'ru', message: 'Что входит в первый груминг щенка?', pagePath: '/ru/prays-list.html' })),
      env: { OPENAI_API_KEY: 'test-key' },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).available, true);
    for (const pattern of [/до 4 месяцев/, /Если щенок спокоен/, /полностью расчесать/, /искупать/, /подсушить/, /в его темпе/, /от 50 €/]) {
      assert.match(instructions, pattern);
    }
    assert.ok(instructions.length < 12_500);
    assert.doesNotMatch(instructions, /It can include light brushing, careful bathing and drying, nails/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCache();
  }
});
