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
  ],
  vnets: [
    { name: "vnet-foundry-hub", prefix: "10.0.0.0/16", role: "hub" },
    { name: "vnet-foundry-finance", prefix: "10.1.0.0/16", role: "spoke" },
    { name: "vnet-foundry-marketing", prefix: "10.2.0.0/16", role: "spoke" },
    { name: "vnet-foundry-engineering", prefix: "10.3.0.0/16", role: "spoke" },
  ],
  policies: [
    { name: "Disable local authentication", status: "Audit", icon: "shield" },
    { name: "Use private link", status: "Audit", icon: "lock" },
    { name: "Require businessUnit tag", status: "Audit", icon: "tag" },
    { name: "Restrict network access", status: "Audit", icon: "network" },
  ],
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
