"""
External Model Proxy — Flask Web App
Simulates an external model (e.g., Claude, Gemini) by proxying to Foundry gpt-4o-mini.
Deployed as an Azure App Service with managed identity.
"""
import json
import os
import urllib.request
import urllib.error
from flask import Flask, request, jsonify
from azure.identity import DefaultAzureCredential

app = Flask(__name__)

FOUNDRY_ENDPOINT = os.environ.get("FOUNDRY_ENDPOINT", "https://contoso-foundry-hub-dev.cognitiveservices.azure.com/")
REAL_DEPLOYMENT = os.environ.get("REAL_DEPLOYMENT", "gpt-4o-mini")
MODEL_NAME = os.environ.get("EXTERNAL_MODEL_NAME", "external-model-sim")

@app.route("/api/chat/completions", methods=["POST"])
def chat_completions():
    body = request.get_json(silent=True) or {}
    messages = body.get("messages", [])
    max_tokens = body.get("max_tokens", 200)

    if not messages:
        return jsonify(error={"code": "InvalidRequest", "message": "messages required"}), 400

    credential = DefaultAzureCredential()
    token = credential.get_token("https://cognitiveservices.azure.com/.default")

    url = f"{FOUNDRY_ENDPOINT.rstrip('/')}/openai/deployments/{REAL_DEPLOYMENT}/chat/completions?api-version=2024-08-01-preview"
    req_body = json.dumps({"messages": messages, "max_tokens": max_tokens}).encode()
    http_req = urllib.request.Request(url, data=req_body, method="POST", headers={
        "Authorization": f"Bearer {token.token}",
        "Content-Type": "application/json",
    })

    try:
        with urllib.request.urlopen(http_req) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.read().decode(), e.code

    data["model"] = MODEL_NAME
    data["_proxy"] = {"provider": "azure-function-sim", "realModel": REAL_DEPLOYMENT}

    response = jsonify(data)
    response.headers["x-external-model"] = MODEL_NAME
    response.headers["x-real-model"] = REAL_DEPLOYMENT
    return response

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(status="healthy", model=MODEL_NAME, backend=REAL_DEPLOYMENT)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
