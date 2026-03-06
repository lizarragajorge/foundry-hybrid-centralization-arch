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
