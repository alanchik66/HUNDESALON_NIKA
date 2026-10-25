import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { getForwardDestinations } from './src/index.js';

function createMessage(overrides = {}) {
  const actions = [];
  return {
    from: 'customer@example.com',
    to: 'info@hundesalon-nika.com',
    headers: new Headers({ subject: 'Termin bitte' }),
    raw: 'Subject: Termin bitte\r\n\r\nHallo',
    rawSize: 36,
    async forward(destination) {
      actions.push(['forward', destination]);
    },
    setReject(reason) {
      actions.push(['reject', reason]);
    },
    actions,
    ...overrides,
  };
}

test('normalizes, validates and deduplicates forwarding destinations', () => {
  assert.deepEqual(
    getForwardDestinations({
      INFO_FORWARD_DESTINATION: ' Team@Example.com; owner@example.com,team@example.com ',
    }),
    ['team@example.com', 'owner@example.com']
  );
  assert.deepEqual(getForwardDestinations({ INFO_FORWARD_DESTINATION: 'invalid' }), []);
  assert.deepEqual(getForwardDestinations({ INFO_FORWARD_DESTINATION: ' Info@Hundesalon-Nika.com ' }), []);
  assert.deepEqual(getForwardDestinations({ INFO_FORWARD_DESTINATION: '<team@example.com>' }), []);
});

test('rejects a misconfigured route before consuming the message', async () => {
  const message = createMessage();
  await worker.email(message, {});
  assert.deepEqual(message.actions, [['reject', 'Routing configuration error.']]);
});

test('forwards the original before sending the auto reply', async () => {
  const originalFetch = globalThis.fetch;
  const events = [];
  const message = createMessage({
    async forward(destination) {
      events.push(['forward', destination]);
    },
  });
  globalThis.fetch = async () => {
    events.push(['reply']);
    return new Response('{}', { status: 200 });
  };

  try {
    await worker.email(message, {
      INFO_FORWARD_DESTINATION: 'team@example.com',
      INFO_AUTOREPLY_SECRET: 'test-secret',
    });
    assert.deepEqual(events, [['forward', 'team@example.com'], ['reply']]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('forwards the original to every configured destination', async () => {
  const message = createMessage({ from: 'no-reply@example.com' });
  await worker.email(message, {
    INFO_FORWARD_DESTINATION: 'team@example.com,owner@example.com',
  });
  assert.deepEqual(message.actions, [
    ['forward', 'team@example.com'],
    ['forward', 'owner@example.com'],
  ]);
});

test('keeps a forwarded message accepted when the optional auto reply fails', async () => {
  const originalFetch = globalThis.fetch;
  const message = createMessage();
  globalThis.fetch = async () => new Response('{}', { status: 502 });

  try {
    await worker.email(message, {
      INFO_FORWARD_DESTINATION: 'team@example.com',
      INFO_AUTOREPLY_SECRET: 'test-secret',
    });
    assert.deepEqual(message.actions, [['forward', 'team@example.com']]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('forwards large messages without buffering their raw body', async () => {
  const originalFetch = globalThis.fetch;
  let replies = 0;
  const message = createMessage({
    rawSize: 10 * 1024 * 1024,
    headers: new Headers({ subject: 'Hello' }),
  });
  Object.defineProperty(message, 'raw', {
    get() {
      throw new Error('raw body should not be read');
    },
  });
  globalThis.fetch = async () => {
    replies += 1;
    return Response.json({ ok: true });
  };

  try {
    await worker.email(message, {
      INFO_FORWARD_DESTINATION: 'team@example.com',
      INFO_AUTOREPLY_SECRET: 'test-secret',
    });
    assert.deepEqual(message.actions, [['forward', 'team@example.com']]);
    assert.equal(replies, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const suppressedMessages = [
  ['empty envelope sender', { from: '' }],
  ['null reverse path', { from: '<>' }],
  ['invalid sender', { from: 'not-an-email' }],
  ['self info address', { from: 'Info@Hundesalon-Nika.com' }],
  ['self support address', { from: 'support@hundesalon-nika.com' }],
  ['self noreply address', { from: 'noreply@hundesalon-nika.com' }],
  ['self subdomain', { from: 'service@mail.hundesalon-nika.com' }],
  ['mailer daemon', { from: 'MAILER-DAEMON@example.com' }],
  ['postmaster', { from: 'postmaster@example.com' }],
  ['bounce sender', { from: 'bounces+123@example.com' }],
  ['list bounce sender', { from: 'news-bounces@example.com' }],
  ['noreply sender', { from: 'no-reply@example.com' }],
  ['list owner', { from: 'owner-news@example.com' }],
  ['list request address', { from: 'news-request@example.com' }],
  ['automatic reply', { headers: { 'Auto-Submitted': 'auto-replied' } }],
  ['automatic generation', { headers: { 'Auto-Submitted': 'auto-generated; owner=system' } }],
  ['automatic extension', { headers: { 'Auto-Submitted': 'x-system' } }],
  ['list ID', { headers: { 'List-Id': '<customers.example.com>' } }],
  ['list unsubscribe', { headers: { 'List-Unsubscribe': '<mailto:unsubscribe@example.com>' } }],
  ['all response suppression', { headers: { 'X-Auto-Response-Suppress': 'All' } }],
  ['OOF response suppression', { headers: { 'X-Auto-Response-Suppress': 'OOF, AutoReply' } }],
  ['bulk precedence', { headers: { Precedence: ' BULK ' } }],
  ['list precedence', { headers: { Precedence: 'list' } }],
  ['junk precedence', { headers: { Precedence: 'junk' } }],
  ['delivery report', { headers: { 'Content-Type': 'multipart/report; report-type=delivery-status' } }],
  ['delivery status', { headers: { 'Content-Type': 'message/delivery-status' } }],
  ['read receipt', { headers: { 'Content-Type': 'message/disposition-notification' } }],
];

for (const [name, overrides] of suppressedMessages) {
  test(`forwards without an auto reply: ${name}`, async () => {
    const originalFetch = globalThis.fetch;
    let replies = 0;
    const message = createMessage({
      ...overrides,
      headers: new Headers({ subject: 'Test', ...overrides.headers }),
    });
    globalThis.fetch = async () => {
      replies += 1;
      return Response.json({ ok: true });
    };

    try {
      await worker.email(message, {
        INFO_FORWARD_DESTINATION: 'team@example.com',
        INFO_AUTOREPLY_SECRET: 'test-secret',
      });
      assert.deepEqual(message.actions, [['forward', 'team@example.com']]);
      assert.equal(replies, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test('allows a human message with explicit no auto-submission and suppression', async () => {
  const originalFetch = globalThis.fetch;
  let replies = 0;
  const message = createMessage({
    headers: new Headers({ 'Auto-Submitted': 'no (human); owner=user', 'X-Auto-Response-Suppress': 'None' }),
  });
  globalThis.fetch = async () => {
    replies += 1;
    return Response.json({ ok: true });
  };

  try {
    await worker.email(message, {
      INFO_FORWARD_DESTINATION: 'team@example.com',
      INFO_AUTOREPLY_SECRET: 'test-secret',
    });
    assert.deepEqual(message.actions, [['forward', 'team@example.com']]);
    assert.equal(replies, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not follow relay redirects or reject an already forwarded original', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const message = createMessage();
  let calls = 0;
  let loggedFailure = '';
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/relay' } });
  };
  console.error = (...args) => {
    loggedFailure += args.join(' ');
  };

  try {
    await worker.email(message, {
      INFO_FORWARD_DESTINATION: 'team@example.com',
      INFO_AUTOREPLY_SECRET: 'test-secret',
    });
    assert.equal(calls, 1);
    assert.deepEqual(message.actions, [['forward', 'team@example.com']]);
    assert.match(loggedFailure, /"ok":false/);
    assert.match(loggedFailure, /"status":302/);
    assert.doesNotMatch(loggedFailure, /test-secret/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('does not send an auto reply when forwarding fails', async () => {
  const originalFetch = globalThis.fetch;
  let replies = 0;
  const message = createMessage({
    async forward() {
      throw new Error('forward unavailable');
    },
  });
  globalThis.fetch = async () => {
    replies += 1;
    return Response.json({ ok: true });
  };

  try {
    await assert.rejects(
      worker.email(message, {
        INFO_FORWARD_DESTINATION: 'team@example.com',
        INFO_AUTOREPLY_SECRET: 'test-secret',
      }),
      /forward unavailable/
    );
    assert.equal(replies, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
