"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock, ShieldCheck, KeyRound, Network, Cpu, Boxes, ArrowRight,
  CheckCircle2, XCircle, FileCheck, Building2, Globe, ScrollText,
} from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { architectureData } from "@/lib/config";
import { businessUnits } from "@/lib/business-units";

// The enforced control-plane seam every federated call must pass through.
const checkpoints = [
  { icon: <KeyRound size={13} />, label: "Entra ID token", note: "No API keys \u2014 local auth disabled" },
  { icon: <ShieldCheck size={13} />, label: "RBAC scope", note: "Project MI limited to hub" },
  { icon: <ScrollText size={13} />, label: "Azure Policy", note: "Allowed models + tags enforced" },
  { icon: <FileCheck size={13} />, label: "Content Safety", note: "Standard RAI guardrail" },
];

// Central functions owned once by the AI CoE hub.
const centralFunctions = [
  { icon: <KeyRound size={14} />, label: "Identity", value: "Entra ID + Managed Identities", on: architectureData.governance.rbacAuth },
  { icon: <Lock size={14} />, label: "Local auth", value: architectureData.governance.localAuthDisabled ? "Disabled (keys off)" : "Enabled", on: architectureData.governance.localAuthDisabled },
  { icon: <ScrollText size={14} />, label: "Policy", value: `${architectureData.policies.length} assignments`, on: true },
  { icon: <Network size={14} />, label: "Networking", value: "Hub-spoke + private endpoints", on: true },
  { icon: <ShieldCheck size={14} />, label: "Key Vault", value: architectureData.governance.purgeProtection ? "Purge-protected, RBAC" : "RBAC", on: architectureData.governance.purgeProtection },
];

export default function HybridSplitView() {
  const [selectedBU, setSelectedBU] = useState<string | null>(null);
  const active = businessUnits.find((b) => b.id === selectedBU) || null;

  return (
    <div className="space-y-5">
      {/* Thesis banner */}
      <Card className="p-4 border-indigo-500/20 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5">
        <p className="text-sm text-slate-300 text-center">
          <span className="text-cyan-300 font-semibold">Centralize</span> identity, models, policy & security once &middot;{" "}
          <span className="text-purple-300 font-semibold">Federate</span> AI consumption to every business unit &middot;{" "}
          <span className="text-slate-400">click a BU to see exactly what it can reach</span>
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT — Centralized hub */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-300 uppercase tracking-widest">Centralized &mdash; AI CoE Hub</span>
          </div>

          <Card className="p-4 border-cyan-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Model deployments</span>
              <Badge color="cyan">deployed once</Badge>
            </div>
            <div className="space-y-2">
              {architectureData.models.map((m) => {
                const allowed = active ? active.allowedModels.includes(m.name) : null;
                const dimmed = allowed === false;
                return (
                  <div
                    key={m.name}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-all ${
                      allowed === true
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : dimmed
                        ? "border-[#2d3561] opacity-35"
                        : "border-[#2d3561]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white">{m.name}</span>
                      <span className="text-[10px] text-slate-500">{m.format}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{m.tpm ? `${m.tpm}K TPM` : "external"}</span>
                      {allowed === true && <CheckCircle2 size={14} className="text-emerald-400" />}
                      {dimmed && <XCircle size={14} className="text-slate-600" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-4 border-cyan-500/20">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Governed core functions</div>
            <div className="space-y-2">
              {centralFunctions.map((f) => (
                <div key={f.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="text-cyan-400">{f.icon}</span>
                    {f.label}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                    {f.value}
                    <span className={`w-1.5 h-1.5 rounded-full ${f.on ? "bg-emerald-400" : "bg-amber-400"}`} />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* MIDDLE — Control-plane seam */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center gap-2 py-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Foundry Control Plane</div>
          <div className="hidden lg:block text-slate-600"><ArrowRight size={18} /></div>
          <div className="w-full space-y-1.5">
            {checkpoints.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: active ? 1 : 0.6, borderColor: active ? "rgba(16,185,129,0.4)" : "rgba(45,53,97,1)" }}
                transition={{ delay: active ? i * 0.08 : 0 }}
                className="rounded-lg border px-2.5 py-1.5 bg-[#0d1225]"
                title={c.note}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                  <span className="text-emerald-400">{c.icon}</span>
                  {c.label}
                </div>
              </motion.div>
            ))}
          </div>
          {active && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-center text-slate-500 mt-1"
            >
              <span className="font-mono" style={{ color: active.color }}>{active.id}</span> → hub
            </motion.div>
          )}
        </div>

        {/* RIGHT — Federated BU spokes */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes size={15} className="text-purple-400" />
              <span className="text-xs font-semibold text-purple-300 uppercase tracking-widest">Federated &mdash; BU Spokes</span>
            </div>
            {active && (
              <button onClick={() => setSelectedBU(null)} className="text-[11px] text-slate-500 hover:text-white">
                clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {businessUnits.map((bu) => {
              const isActive = bu.id === selectedBU;
              return (
                <button
                  key={bu.id}
                  onClick={() => setSelectedBU(isActive ? null : bu.id)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    isActive ? "bg-[#1a1f36]" : "border-[#2d3561] bg-[#0d1225] hover:-translate-y-0.5"
                  }`}
                  style={isActive ? { borderColor: bu.color, backgroundColor: `${bu.color}12` } : {}}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bu.color }} />
                    <span className="text-sm font-semibold text-white truncate">{bu.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-2">
                    <Globe size={10} /> {bu.region}
                    <span className="text-slate-700">&middot;</span>
                    <Building2 size={10} /> own MI
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {bu.allowedModels.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#111827] text-slate-400 border border-[#2d3561]">
                        {m}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <Card className="p-3 border-purple-500/20">
            <p className="text-[11px] text-slate-400">
              Adding a BU is a <span className="text-purple-300 font-mono">one-line</span> entry in the{" "}
              <span className="font-mono text-slate-300">businessUnits[]</span> Bicep param &mdash; the orchestrator auto-creates the
              resource group, project, VNet, peering, managed identity, RBAC, and Key Vault access.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
