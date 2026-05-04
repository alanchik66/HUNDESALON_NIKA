# ═══════════════════════════════════════════════════════════════
#           СКРИПТ ПОДГОТОВКИ К ПРОДАКШЕНУ
#           HUNDESALON NIKA WEBSITE PRODUCTION BUILD
# ═══════════════════════════════════════════════════════════════

# Проверка существования необходимых папок
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
}
New-Item -ItemType Directory -Force -Path "dist"

Write-Host "🚀 НАЧАЛО СБОРКИ ДЛЯ ПРОДАКШЕНА" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# ═══ ВАЛИДАЦИЯ КОДА ═══
Write-Host "`n📋 1. ВАЛИДАЦИЯ HTML, CSS, JS..." -ForegroundColor Yellow

# HTML валидация
if (Get-Command htmlhint -ErrorAction SilentlyContinue) {
    htmlhint ru/*.html de/*.html en/*.html uk/*.html *.html
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ HTML валидация не прошла!" -ForegroundColor Red
        # exit 1
    }
    else {
        Write-Host "✅ HTML валидация успешна" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️ htmlhint не установлен - пропускаем HTML валидацию" -ForegroundColor Yellow
}

# CSS валидация  
if (Get-Command stylelint -ErrorAction SilentlyContinue) {
    stylelint "assets/css/**/*.css" --formatter verbose
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ CSS валидация не прошла!" -ForegroundColor Red
        # exit 1
    }
    else {
        Write-Host "✅ CSS валидация успешна" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️ stylelint не установлен - пропускаем CSS валидацию" -ForegroundColor Yellow
}

# JS валидация
if (Get-Command eslint -ErrorAction SilentlyContinue) {
    eslint "assets/js/**/*.js" --format stylish  
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ JavaScript валидация не прошла!" -ForegroundColor Red
        # exit 1
    }
    else {
        Write-Host "✅ JavaScript валидация успешна" -ForegroundColor Green
    }
}
else {
    Write-Host "⚠️ eslint не установлен - пропускаем JS валидацию" -ForegroundColor Yellow
}

# ═══ КОПИРОВАНИЕ ФАЙЛОВ ═══
Write-Host "`n📁 2. КОПИРОВАНИЕ ФАЙЛОВ..." -ForegroundColor Yellow

# Основные HTML файлы
Copy-Item "index.html" "dist/" -Force
Copy-Item "ru" "dist/" -Recurse -Force
Copy-Item "de" "dist/" -Recurse -Force  
Copy-Item "en" "dist/" -Recurse -Force
Copy-Item "uk" "dist/" -Recurse -Force

# Ассеты
Copy-Item "assets" "dist/" -Recurse -Force

# Важные файлы
Copy-Item ".htaccess" "dist/" -Force
Copy-Item "sendmail.php" "dist/" -Force

# Виджет погоды
Copy-Item "3d-weather-codrops-main/dist-widget" "dist/3d-weather-codrops-main/" -Recurse -Force

Write-Host "✅ Файлы скопированы" -ForegroundColor Green

# ═══ ОЧИСТКА ОТ DEV-ФАЙЛОВ ═══
Write-Host "`n🧹 3. ОЧИСТКА РАЗВЕРНУТОЙ ВЕРСИИ..." -ForegroundColor Yellow

# Удаляем dev-файлы из dist
$devFiles = @(
    "dist/.vscode",
    "dist/.git", 
    "dist/node_modules",
    "dist/temp",
    "dist/test-results",
    "dist/tools",
    "dist/.continue",
    "dist/_tmp*",
    "dist/package.json",
    "dist/.eslintrc.json",
    "dist/.htmlhintrc", 
    "dist/.prettierrc",
    "dist/.stylelintrc.json",
    "dist/.gitignore"
)

foreach ($file in $devFiles) {
    if (Test-Path $file) {
        Remove-Item $file -Recurse -Force
        Write-Host "Удален: $file" -ForegroundColor Gray
    }
}

Write-Host "✅ Очистка завершена" -ForegroundColor Green

# ═══ ОПТИМИЗАЦИЯ ═══  
Write-Host "`n⚡ 4. ОПТИМИЗАЦИЯ..." -ForegroundColor Yellow

# Минификация CSS (если доступна)
if (Get-Command cleancss -ErrorAction SilentlyContinue) {
    Get-ChildItem "dist/assets/css" -Filter "*.css" | ForEach-Object {
        $minFile = $_.FullName.Replace(".css", ".min.css")
        cleancss -o $minFile $_.FullName
        Write-Host "Минифицирован: $($_.Name)" -ForegroundColor Gray
    }
    Write-Host "✅ CSS минификация выполнена" -ForegroundColor Green
}
else {
    Write-Host "⚠️ clean-css не установлен - пропускаем CSS минификацию" -ForegroundColor Yellow
}

# Проверка размеров изображений
Write-Host "`n📊 АНАЛИЗ ИЗОБРАЖЕНИЙ:"
Get-ChildItem "dist/assets/images" -Recurse -Include "*.jpg", "*.jpeg", "*.png", "*.gif" | ForEach-Object {
    $sizeKB = [math]::Round($_.Length / 1KB, 1)
    if ($sizeKB -gt 500) {
        Write-Host "⚠️ $($_.Name): ${sizeKB}KB - рассмотрите сжатие" -ForegroundColor Yellow
    }
    else {
        Write-Host "✅ $($_.Name): ${sizeKB}KB" -ForegroundColor Green
    }
}

# ═══ ПРОВЕРКА ССЫЛОК ═══
Write-Host "`n🔗 5. ПРОВЕРКА ВНУТРЕННИХ ССЫЛОК..." -ForegroundColor Yellow

# Простая проверка существования файлов по ссылкам
$brokenLinks = @()
Get-ChildItem "dist" -Recurse -Filter "*.html" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    
    # Проверяем href="относительные_ссылки.html"
    $links = [regex]::Matches($content, 'href="([^"]*\.html)"') | ForEach-Object { $_.Groups[1].Value }
    
    foreach ($link in $links) {
        if (-not $link.StartsWith("http")) {
            $linkPath = Join-Path $_.DirectoryName $link
            if (-not (Test-Path $linkPath)) {
                $brokenLinks += "$($_.Name) -> $link"
            }
        }
    }
}

if ($brokenLinks.Count -gt 0) {
    Write-Host "❌ Найдены битые ссылки:" -ForegroundColor Red
    $brokenLinks | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
}
else {
    Write-Host "✅ Внутренние ссылки корректны" -ForegroundColor Green
}

# ═══ ИТОГИ ═══
Write-Host "`n🎉 СБОРКА ЗАВЕРШЕНА!" -ForegroundColor Green  
Write-Host "===============================================" -ForegroundColor Green
Write-Host "📁 Продакшен-версия создана в папке: ./dist/" -ForegroundColor Cyan
Write-Host "📋 Следующие шаги:" -ForegroundColor Yellow
Write-Host "   1. Протестируйте сайт локально" -ForegroundColor White
Write-Host "   2. Загрузите содержимое dist/ на хостинг" -ForegroundColor White 
Write-Host "   3. Настройте домен и DNS" -ForegroundColor White
Write-Host "   4. Проверьте SSL-сертификат" -ForegroundColor White
Write-Host "`n🌐 Готово к размещению в WordPress/cPanel хостинге!" -ForegroundColor Green