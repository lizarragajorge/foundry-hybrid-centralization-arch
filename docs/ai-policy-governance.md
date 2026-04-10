# Azure AI Foundry — Enterprise Policy Governance Guide

## Overview

This guide explains how to enforce AI governance across your Azure subscriptions using Azure Policy at the management group level. Policies cascade to **all subscriptions** under the management group, ensuring consistent security, model access control, and content safety guardrails.

---

## Quick Start

```powershell
# Clone the repo and run the policy assignment script
.\scripts\assign-ai-policies.ps1 -MgName "your-management-group-name"

# To enforce (Deny non-compliant deployments):
.\scripts\assign-ai-policies.ps1 -MgName "your-management-group-name" -EnforcementMode Default
```

**Prerequisites:** Owner or Resource Policy Contributor on the management group.

---

## The 4-Layer Governance Model

Azure AI Foundry governance operates across **four layers**. Each layer enforces at a different point in the lifecycle:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: AZURE POLICY (Deploy-Time — Control Plane)            │
│  "Can this resource/model be CREATED?"                          │
│  → Evaluates ARM properties when someone deploys via Bicep/CLI  │
│  → Effect: Audit (flag) or Deny (block)                         │
│  → Timing: Immediate on ARM write                               │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: AZURE POLICY (Config-Time — Data Plane)               │
│  "Does this deployment have the right content filters?"         │
│  → Evaluates raiPolicy configuration on deployments             │
│  → Effect: Audit only (Deny not yet supported)                  │
│  → Timing: Periodic scan (up to 24h, or forced via CLI)         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: APIM AI GATEWAY (Runtime — Per-Request)               │
│  "Is this caller allowed to use this model?"                    │
│  → JWT validation, identity→BU mapping, allowedModels           │
│  → Also: llm-content-safety for external models                 │
│  → Effect: 401/403 per request                                  │
│  → Timing: Every API call                                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: FOUNDRY CONTENT FILTERS (Runtime — Per-Request)       │
│  "Is this content safe?"                                        │
│  → Screens prompts + completions through content safety models  │
│  → Effect: HTTP 400 (content_filter) or annotations             │
│  → Timing: Every API call                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Control Plane vs Data Plane — What's the Difference?

| | Control Plane | Data Plane |
|---|---|---|
| **When it evaluates** | When someone creates/updates an Azure resource (ARM write) | Periodically scans the runtime configuration of deployed resources |
| **Resource type** | `Microsoft.CognitiveServices/accounts` | `Microsoft.CognitiveServices.Data/accounts/deployments` (note the `.Data`) |
| **What it checks** | ARM resource properties (auth, networking, tags, model registry) | Content filter configuration (raiPolicy) on individual deployments |
| **Effect** | **Audit** (flag non-compliance) or **Deny** (block creation) | **Audit only** (Deny not currently supported for data plane) |
| **Timing** | Immediate — evaluated on every ARM PUT operation | Periodic — evaluated by compliance scan (up to 24h, or forced) |
| **Example** | "You cannot deploy a model not in the approved list" | "This deployment's Protected Material filter must be enabled" |
| **Force evaluation** | Automatic on deployment | `az policy state trigger-scan --subscription <sub-id>` |

**Why both matter:** Control plane prevents non-compliant resources from being **created**. Data plane ensures existing deployments maintain proper content safety **configuration** over time.

---

## All 8 Policies — Ready to Assign

### Control Plane Policies (5)

These evaluate at **deployment time** and can **Deny** non-compliant ARM writes.

#### 1. Disable Local Authentication (API Keys)

| | |
|---|---|
| **Policy ID** | `71ef260a-8f18-47b7-abcb-62d0673d94dc` |
| **What it does** | Audits/denies Cognitive Services accounts that allow API key authentication |
| **Why it matters** | Forces Entra ID (managed identity) auth — Zero Trust principle |
| **Effect** | Audit or Deny |
| **Docs** | [Azure Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F71ef260a-8f18-47b7-abcb-62d0673d94dc) |

```powershell
az policy assignment create --name "mg-ai-disable-auth" \
    --display-name "MG: Foundry - Disable local authentication" \
    --policy "71ef260a-8f18-47b7-abcb-62d0673d94dc" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce
```

#### 2. Use Private Link

| | |
|---|---|
| **Policy ID** | `cddd188c-4b82-4c48-a19d-ddf74ee66a01` |
| **What it does** | Audits Cognitive Services accounts without private endpoints |
| **Why it matters** | Ensures network isolation — no public internet exposure for AI resources |
| **Effect** | Audit |
| **Docs** | [Azure Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Fcddd188c-4b82-4c48-a19d-ddf74ee66a01) |

```powershell
az policy assignment create --name "mg-ai-private-link" \
    --display-name "MG: Foundry - Use private link" \
    --policy "cddd188c-4b82-4c48-a19d-ddf74ee66a01" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce
```

#### 3. Require businessUnit Tag

| | |
|---|---|
| **Policy ID** | `96670d01-0a4d-4649-9c89-2d3abc0a5025` |
| **What it does** | Requires a `businessUnit` tag on all resource groups |
| **Why it matters** | Cost tracking and ownership attribution per business unit |
| **Effect** | Audit or Deny |

```powershell
az policy assignment create --name "mg-ai-require-bu-tag" \
    --display-name "MG: Foundry - Require businessUnit tag" \
    --policy "96670d01-0a4d-4649-9c89-2d3abc0a5025" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce \
    --params '{"tagName":{"value":"businessUnit"}}'
```

#### 4. Restrict Network Access

| | |
|---|---|
| **Policy ID** | `0725b4dd-7e76-479c-a735-68e7ee23d5ca` |
| **What it does** | Audits Cognitive Services with public network access enabled |
| **Why it matters** | Production AI resources should not be publicly accessible |
| **Effect** | Audit |
| **Docs** | [Azure Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F0725b4dd-7e76-479c-a735-68e7ee23d5ca) |

```powershell
az policy assignment create --name "mg-ai-restrict-net" \
    --display-name "MG: Foundry - Restrict network access" \
    --policy "0725b4dd-7e76-479c-a735-68e7ee23d5ca" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce
```

#### 5. Only Approved AI Models

| | |
|---|---|
| **Policy ID** | `12e5dd16-d201-47ff-849b-8454061c293d` (Preview) or `aafe3651-cb78-4f68-9f81-e7e41509110f` (GA) |
| **What it does** | Restricts which models can be deployed by asset ID or publisher |
| **Why it matters** | Prevents shadow AI — only organization-approved models can be deployed |
| **Effect** | Audit or Deny |
| **Docs** | [Model deployment policies](https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/built-in-policy-model-deployment) |

```powershell
# Save params to file (adjust models as needed)
cat > /tmp/model-policy.json << 'EOF'
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
EOF

az policy assignment create --name "mg-ai-allowed-models" \
    --display-name "MG: Foundry - Only approved AI models" \
    --policy "12e5dd16-d201-47ff-849b-8454061c293d" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce \
    --params @/tmp/model-policy.json
```

---

### Data Plane Policies (3) — Content Filter / RAI Guardrails

These evaluate the **runtime content filter configuration** of model deployments. They use the same policy definition (`af253d37-136a-42f8-a1fc-30010c083d41`) with different `filterName` parameters.

| | |
|---|---|
| **Policy ID** | `af253d37-136a-42f8-a1fc-30010c083d41` |
| **What it does** | Audits whether a specific content filter is enabled and blocking on deployment completions |
| **Docs** | [Content filtering concepts](https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter) · [Configure content filters](https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/content-filters) · [raiPolicies REST API](https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update) |

#### 6. Protected Material Text Filter

Prevents models from outputting copyrighted text (song lyrics, articles, recipes).

```powershell
cat > /tmp/cf-text.json << 'EOF'
{
    "filterName": { "value": "Protected Material Text" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
EOF

az policy assignment create --name "mg-ai-cf-text" \
    --display-name "MG: Require Protected Material Text filter" \
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce \
    --params @/tmp/cf-text.json
```

#### 7. Protected Material Code Filter

Prevents models from outputting copyrighted source code without citation. **Required for Microsoft Customer Copyright Commitment coverage.**

```powershell
cat > /tmp/cf-code.json << 'EOF'
{
    "filterName": { "value": "Protected Material Code" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
EOF

az policy assignment create --name "mg-ai-cf-code" \
    --display-name "MG: Require Protected Material Code filter" \
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce \
    --params @/tmp/cf-code.json
```

#### 8. Profanity Filter

Prevents models from generating profane content.

```powershell
cat > /tmp/cf-prof.json << 'EOF'
{
    "filterName": { "value": "Profanity" },
    "allowedEnabledForCompletion": { "value": ["true"] },
    "allowedBlockingForCompletion": { "value": ["true"] },
    "effect": { "value": "Audit" }
}
EOF

az policy assignment create --name "mg-ai-cf-profanity" \
    --display-name "MG: Require Profanity filter" \
    --policy "af253d37-136a-42f8-a1fc-30010c083d41" \
    --scope "/providers/Microsoft.Management/managementGroups/<your-mg>" \
    --enforcement-mode DoNotEnforce \
    --params @/tmp/cf-prof.json
```

---

## Additional Policies (Optional)

| Policy | ID | Docs |
|---|---|---|
| Prompt content filtering (input guardrails) | `f3a9c2e0-7b4d-4d8f-9c3a-2e1f6b9a8d4e` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Ff3a9c2e0-7b4d-4d8f-9c3a-2e1f6b9a8d4e) |
| Allowed Cognitive Services Kinds | `24695608-3876-42e7-b7ec-17a85ebb9133` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F24695608-3876-42e7-b7ec-17a85ebb9133) |
| Approved Registry Models (GA) | `aafe3651-cb78-4f68-9f81-e7e41509110f` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Faafe3651-cb78-4f68-9f81-e7e41509110f) |
| Deployment control mode | `c1ad46c6-37f8-4af0-9c71-c208375c87dd` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Fc1ad46c6-37f8-4af0-9c71-c208375c87dd) |
| CMK encryption | `67121cc7-ff39-4ab8-b7e3-95b84dab487d` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2F67121cc7-ff39-4ab8-b7e3-95b84dab487d) |
| Azure AI Services use Private Link | `d6759c02-b87f-42b7-892e-71b3f471d782` | [Portal](https://portal.azure.com/#blade/Microsoft_Azure_Policy/PolicyDetailBlade/definitionId/%2Fproviders%2FMicrosoft.Authorization%2FpolicyDefinitions%2Fd6759c02-b87f-42b7-892e-71b3f471d782) |

---

## How It All Works Together

```
1. DEPLOY TIME (Control Plane — Immediate)
   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
   Platform team deploys via Bicep/CLI/Portal:
     → Policy checks: Is this model in the approved list?         ← Policy 5
     → Policy checks: Is local auth disabled?                     ← Policy 1
     → Policy checks: Does the RG have a businessUnit tag?        ← Policy 3
     → If Deny → ARM rejects the deployment immediately
     → If Audit → deployment succeeds but flagged non-compliant

2. CONFIG TIME (Data Plane — Periodic)
   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
   Content filter is attached to the model deployment:
     → Policy scans: Is Protected Material Text filter active?    ← Policy 6
     → Policy scans: Is Profanity filter enabled and blocking?    ← Policy 8
     → Non-compliant results appear in Policy Compliance dashboard

3. RUNTIME (Every API Call)
   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
   Agent calls: POST /openai/deployments/gpt-4o/chat/completions
     → APIM validates JWT token (caller identity)                 ← Gateway
     → APIM checks allowedModels for caller's BU                 ← Gateway
     → Foundry screens the PROMPT through content filters         ← raiPolicy
     → Model generates completion                                 ← Foundry
     → Foundry screens the COMPLETION through content filters     ← raiPolicy
     → If harmful content → HTTP 400 (content_filter)             ← Blocked
     → If clean → response returned to agent                     ← Success
```

---

## Monitoring Compliance

```powershell
# Force a compliance scan
az policy state trigger-scan --subscription <sub-id>

# View compliance summary
az policy state summarize --subscription <sub-id>

# View in portal
# Azure Portal → Policy → Compliance → Scope: <your-management-group>
```

---

## Moving to Production

| Step | What to change |
|---|---|
| **Switch to Enforce** | Change `--enforcement-mode DoNotEnforce` to `--enforcement-mode Default` |
| **Switch effects to Deny** | Change `"effect": "Audit"` to `"effect": "Deny"` in policy parameters |
| **Enable private endpoints** | Deploy PEs, then the private link policy becomes compliant |
| **Add your models** | Update the `allowedAssetIds` array with your approved model list |
| **Set alert notifications** | Configure Azure Monitor alerts on policy non-compliance events |

---

## Reference Links

| Resource | Link |
|---|---|
| Azure Policy Overview | https://learn.microsoft.com/en-us/azure/governance/policy/overview |
| Management Group Policy Inheritance | https://learn.microsoft.com/en-us/azure/governance/management-groups/overview |
| AI Model Deployment Policies | https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/built-in-policy-model-deployment |
| Content Filter Concepts | https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter |
| Configure Content Filters | https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/content-filters |
| raiPolicies REST API | https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update |
| APIM llm-content-safety Policy | https://learn.microsoft.com/en-us/azure/api-management/llm-content-safety-policy |
| AI Gateway in Foundry | https://learn.microsoft.com/en-us/azure/ai-foundry/configuration/enable-ai-api-management-gateway-portal |
| Govern AI with Azure Policy (Training) | https://learn.microsoft.com/en-us/training/modules/govern-ai-azure-policy/ |
| Azure AI Services Built-in Policies | https://learn.microsoft.com/en-us/azure/ai-services/policy-reference |
