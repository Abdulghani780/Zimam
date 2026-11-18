#requires -Version 5.1
<#
.SYNOPSIS
  ASAAS - release build pipeline.

  Produces a staged appliance payload under release\:
    release\bin\asaas-backend.exe
    release\bin\asaas-control.exe
    release\bin\Asaas.Agent.exe (+ libsodium.dll)
    release\web\            (frontend dist, served by the control plane)
    release\data\           (created at first run - ACL'd by the installer)

  Prerequisites on the build machine:
    - .venv with backend + control_plane requirements + pyinstaller
    - Node.js + npm (frontend build)
    - .NET 10 SDK (agent publish)
    - Inno Setup 6 (only for the MSI step, not this script)
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipPython,
    [switch]$SkipAgent
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$py = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) { throw "Virtualenv not found at $py - create it and install requirements first." }

$stage = Join-Path $root 'release'
$binDir = Join-Path $stage 'bin'
$webDir = Join-Path $stage 'web'
$dataDir = Join-Path $stage 'data'
New-Item -ItemType Directory -Force -Path $binDir, $webDir, $dataDir | Out-Null

function Invoke-Step([string]$Name, [scriptblock]$Body) {
    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    & $Body
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "$Name failed with exit code $LASTEXITCODE" }
}

# --- 1. Frontend -------------------------------------------------------------
if (-not $SkipFrontend) {
    Invoke-Step 'Frontend build (vite)' {
        Push-Location (Join-Path $root 'frontend')
        try { npm run build } finally { Pop-Location }
    }
    $dist = Join-Path $root 'dist'
    if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw "Frontend dist missing index.html" }
    Copy-Item (Join-Path $dist '*') $webDir -Recurse -Force
}

# --- 2. Python services (PyInstaller onefile) ---------------------------------
if (-not $SkipPython) {
    Invoke-Step 'asaas-backend.exe (PyInstaller)' {
        & $py -m PyInstaller --onefile --name asaas-backend `
            --paths (Join-Path $root 'backend') `
            --distpath (Join-Path $root 'dist-py') `
            --workpath (Join-Path $root 'build-py') `
            --specpath (Join-Path $root 'build-py') `
            --noconfirm `
            (Join-Path $root 'backend\main.py')
    }
    Invoke-Step 'asaas-control.exe (PyInstaller)' {
        & $py -m PyInstaller --onefile --name asaas-control `
            --paths (Join-Path $root 'control_plane') `
            --distpath (Join-Path $root 'dist-py') `
            --workpath (Join-Path $root 'build-py') `
            --specpath (Join-Path $root 'build-py') `
            --noconfirm `
            (Join-Path $root 'control_plane\serve.py')
    }
    foreach ($exe in 'asaas-backend.exe', 'asaas-control.exe') {
        $src = Join-Path $root "dist-py\$exe"
        if (-not (Test-Path $src)) { throw "Missing build output: $src" }
        Copy-Item $src (Join-Path $binDir $exe) -Force
    }
}

# --- 3. Windows agent (self-contained single file) ----------------------------
if (-not $SkipAgent) {
    Invoke-Step 'Asaas.Agent.exe (dotnet publish)' {
        dotnet publish (Join-Path $root 'agent\Asaas.Agent.csproj') `
            -c Release -r win-x64 --self-contained true `
            -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true `
            -o (Join-Path $root 'agent\publish-single')
    }
    $agentExe = Join-Path $root 'agent\publish-single\Asaas.Agent.exe'
    if (-not (Test-Path $agentExe)) { throw "Missing agent output: $agentExe" }
    Copy-Item $agentExe $binDir -Force
    # libsodium.dll is bundled inside the compressed single-file exe; copy it
    # too if a future publish leaves it external.
    $sodium = Join-Path $root 'agent\publish-single\libsodium.dll'
    if (Test-Path $sodium) { Copy-Item $sodium $binDir -Force }
}

# --- 4. Verify staged payload -------------------------------------------------
Write-Host "`n=== Staged release payload ===" -ForegroundColor Cyan
Get-ChildItem $binDir | ForEach-Object { "{0,-28} {1,8:N1} MB" -f $_.Name, ($_.Length / 1MB) }
$webIndex = Join-Path $webDir 'index.html'
if (-not $SkipFrontend -and -not (Test-Path $webIndex)) { throw "web\index.html missing from stage" }
Write-Host "`nRelease staged at: $stage" -ForegroundColor Green
Write-Host "Next: Inno Setup script (packaging\asaas.iss) consumes this stage."
