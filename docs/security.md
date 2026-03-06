# Security Model

## Zero Trust Posture

This landing zone implements Zero Trust for AI workloads across five pillars:

### 1. Identity

| Control | Status | Detail |
|---------|--------|--------|
| Local auth (API keys) | **Disabled** | `disableLocalAuth: true` on the Foundry resource |
| Authentication | **Entra ID only** | All API access requires OAuth2 bearer tokens |
| Managed identities | **System-assigned** | Hub resource + each project gets its own MI |
| Service-to-service | **Token-based** | MIs get `Azure AI User` at hub scope |
| User auth | **RBAC-scoped** | Group-based assignments at resource/project level |

### 2. Network

| Control | Status | Detail |
|---------|--------|--------|
| Hub-spoke topology | **Active** | 4 VNets with bidirectional peering |
| Spoke isolation | **Active** | Spokes cannot reach each other directly |
| Private endpoint subnets | **Provisioned** | Ready for PE deployment |
| NSGs | **Attached** | On all PE subnets |
| Public access | **Enabled (dev)** | Switch to `Disabled` for production |

### 3. Data Protection

| Control | Status | Detail |
|---------|--------|--------|
| Encryption at rest | **Microsoft-managed** | AES-256, FIPS 140-2 compliant |
| Key Vault | **RBAC auth enabled** | No legacy access policies |
| Soft delete | **90 days** | Prevents accidental deletion |
| Purge protection | **Enabled** | Cannot force-delete within retention |
| CMK support | **Ready** | Pass `customerManagedKeyVaultId` parameter |

### 4. Governance

| Control | Mode | Policy Definition |
|---------|------|-------------------|
| Disable local auth | Audit | `71ef260a-8f18-47b7-abcb-62d0673d94dc` |
| Require private link | Audit | `cddd188c-4b82-4c48-a19d-ddf74ee66a01` |
| Require `businessUnit` tag | Audit | `96670d01-0a4d-4649-9c89-2d3abc0a5025` |
| Restrict network access | Audit | Built-in Cognitive Services policy |

All policies deploy in **audit mode** by default. Set `policyEnforcementMode: 'Default'` to enforce.

### 5. Monitoring

| Control | Detail |
|---------|--------|
| Diagnostic settings | All logs + metrics → Log Analytics |
| Log retention | 90 days (configurable) |
| OTel tracing | Custom spans with auth method, tokens, latency |
| Defender for AI | Enabled on the subscription |

---

## RBAC Matrix

| Persona | Built-in Role | Scope | What They Can Do |
|---------|--------------|-------|------------------|
| AI CoE Admins | Azure AI Account Owner | Foundry Resource | Full management — deployments, networking, policies |
| BU Project Managers | Cognitive Services Contributor | Foundry Resource | Create/manage projects, connections |
| BU Developers | Azure AI User | Foundry Project | Use models, build agents, run evaluations |
| Hub Managed Identity | Azure AI User | Foundry Resource | Service-to-service model access |
| Project Managed Identities | Azure AI User | Foundry Resource | Project-to-hub model access |
| Foundry MIs | Key Vault Secrets User | Key Vault | Read connection secrets |

### Least-Privilege Onboarding

For initial PoC, assign:
1. `Azure AI User` for each developer at the Foundry resource scope
2. `Azure AI User` for each project managed identity at the Foundry resource scope

Tighten after validating workflows.

---

## Content Safety

All model deployments use the `Microsoft.DefaultV2` content filter policy:

| Category | Threshold | Action |
|----------|-----------|--------|
| Hate | High severity | Block |
| Violence | High severity | Block |
| Sexual | High severity | Block |
| Self-harm | High severity | Block |
| Jailbreak | Detected | Flag |
| Indirect attack | Detected | Flag |

Content filter annotations are returned in API responses and can be inspected in the demo app's Guardrails tab.

---

## Demo App Security

The demo app (`demo-app/`) follows secure-by-default practices:

| Concern | Approach |
|---------|----------|
| Credentials in browser | **Never** — all Azure calls go through `/api/*` server routes |
| Token lifetime | Per-request acquisition via `AzureCliCredential` — no caching |
| Env vars | Server-only (no `NEXT_PUBLIC_` prefix on secrets) |
| App Insights connection string | [Not a secret](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration#connection-string) — write-only telemetry ingestion |
| Input validation | Deserialized and type-checked in API routes before Azure calls |

---

## Production Hardening Checklist

- [ ] Set `hubPublicNetworkAccess: 'Disabled'`
- [ ] Deploy private endpoints for Foundry, Key Vault, and Log Analytics
- [ ] Set `policyEnforcementMode: 'Default'`
- [ ] Populate Entra ID group object IDs for RBAC
- [ ] Enable customer-managed keys if required by compliance
- [ ] Configure alert action groups with team email addresses
- [ ] Deploy the demo app to Azure App Service with managed identity (replace `AzureCliCredential` with `ManagedIdentityCredential`)
- [ ] Enable audit logging for Key Vault access events
- [ ] Review and tighten NSG rules on PE subnets
