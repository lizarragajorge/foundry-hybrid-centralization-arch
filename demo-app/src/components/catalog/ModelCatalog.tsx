"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Shield, Users, CheckCircle2, XCircle, ChevronRight,
  ChevronDown, Lock, Server, Cpu, Eye, ArrowRight, Zap,
  ToggleLeft, ToggleRight, AlertTriangle, Play, Ban,
} from "lucide-react";
import { architectureData } from "@/lib/config";
import { Card, Badge, StatusDot } from "@/components/ui/shared";

// ─── Two views: Central IT vs BU Developer ──────────────────────────────────

type Persona = "central-it" | "bu-developer";

// Extended model catalog — Central IT sees everything, BU devs see their allowlist
const modelCatalog = [
  {
    name: "gpt-4o",
    version: "2024-08-06",
    format: "OpenAI",
    sku: "Standard",
    tpm: 30,
    category: "Reasoning",
    description: "Most capable model for complex reasoning, code analysis, and multi-step tasks.",
    useCases: ["Compliance analysis", "Code review", "Architecture assessment", "Contract analysis"],
    costTier: "Premium" as const,
    provisioned: true, // Central IT has deployed this on the hub
  },
  {
    name: "gpt-4o-mini",
    version: "2024-07-18",
    format: "OpenAI",
    sku: "Standard",
    tpm: 60,
    category: "General Purpose",
    description: "Fast, cost-efficient model for high-volume tasks. 97% cheaper than GPT-4o.",
    useCases: ["Content generation", "Summarization", "Data extraction", "Email drafting"],
    costTier: "Economy" as const,
    provisioned: true,
  },
  {
    name: "text-embedding-3-large",
    version: "1",
    format: "OpenAI",
    sku: "Standard",
    tpm: 120,
    category: "Embeddings",
    description: "High-dimensional embeddings for semantic search, RAG, and classification.",
    useCases: ["RAG pipelines", "Semantic search", "Document classification", "Clustering"],
    costTier: "Economy" as const,
    provisioned: true,
  },
  {
    name: "gpt-4.1",
    version: "2025-04-14",
    format: "OpenAI",
    sku: "Standard",
    tpm: 0,
    category: "Reasoning",
    description: "Next-generation reasoning model. Pending AI CoE approval and capacity planning.",
    useCases: ["Advanced multi-step reasoning", "Long-context analysis"],
    costTier: "Premium" as const,
    provisioned: false, // NOT yet deployed — illustrates the approval flow
  },
  {
    name: "Phi-4",
    version: "2025-02-01",
    format: "Microsoft",
    sku: "Standard",
    tpm: 0,
    category: "Small Language Model",
    description: "Compact SLM for on-device or low-latency scenarios. Under evaluation by AI CoE.",
    useCases: ["Edge deployment", "Low-latency classification", "Structured extraction"],
    costTier: "Economy" as const,
    provisioned: false,
  },
];

const costColors = { Premium: "#f59e0b", Economy: "#10b981" };

// Per-BU justifications for why a model is allowed or denied
const accessReasons: Record<string, Record<string, string>> = {
  "gpt-4o": {
    finance: "Approved — required for complex compliance reasoning and risk analysis",
    marketing: "Not approved — use GPT-4o-mini for content tasks (97% cost savings)",
    engineering: "Approved — needed for code review and architecture assessment",
  },
  "gpt-4o-mini": {
    finance: "Approved — high-volume summarization and structured data extraction",
    marketing: "Approved — primary model for content generation at scale",
    engineering: "Approved — CI/CD automation and documentation generation",
  },
  "text-embedding-3-large": {
    finance: "Not approved — Finance uses structured queries, not semantic search",
    marketing: "Approved — semantic search over campaign libraries",
    engineering: "Approved — RAG pipelines for internal documentation",
  },
};

type AccessTestResult = {
  allowed: boolean;
  bu: string;
  deployment: string;
  steps: Array<{ step: string; status: "pass" | "fail" | "skip"; detail: string; durationMs: number }>;
  totalDurationMs: number;
  response?: { content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null; model: string };
  error?: { code: string; message: string; allowedModels?: string[] };
};

export default function ModelCatalog() {
  const [persona, setPersona] = useState<Persona>("central-it");
  const [selectedBu, setSelectedBu] = useState(architectureData.projects[0]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AccessTestResult>>({});

  const handleTestAccess = async (modelName: string) => {
    const key = `${selectedBu.bu}:${modelName}`;
    setSimulating(modelName);
    try {
      const res = await fetch("/api/catalog-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bu: selectedBu.bu,
          deployment: modelName,
          prompt: "Confirm access: respond with one sentence about your capabilities.",
          maxTokens: 60,
        }),
      });
      const data: AccessTestResult = await res.json();
      setTestResults((prev) => ({ ...prev, [key]: data }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          allowed: false,
          bu: selectedBu.bu,
          deployment: modelName,
          steps: [{ step: "Network", status: "fail" as const, detail: err instanceof Error ? err.message : "Fetch failed", durationMs: 0 }],
          totalDurationMs: 0,
          error: { code: "NetworkError", message: "Could not reach the API" },
        },
      }));
    } finally {
      setSimulating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Persona switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 bg-[#0d1225] rounded-xl p-1.5 border border-[#2d3561]">
          <button
            onClick={() => setPersona("central-it")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              persona === "central-it"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Server size={15} />
            Central IT / AI CoE
          </button>
          <button
            onClick={() => setPersona("bu-developer")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              persona === "bu-developer"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Users size={15} />
            BU Developer
          </button>
        </div>

        {persona === "bu-developer" && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-slate-500">Viewing as:</span>
            {architectureData.projects.map((p) => (
              <button
                key={p.bu}
                onClick={() => { setSelectedBu(p); setTestResults({}); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedBu.bu === p.bu
                    ? "border shadow-sm"
                    : "bg-[#1a1f36] text-slate-500 border border-transparent hover:border-[#2d3561] hover:text-slate-300"
                }`}
                style={
                  selectedBu.bu === p.bu
                    ? { borderColor: p.color + "60", color: p.color, backgroundColor: p.color + "15" }
                    : undefined
                }
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.displayName}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Context banner */}
      <div
        className="px-5 py-3.5 rounded-xl border text-sm flex items-center gap-3"
        style={{
          borderColor: persona === "central-it" ? "#8b5cf640" : selectedBu.color + "40",
          backgroundColor: persona === "central-it" ? "#8b5cf608" : selectedBu.color + "08",
        }}
      >
        {persona === "central-it" ? (
          <>
            <Shield size={18} className="text-purple-400 shrink-0" />
            <div>
              <span className="text-purple-300 font-medium">AI CoE Admin view — </span>
              <span className="text-slate-400">
                You <strong className="text-white">provision</strong> models on the hub and control which BUs can consume them.
                Models in the catalog are available for approval. Provisioned models can be assigned to BU projects.
              </span>
            </div>
          </>
        ) : (
          <>
            <Users size={18} style={{ color: selectedBu.color }} className="shrink-0" />
            <div>
              <span style={{ color: selectedBu.color }} className="font-medium">{selectedBu.displayName} Developer view — </span>
              <span className="text-slate-400">
                You can only <strong className="text-white">deploy and use</strong> models that Central IT has provisioned AND approved for your BU.
                Models not in your allowlist are visible but blocked.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Model catalog */}
      <div className="space-y-3">
        {modelCatalog.map((model, i) => {
          const isExpanded = expandedModel === model.name;
          const buAllowed = selectedBu.allowedModels.includes(model.name);
          const isBlocked = persona === "bu-developer" && (!model.provisioned || !buAllowed);
          const blockReason = !model.provisioned
            ? "Not provisioned by Central IT"
            : !buAllowed
            ? "Not approved for your BU"
            : null;
          const testKey = `${selectedBu.bu}:${model.name}`;
          const testResult = testResults[testKey] || null;

          return (
            <motion.div
              key={model.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card
                glow={!isBlocked}
                className={`overflow-hidden transition-all ${
                  isBlocked ? "opacity-60" : ""
                } ${isExpanded ? "border-opacity-60" : ""}`}
                style={isExpanded && !isBlocked ? {
                  borderColor: persona === "central-it" ? "#8b5cf640" : selectedBu.color + "40",
                } : undefined}
              >
                <button
                  onClick={() => setExpandedModel(isExpanded ? null : model.name)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4"
                >
                  {/* Model icon */}
                  <div className={`p-2.5 rounded-xl ${
                    isBlocked
                      ? "bg-slate-500/10 text-slate-500"
                      : "bg-purple-500/10 text-purple-400"
                  }`}>
                    <Brain size={18} />
                  </div>

                  {/* Model info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm ${isBlocked ? "text-slate-500" : "text-white"}`}>
                        {model.name}
                      </span>
                      <Badge color={model.format === "OpenAI" ? "purple" : "blue"}>{model.format}</Badge>
                      <Badge color={model.costTier === "Premium" ? "amber" : "green"}>{model.costTier}</Badge>
                      {model.provisioned ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 uppercase font-semibold tracking-wide">
                          <StatusDot status="active" /> Provisioned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-semibold tracking-wide">
                          <span className="w-2 h-2 rounded-full bg-slate-600" /> Not Provisioned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{model.description}</p>
                  </div>

                  {/* BU access status (only in BU view) */}
                  {persona === "bu-developer" && (
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                      {model.provisioned && buAllowed ? (
                        <>
                          <CheckCircle2 size={20} className="text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-medium">AVAILABLE</span>
                        </>
                      ) : (
                        <>
                          <Ban size={20} className="text-rose-400" />
                          <span className="text-[10px] text-rose-400 font-medium">BLOCKED</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Expand chevron */}
                  <div className="text-slate-600">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-[#2d3561]">
                        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: Model details */}
                          <div className="space-y-4">
                            <div>
                              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Deployment Details</h5>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between py-1.5 px-3 rounded bg-[#0d1225]">
                                  <span className="text-slate-500">Version</span>
                                  <span className="text-white font-mono">{model.version}</span>
                                </div>
                                <div className="flex justify-between py-1.5 px-3 rounded bg-[#0d1225]">
                                  <span className="text-slate-500">SKU</span>
                                  <span className="text-white">{model.sku}</span>
                                </div>
                                <div className="flex justify-between py-1.5 px-3 rounded bg-[#0d1225]">
                                  <span className="text-slate-500">TPM Quota</span>
                                  <span className="text-white font-mono">{model.tpm > 0 ? `${model.tpm}K` : "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5 px-3 rounded bg-[#0d1225]">
                                  <span className="text-slate-500">Status</span>
                                  <span className={model.provisioned ? "text-emerald-400" : "text-slate-500"}>
                                    {model.provisioned ? "Deployed on Hub" : "Pending Approval"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Approved Use Cases</h5>
                              <div className="flex flex-wrap gap-1.5">
                                {model.useCases.map((uc) => (
                                  <span key={uc} className="px-2 py-1 rounded bg-[#0d1225] text-xs text-slate-400 border border-[#2d3561]">
                                    {uc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Right: Access matrix (Central IT) or Deploy simulation (BU Dev) */}
                          <div>
                            {persona === "central-it" ? (
                              <CentralITAccessPanel model={model} />
                            ) : (
                              <BUDeployPanel
                                model={model}
                                bu={selectedBu}
                                isAllowed={model.provisioned && buAllowed}
                                blockReason={blockReason}
                                simulating={simulating === model.name}
                                testResult={testResult}
                                onTest={() => handleTestAccess(model.name)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Governance explanation */}
      <Card className="p-5 border-indigo-500/20 bg-indigo-500/5">
        <div className="flex gap-3">
          <Shield size={20} className="text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-indigo-300 mb-1">How Two-Tier Model Governance Works</h4>
            <div className="text-xs text-slate-400 leading-relaxed space-y-2">
              <p>
                <strong className="text-white">Step 1 — Central IT provisions:</strong> The AI CoE deploys model
                endpoints on the hub via the <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">modelDeployments</code> array
                in IaC. This makes models available on the platform — but no BU can use them yet.
              </p>
              <p>
                <strong className="text-white">Step 2 — Central IT approves per-BU:</strong> Each BU&apos;s
                <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">allowedModels</code> array declares
                which provisioned models that BU is permitted to deploy. This is a PR-reviewed IaC change.
              </p>
              <p>
                <strong className="text-white">Step 3 — BU developer deploys:</strong> Developers in approved BUs can
                call the model APIs through their project. Requests to non-allowed models are blocked at the gateway layer
                (APIM) or fail RBAC validation.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Central IT: Access Matrix Panel ────────────────────────────────────────

function CentralITAccessPanel({ model }: { model: typeof modelCatalog[0] }) {
  return (
    <div>
      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        BU Access Assignments
      </h5>
      {!model.provisioned ? (
        <div className="p-4 rounded-lg bg-[#0d1225] border border-[#2d3561] text-center">
          <AlertTriangle size={24} className="mx-auto text-amber-400 mb-2" />
          <p className="text-sm text-amber-300 font-medium">Not Yet Provisioned</p>
          <p className="text-xs text-slate-500 mt-1">
            Deploy this model to the hub first, then assign BU access.
          </p>
          <div className="mt-3 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono">
            Add to modelDeployments[] in main.bicepparam → redeploy
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {architectureData.projects.map((p) => {
            const allowed = p.allowedModels.includes(model.name);
            const reason = accessReasons[model.name]?.[p.bu];
            return (
              <div
                key={p.bu}
                className={`p-3 rounded-lg border transition-all ${
                  allowed
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-[#2d3561] bg-[#0d1225]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium text-slate-300">{p.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {allowed ? (
                      <>
                        <ToggleRight size={18} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={18} className="text-slate-600" />
                        <span className="text-[10px] text-slate-600 font-semibold uppercase">Disabled</span>
                      </>
                    )}
                  </div>
                </div>
                {reason && (
                  <p className="text-[11px] text-slate-500 pl-[18px]">{reason}</p>
                )}
              </div>
            );
          })}
          <div className="text-[11px] text-slate-600 mt-2 pl-1 flex items-center gap-1">
            <Lock size={10} />
            Modify via <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">allowedModels[]</code> in main.bicepparam
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BU Developer: Deploy Simulation Panel ──────────────────────────────────

function BUDeployPanel({
  model,
  bu,
  isAllowed,
  blockReason,
  simulating,
  testResult,
  onTest,
}: {
  model: typeof modelCatalog[0];
  bu: typeof architectureData.projects[0];
  isAllowed: boolean;
  blockReason: string | null;
  simulating: boolean;
  testResult: AccessTestResult | null;
  onTest: () => void;
}) {
  return (
    <div>
      <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Test Access as {bu.displayName}
      </h5>

      <div className={`p-4 rounded-lg border space-y-3 ${isAllowed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
        <div className="flex items-center gap-2">
          {isAllowed ? (
            <><CheckCircle2 size={16} className="text-emerald-400" /><span className="text-sm text-emerald-300 font-medium">Expected: Access Granted</span></>
          ) : (
            <><Ban size={16} className="text-rose-400" /><span className="text-sm text-rose-300 font-medium">Expected: {blockReason}</span></>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {accessReasons[model.name]?.[bu.bu] || (isAllowed ? "Approved for your BU." : "Not approved for your BU.")}
        </p>

        {/* Test button */}
        <button
          onClick={onTest}
          disabled={simulating || !model.provisioned}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
            isAllowed
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
          }`}
        >
          {simulating ? (
            <><Zap size={14} className="animate-pulse" /> Running access pipeline...</>
          ) : testResult ? (
            testResult.allowed
              ? <><CheckCircle2 size={14} /> Access Granted — {testResult.totalDurationMs}ms</>
              : <><XCircle size={14} /> 403 Forbidden — {testResult.totalDurationMs}ms</>
          ) : (
            <><Play size={14} /> {model.provisioned ? "Test Live Access" : "Cannot test — not provisioned"}</>
          )}
        </button>

        {/* Step-by-step pipeline result */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            {testResult.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <div className="mt-0.5">
                  {step.status === "pass" ? (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                  ) : step.status === "fail" ? (
                    <XCircle size={12} className="text-rose-400" />
                  ) : (
                    <ArrowRight size={12} className="text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={step.status === "fail" ? "text-rose-300" : "text-slate-400"}>
                    {step.step}
                  </span>
                  <span className="text-slate-600 ml-1">({step.durationMs}ms)</span>
                  <p className={`text-[10px] truncate ${step.status === "fail" ? "text-rose-400/80" : "text-slate-600"}`}>
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}

            {/* Real model response (if allowed) */}
            {testResult.allowed && testResult.response && (
              <div className="mt-2 p-3 rounded-lg bg-[#0d1225] border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">Live Model Response</span>
                  {testResult.response.usage && (
                    <span className="text-[10px] text-slate-600">
                      {testResult.response.usage.total_tokens} tokens
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {testResult.response.content}
                </p>
              </div>
            )}

            {/* Error detail (if denied) */}
            {!testResult.allowed && testResult.error && (
              <div className="mt-2 p-3 rounded-lg bg-[#0d1225] border border-rose-500/20">
                <div className="text-[10px] text-rose-400 font-semibold uppercase mb-1">Gateway Response</div>
                <p className="text-xs text-rose-300 font-mono">{testResult.error.code}: {testResult.error.message}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* How to fix (for blocked models) */}
        {!isAllowed && (
          <div className="mt-2 p-2.5 rounded-lg bg-[#0d1225] border border-[#2d3561] text-[11px] text-slate-500">
            <span className="text-slate-400 font-medium">To request access:</span>
            {!model.provisioned ? (
              <span> Ask AI CoE to add <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">{model.name}</code> to <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">modelDeployments[]</code></span>
            ) : (
              <span> Ask AI CoE to add <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">&quot;{model.name}&quot;</code> to your BU&apos;s <code className="text-indigo-400 bg-indigo-500/10 px-1 rounded">allowedModels[]</code></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
