// ============================================================================
// Azure Foundry - Hybrid Centralized/Federated Deployment
// Main Orchestrator
//
// Architecture Pattern (matching diagram):
// ┌──────────────────────────────────┐  ┌──────────────────────────────────┐
// │  Federated - BUs                 │  │  Centralized - AI CoE           │
// │  ┌──────────────────────┐        │  │  ┌──────────────────────┐       │
// │  │ Resource Group       │        │  │  │ Resource Group       │       │
// │  │  AI, Application,    │ Azure  │  │  │  AI, Data, IAM       │       │
// │  │  Data, IAM           │ Policy │  │  │                      │       │
// │  └──────┬───────────────┘◄───────┤  │  └──────┬───────────────┘       │
// │         │                        │  │         │                       │
// │  ┌──────▼───────────────┐        │  │  ┌──────▼───────────────┐       │
// │  │ Foundry Project      │ Foundry│  │  │ Foundry Resource     │       │
// │  │  Agents, Tools       │ Control│  │  │  Models & Endpoints  │       │
// │  │  Shared Connections  │◄───────┼──┤  │  Compute, Policies   │       │
// │  │  Guardrails          │ Plane  │  │  │  Observability       │       │
// │  │  Evaluations         │        │  │  │                      │       │
// │  │  Observability       │        │  │  │                      │       │
// │  └──────────────────────┘        │  │  └──────────────────────┘       │
// └──────────────────────────────────┘  └──────────────────────────────────┘
//   Microsoft Purview | Microsoft Entra | Microsoft Defender
// ============================================================================

targetScope = 'subscription'

// ─── Global Parameters ──────────────────────────────────────────────────────

@description('Primary Azure region for deployment')
param location string

@description('Environment designation')
@allowed(['dev', 'test', 'staging', 'prod'])
param environment string = 'dev'

@description('Organization name prefix for resource naming')
@minLength(2)
@maxLength(10)
param orgPrefix string

@description('Tags applied to all resources')
param globalTags object = {}

// ─── Centralized Hub Parameters ─────────────────────────────────────────────

@description('Name of the AI CoE Foundry resource')
param aiCoeFoundryName string

@description('Whether to disable local (API key) auth on the hub')
param disableLocalAuth bool = true

@description('Public network access setting for the hub')
@allowed(['Enabled', 'Disabled'])
param hubPublicNetworkAccess string = 'Enabled'

@description('Model deployments for the centralized hub')
param modelDeployments array = []

// ─── Federated Spoke Parameters ─────────────────────────────────────────────

@description('Business unit spoke configurations')
param businessUnits businessUnitConfig[] = []

@description('Business unit spoke configuration type')
type businessUnitConfig = {
  @description('Short name for the BU (used in resource naming)')
  name: string
  @description('Display name for the BU Foundry project')
  displayName: string
  @description('VNet address prefix for the spoke')
  vnetAddressPrefix: string
  @description('Application subnet prefix')
  appSubnetPrefix: string
  @description('Private endpoint subnet prefix')
  peSubnetPrefix: string
  @description('Model deployment names this BU is allowed to consume (empty = all models). Central IT provisions models on the hub; this controls which BUs can deploy/use them.')
  allowedModels: string[]
}

// ─── Governance Parameters ──────────────────────────────────────────────────

@description('Admin Entra group principal IDs')
param adminGroupIds string[] = []

@description('Project manager Entra group principal IDs')
param projectManagerGroupIds string[] = []

@description('Developer Entra group principal IDs')
param developerGroupIds string[] = []

@description('Policy enforcement mode')
@allowed(['Default', 'DoNotEnforce'])
param policyEnforcementMode string = 'Default'

// ─── Monitoring Parameters ──────────────────────────────────────────────────

@description('Alert notification email addresses')
param alertEmails string[] = []

@description('Log Analytics retention in days')
param logRetentionDays int = 90

// ─── Private Endpoint Parameters ────────────────────────────────────────────

@description('Enable Private Endpoints for Foundry and Key Vault (requires hubPublicNetworkAccess = Disabled)')
param enablePrivateEndpoints bool = false

// ─── AI Gateway Parameters ──────────────────────────────────────────────────

@description('Enable APIM AI Gateway for centralized model access enforcement')
param enableAiGateway bool = false

@description('Publisher email for APIM (required when enableAiGateway = true)')
param apimPublisherEmail string = ''

@description('APIM SKU')
@allowed(['Developer', 'Basic', 'Standard', 'Premium', 'Consumption', 'BasicV2', 'StandardV2', 'PremiumV2'])
param apimSku string = 'BasicV2'

@description('Per-BU tokens-per-minute rate limit (0 = unlimited)')
param defaultBuRateLimitTPM int = 0

// ─── Computed Values ────────────────────────────────────────────────────────

var tags = union(globalTags, {
  environment: environment
  managedBy: 'bicep'
  pattern: 'hybrid-foundry'
  organization: orgPrefix
})

var hubResourceGroupName = 'rg-${orgPrefix}-foundry-hub-${environment}'
var monitoringResourceGroupName = 'rg-${orgPrefix}-foundry-monitoring-${environment}'
var networkingResourceGroupName = 'rg-${orgPrefix}-foundry-networking-${environment}'

// ─── Resource Groups ────────────────────────────────────────────────────────

// Centralized Hub Resource Group (AI CoE)
resource hubResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: hubResourceGroupName
  location: location
  tags: union(tags, { role: 'ai-coe-hub' })
}

// Monitoring Resource Group
resource monitoringResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: monitoringResourceGroupName
  location: location
  tags: union(tags, { role: 'monitoring' })
}

// Networking Resource Group
resource networkingResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: networkingResourceGroupName
  location: location
  tags: union(tags, { role: 'networking' })
}

// BU Spoke Resource Groups (Federated)
resource spokeResourceGroups 'Microsoft.Resources/resourceGroups@2024-03-01' = [
  for bu in businessUnits: {
    name: 'rg-${orgPrefix}-foundry-${bu.name}-${environment}'
    location: location
    tags: union(tags, {
      role: 'bu-spoke'
      businessUnit: bu.name
    })
  }
]

// ─── 1. Observability (Deploy First) ────────────────────────────────────────

module monitoring 'modules/monitoring/observability.bicep' = {
  scope: monitoringResourceGroup
  params: {
    location: location
    tags: tags
    namePrefix: '${orgPrefix}-foundry'
    retentionInDays: logRetentionDays
    alertEmails: alertEmails
  }
}

// ─── 2. Networking ──────────────────────────────────────────────────────────

module networking 'modules/networking/vnet.bicep' = {
  scope: networkingResourceGroup
  params: {
    location: location
    tags: tags
    enableApimSubnet: enableAiGateway
    spokeVnets: [
      for bu in businessUnits: {
        name: 'vnet-foundry-${bu.name}'
        addressPrefix: bu.vnetAddressPrefix
        appSubnetPrefix: bu.appSubnetPrefix
        peSubnetPrefix: bu.peSubnetPrefix
        businessUnit: bu.name
      }
    ]
  }
}

// ─── 3. Security (Key Vault) ────────────────────────────────────────────────

module security 'modules/security/keyvault.bicep' = {
  scope: hubResourceGroup
  params: {
    location: location
    tags: tags
    keyVaultName: 'kv-${orgPrefix}-foundry-${environment}'
    tenantId: tenant().tenantId
    publicNetworkAccess: hubPublicNetworkAccess
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ─── 4. Centralized Foundry Resource (AI CoE Hub) ───────────────────────────

module foundryHub 'modules/hub/foundry-resource.bicep' = {
  scope: hubResourceGroup
  params: {
    foundryName: aiCoeFoundryName
    location: location
    publicNetworkAccess: hubPublicNetworkAccess
    disableLocalAuth: disableLocalAuth
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// ─── 5. Model Deployments (Centralized) ─────────────────────────────────────

module modelDeploy 'modules/hub/model-deployment.bicep' = if (!empty(modelDeployments)) {
  scope: hubResourceGroup
  params: {
    foundryName: foundryHub.outputs.foundryResourceName
    modelDeployments: modelDeployments
  }
}

// ─── 6. Federated BU Projects (Spokes) ─────────────────────────────────────

// Projects are child resources of the centralized Foundry resource,
// but logically scoped to each Business Unit for autonomy.
module spokeProjects 'modules/spoke/foundry-project.bicep' = [
  for (bu, i) in businessUnits: {
    scope: hubResourceGroup
    dependsOn: [modelDeploy]
    params: {
      foundryName: foundryHub.outputs.foundryResourceName
      projectName: '${orgPrefix}-${bu.name}-${environment}'
      projectDisplayName: bu.displayName
      location: location
      businessUnit: bu.name
      environment: environment
      tags: tags
      logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    }
  }
]

// ─── 7. RBAC Assignments ────────────────────────────────────────────────────

module rbac 'modules/governance/rbac.bicep' = {
  scope: hubResourceGroup
  params: {
    foundryResourceId: foundryHub.outputs.foundryResourceId
    adminPrincipalIds: adminGroupIds
    projectManagerPrincipalIds: projectManagerGroupIds
    aiUserPrincipalIds: developerGroupIds
    managedIdentityPrincipalIds: []
  }
}

// Hub Foundry managed identity -> AI User at hub scope
module hubMiRbac 'modules/governance/rbac-mi.bicep' = {
  scope: hubResourceGroup
  params: {
    foundryResourceId: foundryHub.outputs.foundryResourceId
    principalId: foundryHub.outputs.foundryPrincipalId
    roleDescription: 'Hub Foundry managed identity - AI User'
  }
}

// Spoke project managed identities -> AI User at hub scope
module spokeMiRbac 'modules/governance/rbac-mi.bicep' = [
  for (bu, i) in businessUnits: {
    name: 'spokeMiRbac-${bu.name}'
    scope: hubResourceGroup
    params: {
      foundryResourceId: foundryHub.outputs.foundryResourceId
      principalId: spokeProjects[i].outputs.projectPrincipalId
      roleDescription: 'Spoke project ${bu.name} managed identity - AI User'
    }
  }
]

// ─── 8. Governance Policies (Subscription-wide) ─────────────────────────────

// Policies deploy at subscription scope to govern ALL resource groups,
// including hub, spoke, monitoring, and networking.
module policies 'modules/governance/policy.bicep' = {
  name: 'policyAssignments'
  params: {
    location: location
    enforcementMode: policyEnforcementMode
  }
}

// ─── 8a. DINE: Auto-deploy standard control plane governance ────────────────
// Ensures every Foundry resource gets: diagnostics → central LAW,
// disableLocalAuth, network hardening.
module controlPlaneDine 'modules/governance/policy-dine-controlplane.bicep' = {
  name: 'controlPlaneDinePolicy'
  params: {
    location: location
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    enforcementMode: policyEnforcementMode
  }
}

// ─── 8b. DINE: Auto-deploy standard RAI guardrails ─────────────────────────
// Ensures every Foundry resource has an enterprise-standard raiPolicy
// with content filters configured.
module guardrailsDine 'modules/governance/policy-dine-guardrails.bicep' = {
  name: 'guardrailsDinePolicy'
  params: {
    location: location
    enforcementMode: policyEnforcementMode
  }
}

// ─── 8c. Modify: Enforce guardrail on all asset deployments ─────────────────
// Automatically sets raiPolicyName on every model/agent/tool deployment
// to reference the enterprise-standard guardrail from 8b.
module assetGuardrailModify 'modules/governance/policy-modify-assets.bicep' = {
  name: 'assetGuardrailModifyPolicy'
  dependsOn: [guardrailsDine]
  params: {
    location: location
    enforcementMode: policyEnforcementMode
    standardRaiPolicyName: guardrailsDine.outputs.standardRaiPolicyName
  }
}

// ─── 9. Metric Alert Rules ──────────────────────────────────────────────────

// Alerts deploy after Foundry hub exists (scoped to its resource ID).
// Only created when alertEmails are configured (action group must exist).
module alerts 'modules/monitoring/alerts.bicep' = if (!empty(alertEmails)) {
  scope: monitoringResourceGroup
  params: {
    namePrefix: '${orgPrefix}-foundry'
    tags: tags
    foundryResourceId: foundryHub.outputs.foundryResourceId
    actionGroupId: monitoring.outputs.actionGroupId
  }
}

// Grant Key Vault access to hub Foundry managed identity
module kvAccessHub 'modules/security/keyvault-access.bicep' = {
  name: 'kvAccessHub'
  scope: hubResourceGroup
  params: {
    keyVaultName: security.outputs.keyVaultName
    principalId: foundryHub.outputs.foundryPrincipalId
  }
}

// Grant Key Vault access to spoke project managed identities
module kvAccessSpoke 'modules/security/keyvault-access.bicep' = [
  for (bu, i) in businessUnits: {
    name: 'kvAccessSpoke-${bu.name}'
    scope: hubResourceGroup
    params: {
      keyVaultName: security.outputs.keyVaultName
      principalId: spokeProjects[i].outputs.projectPrincipalId
    }
  }
]

// ─── 10. Private Endpoints (Optional) ───────────────────────────────────────

// Deploy PEs for Foundry + Key Vault when enabled (production hardening).
// Requires hubPublicNetworkAccess = 'Disabled' for full network isolation.
module privateEndpoints 'modules/networking/private-endpoint.bicep' = if (enablePrivateEndpoints) {
  scope: networkingResourceGroup
  params: {
    location: location
    tags: tags
    namePrefix: '${orgPrefix}-foundry-${environment}'
    foundryResourceId: foundryHub.outputs.foundryResourceId
    keyVaultId: security.outputs.keyVaultId
    privateEndpointSubnetId: networking.outputs.hubPeSubnetId
    vnetIdsForDnsLink: concat(
      [networking.outputs.hubVnetId],
      networking.outputs.spokeVnetIds
    )
  }
}

// ─── 11. AI Gateway (APIM) ──────────────────────────────────────────────────

// Deploys APIM as the AI Gateway with per-BU identity-mapped products.
// BU callers authenticate with their managed identity (Entra ID Bearer token).
// APIM validates the JWT, maps the caller's oid to a BU, enforces allowedModels,
// then authenticates to Foundry using APIM's own managed identity. No API keys.
module aiGateway 'modules/gateway/apim.bicep' = if (enableAiGateway) {
  scope: hubResourceGroup
  params: {
    location: location
    tags: tags
    apimName: '${orgPrefix}-foundry-gateway-${environment}'
    skuName: apimSku
    publisherEmail: apimPublisherEmail
    publisherName: '${orgPrefix} AI CoE'
    foundryEndpoint: foundryHub.outputs.foundryEndpoint
    tenantId: tenant().tenantId
    businessUnits: [
      for (bu, i) in businessUnits: {
        name: bu.name
        displayName: bu.displayName
        allowedModels: bu.allowedModels
        rateLimitTPM: defaultBuRateLimitTPM
        callerPrincipalIds: [spokeProjects[i].outputs.projectPrincipalId]
      }
    ]
    appInsightsInstrumentationKey: monitoring.outputs.appInsightsInstrumentationKey
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// Grant APIM managed identity → Cognitive Services User on the Foundry hub
module apimMiRbac 'modules/governance/rbac-mi.bicep' = if (enableAiGateway) {
  name: 'apimMiRbac'
  scope: hubResourceGroup
  params: {
    foundryResourceId: foundryHub.outputs.foundryResourceId
    principalId: enableAiGateway ? aiGateway.outputs.apimPrincipalId : ''
    roleDescription: 'APIM AI Gateway managed identity - Cognitive Services User'
  }
}

// ─── Outputs ────────────────────────────────────────────────────────────────

@description('Centralized Foundry resource ID')
output hubFoundryResourceId string = foundryHub.outputs.foundryResourceId

@description('Centralized Foundry endpoint')
output hubFoundryEndpoint string = foundryHub.outputs.foundryEndpoint

@description('Spoke project names')
output spokeProjectNames string[] = [
  for (bu, i) in businessUnits: spokeProjects[i].outputs.projectName
]

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId

@description('Key Vault URI')
output keyVaultUri string = security.outputs.keyVaultUri

@description('Hub VNet ID')
output hubVnetId string = networking.outputs.hubVnetId

@description('AI Gateway URL (empty if not enabled)')
output aiGatewayUrl string = enableAiGateway ? aiGateway.outputs.apimGatewayUrl : ''

@description('Control plane DINE policy initiative ID')
output controlPlanePolicySetId string = controlPlaneDine.outputs.policySetDefinitionId

@description('Guardrails DINE policy ID')
output guardrailsPolicyId string = guardrailsDine.outputs.policyDefinitionId

@description('Asset guardrail Modify policy initiative ID')
output assetGuardrailPolicySetId string = assetGuardrailModify.outputs.policySetDefinitionId
