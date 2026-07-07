import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedOrigin, isLocalDevOrigin } from './http-security.js';

test('allows exact same-origin requests', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com', 'https://hundesalon-nika.com/sendmail'), true);
});

test('allows local development cross-port requests on the same exact host', () => {
  assert.equal(isAllowedOrigin('http://127.0.0.1:5502', 'http://127.0.0.1:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://192.168.1.25:5502', 'http://192.168.1.25:8788/sendmail'), true);
});

test('rejects attacker-controlled localhost lookalikes', () => {
  assert.equal(isLocalDevOrigin('http://localhost.attacker.tld:5502'), false);
  assert.equal(isAllowedOrigin('http://localhost.attacker.tld:5502', 'https://hundesalon-nika.com/sendmail'), false);
});

test('rejects non-local cross-port origins for production hosts', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com:444', 'https://hundesalon-nika.com/sendmail'), false);
});
