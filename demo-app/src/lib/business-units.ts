// Canonical Business Unit registry — the single source of truth for the demo.
//
// Consumed by:
//   - lib/config.ts            → architectureData.projects (federated spoke projects)
//   - lib/usage-tracker.ts     → BU_META (per-BU color + display normalization)
//   - app/api/chargeback/route → billed-cost BU allocation / display names
//
// "central" functions (models, identity, policy, Key Vault, networking) are owned
// once by the AI CoE hub; each BusinessUnit below is a *federated* spoke that
// self-serves those central functions inside enforced guardrails.

export type BusinessUnit = {
  id: string;            // short key / cost-allocation tag value, e.g. "finance"
  displayName: string;   // "Finance & Risk"
  color: string;
  project: string;       // Foundry project child-resource name
  allowedModels: string[];
  region: string;
};

export const businessUnits: BusinessUnit[] = [
  { id: "finance", displayName: "Finance & Risk", color: "#10b981", project: "contoso-finance-dev", allowedModels: ["gpt-4o", "gpt-4o-mini"], region: "eastus2" },
  { id: "marketing", displayName: "Marketing & Sales", color: "#3b82f6", project: "contoso-marketing-dev", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"], region: "eastus2" },
  { id: "engineering", displayName: "Engineering & Product", color: "#f59e0b", project: "contoso-engineering-dev", allowedModels: ["gpt-4o", "gpt-4o-mini", "text-embedding-3-large", "external-model-sim"], region: "eastus2" },
  { id: "operations", displayName: "Operations & Supply Chain", color: "#8b5cf6", project: "contoso-operations-dev", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"], region: "eastus2" },
  { id: "legal", displayName: "Legal & Compliance", color: "#ec4899", project: "contoso-legal-dev", allowedModels: ["gpt-4o-mini"], region: "eastus2" },
  { id: "eu-compliance", displayName: "EU Compliance & Privacy", color: "#06b6d4", project: "contoso-eu-compliance-dev", allowedModels: ["gpt-4o", "gpt-4o-mini"], region: "swedencentral" },
  { id: "eu-sales", displayName: "EU Sales & Marketing", color: "#14b8a6", project: "contoso-eu-sales-dev", allowedModels: ["gpt-4o-mini", "text-embedding-3-large"], region: "swedencentral" },
];

const byDisplay = new Map(businessUnits.map((bu) => [bu.displayName, bu]));
const byId = new Map(businessUnits.map((bu) => [bu.id, bu]));
const byFirstWord = new Map(businessUnits.map((bu) => [bu.displayName.split(" ")[0].toLowerCase(), bu]));

// Resolve any raw identifier (id, display name, or capitalized first word such as
// "Finance") to its canonical display name. Null/empty → shared/untagged bucket.
export function displayBU(raw: string | null | undefined): string {
  if (!raw) return "Untagged / Shared";
  if (byDisplay.has(raw)) return raw;
  const key = raw.toLowerCase();
  const match = byId.get(key) || byFirstWord.get(key);
  if (match) return match.displayName;
  return raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Build the per-BU metadata lookup keyed by display name, id, and first word so
// legacy record shapes ("Finance", "finance", "Finance & Risk") all resolve.
export function buildBUMeta(): Record<string, { color: string; displayName: string }> {
  const meta: Record<string, { color: string; displayName: string }> = {};
  for (const bu of businessUnits) {
    const entry = { color: bu.color, displayName: bu.displayName };
    meta[bu.displayName] = entry;
    meta[bu.id] = entry;
    meta[bu.displayName.split(" ")[0]] = entry; // "Finance", "Marketing", "Engineering"…
  }
  return meta;
}
