#Requires -RunAsAdministrator
# Fix Chrome ERR_FAILED / ERR_NAME_NOT_RESOLVED for hundesalon-nika.com on Fritz!Box
$ErrorActionPreference = 'Stop'

function Set-ChromePolicy($name, $value, $type = 'DWord') {
  $path = 'HKLM:\SOFTWARE\Policies\Google\Chrome'
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType $type -Force | Out-Null
  Write-Host "Chrome policy $name = $value"
}

# QUIC + Secure DNS off; use Windows DNS (respects hosts file)
Set-ChromePolicy 'QuicAllowed' 0
Set-ChromePolicy 'DnsOverHttpsMode' 'off' 'String'
Set-ChromePolicy 'BuiltInDnsClientEnabled' 0

$edgePath = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
if (-not (Test-Path $edgePath)) { New-Item -Path $edgePath -Force | Out-Null }
New-ItemProperty -Path $edgePath -Name 'QuicAllowed' -Value 0 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $edgePath -Name 'DnsOverHttpsMode' -Value 'off' -PropertyType String -Force | Out-Null
Write-Host 'Edge policies set'

# Clean hosts (remove duplicates, keep one block)
$hostsPath = "$env:Windir\System32\drivers\etc\hosts"
$marker = '# HUNDESALON_NIKA production'
$raw = Get-Content $hostsPath -ErrorAction Stop
$clean = [System.Collections.Generic.List[string]]::new()
foreach ($line in $raw) {
  if ($line -match 'hundesalon-nika\.com' -or $line -eq $marker) { continue }
  $clean.Add($line)
}
$clean.Add('')
$clean.Add($marker)
$clean.Add('104.21.55.31 hundesalon-nika.com')
$clean.Add('104.21.55.31 www.hundesalon-nika.com')
Set-Content -Path $hostsPath -Value $clean -Encoding ascii
Write-Host 'Hosts file cleaned'

# Enable IPv6 on active Wi-Fi (Happy Eyeballs fix)
Get-NetAdapterBinding -ComponentID ms_tcpip6 | Where-Object { $_.Name -notmatch 'Bluetooth' } | ForEach-Object {
  if (-not $_.Enabled) {
    Enable-NetAdapterBinding -Name $_.Name -ComponentID ms_tcpip6
    Write-Host "IPv6 enabled on $($_.Name)"
  }
}

Get-DnsClientServerAddress -AddressFamily IPv4 |
  Where-Object { $_.ServerAddresses -and $_.InterfaceAlias -notmatch 'Loopback' } |
  ForEach-Object {
    Set-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -ServerAddresses ('1.1.1.1', '8.8.8.8')
  }

ipconfig /flushdns | Out-Null
Clear-DnsClientCache -ErrorAction SilentlyContinue
Write-Host 'DNS cache flushed'

# Kill browsers so policies apply
Get-Process chrome, msedge -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$desktop = [Environment]::GetFolderPath('Desktop')
$batSrc = Join-Path $PSScriptRoot 'open-hundesalon-site.bat'
Copy-Item -Path $batSrc -Destination (Join-Path $desktop 'HUNDESALON NIKA.bat') -Force
& $batSrc
Write-Host 'Browser relaunched'
