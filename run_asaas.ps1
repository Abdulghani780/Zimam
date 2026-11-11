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

Start-Sleep -Milliseconds 1200
Start-Process "http://${browserHost}:${port}"
Write-Host '=================================================='
Write-Host ' ASAAS Enterprise v3.0 Master Console Active'
Write-Host " URL: http://${browserHost}:${port}"
Write-Host ' Sign in with the administrator account configured for this appliance.'
Write-Host '=================================================='
