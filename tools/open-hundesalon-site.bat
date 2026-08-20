@echo off
REM Opens hundesalon-nika.com with QUIC/DoH disabled (Fritz!Box + Chrome ERR_FAILED workaround)
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
set SITE_PROFILE=%TEMP%\hundesalon-nika-site-open
if exist "%CHROME%" (
  start "" "%CHROME%" --user-data-dir="%SITE_PROFILE%\chrome" --disable-quic --disable-http3 --disable-features=DnsOverHttps,UseDnsHttpsSvcb "https://hundesalon-nika.com/"
  exit /b 0
)
if exist "%EDGE%" (
  start "" "%EDGE%" --user-data-dir="%SITE_PROFILE%\edge" --disable-quic --disable-http3 --disable-features=DnsOverHttps,UseDnsHttpsSvcb "https://hundesalon-nika.com/"
  exit /b 0
)
start "" "https://hundesalon-nika.com/"
