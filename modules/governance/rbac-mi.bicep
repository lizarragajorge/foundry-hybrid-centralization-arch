// ============================================================================
// Single Managed Identity RBAC Assignment
// Assigns Azure AI User role to a single managed identity at Hub scope
// ============================================================================

@description('Resource ID of the Foundry resource (hub)')
param foundryResourceId string

@description('Principal ID of the managed identity')
param principalId string

@description('Description for the role assignment')
param roleDescription string = 'Managed Identity - AI User at hub scope'

// Azure AI User role
var aiUserRoleId = '53ca6127-db72-4b80-b1b0-d745d6d5456d'

resource miRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryResourceId, principalId, aiUserRoleId, 'mi')
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiUserRoleId)
    principalType: 'ServicePrincipal'
    description: roleDescription
  }
}
