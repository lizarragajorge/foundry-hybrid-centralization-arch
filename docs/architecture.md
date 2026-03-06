# Architecture

## Design Principles

1. **Deploy once, consume everywhere** — Models are deployed on the centralized Foundry resource. BU projects inherit access via the Foundry Control Plane. No per-team model management.

2. **Isolation through child resources** — Projects are `Microsoft.CognitiveServices/accounts/projects`, a child resource type. They share the parent's model deployments but isolate agents, evaluations, files, and RBAC.

3. **Governance by default** — Azure Policy assignments ship in audit mode. One parameter change switches to enforcement. No retroactive cleanup.

4. **Identity over keys** — Local auth (API keys) is disabled at the Foundry resource level. All access uses Microsoft Entra ID tokens. Managed identities handle service-to-service auth.

5. **One parameter, one BU** — Adding a Business Unit is a single entry in the `businessUnits` array. The orchestrator creates the resource group, project, VNet, peering, managed identity, RBAC, and Key Vault access automatically.

---

## Resource Hierarchy

```
Microsoft.CognitiveServices/accounts (kind: AIServices)
  └── name: contoso-foundry-hub-dev
      ├── identity: SystemAssigned
      ├── properties.allowProjectManagement: true
      ├── properties.disableLocalAuth: true
      ├── properties.publicNetworkAccess: Enabled (dev) / Disabled (prod)
      │
      ├── /deployments/gpt-4o             (30K TPM, Standard)
      ├── /deployments/gpt-4o-mini        (60K TPM, Standard)
      ├── /deployments/text-embedding-3-large (120K TPM, Standard)
      │
      ├── /projects/contoso-finance-dev       (own SystemAssigned MI)
      ├── /projects/contoso-marketing-dev     (own SystemAssigned MI)
      └── /projects/contoso-engineering-dev   (own SystemAssigned MI)
```

### Why Child Resources, Not Separate Foundry Resources?

The Azure Foundry architecture [documentation](https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture) recommends **one Foundry resource per business group** when full isolation is required. Our pattern uses **projects as child resources** because:

- Model deployments are shared (cost efficiency, version consistency)
- Network security is applied at the resource level (not duplicated per BU)
- Azure Policy targets the resource type once, governs all projects
- RBAC can be scoped at either the resource or project level

If your BUs require complete data isolation (different compliance domains), deploy separate Foundry resources instead and use [connections](https://learn.microsoft.com/en-us/azure/foundry/how-to/connections-add) to share model endpoints.

---

## Deployment Sequence

`infra/main.bicep` deploys at subscription scope in dependency order:

```
1. Resource Groups (×6)
   ├── Hub, monitoring, networking, 3× BU spokes
   │
2. Observability
   ├── Log Analytics (needed first — diagnostic sink)
   └── Application Insights
   │
3. Networking
   ├── Hub VNet + PE subnets
   ├── Spoke VNets (×3)
   └── Bidirectional peering (×6)
   │
4. Security
   └── Key Vault (RBAC auth, purge-protected)
   │
5. Foundry Hub
   └── AIServices resource (system MI, diagnostics)
   │
6. Model Deployments (depends on hub)
   ├── GPT-4o
   ├── GPT-4o-mini
   └── text-embedding-3-large
   │
7. Spoke Projects (depends on hub)
   ├── Finance project (own MI)
   ├── Marketing project (own MI)
   └── Engineering project (own MI)
   │
8. RBAC (depends on hub + projects)
   ├── Group roles (Admin, PM, Developer)
   ├── Hub MI → AI User at hub scope
   └── Project MIs → AI User at hub scope
   │
9. Azure Policy
   ├── Disable local auth (audit)
   ├── Require private link (audit)
   ├── Require businessUnit tag (audit)
   └── Restrict network access (audit)
   │
10. Key Vault Access (depends on KV + projects)
    ├── Hub MI → KV Secrets User
    └── Project MIs → KV Secrets User
```

---

## Module Design

Each module is **self-contained** with typed parameters, no cross-module dependencies, and descriptive outputs.

| Module | Scope | Inputs | Creates |
|--------|-------|--------|---------|
| `hub/foundry-resource` | Resource Group | name, location, SKU, diagnostics | AIServices account |
| `hub/model-deployment` | Resource Group | parent name, typed deployment array | N model deployments |
| `spoke/foundry-project` | Resource Group | parent name, BU config | Project child resource |
| `networking/vnet` | Resource Group | hub/spoke prefixes, spoke array | VNets + NSGs + peering |
| `governance/policy` | Resource Group | enforcement mode | 4 policy assignments |
| `governance/rbac` | Resource Group | principal ID arrays | Group-based role bindings |
| `governance/rbac-mi` | Resource Group | single principal ID | Single MI role binding |
| `monitoring/observability` | Resource Group | retention, SKU, alert emails | LAW + App Insights |
| `security/keyvault` | Resource Group | name, tenant, Defender | Key Vault |
| `security/keyvault-access` | Resource Group | KV name, principal ID | Single KV access grant |

### Why `rbac-mi` is separate from `rbac`

Bicep cannot use module outputs inside `for`-expression variable declarations ([BCP182](https://aka.ms/bicep/core-diagnostics#BCP182)). Since project managed identity principal IDs are only known after deployment, each MI gets its own module invocation via a `for` loop over the `businessUnits` array in `main.bicep`.

---

## Networking

```
vnet-foundry-hub (10.0.0.0/16)
  ├── snet-foundry (10.0.1.0/24)           — Foundry workloads
  └── snet-private-endpoints (10.0.2.0/24) — PE subnet (policies disabled)

vnet-foundry-finance (10.1.0.0/16)
  ├── snet-app (10.1.1.0/24)
  └── snet-private-endpoints (10.1.2.0/24)

vnet-foundry-marketing (10.2.0.0/16)  [same structure]
vnet-foundry-engineering (10.3.0.0/16) [same structure]
```

All spoke VNets peer bidirectionally to the hub. **Spokes do not peer to each other** — BU traffic is isolated at the network level.

Private endpoints are prepared (subnet provisioned, NSG attached) but not deployed in the PoC. For production, add a `Microsoft.Network/privateEndpoints` resource targeting the Foundry resource and set `publicNetworkAccess: 'Disabled'`.

---

## Observability

Three layers:

1. **Azure Monitor Metrics** — Platform-level (calls, tokens, latency) at the Foundry resource scope. Diagnostic settings stream to Log Analytics.
2. **OpenTelemetry** — Application-level distributed tracing from the demo app. Custom spans (`foundry.inference`, `guardrails.check`) export to Application Insights.
3. **Session Tracking** — Client-side in-memory usage tracking with per-BU/per-model aggregation for live cost attribution during demos.
