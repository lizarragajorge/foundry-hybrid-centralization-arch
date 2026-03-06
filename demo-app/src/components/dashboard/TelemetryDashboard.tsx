"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import {
  Activity, Zap, Clock, Hash, TrendingUp, RefreshCw, CheckCircle2, XCircle,
  Users, Layers, Filter, GitBranch, ArrowRight, ExternalLink
} from "lucide-react";
import { Card, MetricCard } from "@/components/ui/shared";
import { useBUFilter, BU_OPTIONS } from "@/lib/bu-context";
import {
  getUsageRecords, subscribeUsage, aggregateByBU, aggregateByModel,
  calcCost, BU_META, MODEL_PRICING,
} from "@/lib/usage-tracker";

type AzureMetrics = Record<string, number>;

type TraceRow = {
  timestamp: string;
  name: string;
  duration: number;
  resultCode: string;
  success: boolean;
  operationId: string;
  target?: string;
  type?: string;
};

export default function TelemetryDashboard() {
  const { activeBU } = useBUFilter();

  // Azure Monitor metrics (aggregate)
  const [azureMetrics, setAzureMetrics] = useState<AzureMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  // OTel traces from App Insights
  const [traceRequests, setTraceRequests] = useState<TraceRow[]>([]);
  const [traceDeps, setTraceDeps] = useState<TraceRow[]>([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [tracesError, setTracesError] = useState<string | null>(null);

  // Session records (reactive)
  const allRecords = useSyncExternalStore(subscribeUsage, getUsageRecords, getUsageRecords);

  // Filter session records by active BU
  const filteredRecords = useMemo(() => {
    if (activeBU === "all") return allRecords;
    return allRecords.filter((r) => {
      const buDisplay = BU_META[r.bu]?.displayName || r.bu;
      return buDisplay === activeBU || r.bu === activeBU;
    });
  }, [allRecords, activeBU]);

  // Aggregations
  const sessionByBU = useMemo(() => aggregateByBU(filteredRecords), [filteredRecords]);
  const sessionByModel = useMemo(() => aggregateByModel(filteredRecords), [filteredRecords]);

  const sessionTotalCalls = filteredRecords.length;
  const sessionSuccessCalls = filteredRecords.filter((r) => r.success).length;
  const sessionFailedCalls = sessionTotalCalls - sessionSuccessCalls;
  const sessionTotalTokens = filteredRecords.reduce((s, r) => s + r.totalTokens, 0);
  const sessionTotalCost = filteredRecords.reduce(
    (s, r) => s + calcCost(r.deployment, r.promptTokens, r.completionTokens), 0
  );
  const sessionAvgLatency = sessionTotalCalls > 0
    ? Math.round(filteredRecords.reduce((s, r) => s + r.latencyMs, 0) / sessionTotalCalls)
    : 0;

  // Latency over time (session records as a timeline)
  const latencyTimeline = useMemo(() => {
    return [...filteredRecords].reverse().map((r, i) => ({
      idx: i + 1,
      latency: r.latencyMs,
      bu: BU_META[r.bu]?.displayName || r.bu,
      model: r.deployment,
      color: BU_META[r.bu]?.color || "#6366f1",
    }));
  }, [filteredRecords]);

  // Fetch Azure Monitor metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      if (data.metrics) {
        setAzureMetrics(data.metrics);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Fetch OTel traces from App Insights
  const fetchTraces = useCallback(async () => {
    setTracesLoading(true);
    setTracesError(null);
    try {
      const res = await fetch("/api/traces");
      const data = await res.json();
      if (data.error) {
        setTracesError(data.error);
        return;
      }

      // Parse requests table
      if (data.requests?.tables?.[0]) {
        const table = data.requests.tables[0];
        const cols = table.columns.map((c: any) => c.name);
        const rows: TraceRow[] = table.rows.map((row: any[]) => {
          const obj: any = {};
          cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return {
            timestamp: obj.timestamp,
            name: obj.name,
            duration: obj.duration,
            resultCode: obj.resultCode,
            success: obj.success,
            operationId: obj.operation_Id,
          };
        });
        setTraceRequests(rows);
      }

      // Parse dependencies table
      if (data.dependencies?.tables?.[0]) {
        const table = data.dependencies.tables[0];
        const cols = table.columns.map((c: any) => c.name);
        const rows: TraceRow[] = table.rows.map((row: any[]) => {
          const obj: any = {};
          cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return {
            timestamp: obj.timestamp,
            name: obj.name,
            duration: obj.duration,
            resultCode: obj.resultCode,
            success: obj.success,
            operationId: obj.operation_Id,
            target: obj.target,
            type: obj.type,
          };
        });
        setTraceDeps(rows);
      }
    } catch (err) {
      setTracesError(err instanceof Error ? err.message : "Failed to fetch traces");
    } finally {
      setTracesLoading(false);
    }
  }, []);

  // Azure Monitor summary
  const azureTotalCalls = azureMetrics?.TotalCalls || 0;
  const azureSuccessRate = azureTotalCalls > 0
    ? ((azureMetrics?.SuccessfulCalls || 0) / azureTotalCalls * 100).toFixed(1)
    : "100";
  const azureTotalTokens = azureMetrics?.TotalTokens || 0;
  const azureAvgLatency = azureTotalCalls > 0
    ? Math.round((azureMetrics?.Latency || 0) / azureTotalCalls)
    : 0;

  // Chart: BU calls distribution (pie)
  const buPieData = sessionByBU.map((b) => ({
    name: b.bu.split(" ")[0],
    value: b.calls,
    fill: b.color,
  }));

  // Chart: model token usage (bar)
  const modelBarData = sessionByModel.map((m) => ({
    name: MODEL_PRICING[m.model]?.label || m.model,
    tokens: m.tokens,
    cost: parseFloat(m.cost.toFixed(5)),
    fill: MODEL_PRICING[m.model]?.color || "#6366f1",
  }));

  const buLabel = activeBU === "all" ? "All BUs" : activeBU;

  return (
    <div className="space-y-6">
      {/* Active Filter Indicator */}
      {activeBU !== "all" && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm"
          style={{
            borderColor: `${BU_OPTIONS.find((b) => b.value === activeBU)?.color}40`,
            backgroundColor: `${BU_OPTIONS.find((b) => b.value === activeBU)?.color}08`,
          }}
        >
          <Filter size={14} style={{ color: BU_OPTIONS.find((b) => b.value === activeBU)?.color }} />
          <span className="text-slate-400">Filtered to:</span>
          <span className="font-semibold text-white">{activeBU}</span>
          <span className="text-slate-500 text-xs ml-2">
            ({sessionTotalCalls} session calls)
          </span>
        </div>
      )}

      {/* Two-panel layout: Azure Monitor + Session */}
      <div className="grid grid-cols-2 gap-4">
        {/* Azure Monitor (infra-level) */}
        <Card className="p-4 border-cyan-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Azure Monitor</span>
              <span className="text-[10px] text-slate-500">(all BUs, infra-level)</span>
            </div>
            <button
              onClick={fetchMetrics}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
            >
              <RefreshCw size={10} className={loading ? "animate-spin" : ""} /> {lastUpdated}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Total Calls</div>
              <div className="text-xl font-bold text-white">{azureTotalCalls}</div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Success Rate</div>
              <div className="text-xl font-bold text-emerald-400">{azureSuccessRate}%</div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Total Tokens</div>
              <div className="text-xl font-bold text-white">{azureTotalTokens.toLocaleString()}</div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Avg Latency</div>
              <div className="text-xl font-bold text-white">{azureAvgLatency}ms</div>
            </div>
          </div>
        </Card>

        {/* Session Telemetry (BU-filtered) */}
        <Card className="p-4 border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Session Telemetry</span>
              <span className="text-[10px] text-purple-400">({buLabel})</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Calls</div>
              <div className="text-xl font-bold text-white">{sessionTotalCalls}</div>
              <div className="text-[10px] text-slate-600">
                {sessionSuccessCalls} ok / {sessionFailedCalls} fail
              </div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Tokens</div>
              <div className="text-xl font-bold text-white">{sessionTotalTokens.toLocaleString()}</div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Est. Cost</div>
              <div className="text-xl font-bold text-emerald-400">${sessionTotalCost.toFixed(5)}</div>
            </div>
            <div className="bg-[#0d1225] rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500">Avg Latency</div>
              <div className="text-xl font-bold text-white">{sessionAvgLatency}ms</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts (session data, BU-filtered) */}
      {filteredRecords.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-6">
            {/* Latency Timeline */}
            <Card className="p-5 col-span-2">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Clock size={14} className="text-cyan-400" />
                Latency Timeline ({buLabel})
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={latencyTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                    <XAxis dataKey="idx" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#2d3561" }} label={{ value: "Request #", fill: "#64748b", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#2d3561" }} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }} />
                    <Line type="monotone" dataKey="latency" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* BU Distribution Pie */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users size={14} className="text-indigo-400" />
                Calls by BU
              </h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={buPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                      {buPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {buPieData.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.fill }} />
                      <span className="text-slate-400">{b.name}</span>
                    </div>
                    <span className="text-slate-300 font-mono">{b.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Model Token Usage */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Zap size={14} className="text-purple-400" />
              Token Usage by Model ({buLabel})
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelBarData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                  <Tooltip contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }} />
                  <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                    {modelBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Request Log (BU-filtered) */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              Request Log ({buLabel}) — {filteredRecords.length} calls
            </h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#1a1f36]">
                  <tr className="border-b border-[#2d3561]">
                    <th className="text-left py-2 text-slate-500 font-medium">Time</th>
                    <th className="text-left py-2 text-slate-500 font-medium">BU</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Model</th>
                    <th className="text-left py-2 text-slate-500 font-medium">Source</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Latency</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Tokens</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Cost</th>
                    <th className="text-right py-2 text-slate-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="border-b border-[#2d3561]/30 hover:bg-indigo-500/5">
                      <td className="py-1.5 text-slate-500 font-mono">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: BU_META[r.bu]?.color || "#6366f1" }}
                          />
                          <span className="text-slate-300">
                            {(BU_META[r.bu]?.displayName || r.bu).split(" ")[0]}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 text-slate-400 font-mono">{r.deployment}</td>
                      <td className="py-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111827] text-slate-400">
                          {r.source}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-white">{r.latencyMs}ms</td>
                      <td className="py-1.5 text-right font-mono text-slate-300">{r.totalTokens}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-400">
                        ${calcCost(r.deployment, r.promptTokens, r.completionTokens).toFixed(6)}
                      </td>
                      <td className="py-1.5 text-right">
                        {r.success ? (
                          <CheckCircle2 size={12} className="inline text-emerald-400" />
                        ) : (
                          <XCircle size={12} className="inline text-rose-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <Activity size={32} className="mx-auto mb-3 text-slate-600 opacity-50" />
          <p className="text-sm text-slate-500">No session telemetry yet{activeBU !== "all" ? ` for ${activeBU}` : ""}</p>
          <p className="text-xs text-slate-600 mt-1">
            Run simulations, arena, load tests, or traces to populate per-BU telemetry
          </p>
        </Card>
      )}

      {/* OTel Distributed Traces (from App Insights) */}
      <Card className="p-5 border-indigo-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">OpenTelemetry Distributed Traces</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              App Insights
            </span>
          </div>
          <button
            onClick={fetchTraces}
            disabled={tracesLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
              border border-[#2d3561] hover:border-indigo-500/40 text-slate-400 hover:text-white transition-all
              disabled:opacity-50"
          >
            <RefreshCw size={12} className={tracesLoading ? "animate-spin" : ""} />
            {traceRequests.length > 0 ? "Refresh" : "Load Traces"}
          </button>
        </div>

        {tracesError && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400 mb-3">
            {tracesError}
            <span className="text-slate-500 ml-2">(Traces may take 2-5 min to appear in App Insights)</span>
          </div>
        )}

        {traceRequests.length > 0 ? (
          <div className="space-y-4">
            {/* Requests Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
                <ArrowRight size={10} /> Server Requests ({traceRequests.length})
              </h4>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#1a1f36]">
                    <tr className="border-b border-[#2d3561]">
                      <th className="text-left py-1.5 text-slate-500 font-medium">Time</th>
                      <th className="text-left py-1.5 text-slate-500 font-medium">Operation</th>
                      <th className="text-right py-1.5 text-slate-500 font-medium">Duration</th>
                      <th className="text-right py-1.5 text-slate-500 font-medium">Status</th>
                      <th className="text-left py-1.5 text-slate-500 font-medium">Trace ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceRequests.map((r, i) => (
                      <tr key={`${r.operationId}-${i}`} className="border-b border-[#2d3561]/30 hover:bg-indigo-500/5">
                        <td className="py-1.5 text-slate-500 font-mono">
                          {new Date(r.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5">
                          <span className={`font-medium ${
                            r.name.includes("POST") ? "text-purple-400" :
                            r.name.includes("GET") ? "text-cyan-400" : "text-slate-300"
                          }`}>
                            {r.name}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-mono text-white">{Math.round(r.duration)}ms</td>
                        <td className="py-1.5 text-right">
                          {r.success ? (
                            <span className="text-emerald-400">{r.resultCode}</span>
                          ) : (
                            <span className="text-rose-400">{r.resultCode}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-slate-600 font-mono text-[10px]">
                          {r.operationId?.substring(0, 16)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dependencies Table */}
            {traceDeps.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2 flex items-center gap-1">
                  <ExternalLink size={10} /> Outbound Dependencies ({traceDeps.length})
                </h4>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#1a1f36]">
                      <tr className="border-b border-[#2d3561]">
                        <th className="text-left py-1.5 text-slate-500 font-medium">Time</th>
                        <th className="text-left py-1.5 text-slate-500 font-medium">Target</th>
                        <th className="text-left py-1.5 text-slate-500 font-medium">Type</th>
                        <th className="text-right py-1.5 text-slate-500 font-medium">Duration</th>
                        <th className="text-right py-1.5 text-slate-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traceDeps.map((d, i) => (
                        <tr key={`${d.operationId}-dep-${i}`} className="border-b border-[#2d3561]/30 hover:bg-indigo-500/5">
                          <td className="py-1.5 text-slate-500 font-mono">
                            {new Date(d.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-1.5 text-cyan-400 font-mono text-[10px] max-w-[200px] truncate">
                            {d.target || d.name}
                          </td>
                          <td className="py-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111827] text-slate-400">
                              {d.type || "HTTP"}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-mono text-white">{Math.round(d.duration)}ms</td>
                          <td className="py-1.5 text-right">
                            {d.success ? (
                              <span className="text-emerald-400">{d.resultCode}</span>
                            ) : (
                              <span className="text-rose-400">{d.resultCode}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Deep link to App Insights */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#2d3561]">
              <span>Traces exported via OpenTelemetry SDK → Azure Monitor Exporter</span>
              <a
                href="https://portal.azure.com/#view/AppInsightsExtension/TransactionSearchBlade"
                target="_blank"
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink size={10} />
                Open in App Insights
              </a>
            </div>
          </div>
        ) : !tracesLoading ? (
          <div className="text-center py-8 text-slate-600">
            <GitBranch size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Click &quot;Load Traces&quot; to fetch OTel distributed traces from Application Insights</p>
            <p className="text-[10px] text-slate-700 mt-1">Traces take 2-5 minutes to ingest after API calls are made</p>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin opacity-50" />
            <p className="text-xs">Querying Application Insights...</p>
          </div>
        )}
      </Card>
    </div>
  );
}
