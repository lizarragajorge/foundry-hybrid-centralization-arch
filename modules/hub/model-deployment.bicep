// ============================================================================
// Centralized AI CoE - Model Deployments
// Manages model endpoints centrally so BU spokes can consume them
// via the Foundry Control Plane.
// ============================================================================

@description('Name of the parent Foundry resource')
param foundryName string

@description('Model deployments to create on the centralized hub')
param modelDeployments modelDeploymentConfig[] = []

@description('Model deployment configuration')
type modelDeploymentConfig = {
  @description('Name of the deployment')
  name: string
  @description('Model name (e.g., gpt-4o, gpt-4o-mini, text-embedding-ada-002)')
  modelName: string
  @description('Model version')
  modelVersion: string
  @description('Model format')
  modelFormat: string
  @description('Deployment SKU name')
  skuName: string
  @description('Tokens-per-minute capacity')
  skuCapacity: int
}

resource foundryResource 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryName
}

@batchSize(1)
resource deployments 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [
  for deployment in modelDeployments: {
    parent: foundryResource
    name: deployment.name
    sku: {
      name: deployment.skuName
      capacity: deployment.skuCapacity
    }
    properties: {
      model: {
        format: deployment.modelFormat
        name: deployment.modelName
        version: deployment.modelVersion
      }
    }
  }
]

@description('Deployed model endpoint names')
output deploymentNames string[] = [for (d, i) in modelDeployments: deployments[i].name]
