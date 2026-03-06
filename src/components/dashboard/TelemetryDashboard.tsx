"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
  Activity, Zap, Clock, Hash, TrendingUp, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { Card, MetricCard, SectionHeader } from "@/components/ui/shared";

type Metrics = {
  SuccessfulCalls: number;
  TotalCalls: number;
  ProcessedPromptTokens: number;
  GeneratedTokens: number;
  TotalTokens: number;
  Latency: number;
};

const CHART_COLORS = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b"];

export default function TelemetryDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics");
      const data = await res.json();
      if (data.metrics) {
        setMetrics(data.metrics);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // Keep existing metrics on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const successRate = metrics
    ? metrics.TotalCalls > 0
      ? ((metrics.SuccessfulCalls / metrics.TotalCalls) * 100).toFixed(1)
      : "100"
    : "—";

  const avgLatency = metrics
    ? metrics.TotalCalls > 0
      ? Math.round(metrics.Latency / metrics.TotalCalls)
      : 0
    : 0;

  const tokenData = metrics
    ? [
        { name: "Prompt", value: metrics.ProcessedPromptTokens, fill: "#8b5cf6" },
        { name: "Completion", value: metrics.GeneratedTokens, fill: "#06b6d4" },
      ]
    : [];

  const callData = metrics
    ? [
        { name: "Successful", value: metrics.SuccessfulCalls, fill: "#10b981" },
        { name: "Failed", value: metrics.TotalCalls - metrics.SuccessfulCalls, fill: "#f43f5e" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Refresh Control */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {lastUpdated && <>Last updated: {lastUpdated} &middot; Auto-refresh 30s</>}
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
            border border-[#2d3561] hover:border-indigo-500/40 text-slate-400 hover:text-white
            transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total API Calls"
          value={metrics?.TotalCalls || 0}
          icon={<Activity size={20} />}
        />
        <MetricCard
          label="Success Rate"
          value={`${successRate}%`}
          icon={<CheckCircle2 size={20} />}
        />
        <MetricCard
          label="Total Tokens"
          value={metrics?.TotalTokens?.toLocaleString() || "0"}
          icon={<Hash size={20} />}
        />
        <MetricCard
          label="Avg Latency"
          value={avgLatency}
          unit="ms"
          icon={<Clock size={20} />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Distribution */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-purple-400" />
            Token Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3561" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#2d3561" }} />
                <Tooltip
                  contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {tokenData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Call Success/Failure Pie */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            Call Success Rate
          </h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={callData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {callData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1f36", border: "1px solid #2d3561", borderRadius: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Successful ({metrics?.SuccessfulCalls || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="text-slate-400">Failed ({(metrics?.TotalCalls || 0) - (metrics?.SuccessfulCalls || 0)})</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Metrics Table */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Raw Metrics (Last 2 Hours)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2d3561]">
                <th className="text-left py-2 text-slate-400 font-medium">Metric</th>
                <th className="text-right py-2 text-slate-400 font-medium">Value</th>
                <th className="text-right py-2 text-slate-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics &&
                Object.entries(metrics).map(([key, value]) => (
                  <tr key={key} className="border-b border-[#2d3561]/50 hover:bg-indigo-500/5 transition-colors">
                    <td className="py-2.5 text-slate-300">{key}</td>
                    <td className="py-2.5 text-right font-mono text-white">
                      {typeof value === "number" ? value.toLocaleString() : value}
                      {key === "Latency" && <span className="text-slate-500 ml-1">ms</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
