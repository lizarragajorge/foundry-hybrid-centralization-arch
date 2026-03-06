// ============================================================================
// Governance - RBAC Role Assignments
// Implements the security-driven separation of concerns:
//   - Admins: Owner/Azure AI Account Owner at Foundry resource scope
//   - Project Managers: Azure AI Project Manager at Foundry resource scope
//   - Project Users: Azure AI User at Foundry project scope
//   - Project Managed Identities: Azure AI User at Foundry resource scope
// ============================================================================

@description('Resource ID of the Foundry resource (hub)')
param foundryResourceId string

@description('Admin group principal IDs (Entra ID groups)')
param adminPrincipalIds string[] = []

@description('Project manager principal IDs')
param projectManagerPrincipalIds string[] = []

@description('AI User principal IDs (developers)')
param aiUserPrincipalIds string[] = []

@description('Managed identity principal IDs that need AI User access at hub scope')
param managedIdentityPrincipalIds string[] = []

// Built-in role definition IDs
// Azure AI Account Owner
var aiAccountOwnerRoleId = 'e47c6f54-e4a2-4754-9501-8e0985b135e1'
// Azure AI User
var aiUserRoleId = '53ca6127-db72-4b80-b1b0-d745d6d5456d'
// Azure AI Project Manager
var cogServicesContributorRoleId = 'eadc314b-1a2d-4efa-be10-5d325db5065e'

// Admin role assignments - Azure AI Account Owner
resource adminRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in adminPrincipalIds: {
    name: guid(foundryResourceId, principalId, aiAccountOwnerRoleId)
    properties: {
      principalId: principalId
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiAccountOwnerRoleId)
      principalType: 'Group'
      description: 'AI CoE Admin - Full Foundry resource management'
    }
  }
]

// Project Manager role assignments
resource projectManagerRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in projectManagerPrincipalIds: {
    name: guid(foundryResourceId, principalId, cogServicesContributorRoleId)
    properties: {
      principalId: principalId
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cogServicesContributorRoleId)
      principalType: 'Group'
      description: 'BU Project Manager - Manage Foundry projects'
    }
  }
]

// AI User role assignments (developers)
resource aiUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in aiUserPrincipalIds: {
    name: guid(foundryResourceId, principalId, aiUserRoleId)
    properties: {
      principalId: principalId
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiUserRoleId)
      principalType: 'Group'
      description: 'BU Developer - Use Foundry AI capabilities'
    }
  }
]

// Managed identity role assignments at hub scope
resource managedIdentityRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in managedIdentityPrincipalIds: {
    name: guid(foundryResourceId, principalId, aiUserRoleId, 'mi')
    properties: {
      principalId: principalId
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiUserRoleId)
      principalType: 'ServicePrincipal'
      description: 'Project Managed Identity - AI User at hub scope'
    }
  }
]
