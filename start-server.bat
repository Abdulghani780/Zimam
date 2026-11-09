@echo off
setlocal EnableExtensions
cd /d "%~dp0backend"
title ASAAS Server Control v2.5 [Enterprise Master]

:: Auto-elevate to Administrator if not already elevated
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Requesting Administrator privileges (UAC)...
    powershell -Command "Start-Process cmd -ArgumentList '/k `\"%~dp0start-server.bat`\"' -Verb RunAs"
    exit /b
)

:: Terminate any previous process holding port 8765 so elevated instance takes full ownership
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8765 ^| findstr LISTENING') do (
    echo [*] Terminating previous process on port 8765 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

set PY=python
if exist "C:\Python315\python.exe" set PY="C:\Python315\python.exe"

:: Launch browser in background after 1 second
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:8765/'"

%PY% main.py %*
pause
