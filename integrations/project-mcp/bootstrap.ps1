param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
  $repo = Join-Path $env:USERPROFILE 'repos\HUNDESALON_NIKA'
  $remote = & git -C $repo remote get-url origin
  if ($LASTEXITCODE -ne 0 -or $remote -notmatch '(?:github\.com/|proxy/github\.com/)alanchik66/HUNDESALON_NIKA(?:\.git)?$') {
    throw 'Unexpected repository'
  }
  & git -C $repo rev-parse --verify --quiet "$Commit`^{commit}" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & {
      $ErrorActionPreference = 'Continue'
      & git -C $repo fetch --no-tags origin $Commit 2>&1 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw 'Pinned source fetch failed' }
  }
  $source = & git -C $repo show "$Commit`:integrations/project-mcp/launch.ps1"
  if ($LASTEXITCODE -ne 0 -or -not $source) { throw 'Pinned launcher unavailable' }
  & ([scriptblock]::Create($source -join "`n")) -RepoRoot $repo -Commit $Commit
  exit $LASTEXITCODE
} catch {
  [Console]::Error.WriteLine('Project MCP bootstrap failed; check repository and pinned source availability.')
  exit 1
}
