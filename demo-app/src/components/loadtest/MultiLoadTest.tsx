"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge, Play, Loader2, Square, BarChart3, Clock, Hash,
  Zap, CheckCircle2, XCircle, AlertTriangle, Users
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
  ZAxis
} from "recharts";
import { Card, Badge, MetricCard } from "@/components/ui/shared";
import { addUsageRecord } from "@/lib/usage-tracker";

type LoadResult = {
  bu: string;
  model: string;
  latencyMs: number;
  tokens: number;
  success: boolean;
  error?: string;
  timestamp: number;
};

const BU_CONFIGS = [
  { name: "Finance", deployment: "gpt-4o", prompt: "Analyze risk.", color: "#10b981", icon: "F" },
  { name: "Marketing", deployment: "gpt-4o-mini", prompt: "Write copy.", color: "#3b82f6", icon: "M" },
  { name: "Engineering", deployment: "gpt-4o-mini", prompt: "Review code.", color: "#f59e0b", icon: "E" },
];

export default function MultiLoadTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<LoadResult[]>([]);
  const [concurrency, setConcurrency] = useState(3);
  const [rounds, setRounds] = useState(2);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  const runLoadTest = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    abortRef.current = false;

    const totalRequests = concurrency * rounds;
    setProgress({ current: 0, total: totalRequests });

    const allResults: LoadResult[] = [];

    for (let round = 0; round < rounds; round++) {
      if (abortRef.current) break;

      // Fire concurrent requests (one per BU, up to concurrency)
      const batch = BU_CONFIGS.slice(0, concurrency).map(async (bu) => {
        const startTime = Date.now();
        try {
          const res = await fetch("/api/foundry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deployment: bu.deployment,
              messages: [
                { role: "user", content: `${bu.prompt} Round ${round + 1}. Be very brief (1 sentence).` },
              ],
              maxTokens: 40,
            }),
          });
          const data = await res.json();
          const latency = Date.now() - startTime;

          const result: LoadResult = {
            bu: bu.name,
            model: bu.deployment,
            latencyMs: latency,
            tokens: data.usage?.total_tokens || 0,
            success: res.ok,
            error: !res.ok ? data.error : undefined,
            timestamp: Date.now(),
          };
          return result;
        } catch (err) {
          return {
            bu: bu.name,
            model: bu.deployment,
            latencyMs: Date.now() - startTime,
            tokens: 0,
            success: false,
            error: err instanceof Error ? err.message : "Network error",
            timestamp: Date.now(),
          };
        }
      });

      const batchResults = await Promise.all(batch);
      // Track usage for each result
      for (const r of batchResults) {
        addUsageRecord({
          timestamp: new Date().toISOString(),
          bu: r.bu,
          model: r.model,
          deployment: r.model,
          promptTokens: Math.round(r.tokens * 0.4),
          completionTokens: Math.round(r.tokens * 0.6),
          totalTokens: r.tokens,
          latencyMs: r.latencyMs,
          success: r.success,
          source: "loadtest",
        });
      }
      allResults.push(...batchResults);
      setResults([...allResults]);
      setProgress((p) => ({ ...p, current: allResults.length }));
    }

    setIsRunning(false);
  }, [concurrency, rounds]);

  const stopTest = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
  }, []);

  // Computed stats
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const avgLatency = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length)
    : 0;
  const p95Latency = results.length > 0
    ? results.map((r) => r.latencyMs).sort((a, b) => a - b)[Math.floor(results.length * 0.95)] || 0
    : 0;
  const totalTokens = results.reduce((s, r) => s + r.tokens, 0);

  // Per-BU latency breakdown chart data
  const buLatencyData = BU_CONFIGS.map((bu) => {
    const buResults = results.filter((r) => r.bu === bu.name && r.success);
    const avg = buResults.length > 0
      ? Math.round(buResults.reduce((s, r) => s + r.latencyMs, 0) / buResults.length)
      : 0;
    return { name: bu.name, latency: avg, color: bu.color, count: buResults.length };
  }).filter((d) => d.count > 0);

  // Scatter data for latency distribution
  const scatterData = results
    .filter((r) => r.success)
    .map((r, i) => ({
      x: i,
      y: r.latencyMs,
      bu: r.bu,
      color: BU_CONFIGS.find((b) => b.name === r.bu)?.color || "#6366f1",
    }));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-5 border-indigo-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={18} className="text-amber-400" />
              <h3 className="font-bold text-white">Multi-BU Load Test</h3>
              <Badge color="amber">Concurrent</Badge>
            </div>
            <p className="text-sm text-slate-400">
              Simultaneously fire requests from multiple BUs to test TPM governance and fair queuing
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Concurrency Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">BUs:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setConcurrency(n)}
                  disabled={isRunning}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                    concurrency === n
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "border-[#2d3561] text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Rounds Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Rounds:</span>
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  disabled={isRunning}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                    rounds === n
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "border-[#2d3561] text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {isRunning ? (
              <button
                onClick={stopTest}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                  bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 transition-all"
              >
                <Square size={14} /> Stop
              </button>
            ) : (
              <button
                onClick={runLoadTest}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                  bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 transition-all
                  shadow-[0_0_20px_rgba(245,158,11,0.3)]"
              >
                <Play size={16} /> Run Load Test
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {(isRunning || results.length > 0) && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{progress.current} / {progress.total} requests</span>
              <span>{concurrency} concurrent BU{concurrency > 1 ? "s" : ""} × {rounds} round{rounds > 1 ? "s" : ""}</span>
            </div>
            <div className="w-full h-2 bg-[#111827] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Live Results Feed */}
      {results.length > 0 && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-5 gap-4">
            <MetricCard label="Total Requests" value={results.length} icon={<BarChart3 size={18} />} />
            <MetricCard label="Success" value={successCount} icon={<CheckCircle2 size={18} />} />
            <MetricCard label="Failed" value={failCount} icon={<XCircle size={18} />} />
            <MetricCard label="Avg Latency" value={`${avgLatency}ms`} icon={<Clock size={18} />} />
            <MetricCard label="P95 Latency" value={`${p95Latency}ms`} icon={<Gauge size={18} />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            {/* Per-BU Avg Latency */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users size={14} className="text-indigo-400" />
                Avg Latency by Business Unit
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buLatencyData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip
                      contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }}
                      formatter={(value: any) => [`${value}ms`, "Avg Latency"]}
                    />
                    <Bar dataKey="latency" radius={[4, 4, 0, 0]}>
                      {buLatencyData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Latency Distribution Scatter */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                Latency Distribution (All Requests)
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                    <XAxis dataKey="x" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#2d3561" }} label={{ value: "Request #", fill: "#64748b", fontSize: 10 }} />
                    <YAxis dataKey="y" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#2d3561" }} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip
                      contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }}
                      formatter={(value: any, name: any) => [name === "y" ? `${value}ms` : value, name === "y" ? "Latency" : "Request"]}
                    />
                    <Scatter data={scatterData} fill="#8b5cf6">
                      {scatterData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Request Log Table */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Request Log</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#1a1f36]">
                  <tr className="border-b border-[#2d3561]">
                    <th className="text-left py-2 text-slate-500 font-medium">#</th>
                    <th className="text-left py-2 text-slate-500 font-medium">BU</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Model</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Latency</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Tokens</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, backgroundColor: "rgba(99,102,241,0.1)" }}
                      animate={{ opacity: 1, backgroundColor: "transparent" }}
                      className="border-b border-[#2d3561]/30 hover:bg-indigo-500/5"
                    >
                      <td className="py-1.5 text-slate-600 font-mono">{i + 1}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: BU_CONFIGS.find((b) => b.name === r.bu)?.color }}
                          />
                          <span className="text-slate-300">{r.bu}</span>
                        </div>
                      </td>
                      <td className="py-1.5 text-slate-400 font-mono">{r.model}</td>
                      <td className="py-1.5 text-right font-mono text-white">{r.latencyMs}ms</td>
                      <td className="py-1.5 text-right font-mono text-slate-400">{r.tokens}</td>
                      <td className="py-1.5 text-right">
                        {r.success ? (
                          <CheckCircle2 size={12} className="inline text-emerald-400" />
                        ) : (
                          <XCircle size={12} className="inline text-rose-400" />
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* TPM Governance Note */}
          <Card className="p-4 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5" />
              <div className="text-xs text-slate-400">
                <strong className="text-amber-300">TPM Governance in Action:</strong> Each model deployment has a Tokens-Per-Minute limit
                (GPT-4o: 30K, GPT-4o-mini: 60K, Embeddings: 120K). Under heavy load, the centralized hub throttles
                requests fairly across all BU projects — preventing any single team from monopolizing capacity.
              </div>
            </div>
          </Card>
        </>
      )}

      {results.length === 0 && !isRunning && (
        <div className="text-center py-16 text-slate-600">
          <Gauge size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Configure concurrency and rounds, then run the load test</p>
          <p className="text-xs mt-1">Requests fire simultaneously from multiple BUs against the centralized hub</p>
        </div>
      )}
    </div>
  );
}
