@echo off
REM Opens hundesalon-nika.com with QUIC/DoH disabled (Fritz!Box + Chrome ERR_FAILED workaround)
REM Chrome ignores launch flags when already running — close browsers first.
taskkill /IM chrome.exe /F >nul 2>&1
taskkill /IM msedge.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if exist "%CHROME%" (
  start "" "%CHROME%" --disable-quic --disable-http3 --disable-features=DnsOverHttps,UseDnsHttpsSvcb "https://hundesalon-nika.com/"
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --disable-quic --disable-http3 --disable-features=DnsOverHttps,UseDnsHttpsSvcb "https://hundesalon-nika.com/"
  exit /b 0
)
start "" "https://hundesalon-nika.com/"
