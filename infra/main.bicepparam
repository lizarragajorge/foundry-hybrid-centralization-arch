using 'main.bicep'

// ─── Global Configuration ───────────────────────────────────────────────────

param location = 'eastus2'
param environment = 'dev'
param orgPrefix = 'contoso'

param globalTags = {
  project: 'ai-foundry-hybrid'
  costCenter: 'AI-CoE'
  deployedBy: 'bicep-iac'
}

// ─── Centralized AI CoE Hub ─────────────────────────────────────────────────

param aiCoeFoundryName = 'contoso-foundry-hub-dev'
param disableLocalAuth = true
param hubPublicNetworkAccess = 'Enabled'

// Model deployments managed centrally by AI CoE
param modelDeployments = [
  {
    name: 'gpt-4o'
    modelName: 'gpt-4o'
    modelVersion: '2024-08-06'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 30
  }
  {
    name: 'gpt-4o-mini'
    modelName: 'gpt-4o-mini'
    modelVersion: '2024-07-18'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 60
  }
  {
    name: 'text-embedding-3-large'
    modelName: 'text-embedding-3-large'
    modelVersion: '1'
    modelFormat: 'OpenAI'
    skuName: 'Standard'
    skuCapacity: 120
  }
]

// ─── Federated Business Unit Spokes ─────────────────────────────────────────

param businessUnits = [
  {
    name: 'finance'
    displayName: 'Finance & Risk'
    vnetAddressPrefix: '10.1.0.0/16'
    appSubnetPrefix: '10.1.1.0/24'
    peSubnetPrefix: '10.1.2.0/24'
    allowedModels: [
      'gpt-4o'       // Approved for compliance reasoning
      'gpt-4o-mini'  // Approved for summarization
    ]
  }
  {
    name: 'marketing'
    displayName: 'Marketing & Sales'
    vnetAddressPrefix: '10.2.0.0/16'
    appSubnetPrefix: '10.2.1.0/24'
    peSubnetPrefix: '10.2.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Cost-efficient content gen
      'text-embedding-3-large'   // Semantic search
    ]
  }
  {
    name: 'engineering'
    displayName: 'Engineering & Product'
    vnetAddressPrefix: '10.3.0.0/16'
    appSubnetPrefix: '10.3.1.0/24'
    peSubnetPrefix: '10.3.2.0/24'
    allowedModels: [
      'gpt-4o'                   // Code review
      'gpt-4o-mini'              // Automation
      'text-embedding-3-large'   // RAG pipelines
      'external-model-sim'       // Simulated external model (routes to gpt-4o-mini via APIM rewrite)
    ]
  }
  {
    name: 'operations'
    displayName: 'Operations & Supply Chain'
    vnetAddressPrefix: '10.4.0.0/16'
    appSubnetPrefix: '10.4.1.0/24'
    peSubnetPrefix: '10.4.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Process automation
      'text-embedding-3-large'   // Document search
    ]
  }
  {
    name: 'legal'
    displayName: 'Legal & Compliance'
    vnetAddressPrefix: '10.5.0.0/16'
    appSubnetPrefix: '10.5.1.0/24'
    peSubnetPrefix: '10.5.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Contract review
    ]
  }
  {
    name: 'eu-compliance'
    displayName: 'EU Compliance & Privacy'
    vnetAddressPrefix: '10.6.0.0/16'
    appSubnetPrefix: '10.6.1.0/24'
    peSubnetPrefix: '10.6.2.0/24'
    allowedModels: [
      'gpt-4o'                   // GDPR analysis requires premium reasoning
      'gpt-4o-mini'              // Routine compliance checks
    ]
  }
  {
    name: 'eu-sales'
    displayName: 'EU Sales & Marketing'
    vnetAddressPrefix: '10.7.0.0/16'
    appSubnetPrefix: '10.7.1.0/24'
    peSubnetPrefix: '10.7.2.0/24'
    allowedModels: [
      'gpt-4o-mini'              // Content generation
      'text-embedding-3-large'   // Customer search
    ]
  }
]

// ─── Governance ─────────────────────────────────────────────────────────────

// Replace with your Entra ID group object IDs
param adminGroupIds = [
  // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  // AI CoE Admins
]
param projectManagerGroupIds = [
  // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  // BU Project Managers
]
param developerGroupIds = [
  // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'  // BU Developers
]

param policyEnforcementMode = 'DoNotEnforce' // Start with audit-only, switch to 'Default' for enforcement

// ─── Monitoring ─────────────────────────────────────────────────────────────

param alertEmails = [
  // 'ai-coe-admins@contoso.com'
]
param logRetentionDays = 90

// ─── Private Endpoints ──────────────────────────────────────────────────────

param enablePrivateEndpoints = false // Set to true + hubPublicNetworkAccess = 'Disabled' for production

// ─── AI Gateway (APIM) ──────────────────────────────────────────────────────

param enableAiGateway = true
param apimPublisherEmail = '' // Set to your APIM publisher email before deploying
param apimSku = 'BasicV2'
param defaultBuRateLimitTPM = 0 // 0 = unlimited; set per-BU TPM quota (e.g., 10000)
