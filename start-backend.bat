@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "PYTHON=%BACKEND_DIR%\.venv\Scripts\python.exe"
set "BACKEND_URL=http://127.0.0.1:8000"

echo Fabio Edge Research Lab - Backend
echo API:    %BACKEND_URL%
echo Docs:   %BACKEND_URL%/docs
echo Health: %BACKEND_URL%/health
echo.

if not exist "%BACKEND_DIR%\app\main.py" (
    echo ERROR: Backend source was not found at:
    echo %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%PYTHON%" (
    echo ERROR: Backend virtual environment is missing.
    echo Run these commands first:
    echo   cd /d "%BACKEND_DIR%"
    echo   py -3.11 -m venv .venv
    echo   .venv\Scripts\activate
    echo   python -m pip install -U pip
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)

cd /d "%BACKEND_DIR%" || (
    echo ERROR: Could not enter backend directory.
    pause
    exit /b 1
)

"%PYTHON%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Backend stopped with exit code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%
