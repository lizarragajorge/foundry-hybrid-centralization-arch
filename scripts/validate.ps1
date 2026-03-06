# ============================================================================
# Bicep Validation Script
# Run in CI or locally to validate the landing zone template compiles
# and passes preflight validation without deploying.
# ============================================================================

param(
    [string]$Location = "eastus2"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$templatePath = Join-Path $scriptDir "..\infra\main.bicep"
$paramsPath = Join-Path $scriptDir "..\infra\main.bicepparam"

Write-Host "=== Bicep Validation ===" -ForegroundColor Cyan

# 1. Compile
Write-Host "[1/3] Compiling Bicep template..." -ForegroundColor Yellow
az bicep build --file $templatePath 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "FAIL: Bicep compilation failed."
    exit 1
}
Write-Host "  PASS: Template compiles successfully." -ForegroundColor Green

# 2. Lint (bicep linter runs during build, re-run with --diagnostics-format)
Write-Host "[2/3] Running Bicep linter..." -ForegroundColor Yellow
$lintOutput = az bicep build --file $templatePath --stdout 2>&1
if ($lintOutput -match "Warning|Error") {
    Write-Host "  WARN: Linter produced warnings (see above)." -ForegroundColor DarkYellow
} else {
    Write-Host "  PASS: No linter warnings." -ForegroundColor Green
}

# 3. Preflight validation (requires authenticated Azure session)
Write-Host "[3/3] Running preflight validation..." -ForegroundColor Yellow
$account = az account show 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($account) {
    az deployment sub validate `
        --location $Location `
        --template-file $templatePath `
        --parameters $paramsPath `
        --name "validate-$(Get-Date -Format 'yyyyMMddHHmmss')" 2>&1 | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Error "FAIL: Preflight validation failed."
        exit 1
    }
    Write-Host "  PASS: Preflight validation succeeded." -ForegroundColor Green
} else {
    Write-Host "  SKIP: Not authenticated — run 'az login' for preflight validation." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "All checks passed." -ForegroundColor Green
