# Customization Guide

## Adding a Business Unit

Add one entry to the `businessUnits` array in `infra/main.bicepparam`:

```bicep
{
  name: 'hr'
  displayName: 'Human Resources'
  vnetAddressPrefix: '10.4.0.0/16'
  appSubnetPrefix: '10.4.1.0/24'
  peSubnetPrefix: '10.4.2.0/24'
}
```

Redeploy. The orchestrator automatically creates:
- Resource group: `rg-<org>-foundry-hr-<env>`
- Foundry project: `<org>-hr-<env>` (child of hub)
- Spoke VNet with app + PE subnets
- Bidirectional VNet peering to hub
- System-assigned managed identity
- AI User RBAC at hub scope
- Key Vault Secrets User grant

**No module edits needed.** The `for` loops in `main.bicep` iterate over the array.

### VNet Address Planning

Reserve `/16` blocks per BU. The hub uses `10.0.0.0/16`. Suggested scheme:

| BU | VNet Prefix | App Subnet | PE Subnet |
|----|------------|------------|-----------|
| Finance | 10.1.0.0/16 | 10.1.1.0/24 | 10.1.2.0/24 |
| Marketing | 10.2.0.0/16 | 10.2.1.0/24 | 10.2.2.0/24 |
| Engineering | 10.3.0.0/16 | 10.3.1.0/24 | 10.3.2.0/24 |
| HR | 10.4.0.0/16 | 10.4.1.0/24 | 10.4.2.0/24 |
| Legal | 10.5.0.0/16 | 10.5.1.0/24 | 10.5.2.0/24 |

---

## Adding Model Deployments

Add to the `modelDeployments` array in `infra/main.bicepparam`:

```bicep
{
  name: 'gpt-4.1'
  modelName: 'gpt-4.1'
  modelVersion: '2025-04-14'
  modelFormat: 'OpenAI'
  skuName: 'Standard'
  skuCapacity: 50      // TPM in thousands
}
```

Check [model availability by region](https://learn.microsoft.com/en-us/azure/foundry/reference/region-support) before adding.

### TPM Capacity Planning

| Model | Typical Use | Suggested TPM |
|-------|------------|---------------|
| GPT-4o | Complex reasoning, code review | 30-100K |
| GPT-4o-mini | High-volume, cost-sensitive tasks | 60-200K |
| Embeddings | RAG, search, classification | 120-500K |

---

## Changing the Region

Edit `infra/main.bicepparam`:

```bicep
param location = 'westus3'  // or any region with AIServices support
```

Verify model + feature availability first:
```bash
az cognitiveservices account list-skus --kind AIServices --location westus3
az cognitiveservices model list --location westus3 --query "[?model.name=='gpt-4o'].model.version"
```

---

## Configuring RBAC

Populate the group ID arrays in `infra/main.bicepparam` with your Entra ID group object IDs:

```bicep
param adminGroupIds = [
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'   // AI CoE Admins
]
param projectManagerGroupIds = [
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'   // BU Project Managers
]
param developerGroupIds = [
  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'   // BU Developers
]
```

Find group IDs: `az ad group list --query "[].{name:displayName, id:id}" -o table`

---

## Onboarding an External Agent to the AI Gateway

This section explains how a BU developer connects their agent (app, bot, pipeline, Copilot extension, etc.) to the centralized model gateway. The agent authenticates with a managed identity — **no API keys or secrets are exchanged**.

### Architecture

```
┌─────────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│  External Agent         │          │  APIM AI Gateway     │          │  Foundry Hub         │
│  (App Service, VM,      │  Bearer  │                      │  MI auth │                      │
│   Container App, AKS,   │──token──►│  1. validate JWT     │─────────►│  gpt-4o              │
│   Azure Function, etc.) │          │  2. oid → BU lookup  │          │  gpt-4o-mini         │
│                         │          │  3. allowedModels    │          │  embeddings          │
│  Auth: Managed Identity │          │  4. rate limit       │          │                      │
│  (DefaultAzureCredential)          │  5. retry on 429/5xx │          │                      │
└─────────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

### Prerequisites

| Requirement | Detail |
|---|---|
| AI Gateway deployed | `enableAiGateway = true` in `main.bicepparam` |
| Agent has a managed identity | System-assigned or User-assigned MI on the compute resource |
| Agent's MI principal ID | `az identity show --name <mi-name> -g <rg> --query principalId -o tsv` |

### Step 1: Platform Team — Register the Agent's Identity

Add the agent's managed identity principal ID to the BU's `callerPrincipalIds` in the APIM policy. This is done by the platform/AI CoE team, not the agent developer.

**Option A: If the agent runs on the BU's Foundry Project MI** (already registered)

The project managed identities are automatically wired into the APIM policy during deployment. No action needed — the agent just needs to use `DefaultAzureCredential` on compute that has the project MI attached.

**Option B: If the agent has its own managed identity** (new identity)

The platform team needs to:

1. Get the agent's MI principal ID:
   ```bash
   # System-assigned MI on an App Service
   az webapp identity show --name <app-name> -g <rg> --query principalId -o tsv

   # User-assigned MI
   az identity show --name <mi-name> -g <rg> --query principalId -o tsv
   ```

2. Add the principal ID to the BU's entry in the APIM gateway module. In `infra/main.bicep`, the `callerPrincipalIds` array is built from the project MI plus any additional IDs. To add external agent IDs, extend the `businessUnitConfig` type to include extra caller IDs, or add them directly in the gateway module invocation:

   ```bicep
   // In main.bicep → aiGateway module → businessUnits parameter
   callerPrincipalIds: [
     spokeProjects[i].outputs.projectPrincipalId   // project MI (automatic)
     // Add external agent MIs here:
     // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'      // finance-compliance-agent MI
   ]
   ```

3. Redeploy:
   ```bash
   ./scripts/deploy.ps1
   ```

   The APIM policy will now recognize the new identity and map it to the BU's `allowedModels` list.

### Step 2: Agent Developer — Write the Agent Code

The agent developer receives:
- **Gateway URL**: `https://<org>-foundry-apim-<env>.azure-api.net`
- **Their BU's allowed models**: e.g., `gpt-4o`, `gpt-4o-mini`

They do **not** receive any API keys, Foundry endpoints, or Azure credentials.

**Python:**
```python
from azure.identity import DefaultAzureCredential
import openai

credential = DefaultAzureCredential()
token = credential.get_token("https://cognitiveservices.azure.com/.default")

client = openai.AzureOpenAI(
    azure_endpoint="https://contoso-foundry-apim-dev.azure-api.net",
    azure_ad_token=token.token,
    api_version="2024-08-01-preview",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",   # must be in this BU's allowedModels
    messages=[{"role": "user", "content": "Summarize this document..."}],
    max_tokens=200,
)
```

**JavaScript/TypeScript:**
```typescript
import { DefaultAzureCredential } from "@azure/identity";

const credential = new DefaultAzureCredential();
const { token } = await credential.getToken("https://cognitiveservices.azure.com/.default");

const response = await fetch(
  "https://contoso-foundry-apim-dev.azure-api.net/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview",
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Summarize this document..." }],
      max_tokens: 200,
    }),
  }
);
```

**C#:**
```csharp
using Azure.Identity;
using Azure.AI.OpenAI;

var client = new AzureOpenAIClient(
    new Uri("https://contoso-foundry-apim-dev.azure-api.net"),
    new DefaultAzureCredential()
);

var chatClient = client.GetChatClient("gpt-4o-mini");
var response = await chatClient.CompleteChatAsync(
    new ChatMessage[] {
        new UserChatMessage("Summarize this document...")
    },
    new ChatCompletionOptions { MaxOutputTokenCount = 200 }
);
```

### Step 3: What Happens at Runtime

| Step | Who | What |
|---|---|---|
| 1 | Agent | `DefaultAzureCredential` acquires an Entra token with audience `cognitiveservices.azure.com` |
| 2 | Agent | Sends `POST` to APIM gateway with `Authorization: Bearer <token>` |
| 3 | APIM | `validate-azure-ad-token` validates the JWT against Azure AD |
| 4 | APIM | Extracts `oid` claim → looks up in BU identity mapping |
| 5 | APIM | Checks if the requested model is in the BU's `allowedModels` |
| 6 | APIM | If blocked → returns `403 PolicyViolation` immediately |
| 7 | APIM | If allowed → acquires its own Entra token using APIM's MI |
| 8 | APIM | Forwards request to Foundry hub with APIM's Bearer token |
| 9 | Foundry | Processes the request, returns the model response |
| 10 | APIM | Adds `x-ai-gateway-bu` and `x-ai-gateway-caller` headers, returns response to agent |

### What the Agent Developer Does NOT Need

| They don't need... | Because... |
|---|---|
| Azure API keys | Auth is managed identity only |
| Foundry endpoint URL | APIM is the only endpoint they call |
| Azure subscription access | APIM is publicly reachable (or via PE) |
| RBAC on the Foundry resource | APIM's MI has the RBAC, not the agent |
| Knowledge of other BUs' models | allowedModels policy restricts visibility |
| Credential rotation | Managed identities auto-rotate |

### Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `401 Azure AD JWT not present` | No Bearer token in request | Use `DefaultAzureCredential` with scope `https://cognitiveservices.azure.com/.default` |
| `401 TokenExpired` | Token has expired | `DefaultAzureCredential` handles refresh automatically — ensure you're not caching stale tokens |
| `403 PolicyViolation: Model not approved` | Model not in BU's `allowedModels` | Request access from AI CoE (add to `allowedModels` array in IaC) |
| `200 OK` but `x-ai-gateway-bu: unknown` | Agent's MI oid not in any BU mapping | Add the MI's principal ID to `callerPrincipalIds` and redeploy |

---

## Moving to Production

### Parameter Changes

```bicep
param environment = 'prod'
param hubPublicNetworkAccess = 'Disabled'
param disableLocalAuth = true                     // already true by default
param policyEnforcementMode = 'Default'           // switches from audit to enforce
param alertEmails = ['ai-coe@contoso.com']
param logRetentionDays = 365
```

### Additional Steps

1. **Private endpoints** — Deploy PE resources in each spoke's PE subnet targeting the Foundry resource
2. **DNS** — Configure private DNS zones for `cognitiveservices.azure.com` and `vault.azure.net`
3. **Defender** — Verify Microsoft Defender for AI is active at the subscription level
4. **CMK** — If required, pass `customerManagedKeyVaultId` and `customerManagedKeyName` to the hub module
5. **Demo app hosting** — Deploy to Azure App Service with a managed identity and swap `AzureCliCredential` for `ManagedIdentityCredential`

---

## Adapting for Your Organization

### Different Naming Convention

All resource names are computed from `orgPrefix` and `environment` in `main.bicep`. Search for the `var` declarations:

```bicep
var hubResourceGroupName = 'rg-${orgPrefix}-foundry-hub-${environment}'
```

Modify the naming pattern to match your organization's convention.

### Existing VNet Integration

If you have an existing hub VNet, skip the `networking` module and pass your existing VNet/subnet IDs to the other modules. Remove the peering resources and integrate with your existing network topology.

### Multiple Environments

Deploy the same template with different parameter files:

```bash
az deployment sub create --template-file infra/main.bicep --parameters infra/main.dev.bicepparam
az deployment sub create --template-file infra/main.bicep --parameters infra/main.prod.bicepparam
```

### CI/CD Integration

The deployment scripts work in any CI/CD pipeline. Key variables:
- `AZURE_SUBSCRIPTION_ID` — target subscription
- `AZURE_CREDENTIALS` — service principal or workload identity federation

Example GitHub Actions step:
```yaml
- name: Deploy Landing Zone
  run: |
    az deployment sub create \
      --location ${{ vars.LOCATION }} \
      --template-file infra/main.bicep \
      --parameters infra/main.bicepparam
```
