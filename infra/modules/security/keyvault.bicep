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

@description('Public network access setting (should match hub posture)')
@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Enabled'

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
    publicNetworkAccess: publicNetworkAccess
    networkAcls: {
      defaultAction: publicNetworkAccess == 'Disabled' ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
  }
}

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
