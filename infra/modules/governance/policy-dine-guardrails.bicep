// ============================================================================
// Policy #2: DeployIfNotExists — Standard Guardrails (raiPolicy)
//
// Purpose: Automatically deploy a standardized raiPolicy (Responsible AI
// content filter policy) on every Foundry resource in the subscription.
// This ensures all Foundry accounts have enterprise-standard guardrails
// before any model deployment can reference them.
//
// What it deploys:
//   - Enterprise-standard raiPolicy with:
//     • Hate/Sexual/Violence/Self-harm filters at Medium threshold
//     • Protected Material (Text + Code) blocking enabled
//     • Jailbreak detection enabled
//     • Indirect attack detection enabled
//     • Profanity filter enabled
//
// Effect: DeployIfNotExists
//   When a CognitiveServices account (AIServices) exists WITHOUT an
//   raiPolicy named 'enterprise-standard', the policy deploys one.
//
// Scope: Subscription or Management Group
// ============================================================================

targetScope = 'subscription'

@description('Location for policy assignment managed identity')
param location string

@description('Enforcement mode for the policy')
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'

@description('Name for the standard raiPolicy deployed on every Foundry resource')
param standardRaiPolicyName string = 'enterprise-standard'

@description('Severity threshold for hate/sexual/violence/self-harm filters (Low=most strict, High=least strict)')
@allowed(['Low', 'Medium', 'High'])
param contentFilterSeverity string = 'Medium'

// ─── Custom Policy Definition: DINE Standard raiPolicy ──────────────────────
resource policyDefGuardrails 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-dine-standard-guardrails'
  properties: {
    displayName: 'Foundry - Deploy standard RAI guardrails on AI Services'
    description: 'Automatically deploy an enterprise-standard raiPolicy (content filters) on all Foundry resources. Ensures hate, sexual, violence, self-harm, protected material, jailbreak, and profanity filters are configured.'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      category: 'AI Governance'
      version: '1.0.0'
    }
    parameters: {
      raiPolicyName: {
        type: 'String'
        defaultValue: 'enterprise-standard'
        metadata: {
          displayName: 'RAI Policy Name'
          description: 'Name of the standard raiPolicy to deploy'
        }
      }
      severityThreshold: {
        type: 'String'
        defaultValue: 'Medium'
        allowedValues: [
          'Low'
          'Medium'
          'High'
        ]
        metadata: {
          displayName: 'Content Filter Severity'
          description: 'Severity threshold for content category filters'
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
          type: 'Microsoft.CognitiveServices/accounts/raiPolicies'
          name: '[parameters(\'raiPolicyName\')]'
          roleDefinitionIds: [
            // Cognitive Services Contributor
            '/providers/Microsoft.Authorization/roleDefinitions/25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68'
          ]
          existenceCondition: {
            field: 'name'
            equals: '[parameters(\'raiPolicyName\')]'
          }
          deployment: {
            properties: {
              mode: 'incremental'
              template: {
                '$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#'
                contentVersion: '1.0.0.0'
                parameters: {
                  accountName: {
                    type: 'string'
                  }
                  raiPolicyName: {
                    type: 'string'
                  }
                  severityThreshold: {
                    type: 'string'
                  }
                }
                resources: [
                  {
                    type: 'Microsoft.CognitiveServices/accounts/raiPolicies'
                    apiVersion: '2025-06-01'
                    name: '[concat(parameters(\'accountName\'), \'/\', parameters(\'raiPolicyName\'))]'
                    properties: {
                      mode: 'Blocking'
                      basePolicyName: 'Microsoft.DefaultV2'
                      contentFilters: [
                        // ── Category Filters (Prompt + Completion) ──
                        {
                          name: 'Hate'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Prompt'
                        }
                        {
                          name: 'Hate'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Completion'
                        }
                        {
                          name: 'Sexual'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Prompt'
                        }
                        {
                          name: 'Sexual'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Completion'
                        }
                        {
                          name: 'Violence'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Prompt'
                        }
                        {
                          name: 'Violence'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Completion'
                        }
                        {
                          name: 'SelfHarm'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Prompt'
                        }
                        {
                          name: 'SelfHarm'
                          blocking: true
                          enabled: true
                          allowedContentLevel: '[parameters(\'severityThreshold\')]'
                          source: 'Completion'
                        }
                        // ── Protected Material Filters (Completion only) ──
                        {
                          name: 'Protected Material Text'
                          blocking: true
                          enabled: true
                          source: 'Completion'
                        }
                        {
                          name: 'Protected Material Code'
                          blocking: true
                          enabled: true
                          source: 'Completion'
                        }
                        // ── Jailbreak / Prompt Injection (Prompt only) ──
                        {
                          name: 'Jailbreak'
                          blocking: true
                          enabled: true
                          source: 'Prompt'
                        }
                        {
                          name: 'Indirect Attack'
                          blocking: true
                          enabled: true
                          source: 'Prompt'
                        }
                        // ── Profanity (both directions) ──
                        {
                          name: 'Profanity'
                          blocking: true
                          enabled: true
                          source: 'Prompt'
                        }
                        {
                          name: 'Profanity'
                          blocking: true
                          enabled: true
                          source: 'Completion'
                        }
                      ]
                    }
                  }
                ]
              }
              parameters: {
                accountName: {
                  value: '[field(\'name\')]'
                }
                raiPolicyName: {
                  value: '[parameters(\'raiPolicyName\')]'
                }
                severityThreshold: {
                  value: '[parameters(\'severityThreshold\')]'
                }
              }
            }
          }
        }
      }
    }
  }
}

// ─── Policy Assignment ──────────────────────────────────────────────────────
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-guardrails-dine'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'Foundry - Auto-deploy standard RAI guardrails'
    description: 'Deploys enterprise-standard raiPolicy (content filters) on all Foundry resources: hate, sexual, violence, self-harm, protected material, jailbreak, indirect attack, profanity.'
    policyDefinitionId: policyDefGuardrails.id
    enforcementMode: enforcementMode
    parameters: {
      raiPolicyName: {
        value: standardRaiPolicyName
      }
      severityThreshold: {
        value: contentFilterSeverity
      }
    }
  }
}

// ─── Role Assignment for DINE Managed Identity ──────────────────────────────
// Cognitive Services Contributor — needed to create raiPolicies
resource roleCogSvc 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(policyAssignment.id, '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '25fbc0a9-bd7c-42a3-aa1a-3b75d497ee68')
    principalId: policyAssignment.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Policy definition ID')
output policyDefinitionId string = policyDefGuardrails.id

@description('Policy assignment ID')
output policyAssignmentId string = policyAssignment.id

@description('Standard raiPolicy name (reference this in policy #3)')
output standardRaiPolicyName string = standardRaiPolicyName

@description('Managed identity principal ID')
output managedIdentityPrincipalId string = policyAssignment.identity.principalId
