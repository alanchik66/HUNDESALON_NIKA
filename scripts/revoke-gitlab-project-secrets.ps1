param(
  [Parameter(Mandatory=$true)][string] $ProjectPath,
  [Parameter(Mandatory=$false)][string] $GitLabHost = 'https://gitlab.com'
)

if (-not $env:GITLAB_PAT) {
  Write-Error 'Set environment variable GITLAB_PAT with a Personal Access Token (scope: api) before running.'
  exit 2
}

$pat = $env:GITLAB_PAT

Function ApiGet($url) { Invoke-RestMethod -Headers @{ 'PRIVATE-TOKEN' = $pat } -Uri $url -Method Get }
Function ApiDelete($url) { Invoke-RestMethod -Headers @{ 'PRIVATE-TOKEN' = $pat } -Uri $url -Method Delete }

Write-Host "Resolving project: $ProjectPath on $GitLabHost"
$enc = [System.Web.HttpUtility]::UrlEncode($ProjectPath)
$proj = ApiGet("$GitLabHost/api/v4/projects/$enc")
if (-not $proj) { Write-Error 'Project not found or insufficient access'; exit 3 }
$pid = $proj.id
Write-Host "Project ID: $pid"

Write-Host 'Listing project variables...'
$vars = ApiGet("$GitLabHost/api/v4/projects/$pid/variables")
foreach ($v in $vars) {
  Write-Host "Deleting variable: $($v.key)"
  ApiDelete("$GitLabHost/api/v4/projects/$pid/variables/$($v.key)") | Out-Null
}

Write-Host 'Listing deploy keys...'
$keys = ApiGet("$GitLabHost/api/v4/projects/$pid/deploy_keys")
foreach ($k in $keys) {
  Write-Host "Removing deploy key id: $($k.id) title: $($k.title)"
  ApiDelete("$GitLabHost/api/v4/projects/$pid/deploy_keys/$($k.id)") | Out-Null
}

Write-Host 'Attempting to list project access tokens (may require elevated rights)...'
try {
  $tokens = ApiGet("$GitLabHost/api/v4/projects/$pid/access_tokens")
  foreach ($t in $tokens) {
    Write-Host "Deleting project access token id: $($t.id) name: $($t.name)"
    ApiDelete("$GitLabHost/api/v4/projects/$pid/access_tokens/$($t.id)") | Out-Null
  }
} catch {
  Write-Warning 'Cannot list/delete project access tokens with current PAT (may require admin). Skipping.'
}

Write-Host 'Done. Verify in GitLab UI that secrets/tokens/keys are removed.'

Write-Host "Note: Personal Access Tokens owned by users must be revoked by their owners via GitLab Account → Access Tokens. This script only targets project-level secrets/keys/tokens."
