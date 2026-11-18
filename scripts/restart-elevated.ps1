# ASAAS - restart the console stack with elevation.
# Kills whatever listens on the backend (:8765) and control-plane (:8876)
# ports, then relaunches run_asaas.ps1 elevated so shadowing/RDP features
# keep working. Run from an elevated PowerShell, or let it self-elevate.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ports = 8765, 8876

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host '[!] Elevating...' -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($l in $listeners) {
        $procId = $l.OwningProcess
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Host "[*] Killing PID $procId ($name) on :$port"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1
Write-Host '[*] Starting ASAAS stack...' -ForegroundColor Green
& (Join-Path $root 'run_asaas.ps1')
