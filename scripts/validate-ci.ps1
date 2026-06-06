$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$npm = if ($IsWindows -or $env:OS -eq "Windows_NT") { "npm.cmd" } else { "npm" }

Push-Location (Join-Path $root "frontend")
try {
    & $npm run build
    & $npm run lint
}
finally {
    Pop-Location
}

Push-Location $root
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "Docker CLI was not found. Install Docker Desktop and ensure docker is available on PATH, then rerun this script." -ForegroundColor Red
        exit 1
    }
    docker compose run --rm backend-tests
}
finally {
    Pop-Location
}
