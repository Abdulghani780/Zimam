# ASAAS - Clean VM validation script (Phase 6 gate)
# Run on a fresh Windows 10/11 VM AFTER installing ASAAS-Setup.exe.
# Elevated PowerShell recommended. Read-only checks + a PASS/FAIL summary.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-clean-vm.ps1
#         powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate-clean-vm.ps1 -SkipAgent

param(
    [switch]$SkipAgent,
    [string]$InstallDir = "$env:ProgramFiles\ASAAS"
)

$ErrorActionPreference = 'Continue'
$results = New-Object System.Collections.Generic.List[object]

function Check([string]$Name, [scriptblock]$Test, [string]$Hint = '') {
    try {
        $ok = & $Test
        $results.Add([pscustomobject]@{ Check = $Name; Result = $(if ($ok) { 'PASS' } else { 'FAIL' }); Hint = $Hint })
    } catch {
        $results.Add([pscustomobject]@{ Check = $Name; Result = 'FAIL'; Hint = $_.Exception.Message })
    }
}

Write-Host "=== ASAAS Clean-VM Validation ===" -ForegroundColor Cyan
Write-Host "Install dir: $InstallDir`n"

# --- 1. Payload installed ---
Check 'Backend exe present' { Test-Path "$InstallDir\bin\asaas-backend.exe" } 'Re-run ASAAS-Setup.exe'
Check 'Control plane exe present' { Test-Path "$InstallDir\bin\asaas-control.exe" }
Check 'Agent exe present' { Test-Path "$InstallDir\bin\Asaas.Agent.exe" }
Check 'Web SPA present' { Test-Path "$InstallDir\web\index.html" }
Check 'Install scripts present' { Test-Path "$InstallDir\scripts\install-tasks.ps1" }

# --- 2. Auto-start scheduled tasks (SYSTEM, AtStartup) ---
$expectedTasks = @('ASAAS Backend', 'ASAAS Control Plane', 'ASAAS Backend Watchdog', 'ASAAS Control Plane Watchdog')
foreach ($tn in $expectedTasks) {
    Check "Task '$tn' registered" {
        $t = Get-ScheduledTask -TaskName $tn -ErrorAction Stop
        $t.State -in @('Ready', 'Running') -and $t.Triggers.CimClass.CimClassName -contains 'MSFT_TaskBootTrigger'
    } 'Run {0}\scripts\install-tasks.ps1 elevated' -f $InstallDir
}

# --- 3. Services listening ---
Check 'Backend listening on 8765' {
    [bool](Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue)
} 'schtasks /run /tn "ASAAS Backend"'
Check 'Control plane listening on 8876' {
    [bool](Get-NetTCPConnection -LocalPort 8876 -State Listen -ErrorAction SilentlyContinue)
} 'schtasks /run /tn "ASAAS Control Plane"'

# --- 4. HTTP smoke ---
Check 'Backend /api/health responds' {
    try { (Invoke-WebRequest -Uri 'http://127.0.0.1:8765/api/health' -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { $false }
}
Check 'Control plane console responds' {
    try { (Invoke-WebRequest -Uri 'http://127.0.0.1:8876/' -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { $false }
}
Check 'SPA served (login page HTML)' {
    $html = (Invoke-WebRequest -Uri 'http://127.0.0.1:8876/' -UseBasicParsing -TimeoutSec 10).Content
    $html -match 'id="root"|<div id="root"'
}

# --- 5. Data dir writable + ACL ---
Check 'Data dir exists' { Test-Path "$InstallDir\data" }
Check 'Data dir writable by SYSTEM/Admins' {
    $acl = Get-Acl "$InstallDir\data"
    ($acl.Access | Where-Object { $_.IdentityReference -match 'SYSTEM|Administrators' -and $_.FileSystemRights -match 'FullControl' }).Count -ge 1
}

# --- 6. Agent service (optional) ---
if (-not $SkipAgent) {
    Check 'Agent status command runs' {
        $out = & "$InstallDir\bin\Asaas.Agent.exe" status 2>&1 | Out-String
        $LASTEXITCODE -eq 0 -or $out -match 'ASAAS Windows Agent|not installed|running|stopped'
    } 'Agent must be installed separately: Asaas.Agent.exe install (admin)'
}

# --- 7. Reboot persistence (static check) ---
Check 'Backend task has AtStartup trigger' {
    (Get-ScheduledTask -TaskName 'ASAAS Backend').Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger' }
}
Check 'Control plane task has AtStartup trigger' {
    (Get-ScheduledTask -TaskName 'ASAAS Control Plane').Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger' }
}

# --- Summary ---
Write-Host "`n=== Results ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
$failed = @($results | Where-Object Result -eq 'FAIL')
if ($failed.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$($failed.Count) CHECK(S) FAILED" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host ("  FAIL: " + $_.Check + " - " + $_.Hint) -ForegroundColor Red }
    exit 1
}
