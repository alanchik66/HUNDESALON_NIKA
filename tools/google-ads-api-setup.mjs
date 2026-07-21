#!/usr/bin/env node

/**
 * Google Ads API Setup Script для HUNDESALON NIKA
 * 
 * Необходимые шаги:
 * 1. Создать проект в Google Cloud Console
 * 2. Включить Google Ads API
 * 3. Создать OAuth 2.0 client
 * 4. Получить Developer Token
 * 5. Авторизовать аккаунт
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_NAME = 'hundesalon-nika';
const GOOGLE_ADS_CID = '530-092-3191'; // CID из документации
const SECRETS_DIR = join(process.cwd(), '.secrets');

// Создаём директорию для секретов
if (!existsSync(SECRETS_DIR)) {
  mkdirSync(SECRETS_DIR, { recursive: true });
}

console.log('=== Google Ads API Setup для HUNDESALON NIKA ===\n');

console.log('ШАГ 1: Google Cloud Console');
console.log('---------------------------');
console.log('1. Перейдите: https://console.cloud.google.com/');
console.log('2. Создайте новый проект или выберите существующий');
console.log('3. Включите Google Ads API:');
console.log('   https://console.cloud.google.com/apis/library/googleads.googleapis.com');
console.log('4. Создайте OAuth 2.0 Client ID:');
console.log('   https://console.cloud.google.com/apis/credentials');
console.log('   - Application type: Desktop app');
console.log('   - Download JSON credentials\n');

console.log('ШАГ 2: Google Ads Developer Token');
console.log('-----------------------------------');
console.log('1. Перейдите: https://ads.google.com/aw/apicenter');
console.log('2. Запросите Developer Token');
console.log('3. Получите Access к Basic Access level\n');

console.log('ШАГ 3: Авторизация');
console.log('------------------');
console.log('Вам понадобятся:');
console.log('- OAuth Client ID и Secret из JSON файла');
console.log('- Developer Token');
console.log('- Customer ID: ' + GOOGLE_ADS_CID + '\n');

console.log('Когда готовы:');
console.log('1. Сохраните OAuth JSON файл в: Downloads/ или .secrets/');
console.log('2. Добавьте GOOGLE_ADS_DEVELOPER_TOKEN в .dev.vars');
console.log('3. Запустите: node tools/setup-google-ads-api.mjs --authorize\n');

console.log('Временные параметры для тестирования:');
console.log('--------------------------------------');
const testConfig = {
  customerId: GOOGLE_ADS_CID,
  developerToken: 'YOUR_DEVELOPER_TOKEN',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  refreshToken: 'YOUR_REFRESH_TOKEN'
};

console.log(JSON.stringify(testConfig, null, 2));
console.log('\nСохраните эти параметры в .dev.vars или .secrets/google-ads-config.json');

/**
 * Функция для OAuth авторизации (потребуется позже)
 */
async function performOAuthFlow() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('Не заданы GOOGLE_ADS_CLIENT_ID и GOOGLE_ADS_CLIENT_SECRET');
    return;
  }
  
  const port = 3000;
  const state = randomBytes(16).toString('hex');
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', `http://127.0.0.1:${port}/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/adwords');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  
  console.log('Откройте в браузере:', authUrl.toString());
  
  // Запускаем локальный сервер для OAuth callback
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/callback')) {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      
      if (returnedState !== state) {
        res.writeHead(400).end('Invalid state');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(`
        <h1>Авторизация успешна</h1>
        <p>Вы можете закрыть это окно и вернуться в терминал.</p>
      `);
      
      server.close();
      
      // Здесь обмениваем code на refresh_token
      console.log('Получен код авторизации:', code);
      console.log('Теперь обменяйте его на refresh_token через Google API');
    }
  });
  
  server.listen(port, () => {
    console.log(`OAuth сервер запущен на порту ${port}`);
  });
}

// Если запущено с флагом --authorize
if (process.argv.includes('--authorize')) {
  performOAuthFlow().catch(console.error);
}