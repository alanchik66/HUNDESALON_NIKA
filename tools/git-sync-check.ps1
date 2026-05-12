$ErrorActionPreference = 'Stop'

function Get-OriginPushUrls {
  $urls = @(git config --get-all remote.origin.pushurl)
  if (-not $urls -or $urls.Count -eq 0) {
    $fetchUrl = (git remote get-url origin)
    if ($fetchUrl) {
      $urls = @($fetchUrl)
    }
  }
  return $urls
}

function Get-BranchHash([string]$url, [string]$branch) {
  $ref = "refs/heads/$branch"
  $line = git ls-remote $url $ref | Select-Object -First 1
  if (-not $line) {
    return $null
  }
  return ($line -split "`t")[0]
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$localHead = (git rev-parse HEAD).Trim()
$urls = Get-OriginPushUrls

if (-not $urls -or $urls.Count -eq 0) {
  Write-Host 'SYNC CHECK: origin is not configured.' -ForegroundColor Red
  exit 2
}

Write-Host ("SYNC CHECK: branch={0}" -f $branch) -ForegroundColor Cyan
Write-Host ("LOCAL:  {0}" -f $localHead)

$remoteHeads = @()
$failed = $false

foreach ($url in $urls) {
  try {
    $hash = Get-BranchHash $url $branch
    if (-not $hash) {
      Write-Host ("REMOTE: {0} -> branch '{1}' not found" -f $url, $branch) -ForegroundColor Yellow
      $failed = $true
      continue
    }

    $remoteHeads += [PSCustomObject]@{
      Url = $url
      Head = $hash
    }

    $matchText = if ($hash -eq $localHead) { 'OK' } else { 'DIFF' }
    $color = if ($hash -eq $localHead) { 'Green' } else { 'Yellow' }
    Write-Host ("REMOTE: {0} -> {1} [{2}]" -f $url, $hash, $matchText) -ForegroundColor $color
  } catch {
    Write-Host ("REMOTE: {0} -> access error: {1}" -f $url, $_.Exception.Message) -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  Write-Host 'SYNC CHECK: completed with remote access errors.' -ForegroundColor Red
  exit 2
}

$uniqueRemoteHeads = @($remoteHeads | Select-Object -ExpandProperty Head -Unique)
$allRemoteEqual = $uniqueRemoteHeads.Count -eq 1
$allEqualLocal = $allRemoteEqual -and ($uniqueRemoteHeads[0] -eq $localHead)

if ($allEqualLocal) {
  Write-Host 'SYNC RESULT: GitHub and GitLab are in sync with local branch.' -ForegroundColor Green
  exit 0
}

if ($allRemoteEqual) {
  Write-Host 'SYNC RESULT: GitHub and GitLab are in sync with each other, but local branch differs.' -ForegroundColor Yellow
  exit 1
}

Write-Host 'SYNC RESULT: GitHub and GitLab diverged.' -ForegroundColor Red
exit 1
