"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Play, Loader2, Clock, Hash, Zap, Trophy,
  ArrowRight, RotateCcw, ChevronDown, Scale
} from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { addUsageRecord } from "@/lib/usage-tracker";

type ArenaResult = {
  model: string;
  deployment: string;
  response: string;
  tokens: { prompt: number; completion: number; total: number };
  latencyMs: number;
  costEstimate: number;
};

type ArenaRound = {
  id: string;
  prompt: string;
  results: ArenaResult[];
  timestamp: string;
  winner: string | null;
};

const ARENA_PROMPTS = [
  {
    label: "Strategy Analysis",
    prompt: "In 3 bullet points, analyze the competitive advantage of a hub-spoke AI governance model for enterprise. Be specific about cost and security benefits.",
  },
  {
    label: "Code Generation",
    prompt: "Write a Python function that validates Azure RBAC role assignments against a least-privilege policy. Include type hints and a docstring.",
  },
  {
    label: "Creative Writing",
    prompt: "Write a compelling 2-sentence elevator pitch for a platform that lets enterprises govern AI usage across 50+ business units while enabling developer self-service.",
  },
  {
    label: "Data Extraction",
    prompt: "Extract structured JSON from this text: 'Contoso Finance team used GPT-4o for 1,250 requests in March, consuming 45,000 tokens at $0.005/1K. Marketing used GPT-4o-mini for 3,800 requests, 89,000 tokens at $0.00015/1K.'",
  },
  {
    label: "Summarization",
    prompt: "Summarize in exactly 2 sentences: Azure Foundry provides a centralized governance boundary using Microsoft.CognitiveServices/accounts resources with federated projects as child resources, enabling hub-spoke model deployment patterns with RBAC isolation, Azure Policy enforcement, and centralized observability through Log Analytics diagnostic settings.",
  },
];

// Cost per 1K tokens (approximate Azure pricing)
const COST_RATES: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 0.005, completion: 0.015 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
};

function estimateCost(deployment: string, promptTokens: number, completionTokens: number): number {
  const rate = COST_RATES[deployment] || { prompt: 0.005, completion: 0.015 };
  return (promptTokens / 1000) * rate.prompt + (completionTokens / 1000) * rate.completion;
}

export default function ModelArena() {
  const [selectedPrompt, setSelectedPrompt] = useState(ARENA_PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState<ArenaRound[]>([]);

  const runArena = useCallback(async () => {
    setIsRunning(true);
    const prompt = useCustom ? customPrompt : selectedPrompt.prompt;
    if (!prompt.trim()) { setIsRunning(false); return; }

    const models = [
      { name: "GPT-4o", deployment: "gpt-4o" },
      { name: "GPT-4o-mini", deployment: "gpt-4o-mini" },
    ];

    const results: ArenaResult[] = [];

    // Fire both in parallel
    const promises = models.map(async (model) => {
      const res = await fetch("/api/foundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployment: model.deployment,
          messages: [{ role: "user", content: prompt }],
          maxTokens: 300,
        }),
      });
      const data = await res.json();
      return {
        model: model.name,
        deployment: model.deployment,
        response: data.choices?.[0]?.message?.content || data.error || "No response",
        tokens: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
        latencyMs: data._meta?.latencyMs || 0,
        costEstimate: estimateCost(
          model.deployment,
          data.usage?.prompt_tokens || 0,
          data.usage?.completion_tokens || 0
        ),
      };
    });

    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.push(s.value);
        // Track usage
        addUsageRecord({
          timestamp: new Date().toISOString(),
          bu: "AI CoE",
          model: s.value.model,
          deployment: s.value.deployment,
          promptTokens: s.value.tokens.prompt,
          completionTokens: s.value.tokens.completion,
          totalTokens: s.value.tokens.total,
          latencyMs: s.value.latencyMs,
          success: true,
          source: "arena",
        });
      }
    }

    // Determine winner by latency (lower is better)
    const winner = results.length === 2
      ? results[0].latencyMs <= results[1].latencyMs ? results[0].model : results[1].model
      : null;

    const round: ArenaRound = {
      id: Date.now().toString(),
      prompt,
      results,
      timestamp: new Date().toISOString(),
      winner,
    };

    setRounds((prev) => [round, ...prev]);
    setIsRunning(false);
  }, [selectedPrompt, customPrompt, useCustom]);

  return (
    <div className="space-y-6">
      {/* Prompt Selection */}
      <Card className="p-5 border-indigo-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Swords size={18} className="text-indigo-400" />
          <h3 className="font-bold text-white">Model Comparison Arena</h3>
          <Badge color="purple">GPT-4o vs GPT-4o-mini</Badge>
        </div>

        {/* Preset Prompts */}
        <div className="flex flex-wrap gap-2 mb-3">
          {ARENA_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setSelectedPrompt(p); setUseCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                !useCustom && selectedPrompt.label === p.label
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                  : "border-[#2d3561] text-slate-500 hover:text-slate-300 hover:border-slate-500"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setUseCustom(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              useCustom
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "border-[#2d3561] text-slate-500 hover:text-slate-300"
            }`}
          >
            Custom
          </button>
        </div>

        {/* Prompt Display / Input */}
        {useCustom ? (
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your custom prompt..."
            className="w-full bg-[#0d1225] border border-[#2d3561] rounded-lg p-3 text-sm text-slate-300 resize-none h-20 focus:outline-none focus:border-indigo-500/40"
          />
        ) : (
          <div className="bg-[#0d1225] rounded-lg p-3 text-sm text-slate-300">
            {selectedPrompt.prompt}
          </div>
        )}

        {/* Run Button */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-slate-500">
            Both models receive identical prompts, run in parallel
          </div>
          <button
            onClick={runArena}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
              bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500
              disabled:opacity-50 disabled:cursor-not-allowed transition-all
              shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
          >
            {isRunning ? (
              <><Loader2 size={16} className="animate-spin" /> Running both models...</>
            ) : (
              <><Swords size={16} /> Run Comparison</>
            )}
          </button>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {rounds.map((round) => (
          <motion.div
            key={round.id}
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="p-5 border-[#2d3561]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs text-slate-500">
                  {new Date(round.timestamp).toLocaleTimeString()}
                </div>
                {rounds.length > 0 && (
                  <button
                    onClick={() => setRounds((prev) => prev.filter((r) => r.id !== round.id))}
                    className="text-xs text-slate-600 hover:text-slate-400"
                  >
                    Dismiss
                  </button>
                )}
              </div>

              {/* Side by Side Results */}
              <div className="grid grid-cols-2 gap-4">
                {round.results.map((result) => {
                  const isWinner = result.model === round.winner;
                  return (
                    <div
                      key={result.model}
                      className={`bg-[#0d1225] rounded-xl p-4 border ${
                        isWinner ? "border-emerald-500/30" : "border-[#2d3561]"
                      }`}
                    >
                      {/* Model Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{result.model}</span>
                          {isWinner && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <Trophy size={10} /> Faster
                            </span>
                          )}
                        </div>
                        <Badge color={result.model.includes("mini") ? "blue" : "purple"}>
                          {result.deployment}
                        </Badge>
                      </div>

                      {/* Response */}
                      <div className="text-sm text-slate-300 bg-[#111827] rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap mb-3">
                        {result.response}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Latency</div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                            <Clock size={12} className="text-cyan-400" />
                            {result.latencyMs}ms
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Tokens</div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                            <Hash size={12} className="text-purple-400" />
                            {result.tokens.total}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Est. Cost</div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
                            <Zap size={12} className="text-amber-400" />
                            ${result.costEstimate.toFixed(5)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparison Summary */}
              {round.results.length === 2 && (
                <div className="mt-4 bg-[#111827] rounded-lg p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500">Speed difference:</span>
                    <span className="text-white font-mono">
                      {Math.abs(round.results[0].latencyMs - round.results[1].latencyMs)}ms
                    </span>
                    <span className="text-slate-500">Cost savings with mini:</span>
                    <span className="text-emerald-400 font-mono">
                      {round.results[0].costEstimate > 0
                        ? `${((1 - round.results[1].costEstimate / round.results[0].costEstimate) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Scale size={12} />
                    Quality vs Cost tradeoff
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {rounds.length === 0 && (
        <div className="text-center py-16 text-slate-600">
          <Swords size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a prompt and run a comparison</p>
          <p className="text-xs mt-1">Both models receive the same input, run in parallel against the centralized hub</p>
        </div>
      )}
    </div>
  );
}
