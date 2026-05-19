param(
  [string]$Model = "gemma4:latest",
  [string]$OutFile = "docs/ollama-mtp-pilot-latest.md",
  [int]$NumPredict = 360,
  [double]$Temperature = 0.2,
  [double]$TopP = 0.9
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ollamaApiUrl = "http://127.0.0.1:11434/api/generate"

function Test-CommandExists {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "ollama")) {
  Write-Host "ollama-mtp-pilot: ollama CLI not found in PATH"
  exit 2
}

$prompts = @(
  "Write 5 short CTA lines for booking a grooming service in Leipzig in German.",
  "Create a structured FAQ with 6 Q&A pairs for a grooming services page.",
  "Generate SEO title and description for the Contacts page in Russian and English."
)

$results = @()
$totalSeconds = 0.0

foreach ($prompt in $prompts) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $output = ""
  $ok = $false

  try {
    $requestBody = @{
      model  = $Model
      prompt = $prompt
      stream = $false
      options = @{
        num_predict = $NumPredict
        temperature = $Temperature
        top_p = $TopP
      }
    } | ConvertTo-Json -Depth 4

    $response = Invoke-RestMethod -Method Post -Uri $ollamaApiUrl -ContentType "application/json" -Body $requestBody
    $cleanOutput = [string]$response.response
    $ok = [bool]$response.done -and -not [string]::IsNullOrWhiteSpace($cleanOutput)

    if ($cleanOutput.Length -gt 2000) {
      $output = $cleanOutput.Substring(0, 2000) + "`r`n... [truncated]"
    } else {
      $output = $cleanOutput
    }
  }
  catch {
    $ok = $false
    $output = $_.Exception.Message
  }

  $sw.Stop()
  $seconds = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
  $totalSeconds += $seconds

  $results += [PSCustomObject]@{
    Prompt  = $prompt
    Success = $ok
    Seconds = $seconds
    Output  = ($output.Trim())
  }
}

$avg = if ($results.Count -gt 0) { [Math]::Round($totalSeconds / $results.Count, 2) } else { 0 }
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$lines = @()
$lines += "# Ollama MTP Pilot Report"
$lines += ""
$lines += "- Generated: $timestamp"
$lines += "- Model: $Model"
$lines += "- NumPredict: $NumPredict"
$lines += "- Temperature: $Temperature"
$lines += "- TopP: $TopP"
$lines += "- Prompts: $($results.Count)"
$lines += "- Average latency (sec): $avg"
$lines += ""
$lines += "## Runs"
$lines += ""

$index = 1
foreach ($run in $results) {
  $lines += "### $index. Success: $($run.Success) | Latency: $($run.Seconds)s"
  $lines += ""
  $lines += "Prompt:"
  $lines += '```text'
  $lines += $run.Prompt
  $lines += '```'
  $lines += ""
  $lines += "Output:"
  $lines += '```text'
  $lines += $run.Output
  $lines += '```'
  $lines += ""
  $index++
}

$folder = Split-Path -Parent $OutFile
if ($folder -and -not (Test-Path $folder)) {
  New-Item -Path $folder -ItemType Directory -Force | Out-Null
}

$lines -join "`r`n" | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "ollama-mtp-pilot: report saved to $OutFile"
