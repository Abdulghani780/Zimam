$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root '.venv\Scripts\python.exe'
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $data | Out-Null

if (-not (Test-Path $python)) {
  $python = 'python'
}

# Honor the deployment configuration instead of hard-coding the bind address.
$hostAddr = '127.0.0.1'
$port = 8765
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
  foreach ($line in Get-Content -Path $envFile) {
    if ($line -match '^\s*ASAAS_HOST\s*=\s*(.+?)\s*$') {
      $hostAddr = $Matches[1].Trim().Trim('"').Trim("'")
    }
    elseif ($line -match '^\s*ASAAS_PORT\s*=\s*(\d+)\s*$') {
      $port = [int]$Matches[1]
    }
  }
}

$browserHost = if ($hostAddr -eq '0.0.0.0' -or $hostAddr -eq '::') { '127.0.0.1' } else { $hostAddr }

function Test-ListeningPort([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-ListeningPort $port)) {
  $env:PYTHONPATH = Join-Path $root 'backend'
  Start-Process -FilePath $python -WorkingDirectory $root -WindowStyle Hidden `
    -ArgumentList @('backend\main.py', '--host', $hostAddr, '--port', "$port") `
    -RedirectStandardOutput (Join-Path $data 'server.log') `
    -RedirectStandardError (Join-Path $data 'server-error.log')
}

# Control plane (:8876) — serves /console SPA, /api/v1 natively, and proxies
# legacy /api/* to the backend above so the console works on one origin.
$cpPort = 8876
$cpUrl = ''
if (-not (Test-ListeningPort $cpPort)) {
  $env:PYTHONPATH = Join-Path $root 'control_plane'
  $env:ASAAS_LEGACY_API_URL = "http://127.0.0.1:$port"
  Start-Process -FilePath $python -WorkingDirectory $root -WindowStyle Hidden `
    -ArgumentList @('-m', 'uvicorn', 'asaas_control.app:app', '--host', '127.0.0.1', '--port', "$cpPort") `
    -RedirectStandardOutput (Join-Path $data 'control-plane.log') `
    -RedirectStandardError (Join-Path $data 'control-plane-error.log')
}

Start-Sleep -Milliseconds 1800
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$cpPort/api/v1/health" -TimeoutSec 5
  if ($health.status -eq 'ok') { $cpUrl = "http://127.0.0.1:$cpPort/" }
} catch { }

$openUrl = if ($cpUrl) { $cpUrl } else { "http://${browserHost}:${port}" }
Start-Process $openUrl
Write-Host '=================================================='
Write-Host ' ASAAS Enterprise v3.0 Master Console Active'
if ($cpUrl) {
  Write-Host " URL: $cpUrl  (control plane + legacy proxy)"
} else {
  Write-Host " URL: http://${browserHost}:${port}  (legacy console; control plane unavailable)"
}
Write-Host ' Sign in with the administrator account configured for this appliance.'
Write-Host '=================================================='
