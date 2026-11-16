@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title ZIMAM Enterprise v3.0 [Sovereign Server Manager]

:: Auto-elevate to Administrator if not already elevated
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges (UAC)...
    powershell -Command "Start-Process cmd -ArgumentList '/k `\"%~dp0start-server.bat`\"' -Verb RunAs"
    exit /b
)

:: Deployment configuration from .env (single source of truth)
set "ZIMAM_HOST=127.0.0.1"
set "ZIMAM_PORT=8765"
if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
        if /i "%%A"=="ZIMAM_HOST" set "ZIMAM_HOST=%%~B"
        if /i "%%A"=="ZIMAM_PORT" set "ZIMAM_PORT=%%~B"
    )
)

set "BROWSER_HOST=%ZIMAM_HOST%"
if "%BROWSER_HOST%"=="0.0.0.0" set "BROWSER_HOST=127.0.0.1"
if "%BROWSER_HOST%"=="::" set "BROWSER_HOST=127.0.0.1"

:: Terminate any previous process holding the configured port so the elevated
:: instance takes full ownership.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%ZIMAM_PORT% ^| findstr LISTENING') do (
    echo [*] Terminating previous process on port %ZIMAM_PORT% (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

set PY=python
if exist "%~dp0.venv\Scripts\python.exe" (
    set PY="%~dp0.venv\Scripts\python.exe"
) else if exist "C:\Python315\python.exe" (
    set PY="C:\Python315\python.exe"
)

:: Launch browser in background after 1.5 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://%BROWSER_HOST%:%ZIMAM_PORT%/'"

echo [*] Launching ZIMAM Enterprise v3.0 on %ZIMAM_HOST%:%ZIMAM_PORT%...
%PY% backend\main.py --host %ZIMAM_HOST% --port %ZIMAM_PORT% %*
pause
