@echo off
setlocal

set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%check-frontend-health.ps1" >nul 2>nul
if not errorlevel 1 goto open_browser

where docker >nul 2>nul
if not errorlevel 1 (
    start "Fabio Edge Stack" "%SCRIPT_DIR%run-stack.cmd"
) else (
    start "Fabio Edge Frontend" "%SCRIPT_DIR%run-frontend.cmd"
)

timeout /t 4 /nobreak >nul

:open_browser
start "" "http://localhost:3000"

endlocal
