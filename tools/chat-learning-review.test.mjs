import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { ReadableStream } from 'node:stream/web';
import {
  createD1ReviewStore,
  createFixtureReviewStore,
  createReviewAuthenticate,
  startReviewServer,
} from './chat-learning-review.mjs';

const ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';
const FAQ = {
  id: ID,
  action: 'approve',
  question: 'How can I prepare a poodle for a grooming visit?',
  answer: 'Brush the coat gently and describe its condition when requesting an appointment.',
  confirmPrivacy: true,
};

function rawGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fixture(t, store) {
  const database = store || (await createFixtureReviewStore());
  const instance = await startReviewServer({ store: database });
  t.after(async () => {
    await instance.close();
    database.close?.();
  });
  const page = await fetch(instance.origin);
  const html = await page.text();
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const csrf = html.match(/const csrf = '([a-f0-9]+)'/)[1];
  const headers = {
    Cookie: cookie,
    'X-Review-CSRF': csrf,
    Origin: instance.origin,
    'Content-Type': 'application/json',
  };
  return {
    ...instance,
    store: database,
    html,
    page,
    headers,
    post: body => fetch(`${instance.origin}/api/review`, { method: 'POST', headers, body: JSON.stringify(body) }),
  };
}

test('local review exposes only pending examples and publishes only the manually rewritten FAQ without changing CRM history', async t => {
  const instance = await fixture(t);
  const original = await instance.store.query('SELECT * FROM chat_messages');
  const pending = await fetch(`${instance.origin}/api/pending`, { headers: instance.headers });
  const rows = (await pending.json()).examples;
  assert.deepEqual(
    rows.map(row => row.id),
    [ID, SECOND_ID]
  );
  assert.equal(
    (
      await instance.store.query(
        "SELECT COUNT(*) AS count FROM chat_learning_examples WHERE review_status = 'approved'"
      )
    ).results[0].count,
    1
  );
  assert.equal((await instance.post(FAQ)).status, 200);
  const approved = (
    await instance.store.query(
      "SELECT customer_message, staff_reply FROM chat_learning_examples WHERE id = ? AND review_status = 'approved'",
      [ID]
    )
  ).results[0];
  assert.equal(approved.customer_message, FAQ.question);
  assert.equal(approved.staff_reply, FAQ.answer);
  assert.equal(JSON.stringify(approved).includes('Fixture Person'), false);
  assert.deepEqual(await instance.store.query('SELECT * FROM chat_messages'), original);
  assert.equal((await instance.post(FAQ)).status, 409);
  assert.equal((await instance.post({ id: SECOND_ID, action: 'reject' })).status, 200);
  assert.equal(
    (await instance.store.query('SELECT review_status FROM chat_learning_examples WHERE id = ?', [SECOND_ID]))
      .results[0].review_status,
    'rejected'
  );
  assert.deepEqual(
    (await (await fetch(`${instance.origin}/api/pending`, { headers: instance.headers })).json()).examples,
    []
  );
});

test('approval requires explicit privacy review, two rewritten fields and no obvious identifiers', async t => {
  const instance = await fixture(t);
  const source = (
    await instance.store.query('SELECT customer_message, staff_reply FROM chat_learning_examples WHERE id = ?', [ID])
  ).results[0];
  for (const input of [
    { ...FAQ, confirmPrivacy: false },
    { ...FAQ, confirmPrivacy: 'true' },
    { ...FAQ, question: source.customer_message },
    { ...FAQ, answer: source.staff_reply },
    { ...FAQ, answer: 'Contact customer@example.com about this appointment.' },
    { ...FAQ, question: 'Call +49 341 5550100 about poodle care.' },
    { ...FAQ, answer: 'Visit https://private.example.com/contact for personal details.' },
    { ...FAQ, question: 'short' },
    { ...FAQ, answer: 'a'.repeat(1201) },
    { ...FAQ, action: 'delete' },
    { ...FAQ, id: "' OR 1 = 1 --" },
  ]) {
    assert.equal((await instance.post(input)).status, 400);
  }
  assert.equal(
    (await instance.store.query('SELECT review_status FROM chat_learning_examples WHERE id = ?', [ID])).results[0]
      .review_status,
    'pending'
  );
});

test('review read and write authority rejects cross-origin, DNS rebinding, missing cookies and CSRF', async t => {
  const instance = await fixture(t);
  for (const headers of [
    {},
    { ...instance.headers, Cookie: '' },
    { ...instance.headers, 'X-Review-CSRF': '' },
    { ...instance.headers, Origin: 'https://attacker.example' },
    { ...instance.headers, Host: 'attacker.example' },
    { ...instance.headers, 'Sec-Fetch-Site': 'cross-site' },
  ]) {
    const response = await rawGet(`${instance.origin}/api/pending`, headers);
    assert.equal(
      response.status,
      403,
      `Rejected header set: ${Object.keys(headers).join(', ')}; origin=${headers.Origin || ''}; host=${headers.Host || ''}; site=${headers['Sec-Fetch-Site'] || ''}`
    );
    assert.equal(response.body.includes('Fixture Person'), false);
  }
  for (const headers of [
    { ...instance.headers, Origin: '' },
    { ...instance.headers, 'X-Review-CSRF': 'invalid' },
    { ...instance.headers, Origin: 'null' },
    { ...instance.headers, Cookie: '' },
  ]) {
    assert.equal(
      (await fetch(`${instance.origin}/api/review`, { method: 'POST', headers, body: JSON.stringify(FAQ) })).status,
      403
    );
  }
  assert.equal((await rawGet(instance.origin, { Host: 'attacker.example' })).status, 403);
  assert.equal((await fetch(`${instance.origin}/api/review`, { headers: instance.headers })).status, 405);
  assert.equal(
    (await fetch(`${instance.origin}/api/review`, { method: 'OPTIONS', headers: instance.headers })).status,
    405
  );
  assert.equal(
    (await instance.store.query('SELECT review_status FROM chat_learning_examples WHERE id = ?', [ID])).results[0]
      .review_status,
    'pending'
  );
  assert.match(instance.page.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.match(instance.page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(instance.page.headers.get('cache-control'), 'no-store');
  assert.equal(instance.page.headers.get('access-control-allow-origin'), null);
  assert.equal(instance.server.address().address, '127.0.0.1');
});

test('review bounds request bodies and never leaks SQL or private backend error details', async t => {
  const instance = await fixture(t);
  assert.equal(
    (
      await fetch(`${instance.origin}/api/review`, {
        method: 'POST',
        headers: { ...instance.headers, 'Content-Type': 'text/plain' },
        body: '{}',
      })
    ).status,
    415
  );
  assert.equal(
    (await fetch(`${instance.origin}/api/review`, { method: 'POST', headers: instance.headers, body: '{' })).status,
    400
  );
  assert.equal(
    (
      await fetch(`${instance.origin}/api/review`, {
        method: 'POST',
        headers: instance.headers,
        body: 'a'.repeat(8193),
      })
    ).status,
    413
  );
  // A streaming body has no Content-Length; the byte limit must still apply.
  const streaming = await fetch(`${instance.origin}/api/review`, {
    method: 'POST',
    headers: instance.headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('a'.repeat(8193)));
        controller.close();
      },
    }),
    duplex: 'half',
  });
  assert.equal(streaming.status, 413);
  const failed = await fixture(t, {
    async query() {
      throw new Error('SQL error: Fixture Person / fake-secret');
    },
  });
  const response = await fetch(`${failed.origin}/api/pending`, { headers: failed.headers });
  assert.equal(response.status, 502);
  const error = await response.text();
  assert.equal(error.includes('Fixture Person'), false);
  assert.equal(error.includes('fake-secret'), false);
});

test('reviewed text is bound as data and cannot execute SQL', async t => {
  const instance = await fixture(t);
  const answer = "Use the public price list.'); DROP TABLE chat_messages; --";
  assert.equal((await instance.post({ ...FAQ, answer })).status, 200);
  assert.equal(
    (await instance.store.query('SELECT staff_reply FROM chat_learning_examples WHERE id = ?', [ID])).results[0]
      .staff_reply,
    answer
  );
  assert.equal((await instance.store.query('SELECT COUNT(*) AS count FROM chat_messages')).results[0].count, 1);
});

test('D1 adapter reuses existing admin authentication and sends structured SQL parameters to the explicit target', async () => {
  const calls = [];
  const auth = { Authorization: 'Bearer fake-test-token' };
  const store = createD1ReviewStore({
    databaseId: ID,
    accountId: 'a'.repeat(32),
    authenticate: async () => auth,
    api: async (...args) => {
      calls.push(args);
      return [{ success: true, results: [], meta: { changes: 1 } }];
    },
  });
  const sql = 'UPDATE chat_learning_examples SET staff_reply = ? WHERE id = ?';
  const params = ["A FAQ with apostrophes ' and semicolons ;", ID];
  await store.query(sql, params);
  assert.equal(calls[0][0], auth);
  assert.equal(calls[0][1], `/accounts/${'a'.repeat(32)}/d1/database/${ID}/query`);
  assert.deepEqual(JSON.parse(calls[0][2].body), { sql, params });
  assert.equal(calls[0][2].method, 'POST');
  assert.throws(() => createD1ReviewStore({ databaseId: '../production' }), /Invalid D1 target/);
  const failed = createD1ReviewStore({
    databaseId: ID,
    authenticate: async () => auth,
    api: async () => [{ success: false }],
  });
  await assert.rejects(failed.query('SELECT 1'), /D1 query failed/);
});

test('existing Wrangler OAuth takes priority over a stale scoped token and refreshes its own configuration', async () => {
  const stored = { access_token: 'expired-oauth-fixture', refresh_token: 'fixture-refresh', expiration_time: 0 };
  const refreshed = [];
  const auth = createReviewAuthenticate({
    readOAuth: () => stored,
    refreshOAuth: async value => {
      refreshed.push(value);
      return 'valid-oauth-fixture';
    },
    readApiHeaders: () => {
      throw new Error('A stale scoped token must not shadow existing OAuth');
    },
  });
  assert.deepEqual(await auth(), { Authorization: 'Bearer valid-oauth-fixture' });
  assert.deepEqual(refreshed, [stored]);
  const failed = createReviewAuthenticate({
    readOAuth: () => stored,
    refreshOAuth: async () => {
      throw new Error('OAuth refresh failed');
    },
    readApiHeaders: () => {
      throw new Error('Do not change authentication after a refresh failure');
    },
  });
  await assert.rejects(failed(), /OAuth refresh failed/);
});

test('scoped authentication is used only without readable OAuth configuration and missing credentials fail closed', async () => {
  const scoped = { Authorization: 'Bearer scoped-fixture' };
  const readMissing = () => {
    throw new Error('No Wrangler config');
  };
  const auth = createReviewAuthenticate({
    readOAuth: readMissing,
    refreshOAuth: async () => {
      throw new Error('There is no OAuth configuration to refresh');
    },
    readApiHeaders: () => scoped,
  });
  assert.equal(await auth(), scoped);
  const missing = createReviewAuthenticate({ readOAuth: readMissing, readApiHeaders: () => null });
  await assert.rejects(missing(), /authentication is unavailable/);
});
