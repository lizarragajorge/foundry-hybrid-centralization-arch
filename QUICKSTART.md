# Quick Start — Deploy in 5 Minutes

## Prerequisites

| Requirement | Check |
|-------------|-------|
| Azure CLI with Bicep | `az bicep version` |
| Azure subscription with **Owner** role | `az role assignment list --assignee $(az ad signed-in-user show --query id -o tsv) --query "[?roleDefinitionName=='Owner']"` |
| Node.js 18+ (for demo app only) | `node --version` |

## Step 1: Fork & Clone

```bash
git clone https://github.com/<you>/foundry-hybrid-landing-zone.git
cd foundry-hybrid-landing-zone
```

## Step 2: Authenticate

```bash
az login
az account set --subscription "<your-subscription-id>"
```

## Step 3: Customize Parameters

Edit `infra/main.bicepparam`:

```bicep
param location = 'eastus2'            // Your preferred region
param environment = 'dev'             // dev | test | staging | prod
param orgPrefix = 'contoso'           // Your org name (used in all resource names)
param aiCoeFoundryName = 'contoso-foundry-hub-dev'  // Unique name for Foundry resource

param businessUnits = [
  {
    name: 'finance'
    displayName: 'Finance & Risk'
    vnetAddressPrefix: '10.1.0.0/16'
    appSubnetPrefix: '10.1.1.0/24'
    peSubnetPrefix: '10.1.2.0/24'
  }
  // Add your BUs here
]

param modelDeployments = [
  {
    name: 'gpt-4o'
    modelName: 'gpt-4o'
    modelVersion: '2024-08-06'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 30           // Tokens-per-minute (thousands)
  }
  // Add your models here
]
```

**Key decisions to make:**
- How many BUs to start with (you can add more later)
- Which models to deploy (check [regional availability](https://learn.microsoft.com/en-us/azure/foundry/reference/region-support))
- Whether to populate Entra ID group IDs now or later

## Step 4: Preview

```powershell
# PowerShell
.\scripts\deploy.ps1 -Preview

# Bash
./scripts/deploy.sh --what-if
```

Review the output. You should see ~30 resources across 6 resource groups.

## Step 5: Deploy

```powershell
# PowerShell
.\scripts\deploy.ps1

# Bash
./scripts/deploy.sh
```

Deployment takes 3-5 minutes. The script outputs:
- Foundry endpoint URL
- Key Vault URI
- Hub VNet ID
- Spoke project names

## Step 6: Grant Yourself API Access

The Foundry resource deploys with local auth disabled (Entra ID only). Grant yourself data-plane access:

```bash
USER_ID=$(az ad signed-in-user show --query id -o tsv)
FOUNDRY_ID=$(az cognitiveservices account show --name <your-foundry-name> -g <your-hub-rg> --query id -o tsv)
az role assignment create --assignee $USER_ID --role "Cognitive Services User" --scope $FOUNDRY_ID
```

Wait 60-90 seconds for RBAC propagation.

## Step 7: Run the Demo App (Optional)

```bash
cd demo-app
npm install

# Create .env.local
cat > .env.local << 'EOF'
AZURE_FOUNDRY_ENDPOINT=https://<your-foundry-name>.cognitiveservices.azure.com/
AZURE_FOUNDRY_NAME=<your-foundry-name>
AZURE_FOUNDRY_RESOURCE_GROUP=<your-hub-rg>
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_MONITORING_RG=<your-monitoring-rg>
AZURE_LOG_ANALYTICS_WORKSPACE=<your-law-name>
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights resource>
NEXT_PUBLIC_APP_NAME=Azure Foundry Hybrid
EOF

npm run dev
# Open http://localhost:3000
```

## Verify It Works

```bash
# Test a model call via Entra ID token
TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)
ENDPOINT="https://<your-foundry-name>.cognitiveservices.azure.com"

curl -s "$ENDPOINT/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}],"max_tokens":10}'
```

## What's Next

- [Add more Business Units](docs/customization.md#adding-a-business-unit)
- [Enable policy enforcement](docs/customization.md#moving-to-production)
- [Review the security model](docs/security.md)
- [Understand the architecture](docs/architecture.md)
