# ============================================================================
# Agent Gateway Setup (Managed Identity)
#
# Run AFTER deploying with enableAiGateway = true.
# Verifies APIM configuration, MI RBAC, and configures the demo app.
# No API keys — everything is identity-based.
# ============================================================================

param(
    [string]$OrgPrefix = "contoso",
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"
$apimName = "${OrgPrefix}-foundry-apim-${Environment}"
$hubRg    = "rg-${OrgPrefix}-foundry-hub-${Environment}"
$foundryName = "${OrgPrefix}-foundry-hub-${Environment}"

Write-Host "`n=== Agent Gateway Setup (Managed Identity) ===" -ForegroundColor Cyan
Write-Host "  APIM: $apimName"
Write-Host "  Hub RG: $hubRg`n"

# 1. Get APIM gateway URL and MI principal
Write-Host "[1/4] Fetching APIM gateway URL..." -ForegroundColor Yellow
$apimInfo = az apim show --name $apimName -g $hubRg --query "{url:gatewayUrl, principalId:identity.principalId}" -o json 2>$null | ConvertFrom-Json
if (-not $apimInfo) {
    Write-Host "  ERROR: APIM '$apimName' not found. Deploy with enableAiGateway = true first." -ForegroundColor Red
    exit 1
}
Write-Host "  Gateway URL:    $($apimInfo.url)" -ForegroundColor Green
Write-Host "  APIM MI (oid):  $($apimInfo.principalId)" -ForegroundColor Green

# 2. Verify APIM MI has Cognitive Services User role on hub
Write-Host "`n[2/4] Verifying APIM managed identity RBAC..." -ForegroundColor Yellow
$foundryId = az cognitiveservices account show --name $foundryName -g $hubRg --query id -o tsv 2>$null
$roleAssignments = az role assignment list --scope $foundryId --assignee $apimInfo.principalId --query "[].roleDefinitionName" -o tsv 2>$null
if ($roleAssignments -match "Cognitive Services User|Azure AI User") {
    Write-Host "  APIM MI has Cognitive Services User role on Foundry hub" -ForegroundColor Green
} else {
    Write-Host "  WARNING: APIM MI may not have the required role. Check RBAC." -ForegroundColor Yellow
    Write-Host "  Expected: Cognitive Services User on $foundryName" -ForegroundColor Yellow
}

# 3. List BU project MI principal IDs (these are the callerPrincipalIds in APIM policy)
Write-Host "`n[3/4] BU project managed identity principal IDs..." -ForegroundColor Yellow
$subId = az account show --query id -o tsv 2>$null
$projects = az rest --method GET `
    --url "https://management.azure.com/subscriptions/$subId/resourceGroups/$hubRg/providers/Microsoft.CognitiveServices/accounts/$foundryName/projects?api-version=2025-04-01-preview" `
    --query "value[].{name:name, principalId:identity.principalId, tags:tags}" -o json 2>$null | ConvertFrom-Json

foreach ($project in $projects) {
    $shortName = ($project.name -split '/')[-1]
    $bu = $project.tags.businessUnit
    Write-Host "  $shortName (BU: $bu): $($project.principalId)" -ForegroundColor Green
}

# 4. Write .env.local (gateway URL only — no keys)
Write-Host "`n[4/4] Generating .env.local entries..." -ForegroundColor Yellow
$envLines = @(
    "",
    "# ─── AI Gateway (APIM) ─── Managed Identity auth, no API keys ────",
    "AZURE_APIM_GATEWAY_URL=$($apimInfo.url)"
)

$envPath = Join-Path $PSScriptRoot ".." "demo-app" ".env.local"
if (Test-Path $envPath) {
    $existing = Get-Content $envPath -Raw
    if ($existing -match "AZURE_APIM_GATEWAY_URL") {
        Write-Host "  .env.local already has APIM config — skipping write." -ForegroundColor Yellow
    } else {
        Add-Content -Path $envPath -Value ($envLines -join "`n")
        Write-Host "  Appended APIM config to $envPath" -ForegroundColor Green
    }
} else {
    Write-Host "  No .env.local found at $envPath" -ForegroundColor Yellow
    Write-Host "  Add this line to your demo-app/.env.local:" -ForegroundColor Yellow
    Write-Host "    AZURE_APIM_GATEWAY_URL=$($apimInfo.url)" -ForegroundColor White
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host @"

  Auth model: Managed Identity (Entra ID Bearer tokens)
  No API keys needed — agents use DefaultAzureCredential.

  Next steps:
  1. Restart the demo app: cd demo-app && npm run dev
  2. Open the 'Agent Gateway' tab to test live identity-based APIM routing
  3. Run the standalone agent demo:
     python scripts/agent-gateway-demo.py --gateway-url $($apimInfo.url)

  To onboard a new external agent:
  1. Assign the agent a managed identity (System or User-assigned)
  2. Add the MI's principal ID to the BU's callerPrincipalIds in main.bicepparam
  3. Redeploy — APIM policy will recognize the new identity

"@ -ForegroundColor White
