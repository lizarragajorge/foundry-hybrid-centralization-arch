import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";

export async function GET() {
  try {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || "";
    const resourceGroup = process.env.AZURE_FOUNDRY_RESOURCE_GROUP || "";
    const foundryName = process.env.AZURE_FOUNDRY_NAME || "";

    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken(
      "https://management.azure.com/.default"
    );

    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${foundryName}`;
    const now = new Date();
    const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const endTime = now.toISOString();

    const metricNames = [
      "SuccessfulCalls",
      "TotalCalls",
      "ProcessedPromptTokens",
      "GeneratedTokens",
      "TotalTokens",
      "Latency",
    ];

    const metricsUrl = `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics?api-version=2024-02-01&metricnames=${metricNames.join(",")}&aggregation=Total&interval=PT1H&timespan=${startTime}/${endTime}`;

    const metricsResponse = await fetch(metricsUrl, {
      headers: { Authorization: `Bearer ${tokenResponse.token}` },
    });

    if (!metricsResponse.ok) {
      const errorText = await metricsResponse.text();
      return NextResponse.json(
        { error: "Failed to fetch metrics", details: errorText },
        { status: metricsResponse.status }
      );
    }

    const metricsData = await metricsResponse.json();

    // Parse metrics into a clean format
    const metrics: Record<string, number> = {};
    for (const value of metricsData.value || []) {
      const name = value.name?.value || "";
      let total = 0;
      for (const ts of value.timeseries || []) {
        for (const dp of ts.data || []) {
          total += dp.total || 0;
        }
      }
      metrics[name] = total;
    }

    // Also fetch per-deployment metrics (ModelDeploymentId dimension)
    const perDeployMetricsUrl = `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics?api-version=2024-02-01&metricnames=TotalCalls,TotalTokens,ProcessedPromptTokens,GeneratedTokens&aggregation=Total&interval=PT1H&timespan=${startTime}/${endTime}&$filter=ModelDeploymentId eq '*'`;

    let perDeployment: Record<string, Record<string, number>> = {};
    try {
      const perDeployRes = await fetch(perDeployMetricsUrl, {
        headers: { Authorization: `Bearer ${tokenResponse.token}` },
      });
      if (perDeployRes.ok) {
        const perDeployData = await perDeployRes.json();
        for (const value of perDeployData.value || []) {
          const metricName = value.name?.value || "";
          for (const ts of value.timeseries || []) {
            const deployId = ts.metadatavalues?.find((m: any) => m.name?.value === "ModelDeploymentId")?.value || "unknown";
            if (!perDeployment[deployId]) perDeployment[deployId] = {};
            let total = 0;
            for (const dp of ts.data || []) total += dp.total || 0;
            perDeployment[deployId][metricName] = (perDeployment[deployId][metricName] || 0) + total;
          }
        }
      }
    } catch (err) {
      console.error("[metrics] Failed to fetch per-deployment metrics:", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      metrics,
      perDeployment,
      timeRange: { start: startTime, end: endTime },
      resourceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
