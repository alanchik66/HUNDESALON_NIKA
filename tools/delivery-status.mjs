import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createD1ReviewStore } from './chat-learning-review.mjs';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const FORM_TYPES = new Set(['booking', 'contact', 'feedback', 'client_registration']);
const CHANNELS = new Set([
  'booking_register',
  'client_register',
  'email_main',
  'email_client',
  'email_admin',
  'telegram',
  'contact_sync',
  'automation',
  'failure_alert',
  'calendar',
]);
const STATES = new Set(['pending', 'failed', 'skipped']);
const CODES = new Set(['pending', 'accepted', 'skipped', 'provider_failure', 'network_error']);
const HOUR_MS = 3600_000;
const PENDING_MS = 10 * 60_000;
const MAX_ROWS = 100;

export const DELIVERY_STATUS_SQL = [
  'SELECT id, request_id, form_type, channel, state, provider_status, result_code, created_at, updated_at',
  'FROM delivery_attempts',
  'WHERE created_at >= ? AND created_at <= ?',
  "  AND (state IN ('failed', 'skipped') OR (state = 'pending' AND created_at < ?))",
  'ORDER BY created_at DESC, id DESC LIMIT 100',
].join('\n');

function validHours(hours) {
  return Number.isInteger(hours) && hours >= 1 && hours <= 168;
}

export function parseDeliveryStatusOptions(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      'database-id': { type: 'string' },
      hours: { type: 'string', default: '24' },
      json: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) return { help: true };
  const hours = /^[0-9]+$/.test(values.hours) ? Number(values.hours) : NaN;
  if (!UUID.test(values['database-id'] || '') || !validHours(hours)) {
    throw new Error('Provide an explicit D1 UUID and whole hours from 1 to 168.');
  }
  return { databaseId: values['database-id'].toLowerCase(), hours, json: Boolean(values.json) };
}

function isoTimestamp(value) {
  if (typeof value !== 'string') throw new Error('Invalid delivery metadata.');
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new Error('Invalid delivery metadata.');
  }
  return value;
}

function safeRow(row) {
  if (
    !UUID.test(row?.id || '') ||
    !UUID.test(row?.request_id || '') ||
    !FORM_TYPES.has(row?.form_type) ||
    !CHANNELS.has(row?.channel) ||
    !STATES.has(row?.state) ||
    !CODES.has(row?.result_code) ||
    !Number.isInteger(row?.provider_status) ||
    row.provider_status < 0 ||
    row.provider_status > 599
  )
    throw new Error('Invalid delivery metadata.');
  // Never forward unrecognized database/API fields, even if a backend supplies them.
  return {
    id: row.id,
    request_id: row.request_id,
    form_type: row.form_type,
    channel: row.channel,
    state: row.state,
    provider_status: row.provider_status,
    result_code: row.result_code,
    created_at: isoTimestamp(row.created_at),
    updated_at: isoTimestamp(row.updated_at),
  };
}

export async function readDeliveryStatus(store, { hours = 24, now = new Date() } = {}) {
  if (!store?.query || !validHours(hours) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid delivery status options.');
  }
  const since = new Date(now.getTime() - hours * HOUR_MS).toISOString();
  const pendingBefore = new Date(now.getTime() - PENDING_MS).toISOString();
  const result = await store.query(DELIVERY_STATUS_SQL, [since, now.toISOString(), pendingBefore]);
  if (result?.success !== true || !Array.isArray(result.results) || result.results.length > MAX_ROWS) {
    throw new Error('Invalid delivery metadata.');
  }
  const attempts = result.results.map(safeRow);
  return {
    checked_at: now.toISOString(),
    since,
    pending_before: pendingBefore,
    limit: MAX_ROWS,
    attempts,
  };
}

export function formatDeliveryStatus(report) {
  const lines = [
    'Период: ' + report.since + ' — ' + report.checked_at + '; максимум ' + report.limit + ' записей.',
    'Показаны ошибки, пропуски и pending старше 10 минут. Accepted не доказывает доставку в почтовый ящик.',
  ];
  if (!report.attempts.length) {
    lines.push('В выбранном периоде записей для проверки нет. Это не проверка доступности всех провайдеров.');
  } else {
    for (const row of report.attempts) {
      lines.push(
        [
          row.created_at,
          row.request_id,
          row.form_type,
          row.channel,
          row.state,
          row.provider_status,
          row.result_code,
          row.id,
        ].join('\t')
      );
    }
  }
  return lines.join('\n');
}

export async function runDeliveryStatus(
  args,
  { createStore = createD1ReviewStore, output = console.log, reportError = console.error, now = new Date() } = {}
) {
  try {
    const options = parseDeliveryStatusOptions(args);
    if (options.help) {
      output(
        'node tools/delivery-status.mjs --database-id <D1 UUID> [--hours 24] [--json]\nТолько чтение: последние 100 ошибок/пропусков/pending старше 10 минут. Период 1–168 часов.'
      );
      return 0;
    }
    const store = createStore({ databaseId: options.databaseId });
    const report = await readDeliveryStatus(store, { hours: options.hours, now });
    output(options.json ? JSON.stringify(report, null, 2) : formatDeliveryStatus(report));
    return 0;
  } catch {
    // SQL, credentials and raw provider errors must not enter terminal output.
    reportError(
      'Не удалось прочитать статусы. Проверьте --help, явный UUID базы, существующий доступ D1 и миграцию 0009.'
    );
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDeliveryStatus(process.argv.slice(2));
}
