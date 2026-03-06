// ============================================================================
// Federated BU Spoke - Microsoft Foundry Project
// Resource Type: Microsoft.CognitiveServices/accounts/projects
// Each Business Unit gets its own Foundry Project scoped under the
// centralized Foundry Resource, providing isolation for:
//   - Agents, Tools, Shared Connections
//   - Guardrails & Evaluations
//   - Observability (project-scoped metrics)
// ============================================================================

@description('Name of the parent Foundry resource (centralized hub)')
param foundryName string

@description('Name of the Foundry project for this Business Unit')
param projectName string

@description('Azure region (must match the parent Foundry resource)')
param location string

@description('Display name for the project (stored as tag)')
param projectDisplayName string = projectName

@description('Tags to apply to the project')
param tags object = {}

@description('Business unit identifier for cost tracking and governance')
param businessUnit string

@description('Environment designation')
@allowed(['dev', 'test', 'staging', 'prod'])
param environment string = 'dev'

@description('Optional: Log Analytics workspace ID for project-level diagnostics')
param logAnalyticsWorkspaceId string = ''

// Reference the parent Foundry resource
resource foundryResource 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryName
}

// Foundry Project (BU Spoke)
resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: foundryResource
  name: projectName
  location: location
  tags: union(tags, {
    pattern: 'hybrid-federated'
    role: 'bu-spoke'
    businessUnit: businessUnit
    environment: environment
    displayName: projectDisplayName
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

// Diagnostic settings for project-level observability
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: '${projectName}-diagnostics'
  scope: foundryProject
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

@description('The resource ID of the Foundry project')
output projectId string = foundryProject.id

@description('The name of the Foundry project')
output projectName string = foundryProject.name

@description('The principal ID of the project managed identity')
output projectPrincipalId string = foundryProject.identity.principalId
