"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Lock, Network, Eye, Tag, Users, Key, CheckCircle2,
  AlertTriangle, XCircle, Globe, Server, Database, Building2, ArrowDown,
  RefreshCw, Zap, Wrench
} from "lucide-react";
import { architectureData } from "@/lib/config";
import { Card, Badge, StatusDot } from "@/components/ui/shared";
import PolicyLiveMonitor from "./PolicyLiveMonitor";

type ComplianceResult = {
  managementGroup: string;
  subscriptions: Array<{
    subscription: string;
    subscriptionId: string;
    region: string;
    policies: Array<{
      name: string;
      displayName: string;
      compliance: "compliant" | "noncompliant" | "unknown";
      nonCompliantResources: number;
      scope: string;
    }>;
  }>;
  summary: {
    totalPolicies: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: number;
  };
  timestamp: string;
};

export default function GovernanceShowcase() {
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompliance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/policy-compliance");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ComplianceResult = await res.json();
      setCompliance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch compliance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* Management Group Governance */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Building2 size={18} className="text-purple-400" />
          Management Group Policy Governance
          <Badge color="purple">CROSS-SUBSCRIPTION</Badge>
        </h3>
        <Card className="p-6 border-purple-500/20">
          {/* MG hierarchy visualization */}
          <div className="flex flex-col items-center mb-6">
            {/* Management Group */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border-2 border-purple-500/30 rounded-xl px-8 py-4 text-center mb-2"
            >
              <Building2 size={20} className="text-purple-400 mx-auto mb-1" />
              <div className="text-sm font-bold text-white">{architectureData.managementGroup.name}</div>
              <div className="text-[10px] text-purple-300 font-mono">{architectureData.managementGroup.id}</div>
            </motion.div>

            {/* Policies cascading down */}
            <div className="flex flex-wrap justify-center gap-2 my-3 max-w-2xl">
              {architectureData.managementGroup.policies.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300"
                  title={p.description}
                >
                  <Shield size={10} />
                  {p.name}
                </motion.div>
              ))}
            </div>

            {/* Cascade arrows */}
            <div className="flex items-center gap-1 text-purple-400 my-1">
              <ArrowDown size={16} />
              <span className="text-[10px] text-purple-300">Policies cascade to all subscriptions</span>
              <ArrowDown size={16} />
            </div>

            {/* Subscriptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 w-full">
              {architectureData.managementGroup.subscriptions.map((sub, i) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className={`p-4 rounded-xl border ${i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#2d3561] bg-[#111827]"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Server size={14} className={i === 0 ? "text-emerald-400" : "text-slate-500"} />
                      <Badge color={i === 0 ? "green" : "blue"}>{sub.role}</Badge>
                    </div>
                    <div className="text-xs font-semibold text-slate-300">{sub.name}</div>
                    <div className="text-[10px] text-slate-600 font-mono">{sub.id}...</div>
                    <div className="text-[10px] text-slate-500 mt-1">{sub.region}</div>
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle2 size={10} className="text-purple-400" />
                      <span className="text-[9px] text-purple-300">5 policies inherited</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Policy detail table */}
          <div className="mt-4 space-y-2">
            {architectureData.managementGroup.policies.map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.06 }}
                className="flex items-center justify-between py-2.5 px-4 bg-[#111827] rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Shield size={14} className="text-purple-400 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-slate-300">{p.name}</span>
                    <p className="text-[10px] text-slate-600">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">{p.scope}</span>
                  {(p as { effect?: string }).effect && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      (p as { effect?: string }).effect === "DeployIfNotExists" ? "bg-purple-500/20 text-purple-300" :
                      (p as { effect?: string }).effect === "Modify" ? "bg-cyan-500/20 text-cyan-300" :
                      "bg-amber-500/20 text-amber-300"
                    }`}>{(p as { effect?: string }).effect}</span>
                  )}
                  <Badge color={p.enforcement === "Enforce" ? "green" : "amber"}>{p.enforcement}</Badge>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 text-xs text-purple-300 bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-2.5">
            <Building2 size={12} className="inline mr-1" />
            Policies assigned at the <strong>management group</strong> level cascade to <strong>all 3 subscriptions</strong>.
            Any Foundry resource deployed in any subscription is automatically governed. Switch enforcement from Audit to Deny for production.
          </div>
        </Card>
      </section>

      {/* Live Policy Compliance */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye size={18} className="text-cyan-400" />
            Live Policy Compliance
            <Badge color="cyan">REAL-TIME</Badge>
          </h3>
          <button
            onClick={fetchCompliance}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? "Scanning..." : compliance ? "Refresh Compliance" : "Check Compliance"}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300">
              <XCircle size={14} className="inline mr-2" />{error}
            </motion.div>
          )}

          {compliance && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Card glow className="p-4 text-center">
                  <div className="text-2xl font-bold text-white">{compliance.summary.complianceRate}%</div>
                  <div className="text-xs text-slate-400">Compliance Rate</div>
                </Card>
                <Card glow className="p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{compliance.summary.compliant}</div>
                  <div className="text-xs text-slate-400">Compliant</div>
                </Card>
                <Card glow className="p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">{compliance.summary.nonCompliant}</div>
                  <div className="text-xs text-slate-400">Non-Compliant</div>
                </Card>
                <Card glow className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-400">{compliance.subscriptions.length}</div>
                  <div className="text-xs text-slate-400">Subscriptions</div>
                </Card>
              </div>

              {/* Per-subscription compliance */}
              <div className="space-y-4">
                {compliance.subscriptions.map((sub, si) => (
                  <Card key={sub.subscriptionId} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Server size={14} className={si === 0 ? "text-emerald-400" : "text-slate-400"} />
                        <span className="text-sm font-semibold text-slate-300">{sub.subscription}</span>
                        <span className="text-[10px] text-slate-600 font-mono">{sub.region}</span>
                      </div>
                      <Badge color={sub.policies.every(p => p.compliance === "compliant") ? "green" : "amber"}>
                        {sub.policies.filter(p => p.compliance === "compliant").length}/{sub.policies.length} compliant
                      </Badge>
                    </div>
                    {sub.policies.length > 0 ? (
                      <div className="grid gap-1.5">
                        {sub.policies.map((policy) => (
                          <div
                            key={policy.name}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${
                              policy.compliance === "compliant" ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-amber-500/5 border border-amber-500/10"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {policy.compliance === "compliant" ? (
                                <CheckCircle2 size={12} className="text-emerald-400" />
                              ) : (
                                <AlertTriangle size={12} className="text-amber-400" />
                              )}
                              <span className="text-slate-300">{policy.displayName}</span>
                              <span className="text-[9px] text-slate-600 bg-[#111827] px-1.5 py-0.5 rounded">{policy.scope}</span>
                            </div>
                            <div>
                              {policy.compliance === "compliant" ? (
                                <span className="text-emerald-400">Compliant</span>
                              ) : (
                                <span className="text-amber-400">{policy.nonCompliantResources} non-compliant</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-600 text-center py-2">No Foundry resources — policies inherited but no resources to evaluate</div>
                    )}
                  </Card>
                ))}
              </div>

              <div className="mt-3 text-[10px] text-slate-600 text-right">
                Last checked: {new Date(compliance.timestamp).toLocaleString()}
              </div>
            </motion.div>
          )}

          {!compliance && !loading && (
            <Card className="p-8 text-center border-dashed border-cyan-500/20">
              <Eye size={24} className="mx-auto text-cyan-400/40 mb-2" />
              <p className="text-sm text-slate-500">Click <strong className="text-cyan-300">Check Compliance</strong> to query live Azure Policy compliance across all 3 subscriptions</p>
              <p className="text-[10px] text-slate-600 mt-1">Queries the Azure Policy Insights API for real-time compliance state</p>
            </Card>
          )}
        </AnimatePresence>
      </section>

      {/* Zero Trust Identity */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Wrench size={18} className="text-emerald-400" />
          Live Policy Activity Monitor
          <Badge color="green">REAL-TIME EVENTS</Badge>
        </h3>
        <Card className="p-6 border-emerald-500/20">
          <PolicyLiveMonitor />
        </Card>
      </section>

      {/* Zero Trust Identity */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Lock size={18} className="text-emerald-400" />
          Identity & Zero Trust
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "API Key Auth",
              value: architectureData.governance.localAuthDisabled ? "Disabled" : "Enabled",
              status: architectureData.governance.localAuthDisabled ? "active" as const : "error" as const,
              detail: "All access requires Microsoft Entra ID tokens",
              icon: <Key size={18} />,
            },
            {
              title: "Managed Identities",
              value: "4 Active",
              status: "active" as const,
              detail: "Hub + 3 project system-assigned identities",
              icon: <Users size={18} />,
            },
            {
              title: "RBAC Authorization",
              value: architectureData.governance.rbacAuth ? "Enabled" : "Disabled",
              status: architectureData.governance.rbacAuth ? "active" as const : "error" as const,
              detail: "Key Vault and Foundry use Azure RBAC",
              icon: <Shield size={18} />,
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card glow className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    {item.icon}
                  </div>
                  <StatusDot status={item.status} />
                </div>
                <h4 className="font-semibold text-sm text-slate-300 mb-1">{item.title}</h4>
                <p className="text-xl font-bold text-white mb-1">{item.value}</p>
                <p className="text-xs text-slate-500">{item.detail}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Azure Policy (Subscription Level View) */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          Azure Policy Assignments
          <Badge color="blue">INHERITED FROM MG</Badge>
        </h3>
        <Card className="p-5">
          <div className="grid gap-3">
            {architectureData.policies.map((policy, i) => (
              <motion.div
                key={policy.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between py-3 px-4 bg-[#111827] rounded-lg hover:bg-[#1a1f36] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${
                    policy.effect === "DeployIfNotExists" ? "bg-purple-500/10" :
                    policy.effect === "Modify" ? "bg-cyan-500/10" :
                    "bg-indigo-500/10"
                  }`}>
                    {policy.effect === "DeployIfNotExists" && <Wrench size={14} className="text-purple-400" />}
                    {policy.effect === "Modify" && <Wrench size={14} className="text-cyan-400" />}
                    {policy.effect === "Audit" && <Eye size={14} className="text-amber-400" />}
                    {!policy.effect && policy.icon === "shield" && <Shield size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "lock" && <Lock size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "tag" && <Tag size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "network" && <Network size={14} className="text-indigo-400" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-300">{policy.name}</span>
                    {policy.effect && (
                      <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        policy.effect === "DeployIfNotExists" ? "bg-purple-500/10 text-purple-300" :
                        policy.effect === "Modify" ? "bg-cyan-500/10 text-cyan-300" :
                        "bg-amber-500/10 text-amber-300"
                      }`}>{policy.effect}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={policy.status === "Enforce" ? "green" : "amber"}>{policy.status}</Badge>
                  {policy.status === "Enforce" ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-2">
            <Wrench size={12} className="inline mr-1 text-purple-400" />
            <strong>DINE</strong> policies auto-deploy configurations. <strong>Modify</strong> policies auto-patch properties.
            <strong> Audit</strong> policies flag for visibility. All 11 policies cascade from Management Group.
          </div>
        </Card>
      </section>

      {/* Guardrails & Content Safety Enforcement Chain */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-rose-400" />
          Guardrails &amp; Content Safety Enforcement
          <Badge color="rose">MULTI-LAYER</Badge>
        </h3>
        <Card className="p-6 border-rose-500/20">
          {/* Enforcement chain visualization */}
          <div className="space-y-4 mb-6">
            <p className="text-xs text-slate-400">Every model request passes through multiple enforcement layers — from Azure Policy (deploy-time) to content filtering (runtime):</p>

            {[
              {
                layer: "Layer 1: Azure Policy (Deploy-Time)",
                color: "#8b5cf6",
                icon: <Building2 size={16} />,
                items: [
                  { name: "Approved Registry Models", desc: "Only gpt-4o, gpt-4o-mini, text-embedding-3-large can be deployed", policyId: "aafe3651 / 12e5dd16", effect: "Deny" },
                  { name: "Allowed Content Filtering", desc: "Deployments must use an approved content filter policy", policyId: "af253d37 / f3a9c2e0", effect: "Deny" },
                  { name: "Allowed Cognitive Services Kinds", desc: "Only AIServices kind can be created", policyId: "24695608", effect: "Deny" },
                ],
                docUrl: "https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/built-in-policy-model-deployment",
              },
              {
                layer: "Layer 2: RAI Policies (Deployment Config)",
                color: "#f43f5e",
                icon: <Shield size={16} />,
                items: [
                  { name: "Content Filter: strict-enterprise", desc: "Hate, Sexual, Violence, Self-harm → block at Medium severity", policyId: "raiPolicies ARM resource", effect: "Block" },
                  { name: "Prompt Shields", desc: "Jailbreak + indirect attack detection enabled", policyId: "raiPolicies", effect: "Block" },
                  { name: "Protected Material", desc: "Text + code detection enabled for copyright compliance", policyId: "raiPolicies", effect: "Annotate" },
                ],
                docUrl: "https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter",
              },
              {
                layer: "Layer 3: APIM Gateway (Runtime)",
                color: "#06b6d4",
                icon: <Network size={16} />,
                items: [
                  { name: "JWT Validation", desc: "Caller must present valid Entra ID token", policyId: "validate-azure-ad-token", effect: "401" },
                  { name: "allowedModels per BU", desc: "Identity → BU mapping → model access control", policyId: "APIM policy", effect: "403" },
                  { name: "llm-content-safety (external models)", desc: "Azure Content Safety screening for non-Foundry models", policyId: "llm-content-safety", effect: "403" },
                ],
                docUrl: "https://learn.microsoft.com/en-us/azure/api-management/llm-content-safety-policy",
              },
              {
                layer: "Layer 4: Foundry Content Filter (Inference)",
                color: "#10b981",
                icon: <Eye size={16} />,
                items: [
                  { name: "Prompt screening", desc: "Input content checked before model processes it", policyId: "Microsoft.DefaultV2", effect: "400" },
                  { name: "Completion screening", desc: "Output content checked before returning to caller", policyId: "Microsoft.DefaultV2", effect: "Filtered" },
                  { name: "Annotations in response", desc: "content_filter_results returned with severity levels", policyId: "API response", effect: "Annotate" },
                ],
                docUrl: "https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/content-filters",
              },
            ].map((layer, li) => (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: li * 0.1 }}
                className="rounded-xl border p-4"
                style={{ borderColor: layer.color + "30", backgroundColor: layer.color + "05" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: layer.color + "20", color: layer.color }}>
                      {layer.icon}
                    </div>
                    <span className="text-sm font-semibold text-white">{layer.layer}</span>
                  </div>
                  <a href={layer.docUrl} target="_blank" className="text-[10px] px-2 py-0.5 rounded bg-[#111827] border border-[#2d3561] text-slate-400 hover:text-white transition-colors">
                    Docs ↗
                  </a>
                </div>
                <div className="space-y-1.5">
                  {layer.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#0d1225]/60 text-xs">
                      <div className="flex-1">
                        <span className="text-slate-300 font-medium">{item.name}</span>
                        <span className="text-slate-600 ml-2">— {item.desc}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[9px] text-slate-600 font-mono">{item.policyId}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                          item.effect === "Deny" || item.effect === "Block" ? "bg-rose-500/20 text-rose-300" :
                          item.effect === "401" || item.effect === "403" || item.effect === "400" ? "bg-amber-500/20 text-amber-300" :
                          "bg-blue-500/20 text-blue-300"
                        }`}>{item.effect}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Doc links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Content filtering concepts", url: "https://learn.microsoft.com/en-us/azure/foundry-classic/foundry-models/concepts/content-filter" },
              { label: "Configure content filters", url: "https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/content-filters" },
              { label: "raiPolicies REST API", url: "https://learn.microsoft.com/en-us/rest/api/aiservices/accountmanagement/rai-policies/create-or-update" },
              { label: "Model deployment policies", url: "https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/built-in-policy-model-deployment" },
              { label: "APIM llm-content-safety policy", url: "https://learn.microsoft.com/en-us/azure/api-management/llm-content-safety-policy" },
              { label: "Azure Policy for AI governance", url: "https://learn.microsoft.com/en-us/training/modules/govern-ai-azure-policy/" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111827] border border-[#2d3561] text-xs text-slate-400 hover:text-white hover:border-rose-500/30 transition-all"
              >
                <Globe size={12} className="text-rose-400 shrink-0" />
                {link.label}
                <span className="ml-auto text-[10px] text-slate-600">↗</span>
              </a>
            ))}
          </div>
        </Card>
      </section>

      {/* Azure Policy (Subscription Level View) */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          Azure Policy Assignments
          <Badge color="blue">11 POLICIES</Badge>
        </h3>
        <Card className="p-5">
          <div className="grid gap-3">
            {architectureData.policies.map((policy, i) => (
              <motion.div
                key={policy.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between py-3 px-4 bg-[#111827] rounded-lg hover:bg-[#1a1f36] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${
                    policy.effect === "DeployIfNotExists" ? "bg-purple-500/10" :
                    policy.effect === "Modify" ? "bg-cyan-500/10" :
                    "bg-indigo-500/10"
                  }`}>
                    {policy.effect === "DeployIfNotExists" && <Wrench size={14} className="text-purple-400" />}
                    {policy.effect === "Modify" && <Wrench size={14} className="text-cyan-400" />}
                    {policy.effect === "Audit" && <Eye size={14} className="text-amber-400" />}
                    {!policy.effect && policy.icon === "shield" && <Shield size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "lock" && <Lock size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "tag" && <Tag size={14} className="text-indigo-400" />}
                    {!policy.effect && policy.icon === "network" && <Network size={14} className="text-indigo-400" />}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-300">{policy.name}</span>
                    {policy.effect && (
                      <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        policy.effect === "DeployIfNotExists" ? "bg-purple-500/10 text-purple-300" :
                        policy.effect === "Modify" ? "bg-cyan-500/10 text-cyan-300" :
                        "bg-amber-500/10 text-amber-300"
                      }`}>{policy.effect}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={policy.status === "Enforce" ? "green" : "amber"}>{policy.status}</Badge>
                  {policy.status === "Enforce" ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-400" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-2">
            <Wrench size={12} className="inline mr-1 text-purple-400" />
            <strong>DINE</strong> (DeployIfNotExists) policies auto-deploy configurations. <strong>Modify</strong> policies auto-patch properties.
            Original <strong>Audit</strong> policies flag for compliance visibility.
          </div>
        </Card>
      </section>

      {/* Network Topology */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Network size={18} className="text-cyan-400" />
          Network Topology
        </h3>
        <Card className="p-6">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-8">
              {/* Spokes */}
              <div className="space-y-3">
                {architectureData.vnets.filter(v => v.role === "spoke").map((vnet, i) => (
                  <motion.div
                    key={vnet.name}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="bg-[#111827] border border-[#2d3561] rounded-lg px-4 py-2.5 min-w-[200px]">
                      <div className="text-sm font-medium text-slate-300">{vnet.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{vnet.prefix}</div>
                    </div>
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      className="flex items-center gap-1"
                    >
                      <div className="w-8 h-0.5 bg-cyan-500/50" />
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <div className="w-8 h-0.5 bg-cyan-500/50" />
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Hub */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-indigo-500/30 rounded-xl px-6 py-5 text-center"
              >
                <Globe size={24} className="text-indigo-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-white">vnet-foundry-hub</div>
                <div className="text-xs text-indigo-300 font-mono mt-1">10.0.0.0/16</div>
                <div className="mt-2 flex gap-1 justify-center">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                  ))}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">All peered</div>
              </motion.div>
            </div>
          </div>
        </Card>
      </section>

      {/* Data Protection */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Database size={18} className="text-purple-400" />
          Data Protection & Key Management
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card glow className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Key size={18} className="text-purple-400" />
              <span className="font-semibold text-sm">Azure Key Vault</span>
              <Badge color="green">Secured</Badge>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Soft Delete", enabled: architectureData.governance.softDeleteEnabled },
                { label: "Purge Protection", enabled: architectureData.governance.purgeProtection },
                { label: "RBAC Authorization", enabled: architectureData.governance.rbacAuth },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-slate-400">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className={item.enabled ? "text-emerald-400" : "text-rose-400"} />
                    <span className={item.enabled ? "text-emerald-400" : "text-rose-400"}>
                      {item.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card glow className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <Eye size={18} className="text-cyan-400" />
              <span className="font-semibold text-sm">Observability</span>
              <Badge color="cyan">Active</Badge>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Diagnostic Settings", enabled: architectureData.governance.diagnosticsEnabled },
                { label: "Log Analytics (90d retention)", enabled: true },
                { label: "Metrics Collection", enabled: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-slate-400">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span className="text-emerald-400">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
