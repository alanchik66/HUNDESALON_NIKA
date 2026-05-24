import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();

const webhook = String(process.env.SLACK_WEBHOOK_URL || '').trim();

if (!webhook) {
  console.error('SLACK_WEBHOOK_URL не найден. Добавьте его в .dev.vars или переменные окружения.');
  process.exit(1);
}

const now = new Date().toISOString();
const payload = {
  text: `:satellite: Тест Slack webhook (${now})`,
  blocks: [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Тест интеграции Slack',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          'Интеграция с проектом HUNDESALON NIKA активна.',
          `Время: ${now}`,
          'Источник: npm run slack:test',
        ].join('\n'),
      },
    },
  ],
};

const response = await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text().catch(() => '');
  console.error(`Slack webhook вернул ошибку ${response.status}: ${body}`);
  process.exit(1);
}

console.log('OK: тестовое сообщение отправлено в Slack.');
