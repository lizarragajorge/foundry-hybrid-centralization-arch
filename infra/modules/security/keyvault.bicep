// ============================================================================
// Security - Key Vault & Defender Configuration
// Provides:
//   - Azure Key Vault for connection secrets
//   - Microsoft Defender for AI services
//   - Purview integration readiness
// ============================================================================

@description('Azure region')
param location string

@description('Tags for security resources')
param tags object = {}

@description('Name of the Key Vault')
param keyVaultName string

@description('Tenant ID for Key Vault access policies')
param tenantId string

@description('Principal IDs to grant Key Vault access (Foundry managed identities)')
param accessPrincipalIds string[] = []

@description('Enable purge protection on Key Vault')
param enablePurgeProtection bool = true

@description('Enable soft delete on Key Vault')
param enableSoftDelete bool = true

@description('Soft delete retention in days')
@minValue(7)
@maxValue(90)
param softDeleteRetentionDays int = 90

@description('Optional: Log Analytics workspace ID for diagnostics')
param logAnalyticsWorkspaceId string = ''

// Key Vault for managing connection secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: union(tags, { role: 'security' })
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: enableSoftDelete
    softDeleteRetentionInDays: softDeleteRetentionDays
    enablePurgeProtection: enablePurgeProtection
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// RBAC: Key Vault Secrets User for Foundry managed identities
resource kvSecretUserAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in accessPrincipalIds: {
    name: guid(keyVault.id, principalId, '4633458b-17de-408a-b874-0445c86b69e6')
    scope: keyVault
    properties: {
      principalId: principalId
      // Key Vault Secrets User
      roleDefinitionId: subscriptionResourceId(
        'Microsoft.Authorization/roleDefinitions',
        '4633458b-17de-408a-b874-0445c86b69e6'
      )
      principalType: 'ServicePrincipal'
    }
  }
]

// Key Vault diagnostics
resource kvDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: '${keyVaultName}-diagnostics'
  scope: keyVault
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

@description('Key Vault resource ID')
output keyVaultId string = keyVault.id

@description('Key Vault name')
output keyVaultName string = keyVault.name

@description('Key Vault URI')
output keyVaultUri string = keyVault.properties.vaultUri
