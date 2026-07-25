#/usr/bin/env pwsh
#
# Комплексный скрипт для релиза: линтинг, коммит (если нужно), пуш и деплой.
#
[CmdletBinding()]
param(
  [string]$CommitMessage
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "=> $($Message)" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "✅ $($Message)" -ForegroundColor Green
}

function Write-ErrorLine([string]$Message) {
  Write-Host "❌ $($Message)" -ForegroundColor Red
}

function Invoke-NpmScript([string]$ScriptName, [string]$StepName) {
  Write-Step "Запуск: $StepName (npm run $ScriptName)..."
  & npm run $ScriptName
  if ($LASTEXITCODE -ne 0) {
    throw "$StepName не удался (код выхода: $LASTEXITCODE)."
  }
  Write-Ok "$StepName завершен успешно."
}

try {
  # 0. Синхронизация с удаленным репозиторием
  Write-Step "Синхронизация с GitHub (git pull)..."
  & git pull origin main
  if ($LASTEXITCODE -ne 0) {
    throw "git pull не удался (код выхода: $LASTEXITCODE)."
  }
  Write-Ok "Локальная версия обновлена."

  # 1. Линтинг
  Invoke-NpmScript -ScriptName 'lint' -StepName 'Линтинг кода'

  # 2. Коммит (если есть изменения)
  $gitStatus = git status --porcelain
  if (-not [string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Step "Обнаружены изменения. Подготовка к коммиту..."
    git add -A
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
      $CommitMessage = Read-Host -Prompt "Введите сообщение коммита"
    }
    git commit -m $CommitMessage
    Write-Ok "Изменения закоммичены: `"$CommitMessage`""
  } else {
    Write-Ok "Рабочая директория чиста. Пропускаем коммит."
  }

  # 3. Пуш
  Invoke-NpmScript -ScriptName 'git:push' -StepName 'Пуш в GitHub'

  # 4. Деплой
  Invoke-NpmScript -ScriptName 'deploy:full' -StepName 'Деплой на Cloudflare Pages'

  Write-Host "`n🎉 Релиз успешно завершен!" -ForegroundColor Magenta
}
catch {
  Write-ErrorLine $_.Exception.Message
  exit 1
}
