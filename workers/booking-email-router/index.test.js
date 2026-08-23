import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { getDestinations } from './src/index.js';

test('normalizes and deduplicates exactly two forwarding destinations', () => {
  assert.deepEqual(
    getDestinations({
      BOOKING_FORWARD_DESTINATIONS: ' First@example.com,second@example.com,first@example.com ',
    }),
    ['first@example.com', 'second@example.com']
  );
});

test('forwards one incoming message to both configured destinations', async () => {
  const forwarded = [];
  const message = {
    forward: async destination => forwarded.push(destination),
    setReject: () => assert.fail('valid routing must not reject the message'),
  };

  await worker.email(message, {
    BOOKING_FORWARD_DESTINATIONS: 'first@example.com,second@example.com',
  });

  assert.deepEqual(forwarded.sort(), ['first@example.com', 'second@example.com']);
});

test('rejects mail when the destination configuration is incomplete', async () => {
  let rejection = '';
  const message = {
    forward: async () => assert.fail('invalid routing must not forward the message'),
    setReject: reason => {
      rejection = reason;
    },
  };

  await worker.email(message, {
    BOOKING_FORWARD_DESTINATIONS: 'first@example.com',
  });

  assert.equal(rejection, 'Temporary routing configuration error.');
});
