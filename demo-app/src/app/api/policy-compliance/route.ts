import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";

// Query Azure Policy compliance state across all subscriptions in the management group.
// Set AZURE_SUBSCRIPTION_IDS env var as JSON array, e.g.:
//   [{"id":"...","name":"US East (Hub)","region":"eastus2"}, ...]
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

const FOUNDRY_POLICIES = [
  "mg-ai-disable-auth",
  "mg-foundry-private-link",
  "mg-ai-require-bu-tag",
  "mg-ai-restrict-network",
  "mg-ai-allowed-models",
  // Also include sub-level assignments from Bicep
  "foundry-disable-local-auth",
  "foundry-private-link",
  "foundry-require-bu-tag",
  "foundry-restrict-network",
  "foundry-allowed-models",
  // New DINE/Modify policies
  "foundry-controlplane-dine",
  "foundry-guardrails-dine",
  "foundry-asset-guardrail",
  "foundry-dine-diagnostics",
  "foundry-dine-disable-local-auth",
  "foundry-dine-network-harden",
  "foundry-dine-standard-guardrails",
  "foundry-modify-enforce-guardrail",
  "foundry-audit-missing-guardrail",
];

export async function GET() {
  try {
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");

    const results: Array<{
      subscription: string;
      subscriptionId: string;
      region: string;
      policies: Array<{
        name: string;
        displayName: string;
        compliance: "compliant" | "noncompliant" | "unknown";
        nonCompliantResources: number;
        scope: string;
      }>;
    }> = [];

    for (const sub of SUBSCRIPTIONS) {
      const policies: Array<{
        name: string;
        displayName: string;
        compliance: "compliant" | "noncompliant" | "unknown";
        nonCompliantResources: number;
        scope: string;
      }> = [];

      try {
        // Get policy compliance summary for this subscription
        const summaryUrl = `https://management.azure.com/subscriptions/${sub.id}/providers/Microsoft.PolicyInsights/policyStates/latest/summarize?api-version=2019-10-01`;
        const summaryRes = await fetch(summaryUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResponse.token}`,
            "Content-Type": "application/json",
          },
        });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const assignments = summaryData.value?.[0]?.policyAssignments || [];

          for (const assignment of assignments) {
            const assignmentId: string = assignment.policyAssignmentId || "";
            const assignmentName = assignmentId.split("/").pop() || "";
            // Match any policy with foundry/mg-ai/mg-foundry in the name
            const isFoundryPolicy = assignmentName.match(/^(foundry-|mg-ai-|mg-foundry-)/);
            if (isFoundryPolicy) {
              const nonCompliant = assignment.results?.nonCompliantResources || 0;
              const isMgScope = assignmentId.includes("managementGroups");
              policies.push({
                name: assignmentName,
                displayName: assignmentName
                  .replace("mg-ai-", "")
                  .replace("mg-foundry-", "")
                  .replace("foundry-", "")
                  .replace(/-/g, " ")
                  .replace(/^\w/, (c: string) => c.toUpperCase()),
                compliance: nonCompliant === 0 ? "compliant" : "noncompliant",
                nonCompliantResources: nonCompliant,
                scope: isMgScope ? "Management Group" : "Subscription",
              });
            }
          }
        }
      } catch (err) {
        console.error(`[policy] Error querying sub ${sub.id}:`, err instanceof Error ? err.message : err);
      }

      results.push({
        subscription: sub.name,
        subscriptionId: sub.id,
        region: sub.region,
        policies,
      });
    }

    // Compute summary
    const totalPolicies = results.reduce((sum, r) => sum + r.policies.length, 0);
    const compliantCount = results.reduce((sum, r) => sum + r.policies.filter(p => p.compliance === "compliant").length, 0);
    const nonCompliantCount = results.reduce((sum, r) => sum + r.policies.filter(p => p.compliance === "noncompliant").length, 0);

    return NextResponse.json({
      managementGroup: "Contoso AI Governance",
      subscriptions: results,
      summary: {
        totalPolicies,
        compliant: compliantCount,
        nonCompliant: nonCompliantCount,
        complianceRate: totalPolicies > 0 ? Math.round((compliantCount / totalPolicies) * 100) : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
