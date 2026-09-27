import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCloudflareTailEvents,
  readSendPulseEmailDiagnostics,
  sendPulseEmailWasAccepted,
} from './cloudflare-tail-logs.mjs';

const event = messages => JSON.stringify({
  outcome: 'ok',
  logs: [{ level: 'info', message: messages }],
  event: { request: { url: 'https://hundesalon-nika.com/sendmail', method: 'POST' } },
});

test('reads SendPulse success from Wrangler log argument arrays without exposing unrelated fields', () => {
  const output = [
    event(['[sendpulse] email delivery', '{"ok":true,"status":200,"attempt":1}']),
    event(['unrelated log containing customer@example.test']),
  ].join('\n');

  const diagnostics = readSendPulseEmailDiagnostics(output);
  assert.deepEqual(diagnostics, [{ ok: true, status: 200, attempt: 1 }]);
  assert.equal(sendPulseEmailWasAccepted(diagnostics), true);
  assert.equal(JSON.stringify(diagnostics).includes('customer@example.test'), false);
});

test('reports provider rejection and does not interpret malformed or non-2xx data as acceptance', () => {
  const output = [
    event(['[sendpulse] email delivery', '{"ok":false,"status":401,"attempt":1}']),
    event(['[sendpulse] email delivery', '{"ok":true,"status":503,"attempt":2}']),
    event(['[sendpulse] email delivery', 'not-json']),
  ].join('\n');

  const diagnostics = readSendPulseEmailDiagnostics(output);
  assert.deepEqual(diagnostics, [
    { ok: false, status: 401, attempt: 1 },
    { ok: false, status: 503, attempt: 2 },
    { ok: false, status: null, attempt: null },
  ]);
  assert.equal(sendPulseEmailWasAccepted(diagnostics), false);
});

test('distinguishes missing log evidence from an observed provider failure', () => {
  assert.deepEqual(readSendPulseEmailDiagnostics('not-json\n{}'), []);
  assert.equal(sendPulseEmailWasAccepted([]), null);
});

test('parses Wrangler events when JSON objects are pretty-printed across lines', () => {
  const output = `Wrangler tail connected\n${JSON.stringify({
    outcome: 'ok',
    logs: [{ message: ['[sendpulse] email delivery', '{"ok":true,"status":202,"attempt":1}'] }],
  }, null, 2)}\n`;

  const events = parseCloudflareTailEvents(output);
  const diagnostics = readSendPulseEmailDiagnostics(output);
  assert.equal(events.length, 1);
  assert.deepEqual(diagnostics, [{ ok: true, status: 202, attempt: 1 }]);
  assert.equal(sendPulseEmailWasAccepted(diagnostics), true);
});
