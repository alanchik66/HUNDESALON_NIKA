[CmdletBinding()]
param([ValidateSet('Start', 'CopyKey', 'Status', 'Stop')][string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$instance = Join-Path $root 'output\local-site-admin'
$keyFile = Join-Path $instance 'owner-key.dpapi'
$pidFile = Join-Path $instance 'launcher.json'
$helper = Join-Path $PSScriptRoot 'lib\local-site-admin.mjs'
$origin = 'http://127.0.0.1:8796'
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Net.Http
[void][IO.Directory]::CreateDirectory($instance)

function Get-OwnerKey {
    if (![IO.File]::Exists($keyFile)) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $rng.GetBytes($bytes)
            $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')
            [IO.File]::WriteAllBytes($keyFile, $protected)
        } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
            $rng.Dispose()
        }
    }
    $plain = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile), $null, 'CurrentUser')
    try { return [Convert]::ToBase64String($plain) } finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Get-OwnerProcess {
    if (![IO.File]::Exists($pidFile)) { return }
    $record = [IO.File]::ReadAllText($pidFile) | ConvertFrom-Json
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq 'node' -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.ticks) {
        return $process
    }
}

function Get-OwnerTree($process) {
    foreach ($child in @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($process.Id)" -Property ProcessId,CreationDate)) {
        $live = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
        if ($live -and $live.StartTime -ge $process.StartTime) { Get-OwnerTree $live }
    }
    $process
}

function Stop-OwnerProcess($process) {
    foreach ($owned in @(Get-OwnerTree $process)) {
        if (!$owned.HasExited) { $owned.Kill() }
    }
}

function Test-OwnerSession($key) {
    $handler = New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = New-Object Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(5)
    $client.DefaultRequestHeaders.Add('Origin', $origin)
    $content = New-Object Net.Http.StringContent((ConvertTo-Json -Compress @{key = $key}), [Text.Encoding]::UTF8, 'application/json')
    try {
        $login = $client.PostAsync("$origin/api/admin/session", $content).GetAwaiter().GetResult()
        if ([int]$login.StatusCode -ne 200) { throw "Вход вернул HTTP $([int]$login.StatusCode)." }
        try {
            $settings = $client.GetAsync("$origin/api/admin/settings").GetAwaiter().GetResult()
            if ([int]$settings.StatusCode -ne 200) { throw "Чтение настроек вернуло HTTP $([int]$settings.StatusCode)." }
        } finally {
            $logout = $client.DeleteAsync("$origin/api/admin/session").GetAwaiter().GetResult()
            if (!$logout.IsSuccessStatusCode) { throw 'Ошибка завершения проверочного сеанса.' }
        }
        $signedOut = $client.GetAsync("$origin/api/admin/settings").GetAwaiter().GetResult()
        if ([int]$signedOut.StatusCode -ne 401) { throw 'Проверочный сеанс остался активен.' }
    } finally {
        $content.Dispose()
        $client.Dispose()
    }
}

$guard = New-Object Threading.Mutex($false, 'Local\HundesalonNikaOwner8796')
try {
    try { $locked = $guard.WaitOne([TimeSpan]::FromSeconds(100)) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw 'Другая операция запуска панели ещё выполняется.' }
    if ($Action -eq 'CopyKey') {
        Add-Type -AssemblyName System.Windows.Forms
        $item = New-Object Windows.Forms.DataObject
        $item.SetText((Get-OwnerKey))
        $item.SetData('ExcludeClipboardContentFromMonitorProcessing', $false, [IO.MemoryStream]::new([byte[]]@(1)))
        [Windows.Forms.Clipboard]::SetDataObject($item, $true, 5, 100)
        Write-Output 'Ключ скопирован в буфер обмена.'
        return
    }
    $existing = Get-OwnerProcess
    if ($Action -eq 'Stop') {
        if ($existing) { Stop-OwnerProcess $existing }
        Write-Output 'Локальная панель остановлена.'
        return
    }
    if ($existing) {
        Write-Output "Локальная панель: $origin/admin/ (PID $($existing.Id))"
        return
    }
    if ($Action -eq 'Status') { Write-Output 'Локальная панель остановлена.'; return }
    if (![IO.File]::Exists((Join-Path $root 'dist\index.html'))) { throw 'Сначала соберите сайт командой npm run build:production.' }
    if (![IO.File]::Exists((Join-Path $root 'node_modules\wrangler\bin\wrangler.js'))) { throw 'Для запуска нужны установленные зависимости проекта.' }
    $probe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 8796)
    try { $probe.Start() } catch { throw 'Локальный порт 8796 занят другой программой.' } finally { $probe.Stop() }
    $key = Get-OwnerKey
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    $psi.Arguments = '"' + $helper + '"'
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = 'Hidden'
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $server = [Diagnostics.Process]::Start($psi)
    try {
        [IO.File]::WriteAllText($pidFile, (ConvertTo-Json @{id=$server.Id; ticks=$server.StartTime.ToUniversalTime().Ticks.ToString()}))
        $server.StandardInput.WriteLine($key)
        $server.StandardInput.Close()
        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        $handler = New-Object Net.Http.HttpClientHandler
        $handler.UseProxy = $false
        $handler.AllowAutoRedirect = $false
        $probeHttp = New-Object Net.Http.HttpClient($handler)
        $probeHttp.Timeout = [TimeSpan]::FromSeconds(2)
        $ready = $false
        try {
            while ([DateTime]::UtcNow -lt $deadline -and !$server.HasExited) {
                try {
                    $response = $probeHttp.GetAsync("$origin/api/admin/settings").GetAwaiter().GetResult()
                    $ready = [int]$response.StatusCode -eq 401
                    $response.Dispose()
                    if ($ready) { break }
                } catch [Net.Http.HttpRequestException] {}
                catch [Threading.Tasks.TaskCanceledException] {}
                Start-Sleep -Milliseconds 350
            }
        } finally { $probeHttp.Dispose() }
        if (!$ready) { throw 'Сервер не подтвердил готовность локальной панели.' }
        $owners = @(Get-OwnerTree $server | Select-Object -ExpandProperty Id)
        $listener = @(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8796 -State Listen -ErrorAction Stop)
        if (!$listener -or @($listener | Where-Object { $_.OwningProcess -notin $owners }).Count) { throw 'Владелец локального порта изменился.' }
        Test-OwnerSession $key
    } catch {
        if (!$server.HasExited) { Stop-OwnerProcess $server }
        throw
    }
    Write-Output "Локальная панель: $origin/admin/ (PID $($server.Id)). Вход и выход проверены."
} finally {
    if ($locked) { $guard.ReleaseMutex() }
    $guard.Dispose()
}
