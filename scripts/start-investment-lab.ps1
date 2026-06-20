param(
    [switch]$AutoScan
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$BackendHealthUrl = "http://127.0.0.1:8000/health"
$FrontendHealthUrl = "http://localhost:3000/investment-lab"
$TargetUrl = if ($AutoScan) { "http://localhost:3000/investment-lab?autoscan=local" } else { "http://localhost:3000/investment-lab" }

function Test-HttpUrl {
    param(
        [string]$Url,
        [int]$TimeoutSec = 2
    )
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
        return $false
    }
}

function Test-FrontendHealthy {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) { return $false }
        $cssLinks = [regex]::Matches($response.Content, 'href="([^"]*\.css[^"]*)"')
        if ($cssLinks.Count -eq 0) { return $false }
        foreach ($match in $cssLinks) {
            $href = $match.Groups[1].Value
            $cssUrl = if ($href.StartsWith("http")) { $href } else { "http://localhost:3000$href" }
            if (-not (Test-HttpUrl -Url $cssUrl -TimeoutSec 5)) { return $false }
        }
        return $true
    } catch {
        return $false
    }
}

function Stop-Port {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) { return }
    $listeners |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne 0 } |
        ForEach-Object {
            try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
        }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Seconds = 60
    )
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-HttpUrl -Url $Url -TimeoutSec 2) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Ensure-BackendVenv {
    if (Test-Path $BackendPython) { return }

    Write-Host "Backend virtual environment is missing. Creating backend\.venv..."
    Push-Location $BackendDir
    try {
        $py = Get-Command py -ErrorAction SilentlyContinue
        if ($py) {
            & py -3.11 -m venv .venv
        } else {
            & python -m venv .venv
        }
        & $BackendPython -m pip install -U pip
        & $BackendPython -m pip install -r requirements.txt
    } finally {
        Pop-Location
    }
}

Write-Host "Fabio Edge Research Lab one-click Investment Lab launcher"
Write-Host "Project:  $ProjectRoot"
Write-Host "Backend:  $BackendHealthUrl"
Write-Host "Frontend: $TargetUrl"
Write-Host ""

if (-not (Test-Path (Join-Path $BackendDir "app\main.py"))) {
    throw "Backend source was not found at $BackendDir"
}
if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
    throw "Frontend package.json was not found at $FrontendDir"
}

if (-not (Test-HttpUrl -Url $BackendHealthUrl)) {
    Ensure-BackendVenv
    Stop-Port -Port 8000
    Write-Host "Starting backend on port 8000..."
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k", "`"$ProjectRoot\start-backend.bat`"" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Minimized
} else {
    Write-Host "Backend is already online."
}

if (-not (Test-FrontendHealthy -Url $FrontendHealthUrl)) {
    Stop-Port -Port 3000
    Write-Host "Starting frontend on port 3000. The frontend launcher will clear stale .next cache..."
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k", "`"$ProjectRoot\start-frontend.bat`"" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Minimized
} else {
    Write-Host "Frontend is already online."
}

$backendReady = Wait-ForUrl -Url $BackendHealthUrl -Seconds 75
$frontendReady = Wait-ForUrl -Url $FrontendHealthUrl -Seconds 90

if ($backendReady) {
    Write-Host "Backend ready."
} else {
    Write-Warning "Backend did not become ready. SEC EDGAR and experimental Yahoo scans may still show offline."
}

if ($frontendReady) {
    Write-Host "Frontend ready."
} else {
    Write-Warning "Frontend did not respond yet. Opening the browser anyway; refresh after the dev server finishes compiling."
}

Write-Host "Opening $TargetUrl"
Start-Process $TargetUrl
