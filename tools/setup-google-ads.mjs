import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';

const GOOGLE_ADS_URL = 'https://ads.google.com/aw/overview?ocid=8415382946&workspaceId=0&ascid=8415382946&euid=6578015462&__u=7095037238&uscid=8415382946&__c=5110651154&authuser=0';

async function setupGoogleAds() {
  console.log('Запуск браузера для настройки Google Ads...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Замедление для наглядности
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  console.log('Переход на Google Ads...');
  await page.goto(GOOGLE_ADS_URL, { waitUntil: 'networkidle' });
  
  console.log('Ожидание входа пользователя...');
  console.log('Пожалуйста, войдите в Google аккаунт в открывшемся браузере');
  
  // Ждём пока пользователь войдёт и появится интерфейс Google Ads
  await page.waitForTimeout(30000); // 30 секунд на вход
  
  // Проверяем, вошли ли мы
  const isLoggedIn = await page.locator('body').innerText().then(text => {
    return !text.includes('Sign in') && !text.includes('Войти');
  });
  
  if (!isLoggedIn) {
    console.log('Вы не вошли в аккаунт. Пожалуйста, войдите и нажмите Enter в терминале');
    await page.waitForTimeout(60000); // Дополнительная минута
  }
  
  console.log('Анализ текущего состояния аккаунта...');
  
  // Проверяем структуру страницы
  const pageContent = await page.content();
  console.log('Страница загружена, длина контента:', pageContent.length);
  
  // Ищем ключевые элементы интерфейса
  const hasCampaigns = await page.locator('[data-column="campaigns"]').count() > 0;
  const hasOverview = await page.locator('[data-page="overview"]').count() > 0;
  
  console.log('Наличие кампаний:', hasCampaigns);
  console.log('Наличие обзора:', hasOverview);
  
  // Переходим в настройки кампании
  console.log('Переход к настройкам кампании...');
  
  try {
    // Ищем кнопку создания кампании
    const createButton = page.locator('button:has-text("New campaign"), button:has-text("Создать кампанию"), button:has-text("Kampagne erstellen")').first();
    if (await createButton.isVisible({ timeout: 5000 })) {
      console.log('Найдена кнопка создания кампании');
      await createButton.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('Кнопка создания кампании не найдена, пробуем другой способ');
  }
  
  // Сохраняем скриншот текущего состояния
  await page.screenshot({ path: 'google-ads-state.png', fullPage: true });
  console.log('Скриншот сохранён: google-ads-state.png');
  
  console.log('Браузер открыт. Вы можете настроить Google Ads вручную.');
  console.log('Для завершения работы закройте браузер или нажмите Ctrl+C');
  
  // Оставляем браузер открытым для ручной настройки
  await page.waitForTimeout(300000); // 5 минут
  
  await browser.close();
  console.log('Работа завершена');
}

setupGoogleAds().catch(console.error);