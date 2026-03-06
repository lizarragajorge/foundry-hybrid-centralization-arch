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
param disableLocalAuth bool = false

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

// ─── 8. Governance Policies ─────────────────────────────────────────────────

module policies 'modules/governance/policy.bicep' = {
  scope: hubResourceGroup
  params: {
    location: location
    enforcementMode: policyEnforcementMode
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
