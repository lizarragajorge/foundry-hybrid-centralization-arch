// ============================================================================
// Centralized AI CoE - Microsoft Foundry Resource (Hub)
// Resource Type: Microsoft.CognitiveServices/accounts (kind: AIServices)
// This is the top-level governance boundary for the AI Center of Excellence.
// It manages model deployments, compute, policies, and observability centrally.
// ============================================================================

@description('Name of the Foundry resource (AI CoE hub)')
@minLength(2)
@maxLength(64)
param foundryName string

@description('Azure region for the Foundry resource')
param location string

@description('Custom subdomain name for token-based authentication')
param customSubDomainName string = foundryName

@description('SKU name for the Foundry resource')
@allowed(['S0'])
param skuName string = 'S0'

@description('Whether to enable public network access')
@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Enabled'

@description('Whether to disable local (API key) authentication in favor of Entra ID')
param disableLocalAuth bool = false

@description('Tags to apply to all resources')
param tags object = {}

@description('Optional: Resource ID of a customer-managed Key Vault for encryption')
param customerManagedKeyVaultId string = ''

@description('Optional: Key name in Key Vault for CMK encryption')
param customerManagedKeyName string = ''

@description('Optional: Log Analytics workspace ID for diagnostics')
param logAnalyticsWorkspaceId string = ''

// Foundry Resource (Centralized Hub)
resource foundryResource 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: foundryName
  location: location
  kind: 'AIServices'
  tags: union(tags, {
    pattern: 'hybrid-centralized'
    role: 'ai-coe-hub'
  })
  sku: {
    name: skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: customSubDomainName
    publicNetworkAccess: publicNetworkAccess
    disableLocalAuth: disableLocalAuth
    allowProjectManagement: true
    networkAcls: {
      defaultAction: publicNetworkAccess == 'Disabled' ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
    encryption: !empty(customerManagedKeyVaultId) ? {
      keySource: 'Microsoft.KeyVault'
      keyVaultProperties: {
        keyVaultUri: 'https://${last(split(customerManagedKeyVaultId, '/'))}.${az.environment().suffixes.keyvaultDns}'
        keyName: customerManagedKeyName
      }
    } : null
  }
}

// Diagnostic settings for observability
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: '${foundryName}-diagnostics'
  scope: foundryResource
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

@description('The resource ID of the Foundry resource')
output foundryResourceId string = foundryResource.id

@description('The name of the Foundry resource')
output foundryResourceName string = foundryResource.name

@description('The endpoint of the Foundry resource')
output foundryEndpoint string = foundryResource.properties.endpoint

@description('The principal ID of the system-assigned managed identity')
output foundryPrincipalId string = foundryResource.identity.principalId

@description('The tenant ID of the system-assigned managed identity')
output foundryTenantId string = foundryResource.identity.tenantId
