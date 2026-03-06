# ADR-001: CognitiveServices vs. MachineLearningServices for Foundry Resources

**Status:** Accepted  
**Date:** 2026-03-06  
**Decision makers:** AI CoE Platform Team

---

## Context

Azure AI Foundry provides **two resource type families** for deploying AI capabilities:

| Resource Type | Kind | Resource Manager Namespace |
|--------------|------|---------------------------|
| **AI Services Account** | `AIServices` | `Microsoft.CognitiveServices/accounts` |
| **AI Foundry Hub** | `Hub` | `Microsoft.MachineLearningServices/workspaces` |

Both support model deployments, Entra ID auth, managed identities, and RBAC. However, they differ significantly in scope and capability.

### Option A: CognitiveServices/accounts (kind: AIServices)

**Pros:**
- **Simpler resource model** — single account with child `/deployments` and `/projects`
- **Lower operational complexity** — no workspace storage account, ACR, or compute instance required
- **Direct model hosting** — models deploy as first-class sub-resources
- **Well-understood API surface** — OpenAI-compatible REST API
- **Lower cost** — no ancillary resources (storage, ACR)
- **Policy coverage** — extensive built-in Azure Policy definitions for Cognitive Services

**Cons:**
- **No built-in agent framework** — no Foundry Agent Service, prompt flow, or evaluation pipelines
- **No workspace UI** — no integrated notebooks, datasets, or experiment tracking
- **Limited project isolation** — projects share the parent's network and encryption boundary

### Option B: MachineLearningServices/workspaces (kind: Hub)

**Pros:**
- **Full Foundry experience** — agents, prompt flow, evaluations, playground, fine-tuning
- **Project-level isolation** — each project gets its own workspace with separate storage
- **Integrated tooling** — VS Code integration, SDK support, MLflow tracking
- **Connections framework** — managed connections to external data sources

**Cons:**
- **Higher complexity** — requires dependent resources (Storage Account, Key Vault, ACR, App Insights per workspace)
- **Higher cost** — ancillary resources add fixed monthly cost per workspace
- **More RBAC surface** — need to manage permissions across ML workspace, storage, ACR, and Key Vault
- **Newer API surface** — API is still evolving rapidly

---

## Decision

We chose **Option A: `Microsoft.CognitiveServices/accounts`** (kind: `AIServices`) for this reference implementation.

---

## Rationale

1. **This is a governance and infrastructure accelerator**, not an ML development platform. The primary value is demonstrating hub-spoke model management, RBAC, policy, and networking — all of which work identically on the simpler resource type.

2. **Lower barrier to entry.** Deploying a Cognitive Services account requires only the account itself. An ML workspace requires 4-5 dependent resources, increasing deployment time, cost, and failure surface for a PoC.

3. **Model consumption is the primary BU use case.** Business units in this pattern consume pre-deployed models via REST API — they don't need notebooks, prompt flow, or fine-tuning. If a BU needs those capabilities, they can adopt Option B for that specific project.

4. **Policy and RBAC patterns are transferable.** The governance patterns (Azure Policy assignments, RBAC role bindings, managed identity grants) work the same way regardless of resource type. Migrating to ML workspace-based Foundry Hubs requires changing the resource type and adding dependent resources — the governance overlay remains identical.

---

## Consequences

- BU projects in this deployment **cannot** use Foundry Agent Service, prompt flow, or the full Foundry portal experience.
- If a BU requires those capabilities, deploy a separate `Microsoft.MachineLearningServices/workspaces` (kind: `Hub` + `Project`) and [connect](https://learn.microsoft.com/en-us/azure/foundry/how-to/connections-add) it to the centralized model endpoints.
- Documentation should clearly differentiate between "Foundry Project" (the CognitiveServices child resource) and "Foundry Workspace Project" (the ML workspace variant) to avoid confusion.

---

## References

- [Azure AI Foundry Architecture](https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture)
- [Foundry Rollout Planning](https://learn.microsoft.com/en-us/azure/foundry/concepts/planning)
- [CognitiveServices vs. ML workspace comparison](https://learn.microsoft.com/en-us/azure/ai-services/what-are-ai-services)
- [Azure AI Foundry SDK](https://learn.microsoft.com/en-us/azure/ai-foundry/sdk-overview)
