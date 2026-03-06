import { NextResponse } from "next/server";
import { AzureCliCredential } from "@azure/identity";

// Query Application Insights for OTel trace data
export async function GET() {
  try {
    const credential = new AzureCliCredential();
    const tokenResponse = await credential.getToken(
      "https://api.applicationinsights.io/.default"
    );

    const appId = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
      ?.match(/ApplicationId=([^;]+)/)?.[1];

    if (!appId) {
      return NextResponse.json({ error: "No App Insights ApplicationId configured" }, { status: 500 });
    }

    // Query recent requests from App Insights
    const query = `
      requests
      | where timestamp > ago(2h)
      | where cloud_RoleName == "azure-foundry-hybrid-demo" or name startswith "GET /" or name startswith "POST /"
      | project
          timestamp,
          name,
          url,
          duration,
          resultCode,
          success,
          operation_Id,
          operation_ParentId,
          cloud_RoleName,
          customDimensions
      | order by timestamp desc
      | take 50
    `;

    const res = await fetch(
      `https://api.applicationinsights.io/v1/apps/${appId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResponse.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "App Insights query failed", details: errText }, { status: res.status });
    }

    const data = await res.json();

    // Also query dependencies (outbound calls to Azure APIs)
    const depQuery = `
      dependencies
      | where timestamp > ago(2h)
      | where target contains "cognitiveservices" or target contains "management.azure.com"
      | project
          timestamp,
          name,
          target,
          duration,
          resultCode,
          success,
          operation_Id,
          type,
          data
      | order by timestamp desc
      | take 50
    `;

    const depRes = await fetch(
      `https://api.applicationinsights.io/v1/apps/${appId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResponse.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: depQuery }),
      }
    );

    let dependencies = null;
    if (depRes.ok) {
      dependencies = await depRes.json();
    }

    return NextResponse.json({
      requests: data,
      dependencies,
      appId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
