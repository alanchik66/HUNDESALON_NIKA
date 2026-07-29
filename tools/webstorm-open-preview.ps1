param(
  [ValidateSet("de", "en", "ru", "uk")]
  [string]$Page = "de",
  [string]$ProjectRoot = "C:\PROJEKT\HUNDESALON_NIKA"
)

$ErrorActionPreference = "Stop"

$WebStormExe = "C:\Program Files\JetBrains\WebStorm 2026.1.4\bin\webstorm64.exe"
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"
$HtmlFile = Join-Path $ProjectRoot "$Page\index.html"
$PreviewUrl = "http://127.0.0.1:5502/$Page/"

function Test-DevServer {
  try {
    $response = Invoke-WebRequest -Uri $PreviewUrl -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Ensure-DevServer {
  if (Test-DevServer) {
    return
  }

  Start-Process -FilePath $NpmCmd -ArgumentList @("run", "dev") -WorkingDirectory $ProjectRoot -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline -and -not (Test-DevServer)) {
    Start-Sleep -Milliseconds 500
  }

  if (-not (Test-DevServer)) {
    throw "Dev server did not start on $PreviewUrl"
  }
}

if (-not (Test-Path $HtmlFile)) {
  throw "HTML file not found: $HtmlFile"
}

Ensure-DevServer

$webStorm = Get-Process webstorm64 -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $webStorm) {
  Start-Process -FilePath $WebStormExe -ArgumentList "`"$ProjectRoot`""
  Start-Sleep -Seconds 8
}

& $WebStormExe $HtmlFile | Out-Null
Start-Sleep -Seconds 1

# Open the live preview in the browser instead of SendKeys IDE actions.
# SendKeys can accidentally type into the active editor and corrupt source files.
Start-Process $PreviewUrl | Out-Null

Write-Output "Preview opened: $PreviewUrl ($HtmlFile in WebStorm)"
