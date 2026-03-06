// ============================================================================
// Networking - Private Endpoints & DNS Zones
// Optional module to deploy Private Endpoints for Foundry and Key Vault
// with corresponding Private DNS Zones and VNet links.
//
// Usage: Set `enablePrivateEndpoints = true` in main.bicepparam to activate.
// Requires `hubPublicNetworkAccess = 'Disabled'` for full effect.
// ============================================================================

@description('Azure region')
param location string

@description('Tags for PE resources')
param tags object = {}

@description('Name prefix for resources')
param namePrefix string

@description('Resource ID of the Foundry (CognitiveServices) resource')
param foundryResourceId string

@description('Resource ID of the Key Vault')
param keyVaultId string

@description('Subnet ID for deploying Private Endpoints (hub PE subnet)')
param privateEndpointSubnetId string

@description('VNet IDs to link to Private DNS Zones (hub + all spokes)')
param vnetIdsForDnsLink string[]

// ─── Private DNS Zones ──────────────────────────────────────────────────────

resource dnsZoneCognitiveServices 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  tags: tags
}

resource dnsZoneOpenAI 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource dnsZoneKeyVault 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

// ─── VNet Links (link each VNet to each DNS zone) ───────────────────────────

resource cogServicesVnetLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for (vnetId, i) in vnetIdsForDnsLink: {
    parent: dnsZoneCognitiveServices
    name: 'link-cogservices-${i}'
    location: 'global'
    tags: tags
    properties: {
      virtualNetwork: { id: vnetId }
      registrationEnabled: false
    }
  }
]

resource openAIVnetLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for (vnetId, i) in vnetIdsForDnsLink: {
    parent: dnsZoneOpenAI
    name: 'link-openai-${i}'
    location: 'global'
    tags: tags
    properties: {
      virtualNetwork: { id: vnetId }
      registrationEnabled: false
    }
  }
]

resource keyVaultVnetLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for (vnetId, i) in vnetIdsForDnsLink: {
    parent: dnsZoneKeyVault
    name: 'link-keyvault-${i}'
    location: 'global'
    tags: tags
    properties: {
      virtualNetwork: { id: vnetId }
      registrationEnabled: false
    }
  }
]

// ─── Private Endpoints ──────────────────────────────────────────────────────

resource peFoundry 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: '${namePrefix}-pe-foundry'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: '${namePrefix}-plsc-foundry'
        properties: {
          privateLinkServiceId: foundryResourceId
          groupIds: ['account']
        }
      }
    ]
  }
}

resource peFoundryDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: peFoundry
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cognitiveservices'
        properties: {
          privateDnsZoneId: dnsZoneCognitiveServices.id
        }
      }
      {
        name: 'openai'
        properties: {
          privateDnsZoneId: dnsZoneOpenAI.id
        }
      }
    ]
  }
}

resource peKeyVault 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: '${namePrefix}-pe-keyvault'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetId }
    privateLinkServiceConnections: [
      {
        name: '${namePrefix}-plsc-keyvault'
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: ['vault']
        }
      }
    ]
  }
}

resource peKeyVaultDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: peKeyVault
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'keyvault'
        properties: {
          privateDnsZoneId: dnsZoneKeyVault.id
        }
      }
    ]
  }
}

// ─── Outputs ────────────────────────────────────────────────────────────────

@description('Foundry Private Endpoint ID')
output foundryPrivateEndpointId string = peFoundry.id

@description('Key Vault Private Endpoint ID')
output keyVaultPrivateEndpointId string = peKeyVault.id
