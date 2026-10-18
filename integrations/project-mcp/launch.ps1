param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$Commit,
  [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$stage = 'repository validation'
function Read-PinnedSource([string]$Path) {
  $source = & git -C $RepoRoot show "$Commit`:$Path"
  if ($LASTEXITCODE -ne 0 -or -not $source) { throw 'Pinned source unavailable' }
  return ($source -join "`n") + "`n"
}
try {
  $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
  $remote = & git -C $RepoRoot remote get-url origin
  if ($LASTEXITCODE -ne 0 -or $remote -notmatch '(?:github\.com/|proxy/github\.com/)alanchik66/HUNDESALON_NIKA(?:\.git)?$') {
    throw 'Unexpected repository'
  }
  & git -C $RepoRoot rev-parse --verify --quiet "$Commit`^{commit}" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    $stage = 'pinned source fetch'
    & git -C $RepoRoot fetch --no-tags origin $Commit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Pinned source fetch failed' }
  }
  $cache = Join-Path $env:LOCALAPPDATA "devin-project-mcp\$Commit"
  $stage = 'runtime extraction'
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  foreach ($name in @('package.json', 'package-lock.json', 'policy.mjs', 'server.mjs')) {
    [IO.File]::WriteAllText((Join-Path $cache $name), (Read-PinnedSource "integrations/project-mcp/$name"), [Text.UTF8Encoding]::new($false))
  }
  $stage = 'pinned toolchain resolution'
  $version = (Read-PinnedSource '.node-version').Trim()
  if ($version -notmatch '^24\.\d+\.\d+$') { throw 'Expected pinned Node 24' }
  $node = Join-Path $env:LOCALAPPDATA "devin-node\node-v$version-win-x64\node.exe"
  if (-not (Test-Path -LiteralPath $node)) { throw 'Run the saved Windows environment setup first' }
  $marker = Join-Path $cache '.installed-lock.sha256'
  $hash = (Get-FileHash (Join-Path $cache 'package-lock.json') -Algorithm SHA256).Hash
  if (-not (Test-Path (Join-Path $cache 'node_modules\@modelcontextprotocol\sdk\package.json')) -or
      -not (Test-Path $marker) -or (Get-Content $marker -Raw).Trim() -ne $hash) {
    $manager = (Read-PinnedSource 'package.json' | ConvertFrom-Json).packageManager
    if ($manager -notmatch '^npm@(\d+\.\d+\.\d+)$') { throw 'Expected pinned npm' }
    $npmCli = Join-Path $env:LOCALAPPDATA "devin-node\npm-$($Matches[1])\node_modules\npm\bin\npm-cli.js"
    $stage = 'dependency installation'
    if (Test-Path -LiteralPath $marker) { Remove-Item -LiteralPath $marker -Force }
    & $node $npmCli ci --prefix $cache --ignore-scripts --no-audit --no-fund 2>&1 | ForEach-Object { [Console]::Error.WriteLine($_.ToString()) }
    if ($LASTEXITCODE -ne 0) { throw 'Pinned dependency installation failed' }
    [IO.File]::WriteAllText($marker, $hash, [Text.UTF8Encoding]::new($false))
  }
  if ($PrepareOnly) { return }
  & $node (Join-Path $cache 'server.mjs') --root $RepoRoot
  exit $LASTEXITCODE
} catch {
  [Console]::Error.WriteLine("Project MCP bootstrap failed at $stage; verify pinned source and saved Windows setup.")
  exit 1
}
