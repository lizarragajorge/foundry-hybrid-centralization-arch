"""
External Model Proxy — Azure Function Reference
=================================================

This Azure Function acts as a proxy for an external model provider (e.g.,
Anthropic Claude, Google Gemini, custom SLM). It exposes an OpenAI-compatible
chat completions endpoint that APIM can route to as a backend.

In this SIMULATION, it forwards to the Foundry gpt-4o-mini deployment.
In PRODUCTION, you would replace the forwarding logic with the actual
external provider's SDK (e.g., anthropic.Anthropic().messages.create()).

Architecture:
  Agent → APIM Gateway
              ├── /deployments/gpt-4o → Foundry Hub (direct)
              ├── /deployments/gpt-4o-mini → Foundry Hub (direct)
              └── /deployments/external-model-sim → THIS FUNCTION → Foundry Hub
                    (in production: → Anthropic API / Bedrock / etc.)

Deployment:
  1. Create a Function App with System-assigned MI
  2. Grant the MI "Azure AI User" on the Foundry hub (or use the external API key)
  3. Add the Function App URL as an APIM backend
  4. Update the APIM rewrite policy to route to this backend

Setup:
  func init external-model-proxy --python
  func new --name ChatProxy --template "HTTP trigger"
  # Copy this file to ChatProxy/__init__.py
  # Deploy: func azure functionapp publish <app-name>

Requirements:
  azure-functions
  azure-identity
"""

import json
import logging
import os

import azure.functions as func
from azure.identity import DefaultAzureCredential


# ─── Configuration ───────────────────────────────────────────────────────────

# In SIMULATION mode, forward to Foundry gpt-4o-mini
FOUNDRY_ENDPOINT = os.environ.get(
    "FOUNDRY_ENDPOINT",
    ""
)
REAL_DEPLOYMENT = os.environ.get("REAL_DEPLOYMENT", "gpt-4o-mini")
EXTERNAL_MODEL_NAME = os.environ.get("EXTERNAL_MODEL_NAME", "external-model-sim")

# In PRODUCTION, set these for the real external provider:
# ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# EXTERNAL_PROVIDER_URL = os.environ.get("EXTERNAL_PROVIDER_URL", "https://api.anthropic.com/v1")


app = func.FunctionApp()


@app.route(route="chat/completions", methods=["POST"], auth_level=func.AuthLevel.ANONYMOUS)
def chat_completions(req: func.HttpRequest) -> func.HttpResponse:
    """
    OpenAI-compatible chat completions endpoint.
    Accepts the standard OpenAI request format, forwards to the real backend,
    and returns a normalized response.
    """
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": {"code": "InvalidRequest", "message": "Invalid JSON body"}}),
            status_code=400,
            mimetype="application/json"
        )

    messages = body.get("messages", [])
    max_tokens = body.get("max_tokens", 200)

    if not messages:
        return func.HttpResponse(
            json.dumps({"error": {"code": "InvalidRequest", "message": "messages array is required"}}),
            status_code=400,
            mimetype="application/json"
        )

    # ── SIMULATION: Forward to Foundry gpt-4o-mini ──────────────────────
    # In production, replace this block with the external provider SDK call.

    import urllib.request
    import urllib.error

    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")

    url = (
        f"{FOUNDRY_ENDPOINT.rstrip('/')}/openai/deployments/{REAL_DEPLOYMENT}"
        f"/chat/completions?api-version=2024-08-01-preview"
    )

    request_body = json.dumps({
        "messages": messages,
        "max_tokens": max_tokens,
    }).encode()

    http_req = urllib.request.Request(url, data=request_body, method="POST", headers={
        "Authorization": f"Bearer {token.token}",
        "Content-Type": "application/json",
    })

    try:
        with urllib.request.urlopen(http_req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        logging.error(f"Foundry call failed: {e.code} {error_body}")
        return func.HttpResponse(error_body, status_code=e.code, mimetype="application/json")

    # ── Normalize response to include external model metadata ───────────

    # Override the model name to show it came through the external proxy
    data["model"] = EXTERNAL_MODEL_NAME
    data["_proxy"] = {
        "provider": "simulation",
        "realModel": REAL_DEPLOYMENT,
        "note": "In production, this would be the external provider's response (e.g., Anthropic Claude)"
    }

    return func.HttpResponse(
        json.dumps(data),
        status_code=200,
        mimetype="application/json",
        headers={
            "x-external-model": EXTERNAL_MODEL_NAME,
            "x-real-model": REAL_DEPLOYMENT,
        }
    )


# ── Production Example: Anthropic Claude ────────────────────────────────────
#
# To use Claude instead of the Foundry simulation, replace the forwarding
# block above with:
#
#   import anthropic
#
#   client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
#
#   # Convert OpenAI format to Anthropic format
#   system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
#   user_msgs = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
#
#   response = client.messages.create(
#       model="claude-sonnet-4-20250514",
#       max_tokens=max_tokens,
#       system=system_msg,
#       messages=user_msgs,
#   )
#
#   # Convert Anthropic response back to OpenAI format
#   data = {
#       "choices": [{"message": {"role": "assistant", "content": response.content[0].text}}],
#       "model": "claude-sonnet-4-20250514",
#       "usage": {"prompt_tokens": response.usage.input_tokens, "completion_tokens": response.usage.output_tokens, "total_tokens": response.usage.input_tokens + response.usage.output_tokens},
#   }
