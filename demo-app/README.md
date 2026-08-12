# Azure Foundry Hybrid — Interactive Demo App

A Next.js web app that provides a live, interactive showcase of the Azure Foundry hybrid centralized/federated architecture. Every API call hits **real Azure infrastructure** — no mocks.

## Quick Start

```bash
# Prerequisites: Node.js 18+, Azure CLI logged in
cd demo-app
npm install
npm run dev
# Open http://localhost:3000
```

### Environment Setup

Copy and edit `.env.local`:

```env
# Server-side only (never sent to browser)
AZURE_FOUNDRY_ENDPOINT=https://<name>.cognitiveservices.azure.com/   # trailing slash required
AZURE_FOUNDRY_NAME=<foundry-resource-name>
AZURE_FOUNDRY_RESOURCE_GROUP=<resource-group>
AZURE_SUBSCRIPTION_ID=<subscription-id>
AZURE_LOG_ANALYTICS_WORKSPACE=<law-name>
AZURE_MONITORING_RG=<monitoring-rg>
APPLICATIONINSIGHTS_CONNECTION_STRING=<from App Insights>

# Cross-subscription chargeback (Cost tab). Optional — falls back to AZURE_SUBSCRIPTION_ID.
# Requires the signed-in identity to have "Cost Management Reader" at each subscription (or MG) scope.
AZURE_SUBSCRIPTION_IDS=[{"id":"<sub-1>","name":"US East (Hub)","region":"eastus2"},{"id":"<sub-2>","name":"US West","region":"westus3"}]
AZURE_CHARGEBACK_TAG=businessUnit   # tag key used for per-BU cost allocation

# Public (safe for browser)
NEXT_PUBLIC_APP_NAME=Azure Foundry Hybrid
```

**Auth requirement:** You must be logged in via `az login` with `Cognitive Services User` role on the Foundry resource.

---

## Features (5 Tabs)

The app is organized around one idea — **decentralized consumption, centralized control**. Every top-level tab is labeled **Centralized** or **Federated**; related panels are grouped as sub-tabs.

### 1. Hybrid Overview
- **Split View** — the hero. Centralized hub (models, identity, policy, Key Vault, networking) on the left; federated BU spokes on the right; the Foundry Control Plane seam (Entra ID → RBAC → Policy → Content Safety) in the middle. Click any BU to highlight exactly which central models it can and cannot reach.
- **Architecture Map** — the detailed interactive SVG diagram; click any node (Hub, Spokes, Policy, Security) for rationale and implementation details.

### 2. Central Platform *(Centralized)*
Everything the AI CoE hub owns once for every BU:
- **Model Catalog** — central IT provisions models; BU developers deploy only what they're approved for.
- **Governance & Security** — Zero Trust identity, Azure Policy audit/enforce, hub-spoke topology, Key Vault config, and the live policy monitor.
- **Onboard BU** — fill a short form to generate the exact `businessUnits[]` Bicep param entry and see everything one line auto-provisions (RG, project, VNet + peering, managed identity, RBAC, Key Vault access, policy inheritance).
- **Agent Gateway** — external agents call centralized models through the APIM AI Gateway with per-BU policy enforcement and zero Azure credentials.

### 3. BU Workspace *(Federated)*
Per-BU self-service inside central guardrails:
- **Simulation** — pre-built Finance / Marketing / Engineering scenarios; each call is logged to the session usage tracker for real-time cost attribution.
- **Arena** — side-by-side GPT-4o vs GPT-4o-mini on an identical prompt: latency, tokens, cost, and savings %.
- **Guardrails** — Azure AI Content Safety testing across 6 scenarios with the full filter pipeline (hate, self_harm, sexual, violence, jailbreak, profanity) and PASSED/BLOCKED status.

### 4. Live Proof
- **Request Trace** — animated request flow through every security checkpoint (Browser → API Proxy → Entra ID → Network → RBAC → Model → Response). The inference step makes a real API call.
- **Load Test** — concurrent multi-BU load (1–3 BUs, 1–5 rounds) with live progress, per-BU latency chart, scatter plot, and P95 tracking to demonstrate TPM governance under pressure.

### 5. Chargeback *(Centralized)*
Central financial + operational visibility across all BUs (uses the global BU filter):
- **Chargeback** — actual billed cost from Azure Cost Management (month-to-date), grouped by the `businessUnit` tag **across every subscription**, shown alongside real-time token accrual (Azure Monitor + session tracker). Falls back gracefully if the identity lacks Cost Management Reader.
- **Telemetry** — Azure Monitor infrastructure metrics, per-BU session telemetry, and OTel distributed traces from Application Insights.

---

## Security Model

| Concern | Approach |
|---------|----------|
| **No browser credentials** | All Azure calls go through server-side API routes (`/api/*`) |
| **Authentication** | `DefaultAzureCredential` — chains Managed Identity → Azure CLI (`az login`) → env vars |
| **Token management** | Entra ID tokens acquired per-request server-side, never cached in browser |
| **API keys** | Local auth disabled on Foundry resource — API keys don't work |
| **Env vars** | No `NEXT_PUBLIC_` prefix on secrets — server-only |
| **App Insights connection string** | [Not a secret](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration#connection-string) — allows write-only telemetry ingestion |

## Observability


| Concern | Approach |
|---------|----------|
| **No browser credentials** | All Azure calls go through server-side API routes (`/api/*`) |
| **Authentication** | `DefaultAzureCredential` — chains Managed Identity → Azure CLI (`az login`) → env vars |
| **Token management** | Entra ID tokens acquired per-request server-side, never cached in browser |
| **API keys** | Local auth disabled on Foundry resource — API keys don't work |
| **Env vars** | No `NEXT_PUBLIC_` prefix on secrets — server-only |
| **App Insights connection string** | [Not a secret](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration#connection-string) — allows write-only telemetry ingestion |

## Observability

OpenTelemetry is configured in `src/instrumentation.ts`:

- **SDK:** `@opentelemetry/sdk-node` registered via Next.js `instrumentation.ts` hook
- **Exporters:** `AzureMonitorTraceExporter` (→ App Insights) + `ConsoleSpanExporter` (dev only)
- **Auto-instrumentation:** HTTP requests, Next.js route handling, outbound fetch calls
- **Custom spans:** `foundry.inference` with attributes: deployment, tokens, latency, auth method. `guardrails.check` with: blocked, policy, filter results
- **Service name:** `azure-foundry-hybrid-demo`

Traces appear in App Insights within 2–5 minutes and can be queried from the Telemetry tab.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/foundry` | POST | Secure proxy to Azure Foundry (chat completions + embeddings) |
| `/api/catalog-test` | POST | Per-BU model access test (direct Foundry or via APIM gateway) |
| `/api/guardrails` | POST | Content safety testing with full filter annotation passthrough |
| `/api/metrics` | GET | Azure Monitor metrics (aggregate + per-deployment breakdown) |
| `/api/chargeback` | GET | Cross-subscription billed cost (Cost Management) grouped by BU tag |
| `/api/policy-compliance` | GET | Azure Policy compliance state across all subscriptions |
| `/api/policy-activity` | GET | Recent policy evaluation activity for the live monitor |
| `/api/traces` | GET | OTel traces from Application Insights (requests + dependencies) |

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 (App Router) | Framework, server-side API routes |
| TypeScript | Type safety |
| Tailwind CSS | Dark theme styling |
| Framer Motion | Animations and transitions |
| Recharts | Charts (bar, pie, line, scatter) |
| Lucide React | Icon system |
| `@azure/identity` | Server-side Entra ID authentication |
| `@opentelemetry/*` | Distributed tracing SDK |
| `@azure/monitor-opentelemetry-exporter` | OTel → App Insights export |

## Development

```bash
npm run dev      # Dev server with hot reload + OTel console output
npm run build    # Production build
npm run start    # Production server
```

The dev server outputs OTel spans to the console for debugging. In production, only the Azure Monitor exporter is active.
