"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Network, Brain, Users, Eye, Database, Lock, Cpu,
  ArrowRight, Layers, GitBranch, CheckCircle2, Server
} from "lucide-react";
import { architectureData } from "@/lib/config";
import { Card, Badge, StatusDot } from "@/components/ui/shared";

type SelectedNode = "hub" | "spoke" | "policy" | "network" | "security" | "monitoring" | null;

export default function ArchitectureDiagram() {
  const [selected, setSelected] = useState<SelectedNode>(null);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Main Architecture SVG Diagram */}
      <div className="relative bg-[#0d1225] border border-[#2d3561] rounded-2xl p-8 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        <div className="relative grid grid-cols-12 gap-6 min-h-[500px]">
          {/* Left Side: Federated BUs */}
          <div className="col-span-5 space-y-4">
            <div className="text-center mb-4">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                Federated — Business Units
              </span>
            </div>

            {architectureData.projects.map((project, i) => (
              <motion.div
                key={project.name}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                onMouseEnter={() => setHoveredProject(project.bu)}
                onMouseLeave={() => setHoveredProject(null)}
                onClick={() => setSelected("spoke")}
              >
                <Card
                  glow
                  className={`p-4 cursor-pointer transition-all duration-300 ${
                    hoveredProject === project.bu ? "border-opacity-100 scale-[1.02]" : ""
                  }`}
                  style={{ borderColor: hoveredProject === project.bu ? project.color : undefined } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <span className="font-semibold text-sm">{project.displayName}</span>
                    </div>
                    <StatusDot status="active" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {["Agents", "Tools", "Connections", "Guardrails", "Evaluations", "Observability"].map((cap) => (
                      <div key={cap} className="flex items-center gap-1.5 text-slate-400">
                        <CheckCircle2 size={10} className="text-emerald-400" />
                        {cap}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Center: Control Plane + Policy */}
          <div className="col-span-2 flex flex-col items-center justify-center space-y-6">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              onClick={() => setSelected("policy")}
              className="cursor-pointer"
            >
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-center">
                <Shield size={24} className="text-indigo-400 mx-auto mb-1" />
                <span className="text-xs font-medium text-indigo-300 block">Azure Policy</span>
                <span className="text-[10px] text-slate-500">Deployment</span>
              </div>
            </motion.div>

            {/* Animated connection lines */}
            <div className="flex flex-col items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 h-4 bg-indigo-500/40 rounded"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                />
              ))}
            </div>

            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              onClick={() => setSelected("hub")}
              className="cursor-pointer"
            >
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                <GitBranch size={24} className="text-purple-400 mx-auto mb-1" />
                <span className="text-xs font-medium text-purple-300 block">Foundry</span>
                <span className="text-[10px] text-slate-500">Control Plane</span>
              </div>
            </motion.div>

            {/* Arrow indicators */}
            <div className="flex items-center gap-2 text-slate-600 text-xs">
              <ArrowRight size={12} className="rotate-180" />
              <span>Governed Access</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* Right Side: Centralized AI CoE */}
          <div className="col-span-5 space-y-4">
            <div className="text-center mb-4">
              <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                Centralized — AI CoE
              </span>
            </div>

            {/* Foundry Resource Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card
                glow
                className="p-5 cursor-pointer border-purple-500/20"
                onClick={() => setSelected("hub")}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={20} className="text-purple-400" />
                  <span className="font-semibold">Microsoft Foundry Resource</span>
                  <StatusDot status="active" />
                </div>
                <div className="space-y-2">
                  {architectureData.models.map((model) => (
                    <div key={model.name} className="flex items-center justify-between bg-[#111827] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Cpu size={14} className="text-cyan-400" />
                        <span className="text-sm">{model.name}</span>
                      </div>
                      <Badge color="cyan">{model.tpm}K TPM</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1"><Server size={10} /> Compute</div>
                  <div className="flex items-center gap-1"><Shield size={10} /> Policies</div>
                  <div className="flex items-center gap-1"><Eye size={10} /> Observability</div>
                  <div className="flex items-center gap-1"><Database size={10} /> Data</div>
                </div>
              </Card>
            </motion.div>

            {/* Security Stack */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card glow className="p-4 cursor-pointer" onClick={() => setSelected("security")}>
                <div className="flex items-center gap-2 mb-3">
                  <Lock size={16} className="text-emerald-400" />
                  <span className="text-sm font-semibold">Security & Identity</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge color="green">Entra ID</Badge>
                  <Badge color="green">RBAC</Badge>
                  <Badge color="green">Key Vault</Badge>
                  <Badge color="green">Managed ID</Badge>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Bottom: Platform Services Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-8 py-3 border-t border-[#2d3561]"
        >
          {[
            { name: "Microsoft Purview", icon: <Eye size={16} />, color: "text-blue-400" },
            { name: "Microsoft Entra", icon: <Users size={16} />, color: "text-purple-400" },
            { name: "Microsoft Defender", icon: <Shield size={16} />, color: "text-emerald-400" },
            { name: "Azure Monitor", icon: <Layers size={16} />, color: "text-cyan-400" },
            { name: "Azure Network", icon: <Network size={16} />, color: "text-amber-400" },
          ].map((svc) => (
            <div key={svc.name} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
              <span className={svc.color}>{svc.icon}</span>
              {svc.name}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Detail Panel (shows on click) */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <DetailPanel node={selected} onClose={() => setSelected(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailPanel({ node, onClose }: { node: SelectedNode; onClose: () => void }) {
  const details: Record<string, { title: string; description: string; items: string[] }> = {
    hub: {
      title: "Centralized Foundry Resource (AI CoE)",
      description: "The top-level Azure resource (Microsoft.CognitiveServices/accounts, kind: AIServices) that serves as the governance boundary. All model deployments, compute, and policies are managed centrally.",
      items: [
        "Models deployed once, shared across all BU projects",
        "System-assigned managed identity for zero-credential auth",
        "Token-per-minute (TPM) limits enforce fair resource allocation",
        "Diagnostic settings stream to centralized Log Analytics",
        "Custom subdomain for Entra ID token-based authentication",
      ],
    },
    spoke: {
      title: "Federated BU Projects",
      description: "Each Business Unit gets a Foundry Project (Microsoft.CognitiveServices/accounts/projects) as a child resource. Projects provide isolation for agents, evaluations, and tools while inheriting hub-level model deployments.",
      items: [
        "Project-scoped managed identity for service-to-service auth",
        "Independent agent development and evaluation pipelines",
        "Project-level RBAC (Azure AI User role)",
        "Shared connections to data sources with optional project scoping",
        "Observability metrics scoped per project",
      ],
    },
    policy: {
      title: "Azure Policy Governance",
      description: "Centralized policy assignments enforce compliance across all Foundry resources. Currently in audit mode for PoC, switchable to enforcement.",
      items: architectureData.policies.map((p) => `${p.name} — ${p.status} mode`),
    },
    security: {
      title: "Security & Identity (Zero Trust)",
      description: "API key authentication is disabled. All access uses Microsoft Entra ID tokens. Key Vault stores connection secrets with RBAC-based access.",
      items: [
        "Local auth disabled — Entra ID tokens only",
        "Key Vault with soft-delete + purge protection",
        "RBAC authorization on Key Vault (no access policies)",
        "Managed identities for all Foundry resources",
        "Microsoft Defender for AI enabled",
      ],
    },
    network: {
      title: "Hub-Spoke Network Topology",
      description: "Virtual network isolation with hub-spoke peering. Each BU gets a spoke VNet that peers to the central hub.",
      items: architectureData.vnets.map((v) => `${v.name} — ${v.prefix} (${v.role})`),
    },
    monitoring: {
      title: "Centralized Observability",
      description: "All Foundry resources stream diagnostics to a shared Log Analytics workspace. Application Insights captures application-level telemetry.",
      items: [
        "Log Analytics: contoso-foundry-law (90-day retention)",
        "Diagnostic settings on hub + all projects",
        "Azure Monitor metrics: calls, tokens, latency",
        "KQL queries for request-level investigation",
        "Alert action groups for incident response",
      ],
    },
  };

  const detail = details[node!] || details.hub;

  return (
    <Card className="p-6 border-indigo-500/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{detail.title}</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">{detail.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white text-sm px-3 py-1 rounded-lg border border-[#2d3561] hover:border-indigo-500/40 transition-all"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {detail.items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-2 text-sm text-slate-300"
          >
            <CheckCircle2 size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            {item}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
