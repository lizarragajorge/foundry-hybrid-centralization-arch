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

# Public (safe for browser)
NEXT_PUBLIC_APP_NAME=Azure Foundry Hybrid
```

**Auth requirement:** You must be logged in via `az login` with `Cognitive Services User` role on the Foundry resource.

---

## Features (9 Tabs)

### Architecture
Interactive SVG-based diagram matching the hybrid pattern. Click any node (Hub, Spokes, Policy, Security) for a detail panel with architecture rationale and implementation details. Animated data flow connections between the Foundry Control Plane and BU projects.

### Simulation
5 pre-built Business Unit scenarios:
- Finance: risk analysis (GPT-4o), forecast assistant (GPT-4o-mini)
- Marketing: content generation (GPT-4o-mini)
- Engineering: RAG embedding (text-embedding-3-large), code review (GPT-4o)

Each call is logged to the session usage tracker for real-time cost attribution.

### Arena
Side-by-side GPT-4o vs GPT-4o-mini comparison. Both models receive the identical prompt and run in parallel. Shows latency, token count, estimated cost, and a cost savings percentage. 5 preset prompts (strategy, code gen, creative, data extraction, summarization) plus custom input.

### Trace
Animated step-by-step request flow through 7 security checkpoints:
1. Browser Client → 2. API Proxy (server) → 3. Entra ID Token → 4. Network Layer → 5. RBAC Check → 6. Model Inference (real API call) → 7. Response

Per-BU selector. The model inference step makes an actual API call; other steps have simulated timing to illustrate the security chain.

### Load Test
Configurable concurrent multi-BU load testing:
- 1–3 BUs simultaneously
- 1–5 rounds per run
- Live progress bar, per-BU latency bar chart, scatter plot, P95 tracking
- Full request log table with color-coded BU indicators

### Telemetry
Three data sources in one view:
- **Azure Monitor** — real infrastructure metrics (calls, tokens, success rate, latency) pulled from the Management API with 30s auto-refresh
- **Session Telemetry** — per-BU filtered view of all API calls made through the app, with latency timeline, BU pie chart, model bar chart, and request log
- **OTel Distributed Traces** — queries Application Insights for server request spans and outbound dependency spans (Foundry API calls, Management API calls) with trace IDs

Uses the global BU filter to scope session data to a specific Business Unit.

### Cost
Dual data sources for cost attribution:
- **Azure Monitor (Real)** — aggregate and per-deployment token/call counts from the live Foundry resource
- **Session Tracker** — every API call made through the app logged with BU, model, tokens, cost

Charts: per-BU cost bar chart, per-model cost pie chart. Tables: per-BU attribution with % bars and cost/call. "Cost by Feature" cards showing which tab (Simulation, Arena, Load Test, Trace) spent the most. Live optimization insight comparing GPT-4o vs GPT-4o-mini per-call cost.

Uses the global BU filter.

### Guardrails
Tests Azure AI Content Safety (Microsoft.DefaultV2 policy) with 6 scenarios:

| Scenario | Risk | Category |
|----------|------|----------|
| Legitimate Financial Query | Safe | Baseline |
| Jailbreak Attempt | Harmful | Jailbreak |
| Violence Content Request | Harmful | Violence |
| Hate Speech Request | Harmful | Hate |
| Social Engineering Prompt | Borderline | Indirect Attack |
| Marketing Content (Clean) | Safe | Baseline |

Each result shows the full Content Filter Pipeline: 6 filter categories (hate, self_harm, sexual, violence, jailbreak, profanity) with per-category severity and PASSED/BLOCKED status. Side-by-side prompt vs response/block reason. "Run All" button for automated sweep.

### Governance
Static showcase of deployed governance controls:
- Zero Trust identity status (local auth disabled, managed identities, RBAC)
- Azure Policy assignments with audit/enforce toggle explanation
- Hub-spoke network topology with animated peering status
- Key Vault configuration (soft delete, purge protection, RBAC auth)
- Observability pipeline status

---

## Security Model

| Concern | Approach |
|---------|----------|
| **No browser credentials** | All Azure calls go through server-side API routes (`/api/*`) |
| **Authentication** | `AzureCliCredential` — picks up your `az login` session |
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
| `/api/guardrails` | POST | Content safety testing with full filter annotation passthrough |
| `/api/metrics` | GET | Azure Monitor metrics (aggregate + per-deployment breakdown) |
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
