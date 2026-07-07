@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0optimize-webstorm-memory.ps1" -Restart -OpenProject
exit /b %ERRORLEVEL%
