@echo off
cd /d "%~dp0..\frontend"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-frontend-health.ps1" >nul 2>nul
if not errorlevel 1 (
    echo Fabio Edge frontend is already running at http://localhost:3000
    exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($listeners) { $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force } }" >nul 2>nul
if exist .next (
    rmdir /s /q .next
)
if not exist node_modules (
    npm.cmd install
)
npm.cmd run dev
