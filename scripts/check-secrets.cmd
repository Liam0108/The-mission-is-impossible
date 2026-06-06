@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-secrets.ps1" %*
