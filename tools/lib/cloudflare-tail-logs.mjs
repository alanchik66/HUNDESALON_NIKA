const SENDPULSE_EMAIL_LOG = '[sendpulse] email delivery';

export function parseCloudflareTailEvents(value) {
  const source = String(value || '');
  const events = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (start < 0) {
      if (character === '{' || character === '[') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') depth -= 1;

    if (depth === 0) {
      try {
        const parsed = JSON.parse(source.slice(start, index + 1));
        events.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      } catch {
        // Ignore non-event output; the caller reports missing evidence as unknown.
      }
      start = -1;
    }
  }

  return events;
}

const logArguments = log => {
  if (Array.isArray(log?.message)) return log.message.map(String);
  return typeof log?.message === 'string' ? [log.message] : [];
};

export function readSendPulseEmailDiagnostics(output) {
  const events = parseCloudflareTailEvents(output);
  const diagnostics = [];

  for (const event of events) {
    for (const log of Array.isArray(event?.logs) ? event.logs : []) {
      const message = logArguments(log).join(' ');
      const markerIndex = message.indexOf(SENDPULSE_EMAIL_LOG);
      let structured = null;
      try {
        const candidate = JSON.parse(message);
        if (candidate.event === 'sendpulse_email_delivery') structured = candidate;
      } catch {}
      if (markerIndex < 0 && !structured) continue;

      const detailsText = message.slice(markerIndex + SENDPULSE_EMAIL_LOG.length);
      const detailsStart = detailsText.indexOf('{');
      let details = structured || {};
      if (!structured && detailsStart >= 0) {
        try {
          details = JSON.parse(detailsText.slice(detailsStart));
        } catch {
          details = {};
        }
      }

      const status = Number.isInteger(details.status) ? details.status : null;
      diagnostics.push({
        ok: details.ok === true && status !== null && status >= 200 && status < 300,
        status,
        attempt: Number.isInteger(details.attempt) ? details.attempt : null,
      });
    }
  }

  return diagnostics;
}

export function sendPulseEmailWasAccepted(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return null;
  return diagnostics.some(entry => entry?.ok === true);
}
