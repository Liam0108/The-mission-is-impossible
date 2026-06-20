@echo off
setlocal

rem Default local launcher now starts the full Investment Lab stack:
rem FastAPI backend, Next.js frontend, then /investment-lab?autoscan=local.
call "%~dp0start-investment-lab.bat"

endlocal
