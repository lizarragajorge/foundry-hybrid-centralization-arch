# Azure Foundry Hybrid — Landing Zone + Interactive Demo

A production-ready Bicep scaffold and live web app that deploys and showcases a hub-spoke Azure AI Foundry architecture with centralized governance and federated Business Unit autonomy.

---

## Architecture

```
Subscription
├── rg-*-hub-dev                         Centralized AI CoE
│   ├── Foundry Resource (AIServices)    Models, compute, policies
│   │   ├── Finance Project              BU-scoped agents & evaluations
│   │   ├── Marketing Project            BU-scoped agents & evaluations
│   │   └── Engineering Project          BU-scoped agents & evaluations
│   ├── Key Vault                        Connection secrets (RBAC auth)
│   ├── RBAC Assignments                 Admin / PM / Developer roles
│   └── Azure Policy (×4)               Audit-mode governance
│
├── rg-*-monitoring-dev                  Observability
│   ├── Log Analytics Workspace          90-day retention, diagnostics sink
│   └── Application Insights            OTel trace destination
│
├── rg-*-networking-dev                  Network Isolation
│   ├── vnet-hub (10.0.0.0/16)          Central hub + PE subnets
│   ├── vnet-finance (10.1.0.0/16)      ─┐
│   ├── vnet-marketing (10.2.0.0/16)     ├─ Spoke VNets, peered to hub
│   └── vnet-engineering (10.3.0.0/16)  ─┘
│
└── rg-*-{bu}-dev (×3)                  BU resource groups (tagged)
```

### Resource Types

| Resource | ARM Type | Purpose |
|----------|----------|---------|
| Foundry Resource | `Microsoft.CognitiveServices/accounts` (kind: `AIServices`) | Centralized model deployments, policies, compute |
| Foundry Project | `Microsoft.CognitiveServices/accounts/projects` | BU-scoped agents, evaluations, tools |
| Key Vault | `Microsoft.KeyVault/vaults` | Connection secrets, optional CMK |
| Log Analytics | `Microsoft.OperationalInsights/workspaces` | Centralized diagnostics |
| App Insights | `Microsoft.Insights/components` | OTel trace destination |
| Virtual Networks | `Microsoft.Network/virtualNetworks` | Hub-spoke topology |
| Azure Policy | `Microsoft.Authorization/policyAssignments` | Governance enforcement |

---

## Project Structure

```
azure-foundry-hybrid/
├── main.bicep                             Subscription-scoped orchestrator
├── main.bicepparam                        Parameters (customize here)
├── modules/
│   ├── hub/
│   │   ├── foundry-resource.bicep         Centralized AIServices resource
│   │   └── model-deployment.bicep         GPT-4o, GPT-4o-mini, embeddings
│   ├── spoke/
│   │   └── foundry-project.bicep          BU project (child resource)
│   ├── networking/
│   │   └── vnet.bicep                     Hub-spoke VNets + peering
│   ├── governance/
│   │   ├── policy.bicep                   4 Azure Policy assignments
│   │   ├── rbac.bicep                     Group-based RBAC
│   │   └── rbac-mi.bicep                  Per-identity AI User grants
│   ├── monitoring/
│   │   └── observability.bicep            Log Analytics + App Insights
│   └── security/
│       ├── keyvault.bicep                 Key Vault + Defender
│       └── keyvault-access.bicep          Per-identity KV access
├── scripts/
│   ├── deploy.ps1                         PowerShell deployment
│   ├── deploy.sh                          Bash deployment
│   └── demo-telemetry.ps1                 CLI-based governance demo
└── demo-app/                              Next.js interactive demo
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                   9-tab main page
    │   │   ├── layout.tsx                 Root layout
    │   │   ├── globals.css                Dark theme
    │   │   └── api/
    │   │       ├── foundry/route.ts       Secure AI proxy (Entra ID)
    │   │       ├── guardrails/route.ts    Content safety testing
    │   │       ├── metrics/route.ts       Azure Monitor metrics
    │   │       └── traces/route.ts        OTel traces from App Insights
    │   ├── components/
    │   │   ├── architecture/              Interactive arch diagram
    │   │   ├── simulation/                BU scenario runner
    │   │   ├── arena/                     Model comparison (4o vs mini)
    │   │   ├── trace/                     Animated request trace
    │   │   ├── loadtest/                  Multi-BU concurrent testing
    │   │   ├── dashboard/                 Telemetry + OTel traces
    │   │   ├── cost/                      Real cost attribution
    │   │   ├── guardrails/                Content safety demo
    │   │   ├── governance/                Policy & security showcase
    │   │   └── ui/                        Shared components + BU filter
    │   ├── lib/
    │   │   ├── config.ts                  Architecture data model
    │   │   ├── usage-tracker.ts           Session-level cost tracking
    │   │   └── bu-context.tsx             Global BU filter state
    │   └── instrumentation.ts             OTel SDK + Azure Monitor export
    └── .env.local                         Server-side Azure config
```

---

## Demo Web App (9 Tabs)

| Tab | What It Does |
|-----|-------------|
| **Architecture** | Interactive diagram of the hybrid pattern — click nodes for drill-down detail panels |
| **Simulation** | Run 5 pre-built BU scenarios against live GPT-4o, GPT-4o-mini, and embeddings |
| **Arena** | Side-by-side model comparison — same prompt, parallel execution, cost/quality/latency tradeoff |
| **Trace** | Animated 7-step request flow through all security checkpoints (browser → Entra → RBAC → model) |
| **Load Test** | Configurable concurrent multi-BU load testing with latency charts, P95 tracking, request log |
| **Telemetry** | Azure Monitor metrics + session telemetry + OTel distributed traces from App Insights |
| **Cost** | Real per-BU and per-model cost attribution from Azure Monitor + in-session tracking |
| **Guardrails** | Content safety testing — fire safe/harmful prompts, see real filter annotations and blocks |
| **Governance** | Azure Policy, RBAC model, Zero Trust status, network topology, Key Vault config |

### Security Model

- **Zero API keys in the browser** — all Azure calls route through server-side Next.js API routes
- **Entra ID token auth** via `AzureCliCredential` — local auth is disabled on the Foundry resource
- API endpoints, subscription IDs, and connection strings are server-only env vars (no `NEXT_PUBLIC_` prefix)
- The App Insights connection string is not a secret per [Microsoft docs](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration#connection-string) — it only allows writing telemetry, never reading

### Observability Stack

| Layer | Technology |
|-------|-----------|
| **Infrastructure Metrics** | Azure Monitor → Log Analytics (`contoso-foundry-law`) |
| **Distributed Tracing** | OpenTelemetry SDK → `AzureMonitorTraceExporter` → Application Insights |
| **Custom Spans** | `foundry.inference` (deployment, tokens, latency) and `guardrails.check` (blocked, policy) |
| **Session Tracking** | Client-side in-memory usage tracker with per-BU/model/source aggregation |
| **Diagnostics** | Diagnostic settings on Foundry hub + all projects → Log Analytics |

---

## Quick Start

### Prerequisites

- [Azure CLI](https://aka.ms/installazurecli) with Bicep extension
- [Node.js](https://nodejs.org/) 18+ with npm
- Azure subscription with **Owner** role
- Microsoft Entra ID groups for admins, PMs, developers (optional for PoC)

### 1. Deploy Infrastructure

```powershell
# Edit parameters
notepad main.bicepparam

# Preview
.\scripts\deploy.ps1 -Preview

# Deploy
.\scripts\deploy.ps1
```

### 2. Run the Demo App

```powershell
cd demo-app
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Configuration

Edit `demo-app/.env.local`:

```env
AZURE_FOUNDRY_ENDPOINT=https://<your-foundry>.cognitiveservices.azure.com/
AZURE_FOUNDRY_NAME=<your-foundry-name>
AZURE_FOUNDRY_RESOURCE_GROUP=<your-rg>
AZURE_SUBSCRIPTION_ID=<your-sub-id>
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights>
```

---

## What's Deployed on Azure

| Resource | Details |
|----------|---------|
| 6 Resource Groups | Hub, monitoring, networking, finance, marketing, engineering |
| 1 Foundry Resource | `contoso-foundry-hub-dev` (AIServices, system MI, local auth disabled) |
| 3 Foundry Projects | Finance, Marketing, Engineering (each with own managed identity) |
| 3 Model Deployments | GPT-4o (30K TPM), GPT-4o-mini (60K TPM), text-embedding-3-large (120K TPM) |
| 4 Virtual Networks | Hub + 3 spokes, all peered bidirectionally |
| 1 Key Vault | Soft delete, purge protection, RBAC auth enabled |
| 1 Log Analytics | 90-day retention, diagnostic sink for all resources |
| 1 App Insights | OTel trace destination |
| 4 Azure Policies | Local auth, private link, tagging, network access (audit mode) |
| RBAC Assignments | AI Account Owner, Contributor, AI User + managed identity grants |

---

## Adding a Business Unit

Append to `businessUnits` in `main.bicepparam`:

```bicep
{
  name: 'hr'
  displayName: 'Human Resources'
  vnetAddressPrefix: '10.4.0.0/16'
  appSubnetPrefix: '10.4.1.0/24'
  peSubnetPrefix: '10.4.2.0/24'
}
```

Redeploy — a new resource group, project, VNet, peering, MI, and RBAC assignment are created automatically.

## Moving to Production

1. Set `environment` to `'prod'`
2. Set `hubPublicNetworkAccess` to `'Disabled'`
3. Set `disableLocalAuth` to `true` (already true)
4. Set `policyEnforcementMode` to `'Default'`
5. Populate Entra ID group object IDs
6. Configure alert email addresses
7. Deploy the demo app to Azure Static Web Apps or App Service

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Infrastructure | Bicep (subscription-scoped, modular) |
| Web Framework | Next.js 16 with App Router, TypeScript |
| Styling | Tailwind CSS (dark theme) |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Azure Auth | `@azure/identity` (AzureCliCredential) |
| Observability | OpenTelemetry SDK + Azure Monitor Exporter |
| Content Safety | Azure AI Content Safety (Microsoft.DefaultV2 policy) |

## Related Documentation

- [Microsoft Foundry Architecture](https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture)
- [Foundry Rollout Planning](https://learn.microsoft.com/en-us/azure/foundry/concepts/planning)
- [RBAC for Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/concepts/rbac-foundry)
- [Create Foundry Resource with Bicep](https://learn.microsoft.com/en-us/azure/foundry/how-to/create-resource-template)
- [Configure Private Link](https://learn.microsoft.com/en-us/azure/foundry/how-to/configure-private-link)
- [OpenTelemetry in Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration)
