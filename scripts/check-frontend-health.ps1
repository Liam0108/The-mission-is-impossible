$ErrorActionPreference = "SilentlyContinue"

for ($attempt = 0; $attempt -lt 5; $attempt++) {
    try {
        $page = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000" -TimeoutSec 5
        if ($page.StatusCode -eq 200) {
            $css = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/_next/static/css/app/layout.css" -TimeoutSec 5
            if ($css.StatusCode -eq 200 -and $css.Content -match "bg-canvas|--canvas|tailwind") {
                exit 0
            }
        }
    } catch {
    }

    Start-Sleep -Seconds 2
}

exit 1
