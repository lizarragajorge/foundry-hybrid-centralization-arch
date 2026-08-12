// Demo app hosting — Azure App Service (Linux, Node) with a system-assigned
// managed identity. DefaultAzureCredential in the app auto-selects this MI in
// the cloud, so no code changes are needed versus local `az login`.

@description('Azure region')
param location string

@description('Tags applied to hosting resources')
param tags object = {}

@description('Globally-unique Web App name')
param appName string

@description('App Service Plan SKU')
param skuName string = 'B1'

@description('App settings (environment variables) for the demo app')
param appSettings settingItem[] = []

@description('Log Analytics workspace ID for diagnostics (empty = skip)')
param logAnalyticsWorkspaceId string = ''

type settingItem = {
  name: string
  value: string
}

var buildSettings settingItem[] = [
  { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
  { name: 'ENABLE_ORYX_BUILD', value: 'true' }
  { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
]

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-${appName}'
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource site 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  tags: union(tags, { role: 'demo-app' })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npm run start'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      alwaysOn: true
      appSettings: concat(buildSettings, appSettings)
    }
  }
}

resource siteDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: 'diag-${appName}'
  scope: site
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
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

@description('Web App name')
output webAppName string = site.name

@description('Web App default hostname')
output defaultHostName string = site.properties.defaultHostName

@description('Web App URL')
output webAppUrl string = 'https://${site.properties.defaultHostName}'

@description('Web App system-assigned managed identity principal ID')
output principalId string = site.identity.principalId
