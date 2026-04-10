using 'main.bicep'

// ─── Global Configuration ───────────────────────────────────────────────────
// Sub 3: Europe — EU Compliance & EU Sales
// Region: swedencentral (EU data residency)

param location = 'swedencentral'
param environment = 'dev'
param orgPrefix = 'contoso'

param globalTags = {
  project: 'ai-foundry-hybrid'
  costCenter: 'AI-CoE'
  deployedBy: 'bicep-iac'
  region: 'europe'
  dataResidency: 'EU'
}

// ─── Centralized AI CoE Hub (Europe) ────────────────────────────────────────

param aiCoeFoundryName = 'contoso-foundry-hub-eu-dev'
param disableLocalAuth = true
param hubPublicNetworkAccess = 'Enabled'

// EU data residency — models deployed in swedencentral
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
    name: 'gpt-4o'
    modelName: 'gpt-4o'
    modelVersion: '2024-08-06'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 20
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
    name: 'eu-compliance'
    displayName: 'EU Compliance & Privacy'
    vnetAddressPrefix: '10.1.0.0/16'
    appSubnetPrefix: '10.1.1.0/24'
    peSubnetPrefix: '10.1.2.0/24'
    allowedModels: [
      'gpt-4o'                   // GDPR analysis requires premium reasoning
      'gpt-4o-mini'              // Routine compliance checks
    ]
  }
  {
    name: 'eu-sales'
    displayName: 'EU Sales & Marketing'
    vnetAddressPrefix: '10.2.0.0/16'
    appSubnetPrefix: '10.2.1.0/24'
    peSubnetPrefix: '10.2.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Content generation
      'text-embedding-3-large'   // Customer search
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
