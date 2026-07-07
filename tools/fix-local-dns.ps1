#Requires -RunAsAdministrator
# Local DNS fix for hundesalon-nika.com (ERR_NAME_NOT_RESOLVED / Fritz!Box IPv6 issues)
$ErrorActionPreference = 'Stop'
$hostsPath = "$env:Windir\System32\drivers\etc\hosts"
$marker = '# HUNDESALON_NIKA production'
$entries = @(
  '104.21.55.31 hundesalon-nika.com'
  '104.21.55.31 www.hundesalon-nika.com'
)

$lines = Get-Content $hostsPath -ErrorAction Stop
if ($lines -notmatch 'hundesalon-nika\.com') {
  Add-Content -Path $hostsPath -Value "`n$marker" -Encoding ascii
  foreach ($e in $entries) { Add-Content -Path $hostsPath -Value $e -Encoding ascii }
  Write-Host 'Added hosts entries for hundesalon-nika.com'
} else {
  Write-Host 'Hosts entries already present'
}

ipconfig /flushdns | Out-Null
Clear-DnsClientCache -ErrorAction SilentlyContinue
Write-Host 'DNS cache flushed'

# Prefer Cloudflare DNS on active IPv4 adapters (Fritz!Box forwarder workaround)
Get-DnsClientServerAddress -AddressFamily IPv4 |
  Where-Object { $_.ServerAddresses -and $_.InterfaceAlias -notmatch 'Loopback' } |
  ForEach-Object {
    Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('1.1.1.1', '8.8.8.8')
    Write-Host "DNS set on $($_.InterfaceAlias) -> 1.1.1.1, 8.8.8.8"
  }

$chromePolicy = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
if (-not (Test-Path $chromePolicy)) { New-Item -Path $chromePolicy -Force | Out-Null }
New-ItemProperty -Path $chromePolicy -Name 'QuicAllowed' -Value 0 -PropertyType DWord -Force | Out-Null
Write-Host 'Chrome policy QuicAllowed=0'

$desktop = [Environment]::GetFolderPath('Desktop')
$batSrc = Join-Path $PSScriptRoot 'open-hundesalon-site.bat'
$batDst = Join-Path $desktop 'HUNDESALON NIKA.bat'
Copy-Item -Path $batSrc -Destination $batDst -Force
Write-Host "Shortcut: $batDst"

& $batSrc
Write-Host 'Done.'
