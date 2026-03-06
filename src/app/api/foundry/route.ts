import { NextRequest, NextResponse } from "next/server";
import { DefaultAzureCredential, AzureCliCredential } from "@azure/identity";

const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deployment, messages, input, maxTokens = 200 } = body;

    // Create credential per-request to avoid stale token issues in dev
    let token: string;
    try {
      const credential = new AzureCliCredential();
      const tokenResponse = await credential.getToken(
        "https://cognitiveservices.azure.com/.default"
      );
      token = tokenResponse.token;
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : "Auth failed";
      return NextResponse.json({ error: `Auth error: ${msg}` }, { status: 500 });
    }

    const isEmbedding = deployment.includes("embedding");
    const apiPath = isEmbedding
      ? `${endpoint}openai/deployments/${deployment}/embeddings?api-version=2024-08-01-preview`
      : `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

    const requestBody = isEmbedding
      ? { input, model: deployment }
      : { messages, max_tokens: maxTokens };

    const startTime = Date.now();

    const response = await fetch(apiPath, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API call failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Enrich with metadata for the dashboard
    return NextResponse.json({
      ...data,
      _meta: {
        deployment,
        latencyMs: latency,
        timestamp: new Date().toISOString(),
        authMethod: "EntraID",
        isEmbedding,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
