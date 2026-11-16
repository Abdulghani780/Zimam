# ZIMAM - registers auto-start scheduled tasks.
# Runs elevated from the Inno installer ([Run] postinstall).
#
# Uses the ScheduledTasks PowerShell module instead of schtasks.exe: the /tr
# argument cannot safely express quoted paths containing spaces ("Program
# Files"), which made schtasks fail with "Invalid argument/option".
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $app 'bin'
$logDir = Join-Path $app 'data'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Start-Transcript -Path (Join-Path $logDir 'install-tasks.log') -Append | Out-Null
trap { Stop-Transcript | Out-Null; throw }

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)

function Register-ZimamServiceTask([string]$Name, [string]$Exe, [string]$ExtraArgs) {
    $action = if ([string]::IsNullOrWhiteSpace($ExtraArgs)) {
        New-ScheduledTaskAction -Execute $Exe
    } else {
        New-ScheduledTaskAction -Execute $Exe -Argument $ExtraArgs
    }
    $trigger = New-ScheduledTaskTrigger -AtStartup
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    if ($LASTEXITCODE -ne 0 -and -not (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue)) {
        throw "Failed to register task $Name"
    }
}

function Register-ZimamWatchdog([string]$Name, [int]$Port, [string]$TaskToRun) {
    $guard = switch ($Name) { 'ZIMAM Backend Watchdog' { 'backend' } 'ZIMAM Control Plane Watchdog' { 'control' } }
    $script = Join-Path $PSScriptRoot "watchdog-$guard.ps1"
    $body = "if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) { schtasks /run /tn '$TaskToRun' | Out-Null }"
    $body | Out-File $script -Encoding ascii
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}

Register-ZimamServiceTask 'ZIMAM Backend'        (Join-Path $bin 'zimam-backend.exe')  '--host 127.0.0.1 --port 8765'
Register-ZimamServiceTask 'ZIMAM Control Plane' (Join-Path $bin 'zimam-control.exe')  ''

Register-ZimamWatchdog 'ZIMAM Backend Watchdog'       8765 'ZIMAM Backend'
Register-ZimamWatchdog 'ZIMAM Control Plane Watchdog' 8876 'ZIMAM Control Plane'

# Start immediately.
schtasks.exe /run /tn 'ZIMAM Backend' | Out-Null
schtasks.exe /run /tn 'ZIMAM Control Plane' | Out-Null

Write-Host 'ZIMAM tasks registered.'
Stop-Transcript | Out-Null
