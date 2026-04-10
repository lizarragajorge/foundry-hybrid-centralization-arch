import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";

// ============================================================================
// Policy Activity API — streams real-time policy evaluation events
//
// Queries:
//   1. Policy events (evaluations that happened on resources)
//   2. Remediation deployments (DINE/Modify actions in-flight or completed)
//   3. Compliance state snapshots per policy
//
// Used by the PolicyLiveMonitor component for real-time governance visibility.
// ============================================================================

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || "";

// Subscription IDs are loaded from environment variables.
// Set AZURE_SUBSCRIPTION_IDS as a JSON array, e.g.:
//   [{"id":"...","name":"US East (Hub)","region":"eastus2"}, ...]
// Falls back to AZURE_SUBSCRIPTION_ID as a single-sub default.
const SUBSCRIPTIONS: Array<{ id: string; name: string; region: string }> = (() => {
  const envSubs = process.env.AZURE_SUBSCRIPTION_IDS;
  if (envSubs) {
    try { return JSON.parse(envSubs); } catch { /* fall through */ }
  }
  if (SUBSCRIPTION_ID) {
    return [{ id: SUBSCRIPTION_ID, name: process.env.AZURE_SUBSCRIPTION_NAME || "Primary", region: process.env.AZURE_REGION || "eastus2" }];
  }
  return [];
})();

type PolicyEvent = {
  id: string;
  timestamp: string;
  policyName: string;
  effect: string;
  compliance: "compliant" | "noncompliant" | "remediated" | "in-progress";
  resourceName: string;
  resourceType: string;
  subscription: string;
  subscriptionId: string;
  details: string;
};

type RemediationTask = {
  id: string;
  policyName: string;
  status: "Evaluating" | "InProgress" | "Succeeded" | "Failed" | "Canceled";
  deploymentId: string;
  resourceCount: number;
  createdOn: string;
  lastUpdatedOn: string;
  subscription: string;
};

export async function GET() {
  try {
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");
    const headers = {
      Authorization: `Bearer ${tokenResponse.token}`,
      "Content-Type": "application/json",
    };

    const events: PolicyEvent[] = [];
    const remediations: RemediationTask[] = [];
    const complianceByPolicy: Record<string, { compliant: number; nonCompliant: number; exempt: number; effect: string }> = {};

    for (const sub of SUBSCRIPTIONS) {
      // ── 1. Policy Events (last 2 hours) ─────────────────────────────────
      try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const eventsUrl = `https://management.azure.com/subscriptions/${sub.id}/providers/Microsoft.PolicyInsights/policyEvents/default/queryResults?api-version=2019-10-01&$top=50&$orderby=timestamp desc&$filter=timestamp ge datetime'${twoHoursAgo}' and (policyDefinitionAction eq 'deployifnotexists' or policyDefinitionAction eq 'modify' or policyDefinitionAction eq 'deny' or policyDefinitionAction eq 'audit')`;

        const eventsRes = await fetch(eventsUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          for (const evt of eventsData.value || []) {
            const assignmentName: string = (evt.policyAssignmentId || "").split("/").pop() || "";
            const isFoundryPolicy = assignmentName.match(/^(foundry-|mg-ai-|mg-foundry-)/);
            if (isFoundryPolicy) {
              events.push({
                id: evt.policyEventId || `${sub.id}-${events.length}`,
                timestamp: evt.timestamp || new Date().toISOString(),
                policyName: assignmentName
                  .replace(/^(foundry-|mg-ai-|mg-foundry-)/, "")
                  .replace(/-/g, " ")
                  .replace(/^\w/, (c: string) => c.toUpperCase()),
                effect: evt.policyDefinitionAction || "unknown",
                compliance: evt.isCompliant ? "compliant" : "noncompliant",
                resourceName: (evt.resourceId || "").split("/").pop() || "unknown",
                resourceType: evt.resourceType || "unknown",
                subscription: sub.name,
                subscriptionId: sub.id,
                details: evt.policyDefinitionAction === "deployifnotexists"
                  ? `DINE triggered: will auto-remediate ${(evt.resourceId || "").split("/").pop()}`
                  : evt.policyDefinitionAction === "modify"
                    ? `Modify triggered: patching ${(evt.resourceId || "").split("/").pop()}`
                    : `Policy evaluated: ${evt.isCompliant ? "compliant" : "non-compliant"}`,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[policy-activity] Events error for ${sub.id}:`, err instanceof Error ? err.message : err);
      }

      // ── 2. Remediation tasks (DINE/Modify deployments) ──────────────────
      try {
        const remediationsUrl = `https://management.azure.com/subscriptions/${sub.id}/providers/Microsoft.PolicyInsights/remediations?api-version=2021-10-01&$top=20`;
        const remRes = await fetch(remediationsUrl, { headers });

        if (remRes.ok) {
          const remData = await remRes.json();
          for (const rem of remData.value || []) {
            const assignmentName: string = (rem.properties?.policyAssignmentId || "").split("/").pop() || "";
            const isFoundryRemediation = assignmentName.match(/^(foundry-|mg-ai-|mg-foundry-)/);
            if (isFoundryRemediation) {
              const status = rem.properties?.provisioningState || "Unknown";
              remediations.push({
                id: rem.name || `rem-${remediations.length}`,
                policyName: assignmentName
                  .replace(/^(foundry-|mg-ai-|mg-foundry-)/, "")
                  .replace(/-/g, " ")
                  .replace(/^\w/, (c: string) => c.toUpperCase()),
                status: status as RemediationTask["status"],
                deploymentId: rem.properties?.deploymentStatus?.totalDeployments || 0,
                resourceCount: rem.properties?.deploymentStatus?.totalDeployments || 0,
                createdOn: rem.properties?.createdOn || "",
                lastUpdatedOn: rem.properties?.lastUpdatedOn || "",
                subscription: sub.name,
              });

              // Add remediation events to the events feed
              if (status === "Succeeded") {
                events.push({
                  id: `rem-${rem.name}`,
                  timestamp: rem.properties?.lastUpdatedOn || new Date().toISOString(),
                  policyName: assignmentName.replace(/^(foundry-|mg-ai-|mg-foundry-)/, "").replace(/-/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()),
                  effect: "remediation",
                  compliance: "remediated",
                  resourceName: `${rem.properties?.deploymentStatus?.totalDeployments || 0} resources`,
                  resourceType: "Remediation Task",
                  subscription: sub.name,
                  subscriptionId: sub.id,
                  details: `Remediation completed: ${rem.properties?.deploymentStatus?.successfulDeployments || 0} resources fixed`,
                });
              } else if (status === "Evaluating" || status === "InProgress") {
                events.push({
                  id: `rem-active-${rem.name}`,
                  timestamp: rem.properties?.lastUpdatedOn || new Date().toISOString(),
                  policyName: assignmentName.replace(/^(foundry-|mg-ai-|mg-foundry-)/, "").replace(/-/g, " ").replace(/^\w/, (c: string) => c.toUpperCase()),
                  effect: "remediation",
                  compliance: "in-progress",
                  resourceName: `${rem.properties?.deploymentStatus?.totalDeployments || 0} resources`,
                  resourceType: "Remediation Task",
                  subscription: sub.name,
                  subscriptionId: sub.id,
                  details: `Remediation in progress: ${status}`,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error(`[policy-activity] Remediations error for ${sub.id}:`, err instanceof Error ? err.message : err);
      }

      // ── 3. Per-policy compliance state ──────────────────────────────────
      try {
        const summaryUrl = `https://management.azure.com/subscriptions/${sub.id}/providers/Microsoft.PolicyInsights/policyStates/latest/summarize?api-version=2019-10-01`;
        const summaryRes = await fetch(summaryUrl, { method: "POST", headers, body: JSON.stringify({}) });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const assignments = summaryData.value?.[0]?.policyAssignments || [];

          for (const assignment of assignments) {
            const assignmentId: string = assignment.policyAssignmentId || "";
            const assignmentName = assignmentId.split("/").pop() || "";
            const isFoundry = assignmentName.match(/^(foundry-|mg-ai-|mg-foundry-)/);
            if (isFoundry) {
              const displayName = assignmentName
                .replace(/^(foundry-|mg-ai-|mg-foundry-)/, "")
                .replace(/-/g, " ")
                .replace(/^\w/, (c: string) => c.toUpperCase());

              if (!complianceByPolicy[displayName]) {
                complianceByPolicy[displayName] = { compliant: 0, nonCompliant: 0, exempt: 0, effect: "" };
              }
              complianceByPolicy[displayName].compliant += assignment.results?.compliantResources || 0;
              complianceByPolicy[displayName].nonCompliant += assignment.results?.nonCompliantResources || 0;

              // Determine effect from policy definition reference
              const defRef = assignment.policyDefinitions?.[0];
              if (defRef?.effect) {
                complianceByPolicy[displayName].effect = defRef.effect;
              }
            }
          }
        }
      } catch (err) {
        console.error(`[policy-activity] Summary error for ${sub.id}:`, err instanceof Error ? err.message : err);
      }
    }

    // Sort events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Build summary stats
    const dineEvents = events.filter(e => e.effect === "deployifnotexists" || e.effect === "remediation");
    const modifyEvents = events.filter(e => e.effect === "modify");
    const auditEvents = events.filter(e => e.effect === "audit");
    const denyEvents = events.filter(e => e.effect === "deny");

    return NextResponse.json({
      events: events.slice(0, 100), // Last 100 events
      remediations,
      complianceByPolicy,
      summary: {
        totalEvents: events.length,
        dineActions: dineEvents.length,
        modifyActions: modifyEvents.length,
        auditFindings: auditEvents.length,
        denyBlocks: denyEvents.length,
        activeRemediations: remediations.filter(r => r.status === "InProgress" || r.status === "Evaluating").length,
        completedRemediations: remediations.filter(r => r.status === "Succeeded").length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
