@echo off
REM Safe launcher: runs file-based restart (no pwsh -c inline payload).
pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "D:\HUNDESALON_NIKA\tools\restart-hundesalon-mcp.ps1" %*
