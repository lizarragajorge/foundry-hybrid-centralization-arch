"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Loader2, Zap, Clock, Hash, MessageSquare,
  Sparkles, ArrowRight, RotateCcw, ChevronDown
} from "lucide-react";
import { simulationScenarios, SimulationScenario } from "@/lib/config";
import { Card, Badge } from "@/components/ui/shared";
import { addUsageRecord } from "@/lib/usage-tracker";

type SimResult = {
  scenario: SimulationScenario;
  response: string;
  tokens: { prompt: number; completion: number; total: number };
  latencyMs: number;
  embeddingDims?: number;
  timestamp: string;
};

export default function SimulationPanel() {
  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(simulationScenarios[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SimResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async (scenario: SimulationScenario) => {
    setIsRunning(true);
    setError(null);

    try {
      const isEmbedding = scenario.deployment.includes("embedding");

      const body = isEmbedding
        ? { deployment: scenario.deployment, input: scenario.userPrompt }
        : {
            deployment: scenario.deployment,
            messages: [
              ...(scenario.systemPrompt ? [{ role: "system", content: scenario.systemPrompt }] : []),
              { role: "user", content: scenario.userPrompt },
            ],
            maxTokens: 250,
          };

      const res = await fetch("/api/foundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "API call failed");
        return;
      }

      const result: SimResult = {
        scenario,
        response: isEmbedding
          ? `Generated ${data.data?.[0]?.embedding?.length || 0}-dimensional embedding vector`
          : data.choices?.[0]?.message?.content || "No response",
        tokens: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
        latencyMs: data._meta?.latencyMs || 0,
        embeddingDims: isEmbedding ? data.data?.[0]?.embedding?.length : undefined,
        timestamp: new Date().toISOString(),
      };

      setResults((prev) => [result, ...prev]);

      // Track usage for cost attribution
      addUsageRecord({
        timestamp: result.timestamp,
        bu: scenario.bu,
        model: scenario.model,
        deployment: scenario.deployment,
        promptTokens: result.tokens.prompt,
        completionTokens: result.tokens.completion,
        totalTokens: result.tokens.total,
        latencyMs: result.latencyMs,
        success: true,
        source: "simulation",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsRunning(false);
    }
  }, []);

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Scenario Picker (Left) */}
      <div className="col-span-4 space-y-3">
        <p className="text-sm text-slate-400 mb-3 font-medium">Select a BU scenario</p>
        {simulationScenarios.map((scenario) => (
          <motion.div
            key={scenario.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Card
              glow
              className={`p-4 cursor-pointer transition-all ${
                activeScenario.id === scenario.id ? "border-indigo-500/60 bg-indigo-500/5" : ""
              }`}
              onClick={() => setActiveScenario(scenario)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scenario.color }} />
                  <span className="font-medium text-sm">{scenario.name}</span>
                </div>
                <Badge color={scenario.model.includes("4o-mini") ? "blue" : scenario.model.includes("Embed") ? "amber" : "purple"}>
                  {scenario.model}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">{scenario.bu}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Execution Panel (Right) */}
      <div className="col-span-8 space-y-4">
        {/* Active Scenario Details */}
        <Card className="p-5 border-indigo-500/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} style={{ color: activeScenario.color }} />
                <h3 className="text-lg font-bold">{activeScenario.name}</h3>
                <Badge color="purple">{activeScenario.bu}</Badge>
              </div>
              <p className="text-sm text-slate-400">
                Model: <span className="text-white">{activeScenario.model}</span> &middot;
                Deployment: <span className="text-cyan-400">{activeScenario.deployment}</span>
              </p>
            </div>
            <button
              onClick={() => runSimulation(activeScenario)}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-all
                shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            >
              {isRunning ? (
                <><Loader2 size={16} className="animate-spin" /> Running...</>
              ) : (
                <><Play size={16} /> Run Simulation</>
              )}
            </button>
          </div>

          {/* Prompt Preview */}
          <div className="space-y-2">
            {activeScenario.systemPrompt && (
              <div className="bg-[#0d1225] rounded-lg p-3 text-sm">
                <span className="text-purple-400 text-xs font-medium">SYSTEM</span>
                <p className="text-slate-300 mt-1">{activeScenario.systemPrompt}</p>
              </div>
            )}
            <div className="bg-[#0d1225] rounded-lg p-3 text-sm">
              <span className="text-blue-400 text-xs font-medium">USER</span>
              <p className="text-slate-300 mt-1">{activeScenario.userPrompt}</p>
            </div>
          </div>

          {/* Security Callout */}
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
            <Zap size={12} />
            Request routed through server-side API proxy &middot; Entra ID token auth &middot; No API keys in browser
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="p-4 border-rose-500/30 bg-rose-500/5">
            <p className="text-sm text-rose-400">{error}</p>
          </Card>
        )}

        {/* Results Stream */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-400">
              Results {results.length > 0 && `(${results.length})`}
            </h4>
            {results.length > 0 && (
              <button
                onClick={() => setResults([])}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={10} /> Clear
              </button>
            )}
          </div>

          <AnimatePresence>
            {results.map((result, i) => (
              <motion.div
                key={result.timestamp}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: result.scenario.color }} />
                      <span className="font-medium text-sm">{result.scenario.name}</span>
                      <ArrowRight size={12} className="text-slate-600" />
                      <Badge color={result.scenario.model.includes("4o-mini") ? "blue" : result.scenario.model.includes("Embed") ? "amber" : "purple"}>
                        {result.scenario.model}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {result.latencyMs}ms</span>
                      <span className="flex items-center gap-1"><Hash size={10} /> {result.tokens.total} tokens</span>
                    </div>
                  </div>
                  <div className="bg-[#0d1225] rounded-lg p-3 text-sm text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {result.response}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Prompt: {result.tokens.prompt}</span>
                    <span>Completion: {result.tokens.completion}</span>
                    {result.embeddingDims && <span>Dimensions: {result.embeddingDims}</span>}
                    <span className="ml-auto">{new Date(result.timestamp).toLocaleTimeString()}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {results.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Run a simulation to see results here</p>
              <p className="text-xs mt-1">Each call goes through the live Azure Foundry deployment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
