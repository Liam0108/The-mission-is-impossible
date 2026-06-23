@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "SCRIPT=%PROJECT_ROOT%scripts\start-investment-lab.ps1"

if not exist "%SCRIPT%" (
    echo ERROR: Launcher script was not found:
    echo %SCRIPT%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -AutoScan
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Investment Lab launcher stopped with exit code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
