// ============================================================================
// Monitoring - Metric Alert Rules
// Deployed AFTER the Foundry resource exists so we can scope alerts to it.
// Requires an action group from the observability module.
// ============================================================================

@description('Name prefix for alert resources')
param namePrefix string = 'foundry'

@description('Tags for alert resources')
param tags object = {}

@description('Foundry resource ID to scope alerts to')
param foundryResourceId string

@description('Action group ID for alert notifications')
param actionGroupId string

// Alert: High Latency (average > 5 seconds over 15 min window)
resource alertHighLatency 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-alert-high-latency'
  location: 'global'
  tags: tags
  properties: {
    description: 'Foundry API average latency exceeds 5 seconds'
    severity: 2
    enabled: true
    scopes: [foundryResourceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighLatency'
          metricName: 'Latency'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          operator: 'GreaterThan'
          threshold: 5000
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// Alert: High Server Error Rate (> 5 errors in 15 min)
resource alertErrorRate 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-alert-error-rate'
  location: 'global'
  tags: tags
  properties: {
    description: 'Foundry API server error count exceeds threshold'
    severity: 1
    enabled: true
    scopes: [foundryResourceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighServerErrors'
          metricName: 'ServerErrors'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// Alert: TPM Throttling (> 10 client errors / 429s in 15 min)
resource alertThrottling 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-alert-throttling'
  location: 'global'
  tags: tags
  properties: {
    description: 'Foundry API is being throttled (HTTP 429 — increase TPM quota)'
    severity: 2
    enabled: true
    scopes: [foundryResourceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ThrottledRequests'
          metricName: 'ClientErrors'
          metricNamespace: 'Microsoft.CognitiveServices/accounts'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}
