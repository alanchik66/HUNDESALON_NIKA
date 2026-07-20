# ============================================================
#  fix-repo.ps1  -  Repository Auto-Diagnostics after relocation
#  Run from: D:\HUNDESALON_NIKA
# ============================================================

$RepoPath   = "D:\HUNDESALON_NIKA"
$LogFile    = "$RepoPath\fix-repo-report.txt"
$Divider    = "=" * 60

function Log($msg) {
    Write-Host $msg
    Add-Content $LogFile $msg
}

# Clean old log
if (Test-Path $LogFile) { Remove-Item $LogFile }

Log $Divider
Log "  REPOSITORY DIAGNOSTICS: $RepoPath"
Log "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log $Divider

# -- 1. Go to path
if (-not (Test-Path $RepoPath)) {
    Log "ERROR: Path '$RepoPath' not found!"
    exit 1
}
Set-Location $RepoPath

# -- 2. Check Git
Log "`n[1] GIT STATUS"
Log $("-" * 40)

if (-not (Test-Path ".git")) {
    Log "ERROR: .git not found - this is not a git repository!"
    exit 1
}

$gitStatus = git status 2>&1
Log ($gitStatus -join "`n")

# -- 3. Remotes
Log "`n[2] REMOTE ADDRESSES"
Log $("-" * 40)

$remotes = git remote -v 2>&1
if ($remotes) {
    Log ($remotes -join "`n")
} else {
    Log "(remote not configured - local repository only)"
}

# -- 4. Branches
Log "`n[3] BRANCHES"
Log $("-" * 40)
$branches = git branch -a 2>&1
Log ($branches -join "`n")

# -- 5. Recent commits
Log "`n[4] LAST 5 COMMITS"
Log $("-" * 40)
$log = git log --oneline -5 2>&1
Log ($log -join "`n")

# -- 6. Old paths in .git/config
Log "`n[5] CHECK .git/config FOR ABSOLUTE PATHS"
Log $("-" * 40)

$gitConfig = Get-Content ".git\config" -Raw
$pathPattern = '[A-Za-z]:\\[^\s"''`]+'
$foundPaths = [regex]::Matches($gitConfig, $pathPattern) | ForEach-Object { $_.Value } | Sort-Object -Unique

if ($foundPaths) {
    Log "Found absolute paths in .git/config:"
    $foundPaths | ForEach-Object { Log "  $_" }
    $oldPaths = $foundPaths | Where-Object { $_ -notlike "$RepoPath*" }
    if ($oldPaths) {
        Log "WARNING: Paths DO NOT match current location:"
        $oldPaths | ForEach-Object { Log "  !! $_ !!" }
    } else {
        Log "OK - all paths point to current location."
    }
} else {
    Log "OK - no absolute paths in .git/config."
}

# -- 7. Check for old paths in project files
Log "`n[6] SEARCH FOR HARDCODED PATHS IN PROJECT FILES"
Log $("-" * 40)

$extensions = @("*.bat","*.cmd","*.ps1","*.sh","*.yml","*.yaml",
                "*.json","*.env","*.config","*.ini","*.toml","*.xml")

$allMatches = @()
foreach ($ext in $extensions) {
    Get-ChildItem -Recurse -Include $ext -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notlike "*\.git\*" } |
        ForEach-Object {
            $file = $_
            $lines = Select-String -Path $file.FullName -Pattern '[A-Za-z]:\\' -ErrorAction SilentlyContinue
            foreach ($line in $lines) {
                # Skip lines containing the current path
                if ($line.Line -notlike "*$RepoPath*") {
                    $allMatches += [PSCustomObject]@{
                        File    = $file.FullName.Replace($RepoPath, ".")
                        Line    = $line.LineNumber
                        Content = $line.Line.Trim()
                    }
                }
            }
        }
}

if ($allMatches) {
    Log "Found external absolute paths (possibly old):"
    foreach ($m in $allMatches) {
        Log "  $($m.File) : line $($m.Line)"
        Log "    $($m.Content)"
    }
} else {
    Log "OK - no external absolute paths found in files."
}

# -- 8. VS Code
Log "`n[7] VS CODE (.vscode)"
Log $("-" * 40)

if (Test-Path ".vscode") {
    $vsFiles = Get-ChildItem ".vscode" -File
    Log "Files in .vscode: $($vsFiles.Name -join ', ')"

    $vsOldPaths = @()
    foreach ($f in $vsFiles) {
        $hits = Select-String -Path $f.FullName -Pattern '[A-Za-z]:\\' -ErrorAction SilentlyContinue |
                Where-Object { $_.Line -notlike "*$RepoPath*" }
        $vsOldPaths += $hits
    }

    if ($vsOldPaths) {
        Log "WARNING: Old paths found in .vscode:"
        $vsOldPaths | ForEach-Object {
            Log "  $($_.Filename) : line $($_.LineNumber) -> $($_.Line.Trim())"
        }
    } else {
        Log "OK - .vscode looks clean."
    }
} else {
    Log "(.vscode folder not found)"
}

# -- 9. Environment variables
Log "`n[8] ENVIRONMENT VARIABLES WITH PATHS"
Log $("-" * 40)

$envVarsWithPaths = [System.Environment]::GetEnvironmentVariables() |
    ForEach-Object { $_.GetEnumerator() } |
    Where-Object { $_.Value -match '[A-Za-z]:\\' -and $_.Value -notlike "*$RepoPath*" } |
    Select-Object Name, Value

if ($envVarsWithPaths) {
    Log "Environment variables with absolute paths (not current repo):"
    $envVarsWithPaths | ForEach-Object { Log "  $($_.Name) = $($_.Value)" }
} else {
    Log "OK - no environment variables with old paths."
}

# -- 10. Connection with remote
Log "`n[9] CHECK REMOTE CONNECTION"
Log $("-" * 40)

$remoteList = git remote 2>&1
if ($remoteList -and $remoteList -notmatch "^fatal") {
    foreach ($r in $remoteList) {
        $fetchResult = git fetch $r --dry-run 2>&1
        if ($LASTEXITCODE -eq 0) {
            Log "OK - remote '$r' is available."
        } else {
            Log "ERROR connecting to remote '$r':"
            Log "  $($fetchResult -join ' ')"
        }
    }
} else {
    Log "(remote not configured - skipping)"
}

# -- Summary
Log "`n$Divider"
Log "  DONE. Report saved to:"
Log "  $LogFile"
Log $Divider

# Open report in notepad
Start-Process notepad.exe $LogFile
