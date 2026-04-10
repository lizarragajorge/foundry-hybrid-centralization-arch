# Governance Modules

Azure Policy definitions, initiatives, assignments, and RBAC role assignments for AI Foundry resources.

## Policy Files

| File | Effect(s) | What It Does |
|---|---|---|
| **policy.bicep** | Audit / Deny | Assigns 4 **built-in** Azure policies: disable local auth, require private link, require `businessUnit` tag, restrict public network access |
| **policy-dine-controlplane.bicep** | DINE + Modify | 3 **custom** policies in an initiative: auto-deploy diagnostic settings → central Log Analytics (DINE), enforce `disableLocalAuth=true` (Modify), enforce network hardening (Modify) |
| **policy-dine-guardrails.bicep** | DINE | 1 **custom** policy: auto-deploy an `enterprise-standard` raiPolicy (Responsible AI content filters) on every Foundry resource — covers hate, sexual, violence, self-harm, protected material, jailbreak, indirect attack, and profanity |
| **policy-modify-assets.bicep** | Deny + Audit | 2 **custom** policies in an initiative: deny model/agent/tool deployments missing `raiPolicyName=enterprise-standard`, audit non-compliant deployments for portal visibility |

## RBAC Files

| File | What It Does |
|---|---|
| **rbac.bicep** | Assigns tiered RBAC roles (Account Owner, Project Manager, AI User) to Entra ID groups on the Foundry hub resource |
| **rbac-mi.bicep** | Assigns the AI User role to a single managed identity on the Foundry hub — used for hub and spoke project identities |

## Dependency Chain

```
policy.bicep                        ← 4 built-in audit policies (independent)
policy-dine-controlplane.bicep      ← DINE diagnostics + Modify auth/network (independent)
policy-dine-guardrails.bicep        ← DINE raiPolicy on every Foundry resource
    ↓ dependsOn (raiPolicy must exist before enforcing it on deployments)
policy-modify-assets.bicep          ← Deny/Audit deployments missing that raiPolicy
```

## Parameters

All policy modules share these common parameters:

| Parameter | Type | Description |
|---|---|---|
| `location` | string | Region for the policy assignment managed identity |
| `enforcementMode` | `Default` / `DoNotEnforce` | `DoNotEnforce` = audit-only mode for safe rollout |

Additional parameters per module:

- **policy-dine-controlplane**: `logAnalyticsWorkspaceId` — resource ID of the central Log Analytics workspace
- **policy-dine-guardrails**: `standardRaiPolicyName` (default `enterprise-standard`), `contentFilterSeverity` (`Low`/`Medium`/`High`)
- **policy-modify-assets**: `standardRaiPolicyName` — must match the guardrails module output

## Standalone Usage

These modules can be deployed independently of the rest of the infrastructure:

```bicep
targetScope = 'subscription'

module policies 'governance/policy.bicep' = {
  name: 'auditPolicies'
  params: {
    location: 'eastus2'
    enforcementMode: 'DoNotEnforce'  // start in audit-only
  }
}

module controlPlane 'governance/policy-dine-controlplane.bicep' = {
  name: 'controlPlanePolicies'
  params: {
    location: 'eastus2'
    logAnalyticsWorkspaceId: '/subscriptions/.../resourceGroups/.../providers/Microsoft.OperationalInsights/workspaces/...'
    enforcementMode: 'DoNotEnforce'
  }
}

module guardrails 'governance/policy-dine-guardrails.bicep' = {
  name: 'guardrailsPolicies'
  params: {
    location: 'eastus2'
    enforcementMode: 'DoNotEnforce'
    contentFilterSeverity: 'Medium'
  }
}

module assetGuardrails 'governance/policy-modify-assets.bicep' = {
  name: 'assetGuardrailPolicies'
  dependsOn: [guardrails]
  params: {
    location: 'eastus2'
    enforcementMode: 'DoNotEnforce'
    standardRaiPolicyName: guardrails.outputs.standardRaiPolicyName
  }
}
```

## Prerequisites

- **Subscription scope**: All modules deploy at `targetScope = 'subscription'`
- **Permissions**: Owner or Resource Policy Contributor on the target subscription
- **DINE/Modify**: The policy assignment creates a system-assigned managed identity with the required role assignments inline (Log Analytics Contributor, Monitoring Contributor, Cognitive Services Contributor)
