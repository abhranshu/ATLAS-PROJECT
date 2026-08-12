param(
    [ValidateSet("dev", "prod")]
    [string]$Mode = "dev"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example — edit secrets before production deploy."
}

if ($Mode -eq "prod") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "change-me|change-this") {
        Write-Error "Update POSTGRES_PASSWORD, JWT_SECRET, DOMAIN, and ACME_EMAIL in .env first."
        exit 1
    }
    if ($envContent -notmatch "(?m)^DOMAIN=\S+") {
        Write-Error "Set DOMAIN in .env for production (e.g. DOMAIN=atlas.example.com)."
        exit 1
    }
    Write-Host "Starting Atlas in PRODUCTION mode (HTTPS via Caddy)..."
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
    $domain = (Select-String -Path ".env" -Pattern "^DOMAIN=(.+)$").Matches.Groups[1].Value
    Write-Host ""
    Write-Host "Deployed. Open: https://$domain"
} else {
    Write-Host "Starting Atlas in DEV mode..."
    docker compose up -d --build
    Write-Host ""
    Write-Host "Dashboard: http://localhost:8080"
    Write-Host "API docs:  http://localhost:8080/docs"
}

docker compose ps
