"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Shield, Wrench, Eye, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Zap, Clock, Server, ArrowRight, Play, Pause, ChevronDown,
  ChevronUp, Loader2
} from "lucide-react";
import { Card, Badge, StatusDot } from "@/components/ui/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

type PolicyEvent = {
  id: string;
  timestamp: string;
  policyName: string;
  effect: string;
  compliance: "compliant" | "noncompliant" | "remediated" | "in-progress";
  resourceName: string;
  resourceType: string;
  subscription: string;
  subscriptionId: string;
  details: string;
};

type RemediationTask = {
  id: string;
  policyName: string;
  status: "Evaluating" | "InProgress" | "Succeeded" | "Failed" | "Canceled";
  deploymentId: string;
  resourceCount: number;
  createdOn: string;
  lastUpdatedOn: string;
  subscription: string;
};

type PolicyActivityData = {
  events: PolicyEvent[];
  remediations: RemediationTask[];
  complianceByPolicy: Record<string, { compliant: number; nonCompliant: number; exempt: number; effect: string }>;
  summary: {
    totalEvents: number;
    dineActions: number;
    modifyActions: number;
    auditFindings: number;
    denyBlocks: number;
    activeRemediations: number;
    completedRemediations: number;
  };
  timestamp: string;
};

// ─── Effect badge colors/icons ──────────────────────────────────────────────

const effectConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  deployifnotexists: { color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: <Wrench size={12} />, label: "DINE" },
  modify: { color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", icon: <Wrench size={12} />, label: "Modify" },
  audit: { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <Eye size={12} />, label: "Audit" },
  deny: { color: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30", icon: <XCircle size={12} />, label: "Deny" },
  remediation: { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <CheckCircle2 size={12} />, label: "Remediation" },
};

const complianceConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  compliant: { color: "text-emerald-400", icon: <CheckCircle2 size={14} /> },
  noncompliant: { color: "text-amber-400", icon: <AlertTriangle size={14} /> },
  remediated: { color: "text-purple-400", icon: <CheckCircle2 size={14} /> },
  "in-progress": { color: "text-cyan-400", icon: <Loader2 size={14} className="animate-spin" /> },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PolicyLiveMonitor() {
  const [data, setData] = useState<PolicyActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [filterEffect, setFilterEffect] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/policy-activity");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newData: PolicyActivityData = await res.json();

      // Track new events for highlight animation
      if (data) {
        const existingIds = new Set(data.events.map(e => e.id));
        const newIds = new Set(newData.events.filter(e => !existingIds.has(e.id)).map(e => e.id));
        setNewEventIds(newIds);
        // Clear highlights after 3 seconds
        setTimeout(() => setNewEventIds(new Set()), 3000);
      }

      setData(newData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch policy activity");
    } finally {
      setLoading(false);
    }
  }, [data]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh) {
      fetchActivity();
      intervalRef.current = setInterval(fetchActivity, 15000); // Every 15s
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const filteredEvents = data?.events.filter(e => !filterEffect || e.effect === filterEffect) || [];
  const displayEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Live Policy Activity</span>
          {autoRefresh && (
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-1"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="text-[10px] text-emerald-400">LIVE</span>
            </motion.div>
          )}
          {lastRefresh && (
            <span className="text-[10px] text-slate-600">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchActivity}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            {loading ? "Scanning..." : "Scan Now"}
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              autoRefresh
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-[#111827] border-[#2d3561] text-slate-400 hover:text-white"
            }`}
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            {autoRefresh ? "Pause (15s)" : "Auto-Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
            <XCircle size={14} className="inline mr-2" />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!data && !loading && !error && (
        <Card className="p-8 text-center border-dashed border-emerald-500/20">
          <Activity size={32} className="mx-auto text-emerald-400/30 mb-3" />
          <p className="text-sm text-slate-500">Click <strong className="text-emerald-300">Scan Now</strong> or enable <strong className="text-emerald-300">Auto-Refresh</strong> to stream live policy evaluation events</p>
          <p className="text-[10px] text-slate-600 mt-2">Queries Azure Policy Events, Remediation Tasks, and Compliance State across all subscriptions</p>
        </Card>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Total Events", value: data.summary.totalEvents, color: "text-white", icon: <Activity size={14} /> },
              { label: "DINE Actions", value: data.summary.dineActions, color: "text-purple-400", icon: <Wrench size={14} /> },
              { label: "Modify Actions", value: data.summary.modifyActions, color: "text-cyan-400", icon: <Wrench size={14} /> },
              { label: "Audit Findings", value: data.summary.auditFindings, color: "text-amber-400", icon: <Eye size={14} /> },
              { label: "Deny Blocks", value: data.summary.denyBlocks, color: "text-rose-400", icon: <XCircle size={14} /> },
              { label: "Active Remediations", value: data.summary.activeRemediations, color: "text-cyan-400", icon: <Loader2 size={14} /> },
              { label: "Completed", value: data.summary.completedRemediations, color: "text-emerald-400", icon: <CheckCircle2 size={14} /> },
            ].map((stat) => (
              <Card key={stat.label} className="p-3 text-center">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <span className={stat.color}>{stat.icon}</span>
                  <span className="text-[10px] text-slate-500">{stat.label}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Active Remediations (DINE/Modify in-flight) */}
          {data.remediations.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wrench size={14} className="text-purple-400" />
                Remediation Tasks
                <Badge color="purple">{data.remediations.length}</Badge>
              </h4>
              <div className="grid gap-2">
                {data.remediations.map((rem) => (
                  <motion.div
                    key={rem.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-[#111827] border border-purple-500/10"
                  >
                    <div className="flex items-center gap-3">
                      {rem.status === "Succeeded" ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : rem.status === "Failed" ? (
                        <XCircle size={16} className="text-rose-400" />
                      ) : (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={16} className="text-cyan-400" />
                        </motion.div>
                      )}
                      <div>
                        <div className="text-sm text-slate-300 font-medium">{rem.policyName}</div>
                        <div className="text-[10px] text-slate-600">
                          {rem.subscription} · {rem.resourceCount} resources · {rem.lastUpdatedOn ? new Date(rem.lastUpdatedOn).toLocaleTimeString() : ""}
                        </div>
                      </div>
                    </div>
                    <Badge color={
                      rem.status === "Succeeded" ? "green" :
                      rem.status === "Failed" ? "rose" :
                      rem.status === "Canceled" ? "amber" : "cyan"
                    }>
                      {rem.status}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Per-Policy Compliance Breakdown */}
          {Object.keys(data.complianceByPolicy).length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Shield size={14} className="text-indigo-400" />
                Per-Policy Compliance (Across All Subscriptions)
              </h4>
              <Card className="p-4">
                <div className="space-y-2">
                  {Object.entries(data.complianceByPolicy)
                    .sort(([, a], [, b]) => b.nonCompliant - a.nonCompliant)
                    .map(([name, stats]) => {
                      const total = stats.compliant + stats.nonCompliant;
                      const pct = total > 0 ? Math.round((stats.compliant / total) * 100) : 100;
                      return (
                        <div key={name} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[#0d1225]/60">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-slate-300 font-medium truncate">{name}</span>
                              {stats.effect && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  effectConfig[stats.effect.toLowerCase()]?.bg || "bg-slate-500/10"
                                } ${effectConfig[stats.effect.toLowerCase()]?.color || "text-slate-400"}`}>
                                  {stats.effect}
                                </span>
                              )}
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 rounded-full bg-[#1a1f36] overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8 }}
                                className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct > 70 ? "bg-amber-500" : "bg-rose-500"}`}
                              />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-bold ${pct === 100 ? "text-emerald-400" : pct > 70 ? "text-amber-400" : "text-rose-400"}`}>
                              {pct}%
                            </div>
                            <div className="text-[9px] text-slate-600">
                              {stats.compliant}✓ {stats.nonCompliant > 0 ? `${stats.nonCompliant}✗` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            </section>
          )}

          {/* Event Stream */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                Policy Event Stream
                <Badge color="blue">{filteredEvents.length} events</Badge>
              </h4>
              {/* Effect filter pills */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFilterEffect(null)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all ${!filterEffect ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}
                >
                  All
                </button>
                {Object.entries(effectConfig).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFilterEffect(filterEffect === key ? null : key)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all ${
                      filterEffect === key ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {displayEvents.length > 0 ? (
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {displayEvents.map((event, i) => {
                    const cfg = effectConfig[event.effect] || effectConfig.audit;
                    const compCfg = complianceConfig[event.compliance] || complianceConfig.noncompliant;
                    const isNew = newEventIds.has(event.id);
                    const isExpanded = expandedEvent === event.id;

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20, height: 0 }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          height: "auto",
                          backgroundColor: isNew ? "rgba(16,185,129,0.08)" : "transparent",
                        }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.02 }}
                        className={`rounded-lg border ${cfg.border} overflow-hidden cursor-pointer`}
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                      >
                        <div className="flex items-center gap-3 py-2 px-3">
                          {/* Timestamp */}
                          <span className="text-[10px] text-slate-600 font-mono w-16 shrink-0">
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>

                          {/* Effect badge */}
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${cfg.bg} ${cfg.color} shrink-0`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>

                          {/* Compliance icon */}
                          <span className={compCfg.color}>{compCfg.icon}</span>

                          {/* Policy name + resource */}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-300 font-medium">{event.policyName}</span>
                            <ArrowRight size={10} className="inline mx-1.5 text-slate-600" />
                            <span className="text-xs text-slate-500 truncate">{event.resourceName}</span>
                          </div>

                          {/* Subscription */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Server size={10} className="text-slate-600" />
                            <span className="text-[10px] text-slate-600">{event.subscription}</span>
                          </div>

                          {/* Expand indicator */}
                          {isExpanded ? <ChevronUp size={12} className="text-slate-600" /> : <ChevronDown size={12} className="text-slate-600" />}
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-[#2d3561] bg-[#0d1225]/60 px-4 py-3"
                            >
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                  <span className="text-slate-600">Resource:</span>
                                  <span className="text-slate-300 ml-2">{event.resourceName}</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Type:</span>
                                  <span className="text-slate-300 ml-2 font-mono text-[10px]">{event.resourceType}</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Subscription:</span>
                                  <span className="text-slate-300 ml-2">{event.subscription}</span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Timestamp:</span>
                                  <span className="text-slate-300 ml-2">{new Date(event.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-600">Details:</span>
                                  <span className={`ml-2 ${cfg.color}`}>{event.details}</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Show more */}
                {filteredEvents.length > 20 && !showAllEvents && (
                  <button
                    onClick={() => setShowAllEvents(true)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Show all {filteredEvents.length} events...
                  </button>
                )}
              </div>
            ) : (
              <Card className="p-6 text-center border-dashed border-[#2d3561]">
                <Clock size={20} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">
                  {data.summary.totalEvents === 0
                    ? "No policy events in the last 2 hours — deploy or modify a Foundry resource to trigger evaluations"
                    : `No ${filterEffect || ""} events found — try a different filter`
                  }
                </p>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
