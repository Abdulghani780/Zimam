# ASAAS Server Control - registers auto-start scheduled tasks.
# Runs elevated from the Inno installer ([Run] postinstall).
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $app 'bin'

function Register-AsaasTask([string]$Name, [string]$Exe, [string]$ExtraArgs) {
    $action = "`"$Exe`" $ExtraArgs".Trim()
    schtasks.exe /create /tn $Name /sc onstart /ru SYSTEM /rl HIGHEST /tr $action /f | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to register task $Name" }
}

Register-AsaasTask 'ASAAS Backend'        (Join-Path $bin 'asaas-backend.exe')  '--host 127.0.0.1 --port 8765'
Register-AsaasTask 'ASAAS Control Plane' (Join-Path $bin 'asaas-control.exe')  ''

# Watchdogs: every minute, restart the service task if its port is not listening.
$wdBackend = @"
if (-not (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue)) { schtasks /run /tn 'ASAAS Backend' | Out-Null }
"@
$wdControl = @"
if (-not (Get-NetTCPConnection -LocalPort 8876 -State Listen -ErrorAction SilentlyContinue)) { schtasks /run /tn 'ASAAS Control Plane' | Out-Null }
"@
$wdBackend | Out-File (Join-Path $PSScriptRoot 'watchdog-backend.ps1') -Encoding ascii
$wdControl | Out-File (Join-Path $PSScriptRoot 'watchdog-control.ps1') -Encoding ascii

schtasks.exe /create /tn 'ASAAS Backend Watchdog' /sc minute /mo 1 /ru SYSTEM /rl HIGHEST /tr "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\watchdog-backend.ps1`"" /f | Out-Null
schtasks.exe /create /tn 'ASAAS Control Plane Watchdog' /sc minute /mo 1 /ru SYSTEM /rl HIGHEST /tr "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSScriptRoot\watchdog-control.ps1`"" /f | Out-Null

# Start immediately.
schtasks.exe /run /tn 'ASAAS Backend' | Out-Null
schtasks.exe /run /tn 'ASAAS Control Plane' | Out-Null

Write-Host 'ASAAS Server Control tasks registered.'
