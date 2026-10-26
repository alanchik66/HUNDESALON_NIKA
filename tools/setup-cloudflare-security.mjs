#!/usr/bin/env node
/**
 * Cloudflare Security Setup Script
 * Автоматизирует настройку безопасности через Cloudflare API
 *
 * Требует CLOUDFLARE_API_TOKEN в переменных окружения
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Загрузка переменных окружения из .dev.vars если существует
function loadDevVars() {
  try {
    const devVarsPath = resolve('.dev.vars');
    const content = readFileSync(devVarsPath, 'utf-8');
    const vars = {};
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        vars[key.trim()] = valueParts.join('=').trim();
      }
    });
    return vars;
  } catch {
    return {};
  }
}

const env = { ...process.env, ...loadDevVars() };

const API_TOKEN = env.CLOUDFLARE_API_TOKEN;
const SITE_URL = env.SITE_ORIGIN || 'https://hundesalon-nika.com';

async function cloudflareRequest(endpoint, options = {}) {
  const apiUrl = `https://api.cloudflare.com/client/v4${endpoint}`;
  const response = await fetch(apiUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function getZoneId() {
  const hostname = new URL(SITE_URL).hostname;
  const result = await cloudflareRequest(`/zones?name=${hostname}`);

  if (!result.success || !result.result.length) {
    throw new Error(`Zone not found for ${hostname}`);
  }

  return result.result[0].id;
}

async function setupWAFRules(zoneId) {
  try {
    console.log('🛡️ Настройка WAF Rules...');

    // Создание managed ruleset entry point
    const result = await cloudflareRequest(`/zones/${zoneId}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'HUNDESALON_NIKA Security Rules',
        description: 'Custom security rules for HUNDESALON_NIKA',
        kind: 'root',
        phase: 'http_request_firewall_custom',
        rules: [
          {
            action: 'block',
            expression: '(http.request.uri.path matches \"/api/*\" and cf.threat_score gt 10)',
            description: 'Block high threat score API requests',
          },
          {
            action: 'managed_challenge',
            expression: '(http.request.uri.path matches \"/api/*\" and cf.threat_score gt 5)',
            description: 'Challenge medium threat score API requests',
          },
        ],
      }),
    });

    if (result.success) {
      console.log('✅ WAF Rules настроены');
      return true;
    }

    console.log('⚠️ WAF Rules уже существуют или ошибка:', result.errors);
    return false;
  } catch (error) {
    console.log('⚠️ WAF setup требует дополнительных прав:', error.message);
    return false;
  }
}

async function setupBotManagement(zoneId) {
  try {
    console.log('🤖 Настройка Bot Management...');

    const result = await cloudflareRequest(`/zones/${zoneId}/bot_management`, {
      method: 'PATCH',
      body: JSON.stringify({
        enable_js: true,
        fight_mode: true,
      }),
    });

    if (result.success) {
      console.log('✅ Bot Management включён');
      return true;
    }

    console.log('⚠️ Bot Management уже настроен или ошибка:', result.errors);
    return false;
  } catch (error) {
    console.log('⚠️ Bot Management setup требует дополнительных прав:', error.message);
    return false;
  }
}

async function setupRateLimiting(zoneId) {
  try {
    console.log('⏱️ Настройка Rate Limiting...');

    // Проверка существующих rate limits
    const existing = await cloudflareRequest(`/zones/${zoneId}/rate_limits`);

    if (existing.success && existing.result.length > 0) {
      console.log('ℹ️ Rate Limiting уже настроен:', existing.result.length, 'правил');
      return true;
    }

    // Создание rate limit для API endpoints
    const result = await cloudflareRequest(`/zones/${zoneId}/rate_limits`, {
      method: 'POST',
      body: JSON.stringify({
        match: {
          request: {
            url: `*${SITE_URL}/api/*`,
            schemes: ['HTTP', 'HTTPS'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          },
        },
        action: {
          mode: 'simulate',
          response: {
            content_type: 'application/json',
            body: '{"error": "Rate limit exceeded"}',
          },
        },
        threshold: 100,
        period: 60,
        description: 'API rate limit',
      }),
    });

    if (result.success) {
      console.log('✅ Rate Limiting настроен');
      return true;
    }

    console.log('⚠️ Rate Limiting уже существует или ошибка:', result.errors);
    return false;
  } catch (error) {
    console.log('⚠️ Rate Limiting setup требует дополнительных прав:', error.message);
    return false;
  }
}

async function setupSpendingLimits() {
  try {
    console.log('💰 Настройка Spending Limits...');

    // Spending limits настраиваются через Cloudflare Billing API
    // Эта функциональность обычно недоступна через стандартный API token
    console.log('⚠️ Spending Limits требует настройки через Cloudflare Dashboard вручную');
    console.log('   Navigate: Manage Account → Billing → Spending Limits');
    return false;
  } catch (error) {
    console.log('⚠️ Spending Limits не поддерживается через API:', error.message);
    return false;
  }
}

async function createTurnstileKeys() {
  try {
    console.log('🔐 Создание Turnstile ключей...');

    // Turnstile ключи создаются через Cloudflare Dashboard
    console.log('⚠️ Turnstile требует настройки через Cloudflare Dashboard вручную');
    console.log('   Navigate: Turnstile → Add Site');
    console.log(
      '   Required domains: hundesalon-nika.com, de.hundesalon-nika.com, en.hundesalon-nika.com, ru.hundesalon-nika.com, uk.hundesalon-nika.com'
    );
    return false;
  } catch (error) {
    console.log('⚠️ Turnstile setup не поддерживается через API:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔒 Cloudflare Security Setup для HUNDESALON_NIKA\n');

  if (!API_TOKEN) {
    console.error('❌ CLOUDFLARE_API_TOKEN not set. Please set it in .dev.vars or environment variables.');
    console.log('   Create token at: https://dash.cloudflare.com/profile/api-tokens');
    console.log(
      '   Required permissions: Account - Account Settings, Zone - Zone, Zone - Firewall Services, Zone - DNS'
    );
    process.exit(1);
  }

  console.log('Configuring website security.');

  try {
    const zoneId = await getZoneId();
    console.log(`✅ Zone ID: ${zoneId}\n`);

    const results = {
      waf: await setupWAFRules(zoneId),
      bot: await setupBotManagement(zoneId),
      rateLimit: await setupRateLimiting(zoneId),
      spending: await setupSpendingLimits(),
      turnstile: await createTurnstileKeys(),
    };

    console.log('\n📊 Summary:');
    console.log(`   WAF Rules: ${results.waf ? '✅' : '⚠️ '}`);
    console.log(`   Bot Management: ${results.bot ? '✅' : '⚠️ '}`);
    console.log(`   Rate Limiting: ${results.rateLimit ? '✅' : '⚠️ '}`);
    console.log(`   Spending Limits: ${results.spending ? '✅' : '⚠️ '} (требует Dashboard)`);
    console.log(`   Turnstile: ${results.turnstile ? '✅' : '⚠️ '} (требует Dashboard)`);

    const automated = Object.values(results).filter(r => r).length;
    const manual = Object.values(results).filter(r => !r).length;

    console.log(`\n🎯 Автоматизировано: ${automated}`);
    console.log(`🔧 Требует ручной настройки: ${manual}`);

    if (manual > 0) {
      console.log('\n📋 Для ручной настройки смотрите docs/CLOUDFLARE_SECURITY_CHECKLIST.md');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
