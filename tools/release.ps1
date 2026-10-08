#!/usr/bin/env pwsh
#
# Релиз проверенных файлов: полный QA, коммит уже staged изменений, push и deploy.
# Перед запуском вручную выберите файлы через git add <точные пути>.
#
[CmdletBinding()]
param(
  [string]$CommitMessage
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

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

function Invoke-GitCommand([string[]]$Arguments) {
  $output = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') не удался (код выхода: $LASTEXITCODE)."
  }
  return $output
}

function Assert-ReviewedChanges {
  $status = @(Invoke-GitCommand -Arguments @('status', '--porcelain'))
  # Не добавляем все файлы автоматически: незавершённые operational scripts
  # и несвязанные изменения должны остаться за пределами релиза.
  $unreviewed = @($status | Where-Object { $_.Length -lt 2 -or $_.Substring(1, 1) -ne ' ' })
  if ($unreviewed.Count -gt 0) {
    throw 'Есть unstaged или untracked файлы. Сохраните их отдельно и явно stage только проверенные файлы перед релизом.'
  }
  $stagedPaths = @(Invoke-GitCommand -Arguments @('diff', '--cached', '--name-only', '--diff-filter=ACMR'))
  $privatePaths = @($stagedPaths | Where-Object {
    $_ -notin @('.dev.vars.example', '.codex/environments/environment.toml') -and (
      $_ -match '(^|/)(\.dev\.vars(?:\.|$)|\.env(?:\.|$)|\.secrets/|\.cloudflare-[^/]*|\.codex/|temp/|test-results/)' -or
      $_ -match '\.(key|pem|token)$'
    )
  })
  if ($privatePaths.Count -gt 0) {
    throw 'В staged файлах есть секреты, локальные настройки или временные артефакты. Уберите их из index перед релизом.'
  }
  return $status.Count -gt 0
}

try {
  $branch = Invoke-GitCommand -Arguments @('branch', '--show-current')
  if ($branch -ne 'main') {
    throw "Релиз разрешён только из main (текущая ветка: $branch)."
  }
  $hasStagedChanges = Assert-ReviewedChanges
  if ($hasStagedChanges -and [string]::IsNullOrWhiteSpace($CommitMessage)) {
    throw 'Для staged изменений передайте -CommitMessage. Скрипт не выбирает файлы и не создаёт сообщение за вас.'
  }

  # Проверяем remote без pull: автоматическое слияние изменило бы уже проверенный код.
  Write-Step 'Проверка истории GitHub...'
  Invoke-GitCommand -Arguments @('fetch', 'origin', 'main')
  & git merge-base --is-ancestor origin/main HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'main отстаёт от origin/main или история разошлась. Синхронизируйте и повторно проверьте изменения перед релизом.'
  }

  Invoke-NpmScript -ScriptName 'qa:max' -StepName 'Полная проверка качества'
  Invoke-GitCommand -Arguments @('diff', '--check')
  Invoke-GitCommand -Arguments @('diff', '--cached', '--check')
  $hasStagedChanges = Assert-ReviewedChanges

  if ($hasStagedChanges) {
    Write-Step 'Коммит явно выбранных и проверенных файлов...'
    Invoke-GitCommand -Arguments @('commit', '-m', $CommitMessage)
    Write-Ok "Изменения закоммичены: `"$CommitMessage`""
  } else {
    Write-Ok "Рабочая директория чиста. Пропускаем коммит."
  }

  # Build после commit получает окончательную версию HEAD для cache stamp.
  Invoke-NpmScript -ScriptName 'build:production' -StepName 'Сборка ревизии релиза'
  if (Assert-ReviewedChanges) {
    throw 'После сборки появились staged изменения. Повторно проверьте их перед публикацией.'
  }
  Invoke-NpmScript -ScriptName 'git:push' -StepName 'Пуш в GitHub'

  Write-Step 'Деплой проверенной ревизии на Cloudflare Pages...'
  & node tools/deploy-pages.mjs --branch main --commit-dirty=false
  if ($LASTEXITCODE -ne 0) {
    throw "Деплой не удался (код выхода: $LASTEXITCODE)."
  }
  # Live проверки не создают бронирования и не отправляют служебные сообщения.
  Invoke-NpmScript -ScriptName 'check:live-html' -StepName 'Проверка production HTML'
  Invoke-NpmScript -ScriptName 'check:live-robots' -StepName 'Проверка production robots'
  Invoke-NpmScript -ScriptName 'price:smoke:prod' -StepName 'Проверка production прайс-листа'

  Write-Host "`n🎉 Релиз успешно завершен!" -ForegroundColor Magenta
}
catch {
  Write-ErrorLine $_.Exception.Message
  exit 1
}
