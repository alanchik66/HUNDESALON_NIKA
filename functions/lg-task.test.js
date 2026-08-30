import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './lg-task.js';

test('returns 400 for invalid JSON without referencing uninitialized state', async () => {
  const response = await onRequest({
    request: new Request('https://hundesalon-nika.com/lg-task', {
      method: 'POST',
      headers: {
        Origin: 'https://hundesalon-nika.com',
        'Content-Type': 'application/json',
      },
      body: '{not-json',
    }),
    env: {},
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request failed' });
});
