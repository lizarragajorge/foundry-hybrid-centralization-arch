"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  DollarSign, TrendingUp, Calculator, Users, Zap, Hash,
  RefreshCw, Activity, Clock, Layers
} from "lucide-react";
import { Card, MetricCard, Badge } from "@/components/ui/shared";
import {
  getUsageRecords, subscribeUsage, clearUsageRecords,
  aggregateByBU, aggregateByModel, aggregateBySource,
  calcCost, MODEL_PRICING, BU_META,
} from "@/lib/usage-tracker";

type AzureMetrics = {
  metrics: Record<string, number>;
  perDeployment: Record<string, Record<string, number>>;
};

export default function CostCalculator() {
  // Real Azure Monitor metrics
  const [azureMetrics, setAzureMetrics] = useState<AzureMetrics | null>(null);
  const [azureLoading, setAzureLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState("");

  // Session usage records (reactive via useSyncExternalStore)
  const sessionRecords = useSyncExternalStore(
    subscribeUsage,
    getUsageRecords,
    getUsageRecords
  );

  // Fetch real Azure metrics
  useEffect(() => {
    async function fetchMetrics() {
      setAzureLoading(true);
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json();
        if (data.metrics) {
          setAzureMetrics({ metrics: data.metrics, perDeployment: data.perDeployment || {} });
          setLastFetched(new Date().toLocaleTimeString());
        }
      } catch { /* ignore */ }
      setAzureLoading(false);
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  // === Azure Monitor Aggregate Data ===
  const azureTotalCalls = azureMetrics?.metrics?.TotalCalls || 0;
  const azureSuccessfulCalls = azureMetrics?.metrics?.SuccessfulCalls || 0;
  const azurePromptTokens = azureMetrics?.metrics?.ProcessedPromptTokens || 0;
  const azureCompletionTokens = azureMetrics?.metrics?.GeneratedTokens || 0;
  const azureTotalTokens = azureMetrics?.metrics?.TotalTokens || 0;
  const azureLatency = azureMetrics?.metrics?.Latency || 0;

  // Per-deployment real metrics
  const perDeployData = useMemo(() => {
    if (!azureMetrics?.perDeployment) return [];
    return Object.entries(azureMetrics.perDeployment).map(([deploy, m]) => {
      const pricing = MODEL_PRICING[deploy];
      const promptT = m.ProcessedPromptTokens || 0;
      const completionT = m.GeneratedTokens || 0;
      return {
        deployment: deploy,
        label: pricing?.label || deploy,
        color: pricing?.color || "#6366f1",
        calls: m.TotalCalls || 0,
        promptTokens: promptT,
        completionTokens: completionT,
        totalTokens: m.TotalTokens || 0,
        cost: calcCost(deploy, promptT, completionT),
      };
    });
  }, [azureMetrics]);

  // Estimated total cost from Azure Monitor
  const azureTotalCost = useMemo(() => {
    if (perDeployData.length > 0) {
      return perDeployData.reduce((s, d) => s + d.cost, 0);
    }
    // Fallback: estimate using gpt-4o rates for aggregate
    return calcCost("gpt-4o", azurePromptTokens, azureCompletionTokens);
  }, [perDeployData, azurePromptTokens, azureCompletionTokens]);

  // === Session Usage Data ===
  const sessionByBU = useMemo(() => aggregateByBU(sessionRecords), [sessionRecords]);
  const sessionByModel = useMemo(() => aggregateByModel(sessionRecords), [sessionRecords]);
  const sessionBySource = useMemo(() => aggregateBySource(sessionRecords), [sessionRecords]);
  const sessionTotalCost = sessionRecords.reduce(
    (s, r) => s + calcCost(r.deployment, r.promptTokens, r.completionTokens), 0
  );
  const sessionTotalTokens = sessionRecords.reduce((s, r) => s + r.totalTokens, 0);

  // Chart data
  const buChartData = sessionByBU.map((b) => ({
    name: b.bu.split(" ")[0],
    cost: parseFloat(b.cost.toFixed(5)),
    calls: b.calls,
    color: b.color,
  }));

  const modelPieData = sessionByModel.length > 0
    ? sessionByModel.map((m) => ({ name: m.label, value: parseFloat(m.cost.toFixed(6)), fill: m.color }))
    : perDeployData.map((d) => ({ name: d.label, value: parseFloat(d.cost.toFixed(6)), fill: d.color }));

  const sourceData = sessionBySource.map((s) => ({
    name: s.source.charAt(0).toUpperCase() + s.source.slice(1),
    calls: s.calls,
    cost: parseFloat(s.cost.toFixed(5)),
  }));

  const sourceColors: Record<string, string> = {
    Simulation: "#8b5cf6",
    Arena: "#ec4899",
    Loadtest: "#f59e0b",
    Trace: "#06b6d4",
  };

  return (
    <div className="space-y-6">
      {/* Data Source Switcher / Banner */}
      <div className="grid grid-cols-2 gap-4">
        {/* Azure Monitor (real infra) */}
        <Card className="p-4 border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Azure Monitor (Real)</span>
              <Badge color="cyan">LIVE</Badge>
            </div>
            <button
              onClick={() => {
                setAzureLoading(true);
                fetch("/api/metrics").then(r => r.json()).then(d => {
                  if (d.metrics) setAzureMetrics({ metrics: d.metrics, perDeployment: d.perDeployment || {} });
                  setLastFetched(new Date().toLocaleTimeString());
                  setAzureLoading(false);
                });
              }}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
            >
              <RefreshCw size={10} className={azureLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Calls</div>
              <div className="text-lg font-bold text-white">{azureTotalCalls}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Tokens</div>
              <div className="text-lg font-bold text-white">{azureTotalTokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Est. Cost</div>
              <div className="text-lg font-bold text-emerald-400">${azureTotalCost.toFixed(4)}</div>
            </div>
          </div>
          {lastFetched && <div className="text-[10px] text-slate-600 mt-2">Last 2 hours &middot; Updated {lastFetched}</div>}
        </Card>

        {/* Session Tracking (in-app) */}
        <Card className="p-4 border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Session Tracker (This Session)</span>
              <Badge color="purple">{sessionRecords.length} calls</Badge>
            </div>
            {sessionRecords.length > 0 && (
              <button onClick={clearUsageRecords} className="text-xs text-slate-500 hover:text-white">Clear</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Calls</div>
              <div className="text-lg font-bold text-white">{sessionRecords.length}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Tokens</div>
              <div className="text-lg font-bold text-white">{sessionTotalTokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Est. Cost</div>
              <div className="text-lg font-bold text-emerald-400">${sessionTotalCost.toFixed(5)}</div>
            </div>
          </div>
          {sessionRecords.length === 0 && (
            <div className="text-[10px] text-slate-600 mt-2">Run simulations, arena, or load tests to track per-BU costs</div>
          )}
        </Card>
      </div>

      {/* Per-Deployment Real Metrics (from Azure) */}
      {perDeployData.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Activity size={14} className="text-cyan-400" />
            Real Per-Model Usage (Azure Monitor)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2d3561]">
                  <th className="text-left py-2 text-slate-400 font-medium">Deployment</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Calls</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Prompt Tokens</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Completion Tokens</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Total Tokens</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {perDeployData.map((d) => (
                  <tr key={d.deployment} className="border-b border-[#2d3561]/50 hover:bg-indigo-500/5">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-white font-medium">{d.label}</span>
                        <span className="text-slate-600 text-xs font-mono">({d.deployment})</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-300">{d.calls}</td>
                    <td className="py-2.5 text-right font-mono text-slate-300">{d.promptTokens.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-slate-300">{d.completionTokens.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-white">{d.totalTokens.toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-400">${d.cost.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Session Charts (only if there's session data) */}
      {sessionRecords.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-6">
            {/* Cost by BU */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users size={14} className="text-indigo-400" />
                Session Cost by Business Unit
              </h3>
              <div className="h-56">
                {buChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buChartData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }}
                        labelStyle={{ color: "#f1f5f9" }}
                      />
                      <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                        {buChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-sm">No BU data yet</div>
                )}
              </div>
            </Card>

            {/* Cost by Model */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <DollarSign size={14} className="text-purple-400" />
                Cost by Model
              </h3>
              <div className="h-56 flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={modelPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {modelPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-xs mt-2">
                {modelPieData.map((m) => (
                  <div key={m.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.fill }} />
                    <span className="text-slate-400">{m.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Session detail table */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={14} className="text-purple-400" />
              Session Usage Detail (Per-BU Attribution)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3561]">
                    <th className="text-left py-2 text-slate-400 font-medium">Business Unit</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Calls</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Tokens</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Cost</th>
                    <th className="text-right py-2 text-slate-400 font-medium">% of Total</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Cost/Call</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionByBU.map((bu) => (
                    <tr key={bu.bu} className="border-b border-[#2d3561]/50 hover:bg-indigo-500/5 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bu.color }} />
                          <span className="text-white font-medium">{bu.bu}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-300">{bu.calls}</td>
                      <td className="py-3 text-right font-mono text-slate-300">{bu.tokens.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-emerald-400">${bu.cost.toFixed(5)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-[#111827] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${sessionTotalCost > 0 ? (bu.cost / sessionTotalCost) * 100 : 0}%`,
                                backgroundColor: bu.color,
                              }}
                            />
                          </div>
                          <span className="text-slate-400 font-mono text-xs w-8 text-right">
                            {sessionTotalCost > 0 ? ((bu.cost / sessionTotalCost) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        ${bu.calls > 0 ? (bu.cost / bu.calls).toFixed(6) : "0"}
                      </td>
                    </tr>
                  ))}
                  {sessionByBU.length > 1 && (
                    <tr className="border-t-2 border-indigo-500/20 font-bold">
                      <td className="py-3 text-white">Total</td>
                      <td className="py-3 text-right font-mono text-white">{sessionRecords.length}</td>
                      <td className="py-3 text-right font-mono text-white">{sessionTotalTokens.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-emerald-400">${sessionTotalCost.toFixed(5)}</td>
                      <td className="py-3 text-right text-slate-400">100%</td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        ${(sessionTotalCost / sessionRecords.length).toFixed(6)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* By Source Breakdown */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Calculator size={14} className="text-amber-400" />
              Cost by Feature (Where calls originated)
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {sourceData.map((s) => (
                <div key={s.name} className="bg-[#111827] rounded-lg p-3 text-center">
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: sourceColors[s.name] || "#6366f1" }} />
                  <div className="text-xs text-slate-500 uppercase">{s.name}</div>
                  <div className="text-sm font-bold text-white mt-1">{s.calls} calls</div>
                  <div className="text-xs text-emerald-400 font-mono">${s.cost.toFixed(5)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {sessionRecords.length === 0 && perDeployData.length === 0 && (
        <Card className="p-8 text-center">
          <DollarSign size={32} className="mx-auto mb-3 text-slate-600 opacity-50" />
          <p className="text-sm text-slate-500">Run simulations, arena comparisons, or load tests</p>
          <p className="text-xs text-slate-600 mt-1">Every API call is tracked with per-BU cost attribution in real time</p>
        </Card>
      )}

      {/* Optimization insight */}
      {sessionByModel.length >= 2 && (
        <Card className="p-5 border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent">
          <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
            <TrendingUp size={14} />
            Live Cost Optimization Insight
          </h3>
          <p className="text-sm text-slate-300">
            {(() => {
              const gpt4o = sessionByModel.find(m => m.model === "gpt-4o");
              const mini = sessionByModel.find(m => m.model === "gpt-4o-mini");
              if (gpt4o && mini && gpt4o.calls > 0) {
                const perCallGpt4o = gpt4o.cost / gpt4o.calls;
                const perCallMini = mini.cost / mini.calls;
                const savings = ((1 - perCallMini / perCallGpt4o) * 100).toFixed(0);
                return `GPT-4o-mini costs $${perCallMini.toFixed(6)}/call vs GPT-4o at $${perCallGpt4o.toFixed(6)}/call — ${savings}% cheaper per call. The centralized hub enables this by offering both models to all BUs without per-team infrastructure.`;
              }
              return "Run calls against both GPT-4o and GPT-4o-mini (via Arena or Simulation) to see cost comparison insights.";
            })()}
          </p>
        </Card>
      )}
    </div>
  );
}
