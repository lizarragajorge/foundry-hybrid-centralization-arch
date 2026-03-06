# Azure Foundry Hybrid Landing Zone

**A reference implementation for deploying Microsoft Foundry in a hub-spoke pattern with centralized AI governance and federated Business Unit autonomy.**

This project provides two things:

1. **`infra/`** — A production-grade Bicep landing zone you can fork, parameterize, and deploy to your own Azure subscription in minutes
2. **`demo-app/`** — A 9-tab interactive web app that proves it works by making live API calls against the deployed infrastructure

---

## The Pattern

```
  ┌─ Federated (BU Spokes) ─────────────────┐      ┌─ Centralized (AI CoE Hub) ──────────────┐
  │                                          │      │                                          │
  │  ┌─────────────────────────┐             │      │  ┌─────────────────────────┐             │
  │  │ Finance Project         │  Foundry    │      │  │ Foundry Resource        │             │
  │  │  Agents · Evaluations   │  Control    │      │  │  Models & Endpoints     │             │
  │  │  Tools · Guardrails     │◄── Plane ──►│      │  │  Compute · Policies     │             │
  │  ├─────────────────────────┤             │      │  │  Observability          │             │
  │  │ Marketing Project       │             │      │  └─────────────────────────┘             │
  │  ├─────────────────────────┤             │      │  Key Vault · RBAC · Diagnostics         │
  │  │ Engineering Project     │             │      │  Azure Policy (audit/enforce)            │
  │  └─────────────────────────┘             │      └──────────────────────────────────────────┘
  └──────────────────────────────────────────┘
              Microsoft Entra  ·  Microsoft Defender  ·  Azure Monitor
```

**Why this pattern?**
- Models deploy **once** centrally — BUs consume, not duplicate
- Each BU gets an **isolated project** with its own agents, evals, and managed identity
- Azure Policy enforces **uniform governance** (auth, networking, tagging) across all BUs
- Hub-spoke networking provides **network isolation** with controlled peering
- Adding a BU is a **one-line parameter change** — no module edits needed

---

## Quick Start

> **Full walkthrough:** [QUICKSTART.md](QUICKSTART.md)

```bash
# 1. Fork & clone
git clone https://github.com/<you>/foundry-hybrid-landing-zone.git
cd foundry-hybrid-landing-zone

# 2. Customize parameters
code infra/main.bicepparam

# 3. Deploy (preview first)
./scripts/deploy.ps1 -Preview    # or ./scripts/deploy.sh --what-if
./scripts/deploy.ps1             # or ./scripts/deploy.sh

# 4. Run the demo app (optional)
cd demo-app && npm install && npm run dev
# Open http://localhost:3000
```

---

## Project Structure

```
├── infra/                        The landing zone — what you deploy
│   ├── main.bicep                Subscription-scoped orchestrator
│   ├── main.bicepparam           Your configuration (edit this)
│   └── modules/
│       ├── hub/                  Foundry resource + model deployments
│       ├── spoke/                BU project (child resource)
│       ├── networking/           Hub-spoke VNets + peering
│       ├── governance/           Azure Policy + RBAC
│       ├── monitoring/           Log Analytics + App Insights
│       └── security/             Key Vault + Defender
│
├── demo-app/                     Interactive showcase (optional)
│   ├── src/                      Next.js 16 + TypeScript + Tailwind
│   └── README.md                 Demo app documentation
│
├── scripts/                      Deployment automation
│   ├── deploy.ps1                PowerShell (Windows)
│   ├── deploy.sh                 Bash (Linux/macOS)
│   └── demo-telemetry.ps1        CLI-based telemetry demo
│
├── docs/                         Deep documentation
│   ├── architecture.md           Design decisions & rationale
│   ├── security.md               Threat model & controls
│   └── customization.md          Extending for your organization
│
├── QUICKSTART.md                 5-minute deploy guide
└── README.md                     You are here
```

---

## What Gets Deployed

| Layer | Resources | Count |
|-------|-----------|-------|
| **Compute** | Foundry Resource (AIServices) + model deployments | 1 + 3 |
| **Projects** | BU-scoped Foundry Projects (Finance, Marketing, Engineering) | 3 |
| **Networking** | Hub VNet + spoke VNets + bidirectional peering | 4 + 6 |
| **Security** | Key Vault (RBAC auth, purge-protected) + managed identities | 1 + 4 |
| **Governance** | Azure Policy assignments + RBAC role bindings | 4 + N |
| **Observability** | Log Analytics + App Insights + diagnostic settings | 2 + N |
| **Resource Groups** | Hub, monitoring, networking, per-BU | 6 |

All resources deploy idempotently via a single `az deployment sub create` command.

---

## Demo App (Optional)

A 9-tab interactive web app that makes live API calls against your deployment:

| Tab | Proves |
|-----|--------|
| **Architecture** | Visual understanding of the hybrid pattern |
| **Simulation** | BU-scoped AI workloads against centralized models |
| **Arena** | GPT-4o vs GPT-4o-mini quality/cost/latency tradeoff |
| **Trace** | Animated security checkpoint flow (Entra → RBAC → Model) |
| **Load Test** | Concurrent multi-BU traffic with TPM governance |
| **Telemetry** | Azure Monitor metrics + OTel distributed traces |
| **Cost** | Real per-BU and per-model cost attribution |
| **Guardrails** | Content Safety filter testing (PASSED/BLOCKED) |
| **Governance** | Policy compliance, network topology, Zero Trust status |

> **Details:** [demo-app/README.md](demo-app/README.md)

---

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Everyone | Fork → configure → deploy → demo in 5 minutes |
| [docs/architecture.md](docs/architecture.md) | Architects | Resource hierarchy, deployment sequence, design decisions |
| [docs/security.md](docs/security.md) | Security teams | Zero Trust model, RBAC matrix, policy controls, data protection |
| [docs/customization.md](docs/customization.md) | Platform teams | Adding BUs, changing models, enabling enforcement, production hardening |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `az bicep build --file infra/main.bicep` to validate
5. Open a Pull Request

---

## License

This project is provided as a reference implementation. See your organization's licensing requirements for production use.

## Related

- [Microsoft Foundry Architecture](https://learn.microsoft.com/en-us/azure/foundry/concepts/architecture)
- [Foundry Rollout Planning](https://learn.microsoft.com/en-us/azure/foundry/concepts/planning)
- [Azure Landing Zones (CAF)](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/)
- [Foundry Samples Repository](https://github.com/Azure-AI-Foundry/foundry-samples)
