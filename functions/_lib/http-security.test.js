import test from 'node:test';
import assert from 'node:assert/strict';

import { isAllowedOrigin, isLocalDevOrigin } from './http-security.js';

test('allows exact same-origin requests', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com', 'https://hundesalon-nika.com/sendmail'), true);
});

test('allows local development cross-port requests on the same exact host', () => {
  assert.equal(isAllowedOrigin('http://[::1]:5502', 'http://[::1]:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5502', 'http://127.0.0.1:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://127.1.2.3:5502', 'http://127.1.2.3:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://10.2.3.4:5502', 'http://10.2.3.4:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://172.20.10.5:5502', 'http://172.20.10.5:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://192.168.1.25:5502', 'http://192.168.1.25:8788/sendmail'), true);
});

test('rejects attacker-controlled localhost lookalikes', () => {
  assert.equal(isLocalDevOrigin('http://localhost.attacker.tld:5502'), false);
  assert.equal(isLocalDevOrigin('http://sub.localhost:5502'), false);
  assert.equal(isLocalDevOrigin('http://local-host.com:5502'), false);
  assert.equal(isAllowedOrigin('http://localhost.attacker.tld:5502', 'https://hundesalon-nika.com/sendmail'), false);
  assert.equal(isAllowedOrigin('http://sub.localhost:5502', 'http://localhost:8788/sendmail'), false);
});

test('rejects protocol mismatches', () => {
  assert.equal(isAllowedOrigin('http://hundesalon-nika.com', 'https://hundesalon-nika.com/sendmail'), false);
});

test('rejects non-local cross-port origins for production hosts', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com:444', 'https://hundesalon-nika.com/sendmail'), false);
});
