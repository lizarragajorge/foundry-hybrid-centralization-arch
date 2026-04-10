// ============================================================================
// Policy #1: Standard Foundry Control Plane Governance
//
// Purpose: Automatically deploy/enforce a standardized governance
// configuration on every Foundry resource (Microsoft.CognitiveServices/
// accounts with kind=AIServices). This ensures:
//   - Diagnostic settings → central Log Analytics   (DINE — child resource)
//   - disableLocalAuth = true                       (Modify — same resource)
//   - Network ACLs hardened                         (Modify — same resource)
//
// Effect selection rationale:
//   DINE   → for diagnostic settings (a *child* resource that may not exist)
//   Modify → for disableLocalAuth and network config (properties on the
//            *same* resource — DINE's existenceCondition would always find
//            the resource and never trigger remediation)
//
// Scope: Subscription or Management Group
// ============================================================================

targetScope = 'subscription'

@description('Location for policy assignment managed identity')
param location string

@description('Log Analytics Workspace resource ID for centralized observability')
param logAnalyticsWorkspaceId string

@description('Enforcement mode for the policy')
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'

// ─── Custom Policy Definition: DINE Diagnostic Settings ─────────────────────
// Ensures every Foundry resource has diagnostic settings pointing to
// the central Log Analytics workspace.
resource policyDefDiagnostics 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-dine-diagnostics'
  properties: {
    displayName: 'Foundry - Deploy diagnostic settings for AI Services'
    description: 'Automatically deploy diagnostic settings on all Microsoft.CognitiveServices/accounts (AIServices) to send logs and metrics to the central Log Analytics workspace.'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      category: 'AI Governance'
      version: '1.0.0'
    }
    parameters: {
      logAnalyticsWorkspaceId: {
        type: 'String'
        metadata: {
          displayName: 'Log Analytics Workspace ID'
          description: 'Resource ID of the central Log Analytics workspace'
        }
      }
      effect: {
        type: 'String'
        defaultValue: 'DeployIfNotExists'
        allowedValues: [
          'DeployIfNotExists'
          'Disabled'
        ]
        metadata: {
          displayName: 'Effect'
          description: 'Enable or disable the policy'
        }
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts'
          }
          {
            field: 'kind'
            equals: 'AIServices'
          }
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'
        details: {
          type: 'Microsoft.Insights/diagnosticSettings'
          name: 'foundry-central-diagnostics'
          roleDefinitionIds: [
            // Log Analytics Contributor
            '/providers/Microsoft.Authorization/roleDefinitions/92aaf0da-9dab-42b6-94a3-d43ce8d16293'
            // Monitoring Contributor
            '/providers/Microsoft.Authorization/roleDefinitions/749f88d5-cbae-40b8-bcfc-e573ddc772fa'
          ]
          existenceCondition: {
            allOf: [
              {
                field: 'Microsoft.Insights/diagnosticSettings/workspaceId'
                equals: '[parameters(\'logAnalyticsWorkspaceId\')]'
              }
              {
                field: 'Microsoft.Insights/diagnosticSettings/logs.enabled'
                equals: 'true'
              }
            ]
          }
          deployment: {
            properties: {
              mode: 'incremental'
              template: {
                '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#'
                contentVersion: '1.0.0.0'
                parameters: {
                  resourceName: {
                    type: 'string'
                  }
                  resourceId: {
                    type: 'string'
                  }
                  logAnalyticsWorkspaceId: {
                    type: 'string'
                  }
                }
                resources: [
                  {
                    type: 'Microsoft.CognitiveServices/accounts/providers/diagnosticSettings'
                    apiVersion: '2021-05-01-preview'
                    name: '[concat(parameters(\'resourceName\'), \'/Microsoft.Insights/foundry-central-diagnostics\')]'
                    properties: {
                      workspaceId: '[parameters(\'logAnalyticsWorkspaceId\')]'
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
                ]
              }
              parameters: {
                resourceName: {
                  value: '[field(\'name\')]'
                }
                resourceId: {
                  value: '[field(\'id\')]'
                }
                logAnalyticsWorkspaceId: {
                  value: '[parameters(\'logAnalyticsWorkspaceId\')]'
                }
              }
            }
          }
        }
      }
    }
  }
}

// ─── Custom Policy Definition: Modify Disable Local Auth ────────────────────
// Ensures every Foundry resource has local auth disabled (Zero Trust).
// Uses Modify effect (not DINE) because disableLocalAuth is a property on
// the same resource — DINE requires a *related* child/extension resource.
resource policyDefDisableLocalAuth 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-modify-disable-local-auth'
  properties: {
    displayName: 'Foundry - Modify disableLocalAuth on AI Services'
    description: 'Automatically set disableLocalAuth=true on all Foundry resources to enforce Entra ID authentication.'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      category: 'AI Governance'
      version: '2.0.0'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Modify'
        allowedValues: [
          'Modify'
          'Disabled'
        ]
        metadata: {
          displayName: 'Effect'
          description: 'Enable or disable the policy'
        }
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts'
          }
          {
            field: 'kind'
            equals: 'AIServices'
          }
          {
            field: 'Microsoft.CognitiveServices/accounts/disableLocalAuth'
            notEquals: true
          }
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'
        details: {
          roleDefinitionIds: [
            // Cognitive Services Contributor
            '/providers/Microsoft.Authorization/roleDefinitions/25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68'
          ]
          conflictEffect: 'audit'
          operations: [
            {
              operation: 'addOrReplace'
              field: 'Microsoft.CognitiveServices/accounts/disableLocalAuth'
              value: true
            }
          ]
        }
      }
    }
  }
}

// ─── Custom Policy Definition: Modify Network Hardening ────────────────────
// Ensures Foundry resources have public network access disabled and
// network ACLs set to Deny by default.
// Uses Modify effect (not DINE) because publicNetworkAccess and networkAcls
// are properties on the same resource.
resource policyDefNetworkHarden 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-modify-network-harden'
  properties: {
    displayName: 'Foundry - Modify network hardening on AI Services'
    description: 'Automatically set publicNetworkAccess=Disabled and default ACL=Deny on Foundry resources.'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      category: 'AI Governance'
      version: '2.0.0'
    }
    parameters: {
      effect: {
        type: 'String'
        defaultValue: 'Modify'
        allowedValues: [
          'Modify'
          'Disabled'
        ]
        metadata: {
          displayName: 'Effect'
          description: 'Enable or disable the policy'
        }
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts'
          }
          {
            field: 'kind'
            equals: 'AIServices'
          }
          {
            anyOf: [
              {
                field: 'Microsoft.CognitiveServices/accounts/publicNetworkAccess'
                notEquals: 'Disabled'
              }
              {
                field: 'Microsoft.CognitiveServices/accounts/networkAcls.defaultAction'
                notEquals: 'Deny'
              }
            ]
          }
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'
        details: {
          roleDefinitionIds: [
            '/providers/Microsoft.Authorization/roleDefinitions/25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68'
          ]
          conflictEffect: 'audit'
          operations: [
            {
              operation: 'addOrReplace'
              field: 'Microsoft.CognitiveServices/accounts/publicNetworkAccess'
              value: 'Disabled'
            }
            {
              operation: 'addOrReplace'
              field: 'Microsoft.CognitiveServices/accounts/networkAcls.defaultAction'
              value: 'Deny'
            }
          ]
        }
      }
    }
  }
}

// ─── Policy Initiative (Policy Set) ─────────────────────────────────────────
// Groups all control plane DINE policies into a single initiative for
// easy assignment at MG or subscription scope.
resource policySetControlPlane 'Microsoft.Authorization/policySetDefinitions@2024-05-01' = {
  name: 'foundry-controlplane-initiative'
  properties: {
    displayName: 'Foundry - Standard Control Plane Governance'
    description: 'Initiative that auto-configures every Foundry resource in the subscription with: diagnostics → central LAW (DINE), disableLocalAuth (Modify), network hardening (Modify).'
    policyType: 'Custom'
    metadata: {
      category: 'AI Governance'
      version: '1.0.0'
    }
    parameters: {
      logAnalyticsWorkspaceId: {
        type: 'String'
        metadata: {
          displayName: 'Log Analytics Workspace ID'
          description: 'Central Log Analytics workspace for all Foundry diagnostics'
        }
      }
    }
    policyDefinitions: [
      {
        policyDefinitionId: policyDefDiagnostics.id
        parameters: {
          logAnalyticsWorkspaceId: {
            value: '[parameters(\'logAnalyticsWorkspaceId\')]'
          }
        }
      }
      {
        policyDefinitionId: policyDefDisableLocalAuth.id
        parameters: {}
      }
      {
        policyDefinitionId: policyDefNetworkHarden.id
        parameters: {}
      }
    ]
  }
}

// ─── Policy Assignment ──────────────────────────────────────────────────────
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-controlplane-dine'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'Foundry - Auto-deploy standard control plane governance'
    description: 'Automatically deploys diagnostic settings, disables local auth, and hardens networking on all Foundry resources in this scope.'
    policyDefinitionId: policySetControlPlane.id
    enforcementMode: enforcementMode
    parameters: {
      logAnalyticsWorkspaceId: {
        value: logAnalyticsWorkspaceId
      }
    }
  }
}

// ─── Role Assignments for DINE Managed Identity ─────────────────────────────
// The DINE policy needs permissions to deploy resources on remediation.

// Log Analytics Contributor
resource roleLogAnalytics 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyAssignment.id, '92aaf0da-9dab-42b6-94a3-d43ce8d16293')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '92aaf0da-9dab-42b6-94a3-d43ce8d16293')
    principalId: policyAssignment.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Monitoring Contributor
resource roleMonitoring 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyAssignment.id, '749f88d5-cbae-40b8-bcfc-e573ddc772fa')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '749f88d5-cbae-40b8-bcfc-e573ddc772fa')
    principalId: policyAssignment.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Cognitive Services Contributor
resource roleCogSvc 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyAssignment.id, '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68')
    principalId: policyAssignment.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Policy initiative definition ID')
output policySetDefinitionId string = policySetControlPlane.id

@description('Policy assignment ID')
output policyAssignmentId string = policyAssignment.id

@description('Managed identity principal ID (for role assignments at broader scope)')
output managedIdentityPrincipalId string = policyAssignment.identity.principalId
