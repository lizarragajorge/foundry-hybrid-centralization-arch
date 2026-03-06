import { NextRequest, NextResponse } from "next/server";
import { AzureCliCredential } from "@azure/identity";

const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, deployment = "gpt-4o-mini", maxTokens = 100 } = body;

    let token: string;
    try {
      const credential = new AzureCliCredential();
      const tokenResponse = await credential.getToken(
        "https://cognitiveservices.azure.com/.default"
      );
      token = tokenResponse.token;
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : "Auth failed";
      return NextResponse.json({ error: `Auth error: ${msg}`, blocked: false }, { status: 500 });
    }

    const apiPath = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

    const startTime = Date.now();

    const response = await fetch(apiPath, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, max_tokens: maxTokens }),
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json();

    // Extract content filter results from prompts and completions
    const promptFilterResults = data.prompt_filter_results || data.prompt_annotations || [];
    const choiceFilterResults = data.choices?.[0]?.content_filter_results || {};

    // Check if the request was blocked
    const wasBlocked = response.status === 400 && data.error?.code === "content_filter";
    const innerError = data.error?.innererror;

    // Build a structured trace
    const trace = {
      blocked: wasBlocked,
      httpStatus: response.status,
      latencyMs,
      timestamp: new Date().toISOString(),

      // Prompt-level filter (input guardrails)
      promptFilters: promptFilterResults.map((pf: any) => ({
        promptIndex: pf.prompt_index,
        filters: pf.content_filter_results || pf.content_filter_result || {},
      })),

      // Completion-level filter (output guardrails)
      completionFilters: choiceFilterResults,

      // If blocked, extract the specific category
      blockReason: wasBlocked
        ? {
            code: innerError?.code || data.error?.code || "content_filter",
            message: data.error?.message || "Content was filtered",
            contentFilterResult: innerError?.content_filter_result || {},
          }
        : null,

      // The response content (if not blocked)
      responseContent: wasBlocked ? null : data.choices?.[0]?.message?.content || null,

      // Token usage
      usage: data.usage || null,

      // Policy info
      policyName: "Microsoft.DefaultV2",
      deployment,
    };

    return NextResponse.json(trace);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, blocked: false }, { status: 500 });
  }
}
