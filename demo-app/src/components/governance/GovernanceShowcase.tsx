"use client";

import { motion } from "framer-motion";
import {
  Shield, Lock, Network, Eye, Tag, Users, Key, CheckCircle2,
  AlertTriangle, XCircle, Globe, Server, Database
} from "lucide-react";
import { architectureData } from "@/lib/config";
import { Card, Badge, StatusDot } from "@/components/ui/shared";

export default function GovernanceShowcase() {
  return (
    <div className="space-y-8">
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

      {/* Azure Policy */}
      <section>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          Azure Policy Assignments
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
                  <div className="p-1.5 rounded bg-indigo-500/10">
                    {policy.icon === "shield" && <Shield size={14} className="text-indigo-400" />}
                    {policy.icon === "lock" && <Lock size={14} className="text-indigo-400" />}
                    {policy.icon === "tag" && <Tag size={14} className="text-indigo-400" />}
                    {policy.icon === "network" && <Network size={14} className="text-indigo-400" />}
                  </div>
                  <span className="text-sm font-medium text-slate-300">{policy.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color="amber">{policy.status}</Badge>
                  <AlertTriangle size={14} className="text-amber-400" />
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2">
            <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
            Policies are in <strong>Audit</strong> mode for PoC. Switch to <strong>Enforce</strong> for production by setting
            <code className="mx-1 px-1 bg-[#111827] rounded text-amber-300">policyEnforcementMode = &apos;Default&apos;</code>
            in parameters.
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
