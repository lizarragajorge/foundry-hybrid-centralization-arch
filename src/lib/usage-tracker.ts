// Session-level usage tracker for real per-BU cost attribution
// Every API call through the app logs here for live cost tracking

export type UsageRecord = {
  id: string;
  timestamp: string;
  bu: string;
  model: string;
  deployment: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  source: "simulation" | "arena" | "loadtest" | "trace";
};

// Cost rates per 1K tokens (Azure pricing March 2026)
export const MODEL_PRICING: Record<string, { prompt: number; completion: number; label: string; color: string }> = {
  "gpt-4o": { prompt: 0.005, completion: 0.015, label: "GPT-4o", color: "#8b5cf6" },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006, label: "GPT-4o-mini", color: "#3b82f6" },
  "text-embedding-3-large": { prompt: 0.00013, completion: 0, label: "Embedding-3-Large", color: "#06b6d4" },
};

export const BU_META: Record<string, { color: string; displayName: string }> = {
  "Finance & Risk": { color: "#10b981", displayName: "Finance & Risk" },
  "Marketing & Sales": { color: "#3b82f6", displayName: "Marketing & Sales" },
  "Engineering & Product": { color: "#f59e0b", displayName: "Engineering & Product" },
  "Finance": { color: "#10b981", displayName: "Finance & Risk" },
  "Marketing": { color: "#3b82f6", displayName: "Marketing & Sales" },
  "Engineering": { color: "#f59e0b", displayName: "Engineering & Product" },
};

export function calcCost(deployment: string, promptTokens: number, completionTokens: number): number {
  const rate = MODEL_PRICING[deployment];
  if (!rate) return 0;
  return (promptTokens / 1000) * rate.prompt + (completionTokens / 1000) * rate.completion;
}

// In-memory store (resets on page reload — intentional for demo)
let usageRecords: UsageRecord[] = [];
let listeners: Array<() => void> = [];

export function addUsageRecord(record: Omit<UsageRecord, "id">) {
  usageRecords = [{ ...record, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...usageRecords];
  listeners.forEach((fn) => fn());
}

export function getUsageRecords(): UsageRecord[] {
  return usageRecords;
}

export function clearUsageRecords() {
  usageRecords = [];
  listeners.forEach((fn) => fn());
}

export function subscribeUsage(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

// Aggregation helpers
export function aggregateByBU(records: UsageRecord[]) {
  const map = new Map<string, { cost: number; tokens: number; calls: number; successCalls: number }>();
  for (const r of records) {
    const bu = BU_META[r.bu]?.displayName || r.bu;
    const existing = map.get(bu) || { cost: 0, tokens: 0, calls: 0, successCalls: 0 };
    existing.cost += calcCost(r.deployment, r.promptTokens, r.completionTokens);
    existing.tokens += r.totalTokens;
    existing.calls += 1;
    if (r.success) existing.successCalls += 1;
    map.set(bu, existing);
  }
  return Array.from(map.entries()).map(([bu, data]) => ({
    bu,
    color: BU_META[bu]?.color || "#6366f1",
    ...data,
  }));
}

export function aggregateByModel(records: UsageRecord[]) {
  const map = new Map<string, { cost: number; tokens: number; calls: number }>();
  for (const r of records) {
    const existing = map.get(r.deployment) || { cost: 0, tokens: 0, calls: 0 };
    existing.cost += calcCost(r.deployment, r.promptTokens, r.completionTokens);
    existing.tokens += r.totalTokens;
    existing.calls += 1;
    map.set(r.deployment, existing);
  }
  return Array.from(map.entries()).map(([model, data]) => ({
    model,
    label: MODEL_PRICING[model]?.label || model,
    color: MODEL_PRICING[model]?.color || "#6366f1",
    ...data,
  }));
}

export function aggregateBySource(records: UsageRecord[]) {
  const map = new Map<string, { cost: number; tokens: number; calls: number }>();
  for (const r of records) {
    const existing = map.get(r.source) || { cost: 0, tokens: 0, calls: 0 };
    existing.cost += calcCost(r.deployment, r.promptTokens, r.completionTokens);
    existing.tokens += r.totalTokens;
    existing.calls += 1;
    map.set(r.source, existing);
  }
  return Array.from(map.entries()).map(([source, data]) => ({ source, ...data }));
}
