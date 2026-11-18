@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ASAAS Enterprise v3.0 [Sovereign Server Manager]

:: Auto-elevate to Administrator if not already elevated
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges (UAC)...
    powershell -Command "Start-Process cmd -ArgumentList '/k `\"%~dp0start-server.bat`\"' -Verb RunAs"
    exit /b
)

:: Deployment configuration from .env (single source of truth)
set "ASAAS_HOST=127.0.0.1"
set "ASAAS_PORT=8765"
if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
        if /i "%%A"=="ASAAS_HOST" set "ASAAS_HOST=%%~B"
        if /i "%%A"=="ASAAS_PORT" set "ASAAS_PORT=%%~B"
    )
)

set "BROWSER_HOST=%ASAAS_HOST%"
if "%BROWSER_HOST%"=="0.0.0.0" set "BROWSER_HOST=127.0.0.1"
if "%BROWSER_HOST%"=="::" set "BROWSER_HOST=127.0.0.1"

:: Terminate any previous process holding the configured port so the elevated
:: instance takes full ownership.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%ASAAS_PORT% ^| findstr LISTENING') do (
    echo [*] Terminating previous process on port %ASAAS_PORT% (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

set PY=python
if exist "%~dp0.venv\Scripts\python.exe" (
    set PY="%~dp0.venv\Scripts\python.exe"
) else if exist "C:\Python315\python.exe" (
    set PY="C:\Python315\python.exe"
)

:: Launch browser in background after 1.5 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://%BROWSER_HOST%:%ASAAS_PORT%/'"

echo [*] Launching ASAAS Enterprise v3.0 on %ASAAS_HOST%:%ASAAS_PORT%...
%PY% backend\main.py --host %ASAAS_HOST% --port %ASAAS_PORT% %*
pause
