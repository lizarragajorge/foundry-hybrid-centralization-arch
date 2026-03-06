// ============================================================================
// Monitoring & Observability
// Centralized observability stack for the hybrid Foundry deployment:
//   - Log Analytics Workspace (shared)
//   - Application Insights (per-project optional)
//   - Azure Monitor action groups for alerting
// ============================================================================

@description('Azure region')
param location string

@description('Tags for monitoring resources')
param tags object = {}

@description('Name prefix for monitoring resources')
param namePrefix string = 'foundry'

@description('Log Analytics retention in days')
@minValue(30)
@maxValue(730)
param retentionInDays int = 90

@description('Log Analytics SKU')
@allowed(['PerGB2018', 'Free', 'Standalone', 'PerNode'])
param logAnalyticsSku string = 'PerGB2018'

@description('Alert notification email addresses')
param alertEmails string[] = []

// Log Analytics Workspace (centralized)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-law'
  location: location
  tags: union(tags, { role: 'observability' })
  properties: {
    sku: {
      name: logAnalyticsSku
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Application Insights (centralized)
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-appi'
  location: location
  tags: union(tags, { role: 'observability' })
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Action Group for alerts
resource actionGroup 'Microsoft.Insights/actionGroups@2023-09-01-preview' = if (!empty(alertEmails)) {
  name: '${namePrefix}-ag'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'foundry'
    enabled: true
    emailReceivers: [
      for (email, i) in alertEmails: {
        name: 'admin-${i}'
        emailAddress: email
        useCommonAlertSchema: true
      }
    ]
  }
}

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id

@description('Log Analytics Workspace name')
output logAnalyticsWorkspaceName string = logAnalytics.name

@description('Application Insights resource ID')
output appInsightsId string = appInsights.id

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString
