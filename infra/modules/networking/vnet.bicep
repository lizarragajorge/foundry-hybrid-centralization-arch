// ============================================================================
// Networking - Hub-Spoke Virtual Network Topology
// Implements the network backbone for the hybrid pattern:
//   - Hub VNet for centralized AI CoE
//   - Spoke VNets for federated BU workloads
//   - VNet peering between hub and spokes
//   - Private Endpoints for Foundry resources
// ============================================================================

@description('Azure region')
param location string

@description('Tags for networking resources')
param tags object = {}

@description('Hub VNet address prefix')
param hubVnetAddressPrefix string = '10.0.0.0/16'

@description('Hub Foundry subnet address prefix')
param hubFoundrySubnetPrefix string = '10.0.1.0/24'

@description('Hub Private Endpoint subnet address prefix')
param hubPrivateEndpointSubnetPrefix string = '10.0.2.0/24'

@description('Hub APIM subnet address prefix (for AI Gateway)')
param hubApimSubnetPrefix string = '10.0.3.0/24'

@description('Whether to deploy the APIM subnet')
param enableApimSubnet bool = false

@description('Spoke VNet configurations')
param spokeVnets spokeVnetConfig[] = []

@description('Spoke VNet configuration type')
type spokeVnetConfig = {
  @description('Name of the spoke VNet')
  name: string
  @description('Address prefix')
  addressPrefix: string
  @description('Application subnet prefix')
  appSubnetPrefix: string
  @description('Private endpoint subnet prefix')
  peSubnetPrefix: string
  @description('Business unit tag')
  businessUnit: string
}

// NSG for Private Endpoints
resource nsgPrivateEndpoints 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'nsg-foundry-pe'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// NSG for Spoke Application Subnets
resource nsgSpokeApp 'Microsoft.Network/networkSecurityGroups@2024-01-01' = {
  name: 'nsg-foundry-spoke-app'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVnetInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: 'VirtualNetwork'
          destinationPortRange: '*'
        }
      }
      {
        name: 'DenyAllInbound'
        properties: {
          priority: 4096
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

// Hub VNet (AI CoE)
resource hubVnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: 'vnet-foundry-hub'
  location: location
  tags: union(tags, { role: 'ai-coe-hub' })
  properties: {
    addressSpace: {
      addressPrefixes: [hubVnetAddressPrefix]
    }
    subnets: concat(
      [
        {
          name: 'snet-foundry'
          properties: {
            addressPrefix: hubFoundrySubnetPrefix
            networkSecurityGroup: {
              id: nsgPrivateEndpoints.id
            }
          }
        }
        {
          name: 'snet-private-endpoints'
          properties: {
            addressPrefix: hubPrivateEndpointSubnetPrefix
            networkSecurityGroup: {
              id: nsgPrivateEndpoints.id
            }
            privateEndpointNetworkPolicies: 'Disabled'
          }
        }
      ],
      enableApimSubnet ? [
        {
          name: 'snet-apim'
          properties: {
            addressPrefix: hubApimSubnetPrefix
            networkSecurityGroup: {
              id: nsgPrivateEndpoints.id
            }
          }
        }
      ] : []
    )
  }
}

// Spoke VNets (BU workloads)
resource spokeVnetResources 'Microsoft.Network/virtualNetworks@2024-01-01' = [
  for spoke in spokeVnets: {
    name: spoke.name
    location: location
    tags: union(tags, {
      role: 'bu-spoke'
      businessUnit: spoke.businessUnit
    })
    properties: {
      addressSpace: {
        addressPrefixes: [spoke.addressPrefix]
      }
      subnets: [
        {
          name: 'snet-app'
          properties: {
            addressPrefix: spoke.appSubnetPrefix
            networkSecurityGroup: {
              id: nsgSpokeApp.id
            }
          }
        }
        {
          name: 'snet-private-endpoints'
          properties: {
            addressPrefix: spoke.peSubnetPrefix
            networkSecurityGroup: {
              id: nsgPrivateEndpoints.id
            }
            privateEndpointNetworkPolicies: 'Disabled'
          }
        }
      ]
    }
  }
]

// VNet Peering: Hub -> Spokes
resource hubToSpokePeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-01-01' = [
  for (spoke, i) in spokeVnets: {
    parent: hubVnet
    name: 'peer-hub-to-${spoke.name}'
    properties: {
      remoteVirtualNetwork: {
        id: spokeVnetResources[i].id
      }
      allowVirtualNetworkAccess: true
      allowForwardedTraffic: true
      allowGatewayTransit: false
      useRemoteGateways: false
    }
  }
]

// VNet Peering: Spokes -> Hub
resource spokeToHubPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-01-01' = [
  for (spoke, i) in spokeVnets: {
    parent: spokeVnetResources[i]
    name: 'peer-${spoke.name}-to-hub'
    properties: {
      remoteVirtualNetwork: {
        id: hubVnet.id
      }
      allowVirtualNetworkAccess: true
      allowForwardedTraffic: true
      allowGatewayTransit: false
      useRemoteGateways: false
    }
  }
]

@description('Hub VNet resource ID')
output hubVnetId string = hubVnet.id

@description('Hub Private Endpoint subnet ID')
output hubPeSubnetId string = hubVnet.properties.subnets[1].id

@description('Spoke VNet resource IDs')
output spokeVnetIds string[] = [for (s, i) in spokeVnets: spokeVnetResources[i].id]
