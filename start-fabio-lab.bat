@echo off
setlocal

set "PROJECT_ROOT=C:\Users\zhang\Documents\Codex\2026-05-31\project-name-fabio-edge-research-lab"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "APP_URL=http://localhost:3000/market-lab"

if not exist "%FRONTEND_DIR%\package.json" (
    echo Frontend package.json was not found:
    echo %FRONTEND_DIR%\package.json
    pause
    exit /b 1
)

echo Stopping old Next.js dev servers on ports 3000, 3001, and 3002...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(3000,3001,3002); $listeners = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue; if ($listeners) { $listeners | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne 0 } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }" >nul 2>nul

cd /d "%FRONTEND_DIR%" || (
    echo Could not enter frontend folder:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

if /i not "%CD%"=="%FRONTEND_DIR%" (
    echo Refusing to clear cache because the current folder is not the expected frontend path.
    echo Current: %CD%
    echo Expected: %FRONTEND_DIR%
    pause
    exit /b 1
)

if exist ".next" (
    echo Clearing stale .next cache...
    rmdir /s /q ".next"
)

start "Fabio Edge Browser Opener" /min powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$url = '%APP_URL%'; for ($i = 0; $i -lt 60; $i++) { try { Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; Start-Process $url"

echo Starting Fabio Edge Research Lab at %APP_URL%
npm.cmd run dev -- --port 3000

endlocal
