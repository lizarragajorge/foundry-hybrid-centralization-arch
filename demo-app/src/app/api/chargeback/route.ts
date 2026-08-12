import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { displayBU } from "@/lib/business-units";

// Cross-subscription chargeback via the Azure Cost Management Query API.
// Returns ACTUAL billed cost (month-to-date), grouped by the `businessUnit`
// tag and by service, across every subscription in the management group.
//
// Requires the app identity to have "Cost Management Reader" (or Reader) at
// each subscription (or the management group) scope.
//
// Config:
//   AZURE_SUBSCRIPTION_IDS  JSON array: [{"id":"...","name":"US East (Hub)","region":"eastus2"}, ...]
//   AZURE_SUBSCRIPTION_ID   fallback single subscription
//   AZURE_CHARGEBACK_TAG    tag key used for BU allocation (default: businessUnit)

const SUBSCRIPTIONS: Array<{ id: string; name: string; region: string }> = (() => {
  const envSubs = process.env.AZURE_SUBSCRIPTION_IDS;
  if (envSubs) {
    try { return JSON.parse(envSubs); } catch { /* fall through */ }
  }
  const subId = process.env.AZURE_SUBSCRIPTION_ID || "";
  if (subId) {
    return [{ id: subId, name: process.env.AZURE_SUBSCRIPTION_NAME || "Primary", region: process.env.AZURE_REGION || "eastus2" }];
  }
  return [];
})();

const BU_TAG = process.env.AZURE_CHARGEBACK_TAG || "businessUnit";

type QueryColumn = { name: string; type: string };

function colIndex(columns: QueryColumn[], candidates: string[]): number {
  for (const cand of candidates) {
    const idx = columns.findIndex((c) => c.name?.toLowerCase() === cand.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

async function querySubscription(
  token: string,
  sub: { id: string; name: string; region: string }
): Promise<{
  billed: number;
  currency: string;
  rows: Array<{ businessUnit: string; displayName: string; service: string; billed: number }>;
  error?: string;
}> {
  const url = `https://management.azure.com/subscriptions/${sub.id}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;
  const body = {
    type: "ActualCost",
    timeframe: "MonthToDate",
    dataset: {
      granularity: "None",
      aggregation: {
        totalCost: { name: "Cost", function: "Sum" },
      },
      grouping: [
        { type: "TagKey", name: BU_TAG },
        { type: "Dimension", name: "ServiceName" },
      ],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { billed: 0, currency: "USD", rows: [], error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }

  const data = await res.json();
  const columns: QueryColumn[] = data.properties?.columns || [];
  const rawRows: unknown[][] = data.properties?.rows || [];

  const costIdx = colIndex(columns, ["Cost", "PreTaxCost", "CostUSD"]);
  const tagIdx = colIndex(columns, [BU_TAG, "TagValue"]);
  const serviceIdx = colIndex(columns, ["ServiceName"]);
  const currencyIdx = colIndex(columns, ["Currency", "BillingCurrency", "CurrencyCode"]);

  let currency = "USD";
  let billed = 0;
  const rows: Array<{ businessUnit: string; displayName: string; service: string; billed: number }> = [];

  for (const r of rawRows) {
    const cost = costIdx !== -1 ? Number(r[costIdx]) || 0 : 0;
    const tagVal = tagIdx !== -1 ? (r[tagIdx] as string | null) : null;
    const service = serviceIdx !== -1 ? String(r[serviceIdx] ?? "Unknown") : "Unknown";
    if (currencyIdx !== -1 && r[currencyIdx]) currency = String(r[currencyIdx]);
    billed += cost;
    rows.push({
      businessUnit: tagVal || "untagged",
      displayName: displayBU(tagVal ?? null),
      service,
      billed: cost,
    });
  }

  return { billed, currency, rows };
}

export async function GET() {
  try {
    if (SUBSCRIPTIONS.length === 0) {
      return NextResponse.json({
        available: false,
        reason: "No subscriptions configured. Set AZURE_SUBSCRIPTION_IDS or AZURE_SUBSCRIPTION_ID.",
        subscriptions: [],
        byBU: [],
        byService: [],
        totalBilled: 0,
        currency: "USD",
        timestamp: new Date().toISOString(),
      });
    }

    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    const subResults: Array<{
      id: string;
      name: string;
      region: string;
      billed: number;
      error?: string;
    }> = [];

    const buMap = new Map<string, { displayName: string; billed: number; subscriptions: Set<string> }>();
    const serviceMap = new Map<string, number>();
    let currency = "USD";
    let anySuccess = false;
    const errors: string[] = [];

    for (const sub of SUBSCRIPTIONS) {
      try {
        const result = await querySubscription(tokenResponse.token, sub);
        if (result.error) {
          subResults.push({ id: sub.id, name: sub.name, region: sub.region, billed: 0, error: result.error });
          errors.push(`${sub.name}: ${result.error}`);
          continue;
        }
        anySuccess = true;
        currency = result.currency || currency;
        subResults.push({ id: sub.id, name: sub.name, region: sub.region, billed: result.billed });

        for (const row of result.rows) {
          const key = row.displayName;
          const existing = buMap.get(key) || { displayName: row.displayName, billed: 0, subscriptions: new Set<string>() };
          existing.billed += row.billed;
          existing.subscriptions.add(sub.name);
          buMap.set(key, existing);

          serviceMap.set(row.service, (serviceMap.get(row.service) || 0) + row.billed);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        subResults.push({ id: sub.id, name: sub.name, region: sub.region, billed: 0, error: msg });
        errors.push(`${sub.name}: ${msg}`);
      }
    }

    const byBU = Array.from(buMap.values())
      .map((b) => ({ businessUnit: b.displayName, billed: b.billed, subscriptions: Array.from(b.subscriptions) }))
      .sort((a, b) => b.billed - a.billed);

    const byService = Array.from(serviceMap.entries())
      .map(([service, billed]) => ({ service, billed }))
      .sort((a, b) => b.billed - a.billed);

    const totalBilled = subResults.reduce((s, r) => s + r.billed, 0);

    return NextResponse.json({
      available: anySuccess,
      reason: anySuccess
        ? undefined
        : `Cost Management query failed for all subscriptions. Ensure the app identity has "Cost Management Reader". ${errors.join(" | ")}`,
      tag: BU_TAG,
      timeframe: "MonthToDate",
      currency,
      totalBilled,
      subscriptions: subResults,
      byBU,
      byService,
      errors: errors.length ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ available: false, reason: message, error: message }, { status: 500 });
  }
}
