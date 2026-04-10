using 'main.bicep'

// ─── Global Configuration ───────────────────────────────────────────────────
// Sub 2: US West — Operations & Legal
// Region: westus3

param location = 'westus3'
param environment = 'dev'
param orgPrefix = 'contoso'

param globalTags = {
  project: 'ai-foundry-hybrid'
  costCenter: 'AI-CoE'
  deployedBy: 'bicep-iac'
  region: 'us-west'
}

// ─── Centralized AI CoE Hub (West) ──────────────────────────────────────────

param aiCoeFoundryName = 'contoso-foundry-hub-west-dev'
param disableLocalAuth = true
param hubPublicNetworkAccess = 'Enabled'

// Leaner model set for these BUs — gpt-4o-mini for cost efficiency
param modelDeployments = [
  {
    name: 'gpt-4o-mini'
    modelName: 'gpt-4o-mini'
    modelVersion: '2024-07-18'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 40
  }
  {
    name: 'text-embedding-3-large'
    modelName: 'text-embedding-3-large'
    modelVersion: '1'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 60
  }
]

// ─── Federated Business Unit Spokes ─────────────────────────────────────────

param businessUnits = [
  {
    name: 'operations'
    displayName: 'Operations & Supply Chain'
    vnetAddressPrefix: '10.1.0.0/16'
    appSubnetPrefix: '10.1.1.0/24'
    peSubnetPrefix: '10.1.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Process automation
      'text-embedding-3-large'   // Document search
    ]
  }
  {
    name: 'legal'
    displayName: 'Legal & Compliance'
    vnetAddressPrefix: '10.2.0.0/16'
    appSubnetPrefix: '10.2.1.0/24'
    peSubnetPrefix: '10.2.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Contract review
    ]
  }
]

// ─── Governance ─────────────────────────────────────────────────────────────

param adminGroupIds = []
param projectManagerGroupIds = []
param developerGroupIds = []

param policyEnforcementMode = 'DoNotEnforce'

// ─── Monitoring ─────────────────────────────────────────────────────────────

param alertEmails = []
param logRetentionDays = 90

// ─── Private Endpoints ──────────────────────────────────────────────────────

param enablePrivateEndpoints = false

// ─── AI Gateway (APIM) ──────────────────────────────────────────────────────
// No local APIM — traffic routes through the central APIM in Sub 1

param enableAiGateway = false
param apimPublisherEmail = ''
param apimSku = 'BasicV2'
param defaultBuRateLimitTPM = 0
