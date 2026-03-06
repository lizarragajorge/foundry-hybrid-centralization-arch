"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Play, BarChart3, Shield, ShieldAlert,
  ExternalLink, Brain, Swords, DollarSign, Eye, Gauge
} from "lucide-react";
import ArchitectureDiagram from "@/components/architecture/ArchitectureDiagram";
import SimulationPanel from "@/components/simulation/SimulationPanel";
import TelemetryDashboard from "@/components/dashboard/TelemetryDashboard";
import GovernanceShowcase from "@/components/governance/GovernanceShowcase";
import ModelArena from "@/components/arena/ModelArena";
import CostCalculator from "@/components/cost/CostCalculator";
import RequestTraceViewer from "@/components/trace/RequestTraceViewer";
import MultiLoadTest from "@/components/loadtest/MultiLoadTest";
import GuardrailsDemo from "@/components/guardrails/GuardrailsDemo";
import BUFilterBar from "@/components/ui/BUFilterBar";
import { BUProvider } from "@/lib/bu-context";
import { SectionHeader } from "@/components/ui/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const tabs = [
  { id: "architecture", label: "Architecture", icon: <Layers size={16} /> },
  { id: "simulation", label: "Simulation", icon: <Play size={16} /> },
  { id: "arena", label: "Arena", icon: <Swords size={16} /> },
  { id: "trace", label: "Trace", icon: <Eye size={16} /> },
  { id: "loadtest", label: "Load Test", icon: <Gauge size={16} /> },
  { id: "telemetry", label: "Telemetry", icon: <BarChart3 size={16} /> },
  { id: "cost", label: "Cost", icon: <DollarSign size={16} /> },
  { id: "guardrails", label: "Guardrails", icon: <ShieldAlert size={16} /> },
  { id: "governance", label: "Governance", icon: <Shield size={16} /> },
] as const;

type TabId = (typeof tabs)[number]["id"];

const tabMeta: Record<TabId, { title: string; subtitle: string; badge: string }> = {
  architecture: {
    title: "Hybrid Architecture",
    subtitle: "Interactive visualization of the centralized AI CoE hub with federated BU spoke projects",
    badge: "LIVE DEPLOYMENT",
  },
  simulation: {
    title: "BU Simulations",
    subtitle: "Run live AI workloads through each Business Unit project against centralized model deployments",
    badge: "INTERACTIVE",
  },
  telemetry: {
    title: "Observability Dashboard",
    subtitle: "Real-time Azure Monitor metrics from the centralized Foundry resource",
    badge: "REAL-TIME",
  },
  arena: {
    title: "Model Comparison Arena",
    subtitle: "Side-by-side GPT-4o vs GPT-4o-mini — compare quality, latency, and cost on identical prompts",
    badge: "HEAD-TO-HEAD",
  },
  trace: {
    title: "Live Request Trace",
    subtitle: "Watch a real API request flow through every security checkpoint of the hybrid architecture",
    badge: "ANIMATED",
  },
  loadtest: {
    title: "Multi-BU Load Test",
    subtitle: "Fire simultaneous requests from all Business Units to demonstrate TPM governance under pressure",
    badge: "CONCURRENT",
  },
  cost: {
    title: "Cost Attribution",
    subtitle: "Per-BU and per-model cost breakdown with real-time usage tracking and optimization insights",
    badge: "FINANCIAL",
  },
  guardrails: {
    title: "Content Safety Guardrails",
    subtitle: "Live testing of Azure AI Content Safety filters — watch harmful prompts get blocked in real time",
    badge: "RESPONSIBLE AI",
  },
  governance: {
    title: "Governance & Security",
    subtitle: "Azure Policy, RBAC, network isolation, and Zero Trust controls",
    badge: "ENFORCED",
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("architecture");

  return (
    <BUProvider>
    <div className="min-h-screen">
      {/* Hero Header */}
      <header className="relative border-b border-[#2d3561] overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-purple-900/20" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />

        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  <Brain size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Azure Foundry <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Hybrid Pattern</span>
                  </h1>
                  <p className="text-sm text-slate-400">
                    Centralized AI CoE &middot; Federated Business Units &middot; Enterprise Governance
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Live on Azure</span>
              </div>
              <a
                href="https://ai.azure.com"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-[#2d3561] hover:border-indigo-500/40 transition-all"
              >
                <ExternalLink size={12} />
                Foundry Portal
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-[#2d3561] bg-[#0d1225]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all relative
                  ${activeTab === tab.id
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-300"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <SectionHeader
            title={tabMeta[activeTab].title}
            subtitle={tabMeta[activeTab].subtitle}
            badge={tabMeta[activeTab].badge}
          />
          {["telemetry", "cost"].includes(activeTab) && <BUFilterBar />}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "architecture" && <ErrorBoundary fallbackTitle="Architecture panel error"><ArchitectureDiagram /></ErrorBoundary>}
            {activeTab === "simulation" && <ErrorBoundary fallbackTitle="Simulation panel error"><SimulationPanel /></ErrorBoundary>}
            {activeTab === "arena" && <ErrorBoundary fallbackTitle="Arena panel error"><ModelArena /></ErrorBoundary>}
            {activeTab === "trace" && <ErrorBoundary fallbackTitle="Trace panel error"><RequestTraceViewer /></ErrorBoundary>}
            {activeTab === "loadtest" && <ErrorBoundary fallbackTitle="Load Test panel error"><MultiLoadTest /></ErrorBoundary>}
            {activeTab === "telemetry" && <ErrorBoundary fallbackTitle="Telemetry panel error"><TelemetryDashboard /></ErrorBoundary>}
            {activeTab === "cost" && <ErrorBoundary fallbackTitle="Cost panel error"><CostCalculator /></ErrorBoundary>}
            {activeTab === "guardrails" && <ErrorBoundary fallbackTitle="Guardrails panel error"><GuardrailsDemo /></ErrorBoundary>}
            {activeTab === "governance" && <ErrorBoundary fallbackTitle="Governance panel error"><GovernanceShowcase /></ErrorBoundary>}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2d3561] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-slate-600">
          <span>Azure Foundry Hybrid Pattern &middot; Landing Zone Architecture</span>
          <span>Deployed via Bicep IaC &middot; eastus2</span>
        </div>
      </footer>
    </div>
    </BUProvider>
  );
}
