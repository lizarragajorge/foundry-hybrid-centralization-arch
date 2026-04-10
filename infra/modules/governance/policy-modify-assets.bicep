// ============================================================================
// Policy #3: Deny + Audit — Enforce raiPolicyName on All Asset Deployments
//
// Purpose: Block any model deployment that doesn't reference the
// enterprise-standard guardrail (raiPolicy) deployed by Policy #2.
// This ensures no model deployment can exist without content safety.
//
// NOTE: Azure Policy's Modify effect does NOT support the
// raiPolicyName alias on CognitiveServices deployments (not modifiable).
// We use Deny instead — stronger enforcement that blocks at deploy-time.
//
// Effects:
//   Deny  — blocks any deployment missing raiPolicyName=enterprise-standard
//   Audit — flags non-compliant deployments for visibility in portal
//
// Targets:
//   - Microsoft.CognitiveServices/accounts/deployments (models, agents, tools)
//
// Scope: Subscription or Management Group
// ============================================================================

targetScope = 'subscription'

@description('Location for policy assignment')
param location string

@description('Enforcement mode for the policy')
@allowed(['Default', 'DoNotEnforce'])
param enforcementMode string = 'Default'

@description('Name of the standard raiPolicy to enforce on all deployments (must match Policy #2 output)')
param standardRaiPolicyName string = 'enterprise-standard'

// ─── Custom Policy Definition: Deny deployments without standard guardrail ──
resource policyDefDenyRai 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-deny-missing-guardrail'
  properties: {
    displayName: 'Foundry - Deny model deployments without standard guardrail'
    description: 'Deny creation/update of CognitiveServices model deployments that do not set raiPolicyName to the enterprise-standard content filter policy. Forces all models, agents, and tools to use approved guardrails.'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      category: 'AI Governance'
      version: '2.0.0'
    }
    parameters: {
      raiPolicyName: {
        type: 'String'
        defaultValue: 'enterprise-standard'
        metadata: {
          displayName: 'RAI Policy Name'
          description: 'Required raiPolicy name on all deployments'
        }
      }
      effect: {
        type: 'String'
        defaultValue: 'Deny'
        allowedValues: [
          'Deny'
          'Audit'
          'Disabled'
        ]
        metadata: {
          displayName: 'Effect'
          description: 'Deny blocks deployment, Audit flags only'
        }
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts/deployments'
          }
          {
            anyOf: [
              {
                field: 'Microsoft.CognitiveServices/accounts/deployments/raiPolicyName'
                exists: false
              }
              {
                field: 'Microsoft.CognitiveServices/accounts/deployments/raiPolicyName'
                notEquals: '[parameters(\'raiPolicyName\')]'
              }
            ]
          }
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'
      }
    }
  }
}

// ─── Custom Policy Definition: Audit deployments missing raiPolicy ──────────
// Companion audit policy so you can see non-compliant deployments in the
// portal even if the Modify hasn't been remediated yet.
resource policyDefAuditRai 'Microsoft.Authorization/policyDefinitions@2024-05-01' = {
  name: 'foundry-audit-missing-guardrail'
  properties: {
    displayName: 'Foundry - Audit model deployments without standard guardrail'
    description: 'Audit any CognitiveServices deployment that does not have raiPolicyName set to the enterprise-standard content filter policy.'
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
          description: 'Expected raiPolicy name on all deployments'
        }
      }
      effect: {
        type: 'String'
        defaultValue: 'Audit'
        allowedValues: [
          'Audit'
          'Disabled'
        ]
        metadata: {
          displayName: 'Effect'
        }
      }
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts/deployments'
          }
          {
            anyOf: [
              {
                field: 'Microsoft.CognitiveServices/accounts/deployments/raiPolicyName'
                exists: false
              }
              {
                field: 'Microsoft.CognitiveServices/accounts/deployments/raiPolicyName'
                notEquals: '[parameters(\'raiPolicyName\')]'
              }
            ]
          }
        ]
      }
      then: {
        effect: '[parameters(\'effect\')]'
      }
    }
  }
}

// ─── Policy Initiative ──────────────────────────────────────────────────────
resource policySetAssetGuardrails 'Microsoft.Authorization/policySetDefinitions@2024-05-01' = {
  name: 'foundry-asset-guardrail-initiative'
  properties: {
    displayName: 'Foundry - Enforce guardrails on all asset deployments'
    description: 'Initiative combining Deny (block deployments without guardrail) and Audit (flag non-compliant) policies for all model/agent/tool deployments.'
    policyType: 'Custom'
    metadata: {
      category: 'AI Governance'
      version: '2.0.0'
    }
    parameters: {
      raiPolicyName: {
        type: 'String'
        defaultValue: 'enterprise-standard'
        metadata: {
          displayName: 'RAI Policy Name'
          description: 'Standard raiPolicy to enforce on all deployments'
        }
      }
    }
    policyDefinitions: [
      {
        policyDefinitionId: policyDefDenyRai.id
        parameters: {
          raiPolicyName: {
            value: '[parameters(\'raiPolicyName\')]'
          }
        }
      }
      {
        policyDefinitionId: policyDefAuditRai.id
        parameters: {
          raiPolicyName: {
            value: '[parameters(\'raiPolicyName\')]'
          }
        }
      }
    ]
  }
}

// ─── Policy Assignment ──────────────────────────────────────────────────────
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'foundry-asset-guardrail'
  location: location
  properties: {
    displayName: 'Foundry - Enforce standard guardrail on all deployments'
    description: 'Denies any model/agent/tool deployment that does not reference raiPolicyName=enterprise-standard. Companion audit policy flags non-compliant deployments.'
    policyDefinitionId: policySetAssetGuardrails.id
    enforcementMode: enforcementMode
    parameters: {
      raiPolicyName: {
        value: standardRaiPolicyName
      }
    }
  }
}

@description('Deny policy definition ID')
output denyPolicyDefinitionId string = policyDefDenyRai.id

@description('Audit policy definition ID')
output auditPolicyDefinitionId string = policyDefAuditRai.id

@description('Initiative definition ID')
output policySetDefinitionId string = policySetAssetGuardrails.id

@description('Policy assignment ID')
output policyAssignmentId string = policyAssignment.id
