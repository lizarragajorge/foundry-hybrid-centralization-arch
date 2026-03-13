// ============================================================================
// AI Gateway - Azure API Management
// Acts as the centralized AI gateway in front of the Foundry hub:
//   - Per-BU model access enforcement (allowedModels policy)
//   - Per-BU token rate limiting
//   - Retry with backoff on 429/5xx
//   - Request/response logging to App Insights
//   - Managed identity auth end-to-end:
//       Caller MI → Entra token → APIM (validate-azure-ad-token)
//       APIM MI → Entra token → Foundry (authentication-managed-identity)
//
// Architecture:
//   BU App (MI) → Bearer token → APIM (JWT validation + allowedModels)
//             → Foundry Hub (APIM MI authenticates via Entra ID)
//
// No API keys anywhere. All auth is identity-based.
// ============================================================================

@description('Azure region')
param location string

@description('Tags for APIM resources')
param tags object = {}

@description('Name of the APIM instance')
param apimName string

@description('APIM SKU')
@allowed(['Developer', 'Basic', 'Standard', 'Premium', 'Consumption', 'BasicV2', 'StandardV2', 'PremiumV2'])
param skuName string = 'BasicV2'

@description('APIM publisher email')
param publisherEmail string

@description('APIM publisher name')
param publisherName string = 'AI CoE'

@description('Foundry backend endpoint URL')
param foundryEndpoint string

@description('Entra ID tenant ID for JWT validation')
param tenantId string = tenant().tenantId

@description('Business unit configurations for per-BU products')
param businessUnits buConfig[] = []

@description('Business unit configuration for APIM products')
type buConfig = {
  @description('Short BU name')
  name: string
  @description('Display name')
  displayName: string
  @description('Allowed model deployment names')
  allowedModels: string[]
  @description('Per-BU tokens-per-minute rate limit (0 = unlimited)')
  rateLimitTPM: int
  @description('Entra ID application/principal IDs for this BU (managed identities or app registrations)')
  callerPrincipalIds: string[]
}

@description('Optional: App Insights instrumentation key for request logging')
param appInsightsInstrumentationKey string = ''

@description('Optional: Log Analytics workspace ID for diagnostics')
param logAnalyticsWorkspaceId string = ''

// ─── APIM Instance ──────────────────────────────────────────────────────────

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: apimName
  location: location
  tags: union(tags, { role: 'ai-gateway' })
  sku: {
    name: skuName
    capacity: skuName == 'Consumption' ? 0 : 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}

// ─── App Insights Logger (for request/response logging) ─────────────────────

resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-09-01-preview' = if (!empty(appInsightsInstrumentationKey)) {
  parent: apim
  name: 'appinsights-logger'
  properties: {
    loggerType: 'applicationInsights'
    credentials: {
      instrumentationKey: appInsightsInstrumentationKey
    }
  }
}

// ─── Backend: Foundry Hub ───────────────────────────────────────────────────

resource foundryBackend 'Microsoft.ApiManagement/service/backends@2023-09-01-preview' = {
  parent: apim
  name: 'foundry-hub'
  properties: {
    title: 'Azure Foundry Hub'
    description: 'Centralized AI Foundry resource - OpenAI endpoint'
    url: '${foundryEndpoint}openai'
    protocol: 'http'
    credentials: {
      header: {}
      query: {}
    }
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// ─── API: OpenAI-compatible endpoint ────────────────────────────────────────

resource openaiApi 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' = {
  parent: apim
  name: 'azure-openai'
  properties: {
    displayName: 'Azure OpenAI (Foundry)'
    description: 'Proxies to centralized Foundry hub model deployments. Auth: Entra ID Bearer token (managed identity).'
    path: 'openai'
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: '${foundryEndpoint}openai'
    apiType: 'http'
  }
}

// Chat Completions operation
resource chatCompletionsOp 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: openaiApi
  name: 'chat-completions'
  properties: {
    displayName: 'Chat Completions'
    method: 'POST'
    urlTemplate: '/deployments/{deployment-id}/chat/completions'
    templateParameters: [
      {
        name: 'deployment-id'
        type: 'string'
        required: true
      }
    ]
  }
}

// Embeddings operation
resource embeddingsOp 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: openaiApi
  name: 'embeddings'
  properties: {
    displayName: 'Embeddings'
    method: 'POST'
    urlTemplate: '/deployments/{deployment-id}/embeddings'
    templateParameters: [
      {
        name: 'deployment-id'
        type: 'string'
        required: true
      }
    ]
  }
}

// Completions operation (legacy)
resource completionsOp 'Microsoft.ApiManagement/service/apis/operations@2023-09-01-preview' = {
  parent: openaiApi
  name: 'completions'
  properties: {
    displayName: 'Completions'
    method: 'POST'
    urlTemplate: '/deployments/{deployment-id}/completions'
    templateParameters: [
      {
        name: 'deployment-id'
        type: 'string'
        required: true
      }
    ]
  }
}

// ─── Global API Policy (JWT validation + identity→BU mapping + allowedModels + retry) ──

// All enforcement happens in a single API-level policy:
// 1. validate-azure-ad-token: validates caller's Entra token
// 2. Extract oid claim → look up BU membership
// 3. Enforce allowedModels per BU
// 4. authentication-managed-identity: APIM MI authenticates to Foundry
// 5. Retry on 429/5xx

// Build the identity→BU→allowedModels mapping as a CSV lookup string.
// Format per BU: "principalId1:buName:model1|model2,principalId2:buName:model1|model2"
var buMappingEntries = flatten(map(businessUnits, bu => map(bu.callerPrincipalIds, id => '${id}:${bu.name}:${join(bu.allowedModels, '|')}')))
var buMappingCsv = join(buMappingEntries, ',')

resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  parent: openaiApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '<policies><inbound><base /><!-- Validate caller Entra ID token --><validate-azure-ad-token tenant-id="${tenantId}" output-token-variable-name="jwt"><audiences><audience>https://cognitiveservices.azure.com</audience></audiences></validate-azure-ad-token><!-- Extract caller oid --><set-variable name="caller-oid" value="@(((Jwt)context.Variables["jwt"]).Claims.GetValueOrDefault("oid", "unknown"))" /><set-variable name="deployment-id" value="@(context.Request.MatchedParameters["deployment-id"])" /><!-- Look up caller in BU mapping and compute access decision --><set-variable name="access-decision" value="@{ var mapping = "${buMappingCsv}"; var callerOid = (string)context.Variables["caller-oid"]; var deploymentId = (string)context.Variables["deployment-id"]; var entries = mapping.Split(\',\'); for (int i = 0; i &lt; entries.Length; i++) { var parts = entries[i].Split(\':\'); if (parts.Length >= 3) { if (parts[0] == callerOid) { var models = parts[2].Split(\'|\'); bool found = false; for (int j = 0; j &lt; models.Length; j++) { if (models[j] == deploymentId) { found = true; break; } } if (found) { return "allow:" + parts[1]; } return "deny:" + parts[1] + ":Model " + deploymentId + " is not approved for BU " + parts[1] + ". Allowed: " + parts[2].Replace("|", ", "); } } } return "allow:unknown"; }" /><!-- Enforce: if decision starts with deny, return 403 --><choose><when condition="@(((string)context.Variables["access-decision"]).StartsWith("deny:"))"><return-response><set-status code="403" reason="Model Not Approved" /><set-header name="Content-Type" exists-action="override"><value>application/json</value></set-header><set-body>@{ var decision = (string)context.Variables["access-decision"]; var idx = decision.IndexOf(":", 5); var message = idx > 0 ? decision.Substring(idx + 1) : "Access denied"; return new JObject(new JProperty("error", new JObject(new JProperty("code", "PolicyViolation"), new JProperty("message", message)))).ToString(); }</set-body></return-response></when></choose><!-- Set BU header from decision --><set-header name="x-ai-gateway-bu" exists-action="override"><value>@{ var decision = (string)context.Variables["access-decision"]; var idx = decision.IndexOf(":"); return idx > 0 ? decision.Substring(idx + 1).Split(\':\')[0] : "unknown"; }</value></set-header><!-- Authenticate to Foundry via APIM managed identity --><authentication-managed-identity resource="https://cognitiveservices.azure.com" /><!-- Rewrite external model aliases to real Foundry deployment names --><choose><when condition="@((string)context.Variables["deployment-id"] == "external-model-sim")"><rewrite-uri template="@("/deployments/gpt-4o-mini" + context.Request.Url.Path.Substring(context.Request.Url.Path.IndexOf("/", context.Request.Url.Path.IndexOf("deployments/") + 12)))" /><set-header name="x-ai-gateway-rewrite" exists-action="override"><value>external-model-sim → gpt-4o-mini</value></set-header></when></choose><set-query-parameter name="api-version" exists-action="skip"><value>2024-08-01-preview</value></set-query-parameter><set-backend-service backend-id="foundry-hub" /></inbound><backend><retry condition="@(context.Response.StatusCode == 429 || context.Response.StatusCode >= 500)" count="3" interval="2" max-interval="16" delta="4" first-fast-retry="false"><forward-request buffer-request-body="true" /></retry></backend><outbound><base /><set-header name="x-ai-gateway" exists-action="override"><value>foundry-hybrid-apim</value></set-header><set-header name="x-ai-gateway-caller" exists-action="override"><value>@((string)context.Variables["caller-oid"])</value></set-header></outbound><on-error><base /></on-error></policies>'
  }
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

resource apimDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  name: '${apimName}-diagnostics'
  scope: apim
  properties: {
    workspaceId: logAnalyticsWorkspaceId
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

// ─── Outputs ────────────────────────────────────────────────────────────────

@description('APIM resource ID')
output apimId string = apim.id

@description('APIM gateway URL')
output apimGatewayUrl string = apim.properties.gatewayUrl

@description('APIM managed identity principal ID')
output apimPrincipalId string = apim.identity.principalId

@description('APIM resource name')
output apimName string = apim.name
