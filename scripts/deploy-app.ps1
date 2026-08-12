# ============================================================================
# Deploy the demo web app to the Azure App Service provisioned by main.bicep
# (requires the infra to be deployed with -p deployDemoApp=true).
# ============================================================================

param(
    [string]$SubscriptionId,
    [string]$OrgPrefix = "contoso",
    [string]$Environment = "dev",
    [string]$ResourceGroup,
    [string]$AppName
)

$ErrorActionPreference = "Stop"

# Resolve names to match the conventions in infra/main.bicep
if (-not $ResourceGroup) { $ResourceGroup = "rg-$OrgPrefix-foundry-app-$Environment" }
if (-not $AppName) { $AppName = "$OrgPrefix-foundry-demo-$Environment" }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploy Demo App -> $AppName" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI is not installed. Install from https://aka.ms/installazurecli"
    exit 1
}

if ($SubscriptionId) { az account set --subscription $SubscriptionId }

$appDir = Resolve-Path (Join-Path $PSScriptRoot "..\demo-app")
$zip = Join-Path ([System.IO.Path]::GetTempPath()) "foundry-demo-app.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

Push-Location $appDir
try {
    Write-Host "[1/2] Packaging source (App Service Oryx builds on the server)..." -ForegroundColor Yellow
    # Exclude local build artifacts, dependencies, and secrets; the server runs npm ci + npm run build.
    $items = Get-ChildItem -Force | Where-Object { $_.Name -notin @('node_modules', '.next', '.git', '.env.local') }
    Compress-Archive -Path $items.FullName -DestinationPath $zip -Force
    Write-Host "  OK - packaged $($items.Count) top-level items" -ForegroundColor Green

    Write-Host "[2/2] Deploying to App Service..." -ForegroundColor Yellow
    az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zip --type zip
    if ($LASTEXITCODE -ne 0) { Write-Error "Deployment failed."; exit 1 }
}
finally {
    Pop-Location
    if (Test-Path $zip) { Remove-Item $zip -Force }
}

$hostName = az webapp show --resource-group $ResourceGroup --name $AppName --query defaultHostName -o tsv
Write-Host ""
Write-Host "Deployed. App URL: https://$hostName" -ForegroundColor Green
Write-Host "The first request triggers a server-side build and may take a few minutes." -ForegroundColor DarkYellow
