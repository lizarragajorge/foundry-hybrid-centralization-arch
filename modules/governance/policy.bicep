// ============================================================================
// Governance - Azure Policy Assignments
// Enforces centralized governance over federated BU spokes:
//   - Restrict allowed model families
//   - Enforce Entra ID authentication (disable local auth)
//   - Enforce tagging standards
//   - Restrict public network access
// ============================================================================

@description('Target scope resource group or subscription for policy assignment')
param location string

@description('Whether to enforce policies or just audit')
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'

// Policy: Cognitive Services should disable local auth
resource policyDisableLocalAuth 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-disable-local-auth'
  location: location
  properties: {
    displayName: 'Foundry - Disable local authentication'
    description: 'Enforce Microsoft Entra ID authentication for all Foundry resources'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/71ef260a-8f18-47b7-abcb-62d0673d94dc'
    enforcementMode: enforcementMode
    parameters: {}
  }
}

// Policy: Cognitive Services should use private link
resource policyPrivateLink 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-private-link'
  location: location
  properties: {
    displayName: 'Foundry - Use private link'
    description: 'Audit that Foundry resources use private link connections'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/cddd188c-4b82-4c48-a19d-ddf74ee66a01'
    enforcementMode: enforcementMode
    parameters: {}
  }
}

// Policy: Require tags on resource groups
resource policyRequireTags 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-require-bu-tag'
  location: location
  properties: {
    displayName: 'Foundry - Require businessUnit tag'
    description: 'Require a businessUnit tag on all resource groups for cost tracking'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/96670d01-0a4d-4649-9c89-2d3abc0a5025'
    enforcementMode: enforcementMode
    parameters: {
      tagName: {
        value: 'businessUnit'
      }
    }
  }
}

// Policy: Cognitive Services accounts should restrict network access
resource policyNetworkAccess 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-restrict-network'
  location: location
  properties: {
    displayName: 'Foundry - Restrict network access'
    description: 'Audit that Cognitive Services accounts restrict public network access'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/0725b4dd-7e76-479c-a735-68e7ee23d5ca'
    enforcementMode: enforcementMode
    parameters: {}
  }
}

@description('Policy assignment IDs')
output policyAssignmentIds string[] = [
  policyDisableLocalAuth.id
  policyPrivateLink.id
  policyRequireTags.id
  policyNetworkAccess.id
]
