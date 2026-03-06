import { NextRequest, NextResponse } from "next/server";
import { AzureCliCredential } from "@azure/identity";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT || "";
const tracer = trace.getTracer("foundry-api");

export async function POST(req: NextRequest) {
  return tracer.startActiveSpan("foundry.inference", async (span) => {
  try {
    const body = await req.json();
    const { deployment, messages, input, maxTokens = 200 } = body;

    span.setAttribute("foundry.deployment", deployment);
    span.setAttribute("foundry.max_tokens", maxTokens);
    span.setAttribute("foundry.is_embedding", deployment.includes("embedding"));

    // Create credential per-request to avoid stale token issues in dev
    let token: string;
    try {
      const credential = new AzureCliCredential();
      const tokenResponse = await credential.getToken(
        "https://cognitiveservices.azure.com/.default"
      );
      token = tokenResponse.token;
      span.setAttribute("foundry.auth_method", "EntraID");
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : "Auth failed";
      span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
      span.end();
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

    // Record token usage in span
    span.setAttribute("foundry.prompt_tokens", data.usage?.prompt_tokens || 0);
    span.setAttribute("foundry.completion_tokens", data.usage?.completion_tokens || 0);
    span.setAttribute("foundry.total_tokens", data.usage?.total_tokens || 0);
    span.setAttribute("foundry.latency_ms", latency);
    span.setStatus({ code: SpanStatusCode.OK });

    // Enrich with metadata for the dashboard
    const result = NextResponse.json({
      ...data,
      _meta: {
        deployment,
        latencyMs: latency,
        timestamp: new Date().toISOString(),
        authMethod: "EntraID",
        isEmbedding,
      },
    });
    span.end();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
    return NextResponse.json({ error: message }, { status: 500 });
  }
  });
}
