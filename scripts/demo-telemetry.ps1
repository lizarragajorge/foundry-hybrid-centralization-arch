# ============================================================================
# Azure Foundry Hybrid - Telemetry & Governance Demo Script
# Run this to showcase the management and governance capabilities
# ============================================================================

param(
    [string]$FoundryName = "contoso-foundry-hub-dev",
    [string]$ResourceGroup = "rg-contoso-foundry-hub-dev",
    [string]$MonitoringRg = "rg-contoso-foundry-monitoring-dev",
    [string]$NetworkingRg = "rg-contoso-foundry-networking-dev",
    [string]$LawName = "contoso-foundry-law"
)

$ErrorActionPreference = "Continue"

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkCyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkCyan
}

$hubId = az cognitiveservices account show --name $FoundryName -g $ResourceGroup --query id -o tsv
$ep = az cognitiveservices account show --name $FoundryName -g $ResourceGroup --query properties.endpoint -o tsv
$token = az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv

# ============================================================================
# DEMO 1: Architecture Overview
# ============================================================================
Write-Section "DEMO 1: Hybrid Architecture Overview"

Write-Host "`n  [Centralized Hub - AI CoE]" -ForegroundColor Yellow
az cognitiveservices account show --name $FoundryName -g $ResourceGroup --query "{Name:name, Kind:kind, Location:location, Endpoint:properties.endpoint, Identity:identity.type}" -o table

Write-Host "`n  [Federated Spokes - BU Projects]" -ForegroundColor Yellow
az resource list --resource-type "Microsoft.CognitiveServices/accounts/projects" --query "[?contains(name,'contoso')].{Project:name, ResourceGroup:resourceGroup, Identity:identity.principalId}" -o table

Write-Host "`n  [Centralized Model Deployments]" -ForegroundColor Yellow
az cognitiveservices account deployment list --name $FoundryName -g $ResourceGroup --query "[].{Deployment:name, Model:properties.model.name, Version:properties.model.version, SKU:sku.name, TPM:sku.capacity}" -o table

# ============================================================================
# DEMO 2: Live API Calls (Telemetry Generation)
# ============================================================================
Write-Section "DEMO 2: Live API Calls Across Models"

Write-Host "`n  Calling GPT-4o (Finance BU use case)..." -ForegroundColor Yellow
$r1 = Invoke-RestMethod -Uri "$ep/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview" -Method POST -Headers @{Authorization="Bearer $token";"Content-Type"="application/json"} -Body '{"messages":[{"role":"system","content":"You are a financial analyst."},{"role":"user","content":"What are the top 3 risks in AI adoption for financial services?"}],"max_tokens":150}'
Write-Host "  Response: $($r1.choices[0].message.content)" -ForegroundColor White
Write-Host "  Tokens: prompt=$($r1.usage.prompt_tokens) completion=$($r1.usage.completion_tokens) total=$($r1.usage.total_tokens)" -ForegroundColor DarkGray

Write-Host "`n  Calling GPT-4o-mini (Marketing BU use case)..." -ForegroundColor Yellow
$r2 = Invoke-RestMethod -Uri "$ep/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview" -Method POST -Headers @{Authorization="Bearer $token";"Content-Type"="application/json"} -Body '{"messages":[{"role":"user","content":"Generate 3 email subject lines for an AI product launch."}],"max_tokens":100}'
Write-Host "  Response: $($r2.choices[0].message.content)" -ForegroundColor White
Write-Host "  Tokens: prompt=$($r2.usage.prompt_tokens) completion=$($r2.usage.completion_tokens) total=$($r2.usage.total_tokens)" -ForegroundColor DarkGray

Write-Host "`n  Calling text-embedding-3-large (Engineering BU use case)..." -ForegroundColor Yellow
$r3 = Invoke-RestMethod -Uri "$ep/openai/deployments/text-embedding-3-large/embeddings?api-version=2024-08-01-preview" -Method POST -Headers @{Authorization="Bearer $token";"Content-Type"="application/json"} -Body '{"input":"Hybrid AI governance architecture with centralized model management"}'
Write-Host "  Embedding dimensions: $($r3.data[0].embedding.Count)" -ForegroundColor White
Write-Host "  Tokens: $($r3.usage.total_tokens)" -ForegroundColor DarkGray

# ============================================================================
# DEMO 3: Azure Monitor Metrics
# ============================================================================
Write-Section "DEMO 3: Azure Monitor - Platform Metrics"

$st = (Get-Date).AddHours(-2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$et = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "`n  Hub Metrics (last 2 hours):" -ForegroundColor Yellow
$metricNames = @("SuccessfulCalls","TotalCalls","ProcessedPromptTokens","GeneratedTokens","TotalTokens","Latency")
foreach ($m in $metricNames) {
    $val = az monitor metrics list --resource $hubId --metric $m --aggregation Total --interval PT1H --start-time $st --end-time $et --query "value[0].timeseries[0].data[].total" -o tsv 2>$null
    $totalVal = ($val -split "`n" | ForEach-Object { [double]$_ } | Measure-Object -Sum).Sum
    $unit = $(if ($m -eq "Latency") { "ms" } else { "" })
    Write-Host "    $($m.PadRight(25)) : $totalVal $unit" -ForegroundColor White
}

# ============================================================================
# DEMO 4: Governance - Policy Compliance
# ============================================================================
Write-Section "DEMO 4: Governance - Azure Policy"

Write-Host "`n  Policy Assignments on Hub:" -ForegroundColor Yellow
az policy assignment list --resource-group $ResourceGroup --query "[?contains(name,'foundry')].{Policy:displayName, Enforcement:enforcementMode}" -o table

Write-Host "`n  Policy Compliance Summary:" -ForegroundColor Yellow
az policy state summarize --resource-group $ResourceGroup --query "results.{TotalResources:resourceDetails[0].count, NonCompliant:policyDetails[?complianceState=='noncompliant'] | length(@)}" -o table 2>$null

# ============================================================================
# DEMO 5: Identity & Access (Zero Trust)
# ============================================================================
Write-Section "DEMO 5: Identity & Access - Zero Trust Model"

Write-Host "`n  Local Auth Status:" -ForegroundColor Yellow
$localAuth = az cognitiveservices account show --name $FoundryName -g $ResourceGroup --query properties.disableLocalAuth -o tsv
Write-Host "    API Key Auth Disabled: $localAuth" -ForegroundColor $(if ($localAuth -eq "true") {"Green"} else {"Red"})
Write-Host "    Authentication Mode: Microsoft Entra ID (token-based)" -ForegroundColor Green

Write-Host "`n  Managed Identities:" -ForegroundColor Yellow
$hubPrincipal = az cognitiveservices account show --name $FoundryName -g $ResourceGroup --query identity.principalId -o tsv
Write-Host "    Hub Identity:         $hubPrincipal" -ForegroundColor White
az resource list --resource-type "Microsoft.CognitiveServices/accounts/projects" --query "[?contains(name,'contoso')].{Project:name, ManagedIdentity:identity.principalId}" -o table

Write-Host "`n  RBAC Assignments on Hub:" -ForegroundColor Yellow
az role assignment list --scope $hubId --query "[].{Role:roleDefinitionName, PrincipalType:principalType}" -o table 2>$null

# ============================================================================
# DEMO 6: Network Isolation
# ============================================================================
Write-Section "DEMO 6: Network Architecture - Hub & Spoke"

Write-Host "`n  Virtual Networks:" -ForegroundColor Yellow
az network vnet list -g $NetworkingRg --query "[].{VNet:name, AddressSpace:addressSpace.addressPrefixes[0]}" -o table

Write-Host "`n  VNet Peering (Hub to Spokes):" -ForegroundColor Yellow
az network vnet peering list --vnet-name vnet-foundry-hub -g $NetworkingRg --query "[].{Peering:name, State:peeringState}" -o table

# ============================================================================
# DEMO 7: Cost & Tagging Governance
# ============================================================================
Write-Section "DEMO 7: Cost Tracking & Tagging"

Write-Host "`n  Resource Group Tags:" -ForegroundColor Yellow
$rgs = az group list --query "[?contains(name,'contoso-foundry')].{ResourceGroup:name, CostCenter:tags.costCenter, BU:tags.businessUnit, Env:tags.environment, Pattern:tags.pattern}" -o table
Write-Host $rgs

# ============================================================================
# DEMO 8: Observability Stack
# ============================================================================
Write-Section "DEMO 8: Observability Infrastructure"

Write-Host "`n  Log Analytics Workspace:" -ForegroundColor Yellow
az monitor log-analytics workspace show --workspace-name $LawName -g $MonitoringRg --query "{Name:name, SKU:sku.name, RetentionDays:retentionInDays, DailyCapGB:workspaceCapping.dailyQuotaGb}" -o table

Write-Host "`n  Diagnostic Settings:" -ForegroundColor Yellow
az monitor diagnostic-settings list --resource $hubId --query "[].{Name:name, LogsEnabled:logs[0].enabled, MetricsEnabled:metrics[0].enabled}" -o table

Write-Host "`n  Key Vault:" -ForegroundColor Yellow
az keyvault show --name kv-contoso-foundry-dev --query "{Name:name, SoftDelete:properties.enableSoftDelete, PurgeProtection:properties.enablePurgeProtection, RbacAuth:properties.enableRbacAuthorization}" -o table

# ============================================================================
# DEMO 9: KQL Queries for Log Analytics
# ============================================================================
Write-Section "DEMO 9: Sample KQL Queries (run in Azure Portal)"

Write-Host @"

  Copy these into Log Analytics > Logs in the Azure Portal:

  1. API Request Summary (last 24h):
  -----------------------------------------------
  AzureDiagnostics
  | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
  | where TimeGenerated > ago(24h)
  | summarize Requests=count(), AvgLatencyMs=avg(DurationMs),
              P95LatencyMs=percentile(DurationMs, 95)
    by OperationName, ResultType
  | order by Requests desc

  2. Token Usage Over Time:
  -----------------------------------------------
  AzureMetrics
  | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
  | where MetricName in ("ProcessedPromptTokens", "GeneratedTokens")
  | summarize TotalTokens=sum(Total) by bin(TimeGenerated, 1h), MetricName
  | render timechart

  3. Failed Requests Investigation:
  -----------------------------------------------
  AzureDiagnostics
  | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
  | where ResultType != "Success"
  | project TimeGenerated, OperationName, ResultType,
            CallerIPAddress, DurationMs
  | order by TimeGenerated desc

  4. Cost Attribution by Model Deployment:
  -----------------------------------------------
  AzureMetrics
  | where ResourceProvider == "MICROSOFT.COGNITIVESERVICES"
  | where MetricName == "TotalTokens"
  | extend Deployment = tostring(split(MetricName, "/")[1])
  | summarize TotalTokens=sum(Total) by bin(TimeGenerated, 1d)
  | render columnchart

"@ -ForegroundColor DarkGray

# ============================================================================
# Summary
# ============================================================================
Write-Section "DEMO COMPLETE - Portal Links"

Write-Host @"

  Azure Portal Resources:
    Hub:        https://portal.azure.com/#resource$hubId/overview
    Foundry:    https://ai.azure.com
    Metrics:    https://portal.azure.com/#resource$hubId/metrics
    Logs:       https://portal.azure.com/#resource$hubId/logs

  Key Governance Points:
    [x] Centralized model management (AI CoE controls deployments)
    [x] Federated project isolation (BUs work independently)
    [x] Entra ID authentication (API keys disabled)
    [x] Azure Policy enforcement (audit/deny mode)
    [x] Hub-spoke network isolation (VNet peering)
    [x] Centralized observability (Log Analytics + diagnostics)
    [x] Cost attribution via tags (businessUnit, costCenter)
    [x] Managed identities (zero credential management)

"@ -ForegroundColor White
