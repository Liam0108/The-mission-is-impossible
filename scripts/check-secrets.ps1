param(
    [switch]$StagedOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".git")) {
    Write-Error "Git repository not found at $root"
}

$files = @()
if ($StagedOnly) {
    $files = @(git diff --cached --name-only --diff-filter=ACMR)
} else {
    $files = @(git ls-files --cached --others --exclude-standard)
}

$textExtensions = @(
    ".bat", ".cmd", ".css", ".env", ".example", ".html", ".ini", ".js",
    ".json", ".jsx", ".md", ".mjs", ".ps1", ".py", ".sh", ".sql",
    ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"
)

$rules = @(
    @{ Name = "OpenAI-style API key"; Pattern = "sk-[A-Za-z0-9_-]{20,}" },
    @{ Name = "GitHub token"; Pattern = "gh[pousr]_[A-Za-z0-9_]{20,}" },
    @{ Name = "AWS access key"; Pattern = "AKIA[0-9A-Z]{16}" },
    @{ Name = "Private key block"; Pattern = "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----" },
    @{
        Name = "Non-placeholder FMP_API_KEY"
        Pattern = "(?im)^\s*FMP_API_KEY\s*=\s*(?!your_fmp_key_here\s*$|<redacted>\s*$|\s*$)[^\r\n#]+"
    },
    @{
        Name = "Literal API key in URL"
        Pattern = "(?i)apikey=(?!YOUR_API_KEY|KEY|<redacted>|\$\{|%7B)[A-Za-z0-9_-]{16,}"
    }
)

$findings = New-Object System.Collections.Generic.List[string]
foreach ($relativePath in $files) {
    if (-not $relativePath -or $relativePath -eq "scripts/check-secrets.ps1") {
        continue
    }

    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }

    $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    $name = [System.IO.Path]::GetFileName($path)
    if ($textExtensions -notcontains $extension -and $name -ne ".gitignore") {
        continue
    }

    $content = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
    foreach ($rule in $rules) {
        if ($content -match $rule.Pattern) {
            $findings.Add("$relativePath`: $($rule.Name)")
        }
    }
}

if ($findings.Count -gt 0) {
    Write-Host "Potential secrets detected:" -ForegroundColor Red
    $findings | Sort-Object -Unique | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "Remove or rotate the secret before committing." -ForegroundColor Red
    exit 1
}

Write-Host "Secret check passed for $($files.Count) candidate file(s)." -ForegroundColor Green
