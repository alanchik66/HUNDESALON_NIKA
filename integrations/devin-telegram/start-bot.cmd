@echo off
rem Запуск шлюза Telegram -> Devin из корня репозитория или из этой папки.
rem Требует заполненный .devin\telegram-bot.env в корне репозитория.
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%..\..\.devin\telegram-bot.env"

if not exist "%ENV_FILE%" (
  echo [start-bot] Не найден конфиг: %ENV_FILE%
  echo [start-bot] Скопируйте integrations\devin-telegram\.env.example в .devin\telegram-bot.env и заполните значения.
  exit /b 1
)

rem Ищем node: сначала в PATH, затем типовые пути установки.
set "NODE_EXE="
where node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  for /f "delims=" %%i in ('where node.exe') do (
    set "NODE_EXE=%%i"
    goto :node_found
  )
)
for %%p in (
  "%ProgramFiles%\nodejs\node.exe"
  "%ProgramFiles(x86)%\nodejs\node.exe"
  "%LOCALAPPDATA%\Programs\nodejs\node.exe"
  "C:\hostedtoolcache\node\24.0.1\x64\node.exe"
) do (
  if not defined NODE_EXE if exist %%p set "NODE_EXE=%%~p"
)

:node_found
if not defined NODE_EXE (
  echo [start-bot] node.exe не найден. Установите Node.js LTS и добавьте в PATH.
  exit /b 1
)

echo [start-bot] node: %NODE_EXE%
echo [start-bot] env:  %ENV_FILE%
cd /d "%SCRIPT_DIR%..\.."
"%NODE_EXE%" --env-file="%ENV_FILE%" integrations\devin-telegram\bot.mjs
