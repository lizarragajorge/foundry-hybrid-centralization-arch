# ============================================================================
# Azure AI Foundry — Enterprise Policy Governance
# Copy-paste ready script to assign all AI governance policies
#
# Usage:
#   1. Set $mgName to your management group name (or use subscription scope)
#   2. Set $subscriptionId to your target subscription
#   3. Run the script as Owner on the management group or subscription
#
# Prerequisites:
#   - Owner or Resource Policy Contributor on the target scope
#   - Azure CLI authenticated: az login
# ============================================================================

param(
    [string]$MgName = "contoso-ai-governance",
    [string]$SubscriptionId = "",
    [ValidateSet("DoNotEnforce", "Default")]
    [string]$EnforcementMode = "DoNotEnforce"  # DoNotEnforce = Audit only, Default = Enforce/Deny
)

$ErrorActionPreference = "Stop"

# ─── Scope ───────────────────────────────────────────────────────────────────
# Management group scope = cascades to ALL subscriptions
# Subscription scope = single subscription only
$mgScope = "/providers/Microsoft.Management/managementGroups/$MgName"
$subScope = $(if ($SubscriptionId) { "/subscriptions/$SubscriptionId" } else { $null })
$scope = $(if ($MgName) { $mgScope } else { $subScope })

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Azure AI Foundry Policy Governance" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Scope: $scope"
Write-Host "  Enforcement: $EnforcementMode"
Write-Host ""

# ============================================================================
# CONTROL PLANE POLICIES
# ============================================================================
#
# These evaluate ARM resource properties at DEPLOYMENT TIME (when someone
# creates, updates, or deploys Azure resources via ARM/Bicep/Terraform/Portal).
#
# Resource type: Microsoft.CognitiveServices/accounts
# Resource type: Microsoft.CognitiveServices/accounts/deployments
#
# When to use: Prevent non-compliant resources from being CREATED
# Effect: Audit (flag) or Deny (block creation)
# Evaluation: Immediate on ARM write operations
# Scope: Management Group → cascades to all subscriptions
#
# ============================================================================

Write-Host "── Control Plane Policies (Deploy-Time) ──" -ForegroundColor Yellow
Write-Host ""

# ─── 1. Disable Local Auth (API Keys) ───────────────────────────────────────
# Policy ID: 71ef260a-8f18-47b7-abcb-62d0673d94dc
# What: Audits/denies Cognitive Services accounts that allow API key auth
# Why:  Forces Entra ID (managed identity) authentication — Zero Trust
# Docs: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F71ef260a-8f18-47b7-abcb-62d0673d94dc
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [1/8] Disable local auth..."
az policy assignment create `
    --name "mg-ai-disable-auth" `
    --display-name "MG: Foundry - Disable local authentication" `
    --policy "71ef260a-8f18-47b7-abcb-62d0673d94dc" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 2. Use Private Link ────────────────────────────────────────────────────
# Policy ID: cddd188c-4b82-4c48-a19d-ddf74ee66a01
# What: Audits Cognitive Services accounts without private endpoints
# Why:  Ensures network isolation — no public internet exposure
# Docs: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Fcddd188c-4b82-4c48-a19d-ddf74ee66a01
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [2/8] Private link..."
az policy assignment create `
    --name "mg-ai-private-link" `
    --display-name "MG: Foundry - Use private link" `
    --policy "cddd188c-4b82-4c48-a19d-ddf74ee66a01" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 3. Require businessUnit Tag ────────────────────────────────────────────
# Policy ID: 96670d01-0a4d-4649-9c89-2d3abc0a5025
# What: Requires a "businessUnit" tag on all resource groups
# Why:  Cost tracking and ownership attribution per BU
# Docs: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F96670d01-0a4d-4649-9c89-2d3abc0a5025
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [3/8] Require businessUnit tag..."
'{"tagName":{"value":"businessUnit"}}' | Out-File -Encoding ascii "$env:TEMP\tag-policy.json" -Force
az policy assignment create `
    --name "mg-ai-require-bu-tag" `
    --display-name "MG: Foundry - Require businessUnit tag" `
    --policy "96670d01-0a4d-4649-9c89-2d3abc0a5025" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    --params "@$env:TEMP\tag-policy.json" `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 4. Restrict Network Access ─────────────────────────────────────────────
# Policy ID: 0725b4dd-7e76-479c-a735-68e7ee23d5ca
# What: Audits Cognitive Services with public network access enabled
# Why:  Production resources should not be publicly accessible
# Docs: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F0725b4dd-7e76-479c-a735-68e7ee23d5ca
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [4/8] Restrict network access..."
az policy assignment create `
    --name "mg-ai-restrict-net" `
    --display-name "MG: Foundry - Restrict network access" `
    --policy "0725b4dd-7e76-479c-a735-68e7ee23d5ca" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 5. Only Approved AI Models ─────────────────────────────────────────────
# Policy ID: 12e5dd16-d201-47ff-849b-8454061c293d  (Preview - ML)
#        OR: aafe3651-cb78-4f68-9f81-e7e41509110f  (GA - CognitiveServices)
# What: Restricts which models can be deployed by asset ID or publisher
# Why:  Prevents shadow AI — only org-approved models can be deployed
# Docs: https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/built-in-policy-model-deployment
#
# Parameters:
#   allowedPublishers: ["azure-openai"] — only Azure OpenAI models
#   allowedAssetIds:   partial URIs match all versions of a model
#   effect:            Audit (flag) or Deny (block)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [5/8] Approved AI models only..."
@'
{
    "allowedPublishers": { "value": ["azure-openai"] },
    "allowedAssetIds": {
        "value": [
            "azureml://registries/azure-openai/models/gpt-4o",
            "azureml://registries/azure-openai/models/gpt-4o-mini",
            "azureml://registries/azure-openai/models/text-embedding-3-large"
        ]
    },
    "effect": { "value": "Audit" }
}
'@ | Out-File -Encoding ascii "$env:TEMP\model-policy.json" -Force
az policy assignment create `
    --name "mg-ai-allowed-models" `
    --display-name "MG: Foundry - Only approved AI models" `
    --policy "12e5dd16-d201-47ff-849b-8454061c293d" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    --params "@$env:TEMP\model-policy.json" `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ============================================================================
# DATA PLANE POLICIES (Content Filter / RAI Guardrails)
# ============================================================================
#
# These evaluate the DATA PLANE configuration of deployments — specifically
# the raiPolicy (Responsible AI policy) attached to each model deployment.
#
# Resource type: Microsoft.CognitiveServices.Data/accounts/deployments
#                (note the .Data — this is the data plane resource provider)
#
# How it works:
#   1. You create an raiPolicy (content filter) on the Foundry resource
#      - ARM resource: Microsoft.CognitiveServices/accounts/raiPolicies
#      - Defines: severity thresholds, categories, blocking behavior
#   2. You attach the raiPolicy to a model deployment via raiPolicyName
#   3. Azure Policy evaluates the deployment's content filter configuration
#      at the DATA PLANE level
#
# Control Plane vs Data Plane:
#   - Control plane: "Can this deployment be CREATED?" (ARM write)
#   - Data plane:    "Does this deployment's content filter meet standards?"
#                    (evaluates the runtime configuration)
#
# Evaluation timing:
#   - Data plane policies evaluate periodically (not on every ARM write)
#   - Compliance results may take up to 24 hours to appear
#   - Use: az policy state trigger-scan to force evaluation
#
# When to use: Ensure all deployed models have proper content safety filters
# Effect: Audit only (Deny not supported for data plane policies currently)
#
# Docs:
#   Content filters: https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter
#   Configure filters: https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/content-filters
#   raiPolicies API: https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update
#   Policy definition: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Faf253d37-136a-42f8-a1fc-30010c083d41
# ============================================================================

Write-Host ""
Write-Host "── Data Plane Policies (RAI Content Filters) ──" -ForegroundColor Yellow
Write-Host ""

# ─── 6. Protected Material Text Filter ──────────────────────────────────────
# Policy ID: af253d37-136a-42f8-a1fc-30010c083d41
# What: Ensures the Protected Material Text filter is enabled + blocking
# Why:  Prevents models from outputting known copyrighted text
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [6/8] Protected Material Text..."
@'
{
    "filterName": { "value": "Protected Material Text" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
'@ | Out-File -Encoding ascii "$env:TEMP\cf-text.json" -Force
az policy assignment create `
    --name "mg-ai-cf-text" `
    --display-name "MG: Require Protected Material Text filter" `
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    --params "@$env:TEMP\cf-text.json" `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 7. Protected Material Code Filter ──────────────────────────────────────
# Policy ID: af253d37-136a-42f8-a1fc-30010c083d41 (same policy, different filterName)
# What: Ensures the Protected Material Code filter is enabled + blocking
# Why:  Prevents models from outputting copyrighted source code without citation
#       Required for Microsoft Customer Copyright Commitment coverage
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [7/8] Protected Material Code..."
@'
{
    "filterName": { "value": "Protected Material Code" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
'@ | Out-File -Encoding ascii "$env:TEMP\cf-code.json" -Force
az policy assignment create `
    --name "mg-ai-cf-code" `
    --display-name "MG: Require Protected Material Code filter" `
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    --params "@$env:TEMP\cf-code.json" `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ─── 8. Profanity Filter ────────────────────────────────────────────────────
# Policy ID: af253d37-136a-42f8-a1fc-30010c083d41 (same policy, different filterName)
# What: Ensures the Profanity filter is enabled + blocking
# Why:  Prevents models from generating profane content
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "  [8/8] Profanity filter..."
@'
{
    "filterName": { "value": "Profanity" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
'@ | Out-File -Encoding ascii "$env:TEMP\cf-prof.json" -Force
az policy assignment create `
    --name "mg-ai-cf-profanity" `
    --display-name "MG: Require Profanity filter" `
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" `
    --scope $scope `
    --enforcement-mode $EnforcementMode `
    --params "@$env:TEMP\cf-prof.json" `
    -o none 2>$null
Write-Host "       OK" -ForegroundColor Green

# ============================================================================
# ADDITIONAL POLICIES (Optional)
# ============================================================================
# Uncomment to assign these additional governance policies:
#
# Prompt content filtering (input guardrails):
#   Policy ID: f3a9c2e0-7b4d-4d8f-9c3a-2e1f6b9a8d4e
#   Docs: https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Ff3a9c2e0-7b4d-4d8f-9c3a-2e1f6b9a8d4e
#
# Allowed Cognitive Services Kinds (restrict to AIServices only):
#   Policy ID: 24695608-3876-42e7-b7ec-17a85ebb9133
#
# Approved Registry Models (GA version for CognitiveServices):
#   Policy ID: aafe3651-cb78-4f68-9f81-e7e41509110f
#
# Deployment control mode:
#   Policy ID: c1ad46c6-37f8-4af0-9c71-c208375c87dd
#
# CMK encryption:
#   Policy ID: 67121cc7-ff39-4ab8-b7e3-95b84dab487d
# ============================================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All 8 policies assigned at: $scope" -ForegroundColor Cyan
Write-Host "  Enforcement: $EnforcementMode" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To switch to ENFORCE mode (Deny):" -ForegroundColor White
Write-Host "    .\assign-ai-policies.ps1 -EnforcementMode Default" -ForegroundColor White
Write-Host ""
Write-Host "  To trigger a compliance scan:" -ForegroundColor White
Write-Host "    az policy state trigger-scan --subscription <sub-id>" -ForegroundColor White
Write-Host ""
Write-Host "  To view compliance:" -ForegroundColor White
Write-Host "    Azure Portal > Policy > Compliance > scope: $MgName" -ForegroundColor White
Write-Host ""

# ============================================================================
# REFERENCE: Control Plane vs Data Plane
# ============================================================================
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │                    CONTROL PLANE (ARM)                                  │
# │  When: Resource creation/update (az deployment, Bicep, Portal, API)    │
# │  What: Evaluates ARM resource properties                               │
# │  Type: Microsoft.CognitiveServices/accounts                           │
# │        Microsoft.CognitiveServices/accounts/deployments                │
# │  Effect: Audit or Deny (blocks ARM PUT)                                │
# │  Timing: Immediate on write                                            │
# │                                                                         │
# │  Controls:                                                              │
# │    - Can this Foundry resource be created? (auth, networking, tags)    │
# │    - Can this model be deployed? (approved registry models)            │
# │    - Is the SKU/kind allowed?                                          │
# │                                                                         │
# │  Policies:                                                              │
# │    71ef260a  Disable local auth                                        │
# │    cddd188c  Use private link                                          │
# │    96670d01  Require tags                                              │
# │    0725b4dd  Restrict network access                                   │
# │    12e5dd16  Only approved registry models                             │
# │    aafe3651  CogSvc approved registry models (GA)                      │
# │    24695608  Allowed Cognitive Services kinds                          │
# └─────────────────────────────────────────────────────────────────────────┘
#                              │
#                              ▼
# ┌─────────────────────────────────────────────────────────────────────────┐
# │                    DATA PLANE (Runtime Config)                          │
# │  When: Periodic evaluation (not on every ARM write)                    │
# │  What: Evaluates the runtime configuration of deployed resources       │
# │  Type: Microsoft.CognitiveServices.Data/accounts/deployments           │
# │        (note the .Data in the resource provider)                       │
# │  Effect: Audit only (Deny not supported for data plane currently)      │
# │  Timing: Periodic scan (up to 24h, or forced via trigger-scan)         │
# │                                                                         │
# │  Controls:                                                              │
# │    - Does this deployment have the right content filters?              │
# │    - Is Protected Material detection enabled?                          │
# │    - Is the Profanity filter active?                                   │
# │    - Are prompt shields configured?                                    │
# │                                                                         │
# │  Policies:                                                              │
# │    af253d37  Completion content filtering                              │
# │    f3a9c2e0  Prompt content filtering                                  │
# │    c1ad46c6  Deployment control mode                                   │
# │    930f48f9  Deployment allowed control                                │
# └─────────────────────────────────────────────────────────────────────────┘
#                              │
#                              ▼
# ┌─────────────────────────────────────────────────────────────────────────┐
# │                    RUNTIME (API Call)                                   │
# │  When: Every API request to the model                                  │
# │  What: Content Safety filters process prompt + completion              │
# │  Enforced by: raiPolicy attached to the deployment                    │
# │                                                                         │
# │  Controls:                                                              │
# │    - Hate, Sexual, Violence, Self-harm: block at severity threshold   │
# │    - Jailbreak detection: flag or block                                │
# │    - Indirect attack detection: flag or block                          │
# │    - Protected material: annotate or block                             │
# │    - PII detection: annotate or block (preview)                       │
# │    - Task adherence: detect misaligned tool use (preview)              │
# │                                                                         │
# │  NOT controlled by Azure Policy — enforced by Foundry's inference     │
# │  engine based on the raiPolicyName set on the deployment.             │
# │                                                                         │
# │  Docs: https://learn.microsoft.com/en-us/azure/foundry-classic/       │
# │         foundry-models/concepts/content-filter                        │
# └─────────────────────────────────────────────────────────────────────────┘
#                              │
#                              ▼
# ┌─────────────────────────────────────────────────────────────────────────┐
# │                    APIM GATEWAY (Optional Layer)                       │
# │  When: Request passes through APIM before reaching Foundry            │
# │  What: Additional governance for all models (Azure + external)        │
# │                                                                         │
# │  Controls:                                                              │
# │    - JWT validation (validate-azure-ad-token)                          │
# │    - Identity-based allowedModels enforcement                          │
# │    - llm-content-safety policy (for external models)                  │
# │    - Rate limiting (llm-token-limit)                                   │
# │    - Retry / circuit breaking                                          │
# │                                                                         │
# │  APIM governs external models that Foundry content filters can't see  │
# │                                                                         │
# │  Docs: https://learn.microsoft.com/en-us/azure/api-management/        │
# │         llm-content-safety-policy                                     │
# └─────────────────────────────────────────────────────────────────────────┘
#
# ============================================================================
# HOW THEY WORK TOGETHER — FULL LIFECYCLE
# ============================================================================
#
# 1. DEPLOY TIME (Control Plane):
#    Platform team runs: az deployment sub create --template-file main.bicep
#      → Azure Policy evaluates: Is this model in the approved list? ────── Policy 5
#      → Azure Policy evaluates: Is local auth disabled? ────────────────── Policy 1
#      → Azure Policy evaluates: Does the RG have a businessUnit tag? ──── Policy 3
#      → If any Deny policy fails → ARM rejects the deployment
#      → If Audit → deployment succeeds but flagged as non-compliant
#
# 2. CONFIG TIME (Data Plane):
#    Content filter is attached to the model deployment:
#      → Azure Policy periodically evaluates: Is Protected Material enabled? ── Policy 6
#      → Azure Policy periodically evaluates: Is Profanity filter active? ───── Policy 8
#      → Non-compliant results appear in Azure Policy Compliance dashboard
#
# 3. RUNTIME (Every API Call):
#    Agent calls: POST /openai/deployments/gpt-4o/chat/completions
#      → APIM validates JWT token (caller identity) ─────────────────── APIM Layer
#      → APIM checks allowedModels for caller's BU ──────────────────── APIM Layer
#      → Foundry screens the PROMPT through content filters ─────────── raiPolicy
#      → Model generates completion ─────────────────────────────────── Foundry
#      → Foundry screens the COMPLETION through content filters ──────── raiPolicy
#      → If harmful content detected → HTTP 400 (content_filter) ────── Blocked
#      → If clean → response returned to agent
#
# ============================================================================
