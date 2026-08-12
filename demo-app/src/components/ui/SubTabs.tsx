"use client";

import { ReactNode, useState } from "react";
import { Lock, Boxes } from "lucide-react";

export type SubTab = { id: string; label: string; icon?: ReactNode; content: ReactNode };

export function ScopeBanner({ scope }: { scope: "central" | "federated" }) {
  const cfg =
    scope === "central"
      ? {
          icon: <Lock size={14} />,
          label: "Centralized \u2014 AI CoE Hub",
          desc: "Owned once by central IT: identity, models, policy, and security. Governed uniformly for every business unit.",
          cls: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
        }
      : {
          icon: <Boxes size={14} />,
          label: "Federated \u2014 Business Unit Spokes",
          desc: "Self-service AI workloads scoped to each BU, running inside guardrails the BU cannot escape.",
          cls: "border-purple-500/30 bg-purple-500/5 text-purple-300",
        };
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${cfg.cls}`}>
      <span className="shrink-0">{cfg.icon}</span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide">{cfg.label}</div>
        <div className="text-[11px] text-slate-400">{cfg.desc}</div>
      </div>
    </div>
  );
}

export function SubTabs({ tabs, scope }: { tabs: SubTab[]; scope?: "central" | "federated" }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div className="space-y-5">
      {scope && <ScopeBanner scope={scope} />}
      <div className="flex flex-wrap gap-1 border-b border-[#2d3561]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              active === t.id
                ? "text-white bg-[#1a1f36] border-b-2 border-indigo-500"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}
