# ============================================================================
# Deploy Azure Foundry Hybrid Pattern
# PowerShell deployment script for the centralized/federated landing zone
# ============================================================================

param(
    [string]$SubscriptionId,
    [string]$Location = "eastus2",
    [string]$Environment = "dev",
    [string]$DeploymentName = "foundry-hybrid-$(Get-Date -Format 'yyyyMMdd-HHmmss')",
    [switch]$Preview,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Azure Foundry - Hybrid Pattern Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Prerequisites Check ---

Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI is not installed. Install from https://aka.ms/installazurecli"
    exit 1
}

$bicepCheck = $null
try { $bicepCheck = az bicep version 2>&1 } catch { }
if (-not $bicepCheck -or $bicepCheck -match "not found") {
    Write-Host "  Installing Bicep CLI..." -ForegroundColor DarkYellow
    az bicep install
}
Write-Host "  OK - Azure CLI and Bicep CLI available" -ForegroundColor Green

# --- Authentication ---

Write-Host "[2/5] Verifying authentication..." -ForegroundColor Yellow

$account = az account show 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Logging in to Azure..." -ForegroundColor DarkYellow
    az login
    $account = az account show | ConvertFrom-Json
}

if ($SubscriptionId) {
    az account set --subscription $SubscriptionId
    $account = az account show | ConvertFrom-Json
}

Write-Host "  OK - Authenticated as: $($account.user.name)" -ForegroundColor Green
Write-Host "  OK - Subscription: $($account.name) ($($account.id))" -ForegroundColor Green

# --- Validate Template ---

Write-Host "[3/5] Validating Bicep template..." -ForegroundColor Yellow

$templatePath = Join-Path (Join-Path $PSScriptRoot "..") "infra\main.bicep"
$paramsPath = Join-Path (Join-Path $PSScriptRoot "..") "infra\main.bicepparam"

$ErrorActionPreference = "Continue"

az bicep build --file $templatePath 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Bicep compilation failed. Fix errors above before deploying."
    exit 1
}

$ErrorActionPreference = "Stop"
Write-Host "  OK - Template compiled successfully" -ForegroundColor Green

if ($ValidateOnly) {
    Write-Host ""
    Write-Host "  Running deployment validation..." -ForegroundColor Yellow
    az deployment sub validate `
        --location $Location `
        --template-file $templatePath `
        --parameters $paramsPath `
        --name "$DeploymentName-validate"

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Validation failed."
        exit 1
    }
    Write-Host "  OK - Validation passed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run without -ValidateOnly to deploy." -ForegroundColor Cyan
    exit 0
}

# --- Preview ---

if ($Preview) {
    Write-Host "[4/5] Running What-If analysis..." -ForegroundColor Yellow
    az deployment sub what-if `
        --location $Location `
        --template-file $templatePath `
        --parameters $paramsPath `
        --name $DeploymentName

    Write-Host ""
    Write-Host "This was a preview. Run without -Preview to deploy." -ForegroundColor Cyan
    exit 0
}

# --- Deploy ---

Write-Host "[4/5] Deploying hybrid Foundry pattern..." -ForegroundColor Yellow
Write-Host "  Deployment name: $DeploymentName" -ForegroundColor DarkGray
Write-Host "  Location: $Location" -ForegroundColor DarkGray
Write-Host ""

$deployResult = az deployment sub create `
    --location $Location `
    --template-file $templatePath `
    --parameters $paramsPath `
    --name $DeploymentName `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed. Check the Azure portal for details."
    exit 1
}

# --- Results ---

Write-Host ""
Write-Host "[5/5] Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "--- Outputs ----------------------------------------" -ForegroundColor Cyan

$outputs = $deployResult.properties.outputs
Write-Host "  Hub Foundry Endpoint : $($outputs.hubFoundryEndpoint.value)" -ForegroundColor White
Write-Host "  Hub Foundry ID       : $($outputs.hubFoundryResourceId.value)" -ForegroundColor White
Write-Host "  Log Analytics ID     : $($outputs.logAnalyticsWorkspaceId.value)" -ForegroundColor White
Write-Host "  Key Vault URI        : $($outputs.keyVaultUri.value)" -ForegroundColor White
Write-Host "  Hub VNet ID          : $($outputs.hubVnetId.value)" -ForegroundColor White
Write-Host ""
Write-Host "  Spoke Projects:" -ForegroundColor White
foreach ($project in $outputs.spokeProjectNames.value) {
    Write-Host "    - $project" -ForegroundColor White
}

Write-Host ""
Write-Host "--- Next Steps -------------------------------------" -ForegroundColor Cyan
Write-Host "  1. Update Entra ID group IDs in main.bicepparam" -ForegroundColor White
Write-Host "  2. Configure private endpoints for production" -ForegroundColor White
Write-Host '  3. Set policyEnforcementMode to Default' -ForegroundColor White
Write-Host '  4. Access the Foundry portal: https://ai.azure.com' -ForegroundColor White
Write-Host ""
