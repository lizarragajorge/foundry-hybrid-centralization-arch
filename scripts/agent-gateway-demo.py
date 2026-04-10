"""
External Agent → AI Gateway Demo (Managed Identity)
=====================================================

This script demonstrates how an external agent (any BU application,
Copilot extension, automation pipeline, etc.) calls centralized Foundry
models through the APIM AI Gateway using managed identity auth.

Auth flow:
  1. Agent acquires Entra ID token via DefaultAzureCredential (managed identity)
  2. Sends request to APIM with Bearer token (no API keys anywhere)
  3. APIM validates the JWT (validate-azure-ad-token policy)
  4. APIM maps caller's oid claim → BU → enforces allowedModels
  5. APIM authenticates to Foundry using its own managed identity
  6. Response flows back to the agent

Usage:
  pip install azure-identity openai
  python agent-gateway-demo.py --gateway-url <APIM_URL>

  Or set environment variable:
    APIM_GATEWAY_URL=https://<your-apim-name>.azure-api.net
"""

import argparse
import json
import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def get_entra_token():
    """Acquire an Entra ID token using DefaultAzureCredential (managed identity → CLI fallback)."""
    try:
        from azure.identity import DefaultAzureCredential
    except ImportError:
        print("  ERROR: azure-identity package required. Install with: pip install azure-identity")
        sys.exit(1)

    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")
    return token.token


def call_chat(gateway_url: str, token: str, deployment: str, prompt: str, max_tokens: int = 100):
    """Make a chat completion call through the AI Gateway with Bearer token."""
    url = f"{gateway_url.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version=2024-08-01-preview"
    body = json.dumps({
        "messages": [
            {"role": "system", "content": "You are a helpful AI assistant working within an enterprise governance framework."},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
    }).encode()

    req = Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read())
            gateway_header = resp.headers.get("x-ai-gateway", "unknown")
            gateway_caller = resp.headers.get("x-ai-gateway-caller", "unknown")
            return {
                "status": resp.status,
                "gateway": gateway_header,
                "caller_oid": gateway_caller,
                "content": data["choices"][0]["message"]["content"],
                "usage": data.get("usage", {}),
                "model": data.get("model", deployment),
            }
    except HTTPError as e:
        error_body = e.read().decode()
        try:
            error_json = json.loads(error_body)
        except json.JSONDecodeError:
            error_json = {"raw": error_body}
        return {"status": e.code, "error": error_json}


def call_embeddings(gateway_url: str, token: str, deployment: str, text: str):
    """Make an embeddings call through the AI Gateway with Bearer token."""
    url = f"{gateway_url.rstrip('/')}/openai/deployments/{deployment}/embeddings?api-version=2024-08-01-preview"
    body = json.dumps({"input": text, "model": deployment}).encode()

    req = Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })

    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read())
            dims = len(data["data"][0]["embedding"]) if data.get("data") else 0
            return {"status": resp.status, "dimensions": dims, "usage": data.get("usage", {})}
    except HTTPError as e:
        error_body = e.read().decode()
        try:
            error_json = json.loads(error_body)
        except json.JSONDecodeError:
            error_json = {"raw": error_body}
        return {"status": e.code, "error": error_json}


def demo_openai_sdk(gateway_url: str, token: str, deployment: str, prompt: str):
    """Demo using the official OpenAI Python SDK with Entra token."""
    try:
        import openai
    except ImportError:
        print("  [skip] openai package not installed — install with: pip install openai")
        return None

    client = openai.AzureOpenAI(
        azure_endpoint=gateway_url,
        azure_ad_token=token,
        api_version="2024-08-01-preview",
    )

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": "You are a helpful enterprise AI assistant."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=100,
    )

    return {
        "content": response.choices[0].message.content,
        "model": response.model,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="External Agent → AI Gateway Demo (Managed Identity)")
    parser.add_argument("--gateway-url", default=os.environ.get("APIM_GATEWAY_URL", ""),
                        help="APIM gateway URL (or set APIM_GATEWAY_URL env var)")
    parser.add_argument("--deployment", default="gpt-4o-mini",
                        help="Model deployment name (default: gpt-4o-mini)")
    parser.add_argument("--prompt", default="Explain the benefits of centralized AI governance in 2 sentences.",
                        help="Prompt to send")
    args = parser.parse_args()

    if not args.gateway_url:
        print("Error: --gateway-url is required.")
        print("  Set APIM_GATEWAY_URL environment variable, or pass as argument.")
        sys.exit(1)

    print("=" * 70)
    print("  External Agent → AI Gateway Demo (Managed Identity)")
    print("=" * 70)
    print(f"  Gateway:    {args.gateway_url}")
    print(f"  Deployment: {args.deployment}")
    print(f"  Auth:       Managed Identity → Entra ID Bearer token")
    print()

    # Acquire Entra token
    print("─" * 70)
    print("  Acquiring Entra ID token via DefaultAzureCredential...")
    print("─" * 70)
    token = get_entra_token()
    print(f"  ✓ Token acquired (Bearer {token[:20]}...)")
    print()

    # ── Test 1: Allowed model call ──
    print("─" * 70)
    print(f"  TEST 1: Chat completion via {args.deployment}")
    print("─" * 70)
    result = call_chat(args.gateway_url, token, args.deployment, args.prompt)
    if result["status"] == 200:
        print(f"  ✓ Status:     {result['status']} OK")
        print(f"  ✓ Gateway:    {result.get('gateway', 'n/a')}")
        print(f"  ✓ Caller OID: {result.get('caller_oid', 'n/a')}")
        print(f"  ✓ Model:      {result.get('model', 'n/a')}")
        print(f"  ✓ Tokens:     {result.get('usage', {})}")
        print(f"  ✓ Response:   {result['content'][:200]}")
    else:
        print(f"  ✗ Status:  {result['status']}")
        print(f"  ✗ Error:   {json.dumps(result.get('error', {}), indent=2)}")
    print()

    # ── Test 2: Blocked model call (to show policy enforcement) ──
    blocked_model = "text-embedding-3-large"
    if args.deployment != blocked_model:
        print("─" * 70)
        print(f"  TEST 2: Attempting blocked model ({blocked_model})")
        print("  (This may return 403 if your identity's BU allowedModels blocks it)")
        print("─" * 70)
        result2 = call_embeddings(args.gateway_url, token, blocked_model, "test embedding")
        if result2["status"] == 200:
            print(f"  ✓ Status:  {result2['status']} — model IS allowed for your BU")
            print(f"  ✓ Dims:    {result2.get('dimensions', 'n/a')}")
        elif result2["status"] == 403:
            print(f"  ✗ Status:  403 — BLOCKED by APIM allowedModels policy")
            err = result2.get("error", {})
            print(f"  ✗ Reason:  {err.get('error', {}).get('message', json.dumps(err))}")
        else:
            print(f"  ✗ Status:  {result2['status']}")
            print(f"  ✗ Error:   {json.dumps(result2.get('error', {}), indent=2)}")
        print()

    # ── Test 3: OpenAI SDK (if available) ──
    print("─" * 70)
    print(f"  TEST 3: OpenAI Python SDK via gateway (Bearer token)")
    print("─" * 70)
    sdk_result = demo_openai_sdk(args.gateway_url, token, args.deployment, args.prompt)
    if sdk_result:
        print(f"  ✓ Model:   {sdk_result['model']}")
        print(f"  ✓ Tokens:  {sdk_result['usage']}")
        print(f"  ✓ Response: {sdk_result['content'][:200]}")
    print()

    print("=" * 70)
    print("  Zero API keys in the entire flow.")
    print("  Agent authenticated with managed identity (Entra ID Bearer token).")
    print("  APIM validated the JWT, mapped caller oid → BU, enforced allowedModels.")
    print("  APIM authenticated to Foundry using its own managed identity.")
    print("=" * 70)


if __name__ == "__main__":
    main()
