"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Shield, Server, ArrowRight, CheckCircle2, XCircle,
  Play, ChevronRight, Lock, Zap, Copy, Check,
  Terminal, Code2, Network,
} from "lucide-react";
import { architectureData } from "@/lib/config";
import { Card, Badge, StatusDot } from "@/components/ui/shared";

// ─── Agent scenarios ────────────────────────────────────────────────────────

const agentScenarios = [
  {
    id: "finance-compliance",
    name: "Compliance Review Agent",
    bu: "finance",
    buDisplay: "Finance & Risk",
    color: "#10b981",
    description: "Autonomous agent that reviews contracts for regulatory compliance using GPT-4o.",
    deployment: "gpt-4o",
    prompt: "Review this clause for GDPR compliance: 'Customer data may be shared with third-party analytics providers for service improvement purposes.' Flag any risks.",
    expectedResult: "allowed",
  },
  {
    id: "marketing-content",
    name: "Content Pipeline Agent",
    bu: "marketing",
    buDisplay: "Marketing & Sales",
    color: "#3b82f6",
    description: "Agent that generates marketing copy at scale using the cost-efficient GPT-4o-mini model.",
    deployment: "gpt-4o-mini",
    prompt: "Write a 2-sentence product announcement for our new AI governance platform.",
    expectedResult: "allowed",
  },
  {
    id: "engineering-rag",
    name: "RAG Search Agent",
    bu: "engineering",
    buDisplay: "Engineering & Product",
    color: "#f59e0b",
    description: "Agent that embeds documentation chunks for semantic search using the embeddings model.",
    deployment: "text-embedding-3-large",
    prompt: "Hub-spoke AI governance architecture with centralized model management",
    expectedResult: "allowed",
  },
  {
    id: "finance-blocked",
    name: "Blocked: Finance → Embeddings",
    bu: "finance",
    buDisplay: "Finance & Risk",
    color: "#10b981",
    description: "Finance agent attempts to use text-embedding-3-large, which is NOT in their allowedModels list.",
    deployment: "text-embedding-3-large",
    prompt: "This will be blocked by APIM policy",
    expectedResult: "blocked",
  },
  {
    id: "marketing-blocked",
    name: "Blocked: Marketing → GPT-4o",
    bu: "marketing",
    buDisplay: "Marketing & Sales",
    color: "#3b82f6",
    description: "Marketing agent tries GPT-4o (premium tier) — only GPT-4o-mini is approved for their BU.",
    deployment: "gpt-4o",
    prompt: "This will be blocked by APIM policy",
    expectedResult: "blocked",
  },
  {
    id: "engineering-external",
    name: "External Model (Simulated)",
    bu: "engineering",
    buDisplay: "Engineering & Product",
    color: "#f59e0b",
    description: "Engineering agent calls an external model routed through APIM. Gateway rewrites to gpt-4o-mini — proving external models get identical governance.",
    deployment: "external-model-sim",
    prompt: "You are an external model accessed through the AI Gateway. Describe what governance controls are applied to your responses in 2 sentences.",
    expectedResult: "allowed",
  },
  {
    id: "finance-external-blocked",
    name: "Blocked: Finance → External Model",
    bu: "finance",
    buDisplay: "Finance & Risk",
    color: "#10b981",
    description: "Finance agent tries the external model — not in their allowedModels. Same governance applies to external models.",
    deployment: "external-model-sim",
    prompt: "This will be blocked",
    expectedResult: "blocked",
  },
];

type TestResult = {
  allowed: boolean;
  bu: string;
  deployment: string;
  steps: Array<{ step: string; status: "pass" | "fail" | "skip"; detail: string; durationMs: number }>;
  totalDurationMs: number;
  gateway?: string;
  response?: { content: string; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null; model: string };
  error?: { code: string; message: string };
};

// ─── Code samples for each language ─────────────────────────────────────────

type Lang = "python" | "javascript" | "curl" | "csharp";

function getCodeSample(lang: Lang, gatewayUrl: string, deployment: string): string {
  const url = gatewayUrl || "https://<your-apim>.azure-api.net";

  if (lang === "python") return `from azure.identity import DefaultAzureCredential
import openai

# Agent authenticates with its managed identity — no API keys
# APIM validates the Entra token, maps caller → BU, enforces allowedModels
# APIM then authenticates to Foundry with its own managed identity
credential = DefaultAzureCredential()
token = credential.get_token("https://cognitiveservices.azure.com/.default")

client = openai.AzureOpenAI(
    azure_endpoint="${url}",
    azure_ad_token=token.token,
    api_version="2024-08-01-preview",
)

response = client.chat.completions.create(
    model="${deployment}",
    messages=[
        {"role": "system", "content": "You are a compliance review agent."},
        {"role": "user", "content": "Analyze this contract clause for risks..."},
    ],
    max_tokens=200,
)
print(response.choices[0].message.content)`;

  if (lang === "javascript") return `import { DefaultAzureCredential } from "@azure/identity";

// Agent authenticates with its managed identity — no API keys
const credential = new DefaultAzureCredential();
const tokenResponse = await credential.getToken(
  "https://cognitiveservices.azure.com/.default"
);

const response = await fetch(
  "${url}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${tokenResponse.token}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are a compliance review agent." },
        { role: "user", content: "Analyze this contract clause..." },
      ],
      max_tokens: 200,
    }),
  }
);
const data = await response.json();
console.log(data.choices[0].message.content);`;

  if (lang === "csharp") return `using Azure.Identity;
using Azure.AI.OpenAI;

// Agent authenticates with its managed identity — no API keys
var credential = new DefaultAzureCredential();
var client = new AzureOpenAIClient(
    new Uri("${url}"),
    credential
);

var chatClient = client.GetChatClient("${deployment}");
var response = await chatClient.CompleteChatAsync(
    new ChatMessage[] {
        new SystemChatMessage("You are a compliance review agent."),
        new UserChatMessage("Analyze this contract clause...")
    },
    new ChatCompletionOptions { MaxOutputTokenCount = 200 }
);
Console.WriteLine(response.Value.Content[0].Text);`;

  // curl
  return `# Get an Entra ID token via Azure CLI (simulates managed identity)
TOKEN=$(az account get-access-token \\
  --resource https://cognitiveservices.azure.com \\
  --query accessToken -o tsv)

curl -X POST "${url}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "system", "content": "You are a compliance review agent."},
      {"role": "user", "content": "Analyze this contract clause for risks..."}
    ],
    "max_tokens": 200
  }'`;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function AgentGatewayDemo() {
  const [selectedScenario, setSelectedScenario] = useState(agentScenarios[0]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [codeLang, setCodeLang] = useState<Lang>("python");
  const [copied, setCopied] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<TestResult[]>([]);

  const gatewayUrl = ""; // Will be filled from env when APIM is deployed

  const handleRunScenario = async (scenario: typeof agentScenarios[0]) => {
    setRunning(true);
    try {
      const res = await fetch("/api/catalog-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bu: scenario.bu,
          deployment: scenario.deployment,
          prompt: scenario.prompt,
          maxTokens: 80,
        }),
      });
      const data: TestResult = await res.json();
      setResults(prev => ({ ...prev, [scenario.id]: data }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [scenario.id]: {
          allowed: false,
          bu: scenario.bu,
          deployment: scenario.deployment,
          steps: [{ step: "Network", status: "fail" as const, detail: err instanceof Error ? err.message : "Fetch failed", durationMs: 0 }],
          totalDurationMs: 0,
        },
      }));
    } finally {
      setRunning(false);
    }
  };

  const handleBatchRun = async () => {
    setBatchRunning(true);
    setBatchResults([]);
    const allResults: TestResult[] = [];
    for (const scenario of agentScenarios) {
      try {
        const res = await fetch("/api/catalog-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bu: scenario.bu,
            deployment: scenario.deployment,
            prompt: scenario.prompt,
            maxTokens: 60,
          }),
        });
        const data: TestResult = await res.json();
        allResults.push(data);
        setBatchResults([...allResults]);
      } catch {
        allResults.push({
          allowed: false,
          bu: scenario.bu,
          deployment: scenario.deployment,
          steps: [],
          totalDurationMs: 0,
        });
        setBatchResults([...allResults]);
      }
    }
    setBatchRunning(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeSample(codeLang, gatewayUrl, selectedScenario.deployment));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const result = results[selectedScenario.id];

  return (
    <div className="space-y-6">

      {/* Flow diagram */}
      <Card className="p-5">
        <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Network size={16} className="text-indigo-400" />
          External Agent → AI Gateway → Foundry Flow
        </h4>
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {[
            { label: "External Agent", sub: "BU app / Copilot / Pipeline", icon: <Bot size={20} />, color: "#6366f1" },
            { label: "Bearer token", sub: "Managed identity → Entra", icon: <ArrowRight size={16} />, color: "#475569", isArrow: true },
            { label: "APIM Gateway", sub: "JWT validation · allowedModels", icon: <Shield size={20} />, color: "#8b5cf6" },
            { label: "APIM MI token", sub: "Managed Identity → Entra", icon: <ArrowRight size={16} />, color: "#475569", isArrow: true },
            { label: "Foundry Hub", sub: "gpt-4o · gpt-4o-mini · embed", icon: <Server size={20} />, color: "#10b981" },
          ].map((node, i) =>
            node.isArrow ? (
              <div key={i} className="flex flex-col items-center gap-1 shrink-0 px-1">
                <ArrowRight size={20} className="text-slate-600" />
                <span className="text-[9px] text-slate-600 whitespace-nowrap">{node.label}</span>
                <span className="text-[8px] text-slate-700 whitespace-nowrap">{node.sub}</span>
              </div>
            ) : (
              <div
                key={i}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border min-w-[140px] shrink-0"
                style={{ borderColor: node.color + "40", backgroundColor: node.color + "08" }}
              >
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: node.color + "20", color: node.color }}>
                  {node.icon}
                </div>
                <span className="text-xs font-semibold text-white text-center">{node.label}</span>
                <span className="text-[10px] text-slate-500 text-center">{node.sub}</span>
              </div>
            )
          )}
        </div>
        <div className="mt-3 px-4 py-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 text-xs text-slate-400">
          <strong className="text-indigo-300">Key insight:</strong> Zero API keys in the entire flow.
          The agent authenticates with its managed identity (Entra ID Bearer token). APIM validates the JWT,
          maps the caller&apos;s identity (oid claim) to a BU, enforces allowedModels, then uses its own managed identity
          to authenticate to Foundry. Identity-based auth end-to-end.
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Scenario runner */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Bot size={16} className="text-indigo-400" />
            Agent Scenarios
            <Badge color="purple">LIVE TEST</Badge>
          </h4>

          {agentScenarios.map((scenario, i) => {
            const sr = results[scenario.id];
            const isSelected = selectedScenario.id === scenario.id;
            return (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  glow
                  onClick={() => setSelectedScenario(scenario)}
                  className={`p-4 ${isSelected ? "ring-1" : ""}`}
                  style={isSelected ? { borderColor: scenario.color + "60", boxShadow: `0 0 20px ${scenario.color}10` } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`p-2 rounded-lg shrink-0 ${
                      scenario.expectedResult === "blocked"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {scenario.expectedResult === "blocked" ? <Lock size={16} /> : <Bot size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-white">{scenario.name}</span>
                        <Badge color={scenario.expectedResult === "blocked" ? "rose" : "green"}>
                          {scenario.expectedResult === "blocked" ? "EXPECT 403" : "EXPECT 200"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{scenario.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px]">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scenario.color }} />
                          <span className="text-slate-500">{scenario.buDisplay}</span>
                        </span>
                        <span className="text-slate-600">→</span>
                        <span className="text-indigo-400 font-mono">{scenario.deployment}</span>
                      </div>
                    </div>

                    {/* Result badge */}
                    <div className="shrink-0">
                      {sr ? (
                        sr.allowed ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            <span className="text-[9px] text-emerald-400 mt-0.5">{sr.totalDurationMs}ms</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <XCircle size={18} className="text-rose-400" />
                            <span className="text-[9px] text-rose-400 mt-0.5">403</span>
                          </div>
                        )
                      ) : (
                        <ChevronRight size={16} className="text-slate-600" />
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}

          {/* Batch run button */}
          <div className="flex gap-3">
            <button
              onClick={() => handleRunScenario(selectedScenario)}
              disabled={running}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium hover:bg-indigo-500/20 transition-all disabled:opacity-50"
            >
              {running ? <Zap size={14} className="animate-pulse" /> : <Play size={14} />}
              {running ? "Running..." : "Run Selected"}
            </button>
            <button
              onClick={handleBatchRun}
              disabled={batchRunning || running}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/20 transition-all disabled:opacity-50"
            >
              {batchRunning ? <Zap size={14} className="animate-pulse" /> : <Terminal size={14} />}
              {batchRunning ? `${batchResults.length}/${agentScenarios.length}` : "Run All"}
            </button>
          </div>
        </div>

        {/* Right: Code sample + result */}
        <div className="space-y-4">

          {/* Code sample */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Code2 size={16} className="text-indigo-400" />
                Agent Code Sample
              </h4>
              <div className="flex items-center gap-1 bg-[#0d1225] rounded-lg p-0.5 border border-[#2d3561]">
                {(["python", "javascript", "csharp", "curl"] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setCodeLang(lang)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      codeLang === lang
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                        : "text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {lang === "csharp" ? "C#" : lang === "javascript" ? "JS" : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <Card className="relative overflow-hidden">
              <div className="absolute top-2 right-2 z-10 flex gap-1.5">
                <button onClick={handleCopy} className="p-1.5 rounded-md bg-[#0d1225] border border-[#2d3561] text-slate-500 hover:text-white transition-colors">
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <pre className="p-4 text-[11px] text-slate-300 font-mono leading-relaxed overflow-x-auto max-h-[320px]">
                <code>{getCodeSample(codeLang, gatewayUrl, selectedScenario.deployment)}</code>
              </pre>
            </Card>

            {/* Managed identity info */}
            <div className="mt-2 p-3 rounded-lg bg-[#0d1225] border border-[#2d3561]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Authentication</span>
                <Lock size={12} className="text-emerald-400" />
              </div>
              <div className="font-mono text-xs text-emerald-400">
                Managed Identity → DefaultAzureCredential
              </div>
              <p className="text-[10px] text-slate-600 mt-1">
                Each BU agent authenticates with its managed identity. APIM validates the Entra token and maps the caller&apos;s
                <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded mx-0.5">oid</code> claim to a BU product to enforce allowedModels. No secrets to rotate.
              </p>
            </div>
          </div>

          {/* Live result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={selectedScenario.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Terminal size={16} className="text-indigo-400" />
                  Gateway Trace
                </h4>
                <Card className={`p-4 border ${result.allowed ? "border-emerald-500/20" : "border-rose-500/20"}`}>
                  {/* Status header */}
                  <div className={`flex items-center gap-2 mb-3 pb-3 border-b ${result.allowed ? "border-emerald-500/10" : "border-rose-500/10"}`}>
                    {result.allowed ? (
                      <><CheckCircle2 size={16} className="text-emerald-400" /><span className="text-sm text-emerald-300 font-medium">200 OK — Model access granted</span></>
                    ) : (
                      <><XCircle size={16} className="text-rose-400" /><span className="text-sm text-rose-300 font-medium">403 Forbidden — Blocked by gateway policy</span></>
                    )}
                    <span className="ml-auto text-xs text-slate-600">{result.totalDurationMs}ms</span>
                  </div>

                  {/* Step trace */}
                  <div className="space-y-2">
                    {result.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {step.status === "pass" ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                              <CheckCircle2 size={10} className="text-emerald-400" />
                            </div>
                          ) : step.status === "fail" ? (
                            <div className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center">
                              <XCircle size={10} className="text-rose-400" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-slate-500/20 flex items-center justify-center">
                              <ArrowRight size={10} className="text-slate-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${step.status === "fail" ? "text-rose-300" : "text-slate-300"}`}>
                              {step.step}
                            </span>
                            <span className="text-[10px] text-slate-600">{step.durationMs}ms</span>
                          </div>
                          <p className={`text-[10px] leading-relaxed ${step.status === "fail" ? "text-rose-400/80" : "text-slate-600"}`}>
                            {step.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Response content */}
                  {result.allowed && result.response && (
                    <div className="mt-3 p-3 rounded-lg bg-[#0d1225] border border-emerald-500/15">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase">Agent Response</span>
                        {result.response.usage && (
                          <span className="text-[10px] text-slate-600">{result.response.usage.total_tokens} tokens · {result.response.model}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{result.response.content}</p>
                    </div>
                  )}

                  {/* Error detail */}
                  {!result.allowed && result.error && (
                    <div className="mt-3 p-3 rounded-lg bg-[#0d1225] border border-rose-500/15">
                      <div className="text-[10px] text-rose-400 font-semibold uppercase mb-1">Gateway Policy Response</div>
                      <p className="text-xs text-rose-300 font-mono">{result.error.code}: {result.error.message}</p>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Governance explainer */}
      <Card className="p-5 border-indigo-500/20 bg-indigo-500/5">
        <div className="flex gap-3">
          <Shield size={20} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-indigo-300">How External Agents Use the AI Gateway</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="p-3 rounded-lg bg-[#0d1225] border border-[#2d3561]">
                <div className="text-indigo-300 font-semibold mb-1">1. Agent uses its managed identity</div>
                <p>The BU app/agent calls <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">DefaultAzureCredential</code> to
                   get an Entra ID Bearer token. No API keys, no secrets — just the identity assigned to the compute.</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0d1225] border border-[#2d3561]">
                <div className="text-indigo-300 font-semibold mb-1">2. APIM validates the JWT</div>
                <p>APIM&apos;s <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">validate-azure-ad-token</code> policy
                   verifies the token, extracts the <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">oid</code> claim,
                   and maps it to a BU to determine which models the caller can access.</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0d1225] border border-[#2d3561]">
                <div className="text-indigo-300 font-semibold mb-1">3. APIM authenticates to Foundry</div>
                <p>APIM uses its own managed identity to acquire a separate Entra token scoped to
                   <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">cognitiveservices.azure.com</code> and
                   forwards the request. Identity-based auth end-to-end.</p>
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-300">Why managed identities over API keys?</strong> No secrets to rotate, no keys to leak,
              no credential sprawl. The caller&apos;s identity is cryptographically verified by Entra ID. BU mapping is based on the
              principal&apos;s object ID — adding a new agent is an IaC change (add the MI&apos;s principal ID to
              <strong className="text-indigo-300"> callerPrincipalIds</strong>), not a key distribution problem.
              This is <strong className="text-indigo-300">Zero Trust</strong> for AI model access.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
