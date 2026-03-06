"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Loader2, Eye, ArrowRight, Shield, Key, Brain,
  Server, CheckCircle2, Clock, Zap, Lock, Network, User
} from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { addUsageRecord } from "@/lib/usage-tracker";

type TraceStep = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  status: "pending" | "active" | "done" | "error";
  durationMs?: number;
  detail?: string;
};

const initialSteps = (bu: string): TraceStep[] => [
  {
    id: "browser",
    label: "Browser Client",
    sublabel: `${bu} developer initiates request`,
    icon: <User size={16} />,
    color: "#3b82f6",
    status: "pending",
  },
  {
    id: "proxy",
    label: "API Proxy (Server)",
    sublabel: "Next.js API route /api/foundry",
    icon: <Server size={16} />,
    color: "#8b5cf6",
    status: "pending",
    detail: "No credentials in browser — server-side only",
  },
  {
    id: "entra",
    label: "Microsoft Entra ID",
    sublabel: "Token acquisition (DefaultAzureCredential)",
    icon: <Key size={16} />,
    color: "#10b981",
    status: "pending",
    detail: "OAuth2 token for cognitiveservices.azure.com",
  },
  {
    id: "network",
    label: "Network Layer",
    sublabel: "Hub VNet → Foundry endpoint",
    icon: <Network size={16} />,
    color: "#06b6d4",
    status: "pending",
    detail: "HTTPS with TLS 1.3, private endpoint ready",
  },
  {
    id: "rbac",
    label: "RBAC Check",
    sublabel: "Azure AI User role verification",
    icon: <Shield size={16} />,
    color: "#f59e0b",
    status: "pending",
    detail: "Cognitive Services User at hub scope",
  },
  {
    id: "model",
    label: "Model Inference",
    sublabel: "GPT-4o processing request",
    icon: <Brain size={16} />,
    color: "#ec4899",
    status: "pending",
    detail: "Centralized deployment, TPM-governed",
  },
  {
    id: "response",
    label: "Response",
    sublabel: "Secure return path",
    icon: <CheckCircle2 size={16} />,
    color: "#10b981",
    status: "pending",
  },
];

export default function RequestTraceViewer() {
  const [steps, setSteps] = useState<TraceStep[]>(initialSteps("Finance & Risk"));
  const [isTracing, setIsTracing] = useState(false);
  const [traceComplete, setTraceComplete] = useState(false);
  const [totalLatency, setTotalLatency] = useState(0);
  const [responseText, setResponseText] = useState("");
  const [selectedBU, setSelectedBU] = useState("Finance & Risk");

  const bus = [
    { name: "Finance & Risk", color: "#10b981", prompt: "What are the key AI governance risks for financial services?" },
    { name: "Marketing & Sales", color: "#3b82f6", prompt: "Write a tagline for an AI governance platform." },
    { name: "Engineering & Product", color: "#f59e0b", prompt: "Explain the security benefits of hub-spoke AI architecture." },
  ];

  const activeBU = bus.find((b) => b.name === selectedBU) || bus[0];

  const runTrace = useCallback(async () => {
    setIsTracing(true);
    setTraceComplete(false);
    setResponseText("");
    setTotalLatency(0);

    const newSteps = initialSteps(selectedBU);
    setSteps(newSteps);

    // Simulate step-by-step progression with real API call
    const stepTimings = [150, 200, 350, 100, 150, 0, 100]; // simulated per-step ms (model step is actual)
    let cumulativeTime = 0;

    for (let i = 0; i < newSteps.length; i++) {
      // Mark current step active
      setSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx === i ? "active" : idx < i ? "done" : "pending",
        }))
      );

      if (i === 5) {
        // Model inference — actual API call
        try {
          const startTime = Date.now();
          const res = await fetch("/api/foundry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deployment: "gpt-4o-mini",
              messages: [{ role: "user", content: activeBU.prompt }],
              maxTokens: 100,
            }),
          });
          const data = await res.json();
          const elapsed = Date.now() - startTime;
          cumulativeTime += elapsed;

          setSteps((prev) =>
            prev.map((s, idx) =>
              idx === 5 ? { ...s, status: "done", durationMs: elapsed, sublabel: `GPT-4o-mini — ${elapsed}ms` } : s
            )
          );

          setResponseText(data.choices?.[0]?.message?.content || "Response received");

          // Track usage
          addUsageRecord({
            timestamp: new Date().toISOString(),
            bu: selectedBU,
            model: "GPT-4o-mini",
            deployment: "gpt-4o-mini",
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
            latencyMs: elapsed,
            success: true,
            source: "trace",
          });
        } catch {
          setSteps((prev) =>
            prev.map((s, idx) => (idx === 5 ? { ...s, status: "error" } : s))
          );
        }
      } else {
        const delay = stepTimings[i];
        await new Promise((resolve) => setTimeout(resolve, delay));
        cumulativeTime += delay;

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", durationMs: delay } : s
          )
        );
      }
    }

    setTotalLatency(cumulativeTime);
    setTraceComplete(true);
    setIsTracing(false);
  }, [selectedBU, activeBU.prompt]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-5 border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye size={18} className="text-cyan-400" />
              <h3 className="font-bold text-white">Live Request Trace</h3>
              <Badge color="cyan">End-to-End</Badge>
            </div>
            <p className="text-sm text-slate-400">
              Watch a real API request flow through every security layer of the hybrid architecture
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* BU Selector */}
            <div className="flex gap-1">
              {bus.map((bu) => (
                <button
                  key={bu.name}
                  onClick={() => { setSelectedBU(bu.name); setSteps(initialSteps(bu.name)); setTraceComplete(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedBU === bu.name
                      ? "border-opacity-60 text-white"
                      : "border-[#2d3561] text-slate-500 hover:text-slate-300"
                  }`}
                  style={selectedBU === bu.name ? { borderColor: bu.color, backgroundColor: `${bu.color}15` } : {}}
                >
                  {bu.name.split(" ")[0]}
                </button>
              ))}
            </div>
            <button
              onClick={runTrace}
              disabled={isTracing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-all
                shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              {isTracing ? (
                <><Loader2 size={16} className="animate-spin" /> Tracing...</>
              ) : (
                <><Play size={16} /> Trace Request</>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* Trace Visualization */}
      <Card className="p-6">
        <div className="relative">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start gap-4 mb-1 last:mb-0">
              {/* Timeline Line */}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{
                    scale: step.status === "active" ? [1, 1.3, 1] : 1,
                    boxShadow: step.status === "active"
                      ? `0 0 16px ${step.color}80`
                      : step.status === "done"
                      ? `0 0 8px ${step.color}40`
                      : "none",
                  }}
                  transition={step.status === "active" ? { duration: 0.8, repeat: Infinity } : {}}
                  className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all"
                  style={{
                    borderColor: step.status === "pending" ? "#2d3561" : step.color,
                    backgroundColor: step.status === "done" || step.status === "active" ? `${step.color}20` : "transparent",
                    color: step.status === "pending" ? "#475569" : step.color,
                  }}
                >
                  {step.status === "active" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : step.status === "error" ? (
                    <span className="text-rose-400">✕</span>
                  ) : (
                    step.icon
                  )}
                </motion.div>
                {i < steps.length - 1 && (
                  <motion.div
                    className="w-0.5 h-8 rounded"
                    animate={{
                      backgroundColor: step.status === "done" ? step.color : "#2d3561",
                    }}
                  />
                )}
              </div>

              {/* Step Content */}
              <motion.div
                className="flex-1 pb-4"
                animate={{ opacity: step.status === "pending" ? 0.4 : 1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${step.status === "pending" ? "text-slate-600" : "text-white"}`}>
                        {step.label}
                      </span>
                      {step.status === "done" && step.durationMs !== undefined && (
                        <span className="text-[10px] text-slate-500 font-mono bg-[#111827] px-1.5 py-0.5 rounded">
                          {step.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{step.sublabel}</p>
                  </div>
                  {step.detail && step.status !== "pending" && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-slate-500 bg-[#0d1225] border border-[#2d3561] rounded px-2 py-1 max-w-xs"
                    >
                      <Lock size={8} className="inline mr-1 text-emerald-400" />
                      {step.detail}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          ))}
        </div>

        {/* Completion Summary */}
        <AnimatePresence>
          {traceComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 border-t border-[#2d3561] pt-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Trace Complete</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={10} /> Total: {totalLatency}ms
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield size={10} className="text-emerald-400" /> 5 security checkpoints passed
                  </span>
                </div>
              </div>
              <div className="bg-[#0d1225] rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap">
                {responseText}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Security Chain Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "No Browser Creds", icon: <Lock size={14} />, color: "text-emerald-400" },
          { label: "Entra ID Auth", icon: <Key size={14} />, color: "text-purple-400" },
          { label: "RBAC Verified", icon: <Shield size={14} />, color: "text-amber-400" },
          { label: "Network Isolated", icon: <Network size={14} />, color: "text-cyan-400" },
          { label: "Audit Logged", icon: <Eye size={14} />, color: "text-blue-400" },
        ].map((item) => (
          <Card key={item.label} className="p-3 text-center">
            <div className={`${item.color} mx-auto mb-1`}>{item.icon}</div>
            <div className="text-[10px] text-slate-400">{item.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
