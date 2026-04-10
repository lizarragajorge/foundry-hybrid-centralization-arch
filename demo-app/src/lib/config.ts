// Azure Foundry configuration (server-side only)
export const config = {
  azure: {
    endpoint: process.env.AZURE_FOUNDRY_ENDPOINT || "",
    resourceGroup: process.env.AZURE_FOUNDRY_RESOURCE_GROUP || "",
    foundryName: process.env.AZURE_FOUNDRY_NAME || "",
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || "",
    logAnalyticsWorkspace: process.env.AZURE_LOG_ANALYTICS_WORKSPACE || "",
    monitoringRg: process.env.AZURE_MONITORING_RG || "",
    // AI Gateway (APIM) — when set, catalog-test routes through APIM instead of direct Foundry
    apimGatewayUrl: process.env.AZURE_APIM_GATEWAY_URL || "",
  },
};

// Architecture data model
export const architectureData = {
  hub: {
    name: "contoso-foundry-hub-dev",
    kind: "AIServices",
    location: "eastus2",
    identity: "SystemAssigned",
    endpoint: "https://contoso-foundry-hub-dev.cognitiveservices.azure.com/",
  },
  models: [
    { name: "gpt-4o", version: "2024-08-06", sku: "Standard", tpm: 30, format: "OpenAI" },
    { name: "gpt-4o-mini", version: "2024-07-18", sku: "Standard", tpm: 60, format: "OpenAI" },
    { name: "text-embedding-3-large", version: "1", sku: "Standard", tpm: 120, format: "OpenAI" },
    { name: "external-model-sim", version: "sim", sku: "External", tpm: 0, format: "External (via APIM)" },
  ],
  projects: [
    { name: "contoso-finance-dev", displayName: "Finance & Risk", bu: "finance", color: "#10b981", allowedModels: ["gpt-4o", "gpt-4o-mini"] },
    { name: "contoso-marketing-dev", displayName: "Marketing & Sales", bu: "marketing", color: "#3b82f6", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"] },
    { name: "contoso-engineering-dev", displayName: "Engineering & Product", bu: "engineering", color: "#f59e0b", allowedModels: ["gpt-4o", "gpt-4o-mini", "text-embedding-3-large", "external-model-sim"] },
    { name: "contoso-operations-dev", displayName: "Operations & Supply Chain", bu: "operations", color: "#8b5cf6", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"] },
    { name: "contoso-legal-dev", displayName: "Legal & Compliance", bu: "legal", color: "#ec4899", allowedModels: ["gpt-4o-mini"] },
    { name: "contoso-eu-compliance-dev", displayName: "EU Compliance & Privacy", bu: "eu-compliance", color: "#06b6d4", allowedModels: ["gpt-4o", "gpt-4o-mini"] },
    { name: "contoso-eu-sales-dev", displayName: "EU Sales & Marketing", bu: "eu-sales", color: "#14b8a6", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"] },
  ],
  vnets: [
    { name: "vnet-foundry-hub", prefix: "10.0.0.0/16", role: "hub" },
    { name: "vnet-foundry-finance", prefix: "10.1.0.0/16", role: "spoke" },
    { name: "vnet-foundry-marketing", prefix: "10.2.0.0/16", role: "spoke" },
    { name: "vnet-foundry-engineering", prefix: "10.3.0.0/16", role: "spoke" },
  ],
  policies: [
    { name: "Disable local authentication", status: "Audit", icon: "shield", effect: "Audit", layer: "control-plane" },
    { name: "Use private link", status: "Audit", icon: "lock", effect: "Audit", layer: "control-plane" },
    { name: "Require businessUnit tag", status: "Audit", icon: "tag", effect: "Audit", layer: "control-plane" },
    { name: "Restrict network access", status: "Audit", icon: "network", effect: "Audit", layer: "control-plane" },
    { name: "Only approved AI models", status: "Audit", icon: "shield", effect: "Audit", layer: "control-plane" },
    { name: "DINE: Auto-deploy diagnostics", status: "Enforce", icon: "shield", effect: "DeployIfNotExists", layer: "dine-controlplane" },
    { name: "DINE: Disable local auth", status: "Enforce", icon: "lock", effect: "DeployIfNotExists", layer: "dine-controlplane" },
    { name: "DINE: Network hardening", status: "Enforce", icon: "network", effect: "DeployIfNotExists", layer: "dine-controlplane" },
    { name: "DINE: Standard RAI guardrails", status: "Enforce", icon: "shield", effect: "DeployIfNotExists", layer: "dine-guardrails" },
    { name: "Modify: Enforce guardrail on deployments", status: "Enforce", icon: "shield", effect: "Modify", layer: "modify-assets" },
    { name: "Audit: Missing guardrail", status: "Audit", icon: "shield", effect: "Audit", layer: "modify-assets" },
  ],
  managementGroup: {
    name: "Contoso AI Governance",
    id: "contoso-ai-governance",
    subscriptions: [
      { name: "Subscription-1", id: "sub-hub", region: "eastus2", role: "Hub (Primary)" },
      { name: "Subscription-2", id: "sub-west", region: "westus3", role: "Spoke (US West)" },
      { name: "Subscription-3", id: "sub-eu", region: "swedencentral", role: "Spoke (Europe)" },
    ],
    policies: [
      { name: "Only approved AI models", scope: "Management Group", enforcement: "Audit", description: "Restricts model deployments to gpt-4o, gpt-4o-mini, text-embedding-3-large" },
      { name: "Disable local authentication", scope: "Management Group", enforcement: "Audit", description: "All Foundry resources must use Entra ID — no API keys" },
      { name: "Use private link", scope: "Management Group", enforcement: "Audit", description: "Audit Foundry resources for private endpoint usage" },
      { name: "Require businessUnit tag", scope: "Management Group", enforcement: "Audit", description: "All resource groups must have a businessUnit tag" },
      { name: "Restrict network access", scope: "Management Group", enforcement: "Audit", description: "Audit Cognitive Services for public network access" },
      { name: "DINE: Auto-deploy diagnostics", scope: "Management Group", enforcement: "Enforce", description: "Auto-deploy diagnostic settings → central Log Analytics on all Foundry resources", effect: "DeployIfNotExists" },
      { name: "DINE: Disable local auth", scope: "Management Group", enforcement: "Enforce", description: "Auto-configure disableLocalAuth=true on all Foundry resources", effect: "DeployIfNotExists" },
      { name: "DINE: Network hardening", scope: "Management Group", enforcement: "Enforce", description: "Auto-configure publicNetworkAccess=Disabled and ACL=Deny", effect: "DeployIfNotExists" },
      { name: "DINE: Standard RAI guardrails", scope: "Management Group", enforcement: "Enforce", description: "Auto-deploy enterprise-standard raiPolicy on all Foundry resources", effect: "DeployIfNotExists" },
      { name: "Modify: Enforce guardrail on deployments", scope: "Management Group", enforcement: "Enforce", description: "Auto-set raiPolicyName=enterprise-standard on all model/agent/tool deployments", effect: "Modify" },
      { name: "Audit: Missing guardrail", scope: "Management Group", enforcement: "Audit", description: "Flag deployments without enterprise-standard guardrail", effect: "Audit" },
    ],
  },
  governance: {
    localAuthDisabled: true,
    softDeleteEnabled: true,
    purgeProtection: true,
    rbacAuth: true,
    diagnosticsEnabled: true,
  },
};

export type SimulationScenario = {
  id: string;
  name: string;
  bu: string;
  model: string;
  deployment: string;
  systemPrompt: string;
  userPrompt: string;
  color: string;
};

export const simulationScenarios: SimulationScenario[] = [
  {
    id: "finance-risk",
    name: "Risk Analysis",
    bu: "Finance & Risk",
    model: "GPT-4o",
    deployment: "gpt-4o",
    systemPrompt: "You are a financial risk analyst. Be concise and specific.",
    userPrompt: "Analyze the top 3 risks of adopting GenAI in financial services compliance. Provide a brief risk matrix.",
    color: "#10b981",
  },
  {
    id: "marketing-content",
    name: "Content Generation",
    bu: "Marketing & Sales",
    model: "GPT-4o-mini",
    deployment: "gpt-4o-mini",
    systemPrompt: "You are a creative marketing strategist. Be punchy and engaging.",
    userPrompt: "Create 3 compelling email subject lines and a 2-sentence description for our new AI-powered analytics platform launch.",
    color: "#3b82f6",
  },
  {
    id: "engineering-rag",
    name: "RAG Embedding",
    bu: "Engineering & Product",
    model: "Embedding-3-Large",
    deployment: "text-embedding-3-large",
    systemPrompt: "",
    userPrompt: "Hybrid centralized-federated AI governance architecture with hub-spoke networking and policy-driven model access control",
    color: "#f59e0b",
  },
  {
    id: "finance-forecast",
    name: "Forecast Assistant",
    bu: "Finance & Risk",
    model: "GPT-4o-mini",
    deployment: "gpt-4o-mini",
    systemPrompt: "You are an AI-powered financial forecasting assistant. Use structured data formats.",
    userPrompt: "Generate a Q2 revenue forecast summary with 3 key drivers and confidence intervals. Use markdown table format.",
    color: "#10b981",
  },
  {
    id: "engineering-code",
    name: "Code Review",
    bu: "Engineering & Product",
    model: "GPT-4o",
    deployment: "gpt-4o",
    systemPrompt: "You are a senior software architect reviewing code for security and best practices.",
    userPrompt: "Review this Azure Bicep pattern: A hub-spoke Foundry deployment where projects inherit model deployments from a centralized AIServices resource. What are the security implications?",
    color: "#f59e0b",
  },
];
