@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "FRONTEND_DIR=%PROJECT_ROOT%frontend"
set "APP_URL=http://localhost:3000/investment-lab"

echo Fabio Edge Research Lab - Frontend
echo App: %APP_URL%
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm.cmd was not found. Install Node.js LTS and reopen this window.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo ERROR: Frontend package.json was not found at:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%" || (
    echo ERROR: Could not enter frontend directory.
    pause
    exit /b 1
)

echo Stopping stale Next.js dev servers on port 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
)

if exist ".next" (
    echo Clearing stale Next.js cache...
    rmdir /s /q ".next"
)

if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo ERROR: npm install failed.
        pause
        exit /b 1
    )
)

echo Starting Next.js on port 3000...
echo Open %APP_URL% after the server is ready.
call npm.cmd run dev -- --port 3000
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Frontend stopped with exit code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
