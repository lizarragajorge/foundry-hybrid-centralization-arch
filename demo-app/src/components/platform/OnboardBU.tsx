"use client";

import { useState } from "react";
import { Plus, Copy, Check, FolderPlus, Boxes, Network, KeyRound, ShieldCheck, Lock } from "lucide-react";
import { Card, Badge } from "@/components/ui/shared";
import { architectureData } from "@/lib/config";
import { businessUnits } from "@/lib/business-units";

const autoCreated = [
  { icon: <FolderPlus size={13} />, label: "Resource group", detail: "rg-<name>-<env>" },
  { icon: <Boxes size={13} />, label: "Foundry project", detail: "child of the hub \u2014 own system-assigned MI" },
  { icon: <Network size={13} />, label: "Spoke VNet + peering", detail: "bidirectional hub peering, app + PE subnets" },
  { icon: <KeyRound size={13} />, label: "RBAC", detail: "project MI → Azure AI User, scoped to hub" },
  { icon: <ShieldCheck size={13} />, label: "Key Vault access", detail: "project MI → KV Secrets User" },
  { icon: <Lock size={13} />, label: "Policy inheritance", detail: "allowed-models, tags, network \u2014 enforced automatically" },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "newbu";
}

export default function OnboardBU() {
  const [displayName, setDisplayName] = useState("Data Science & AI");
  const [octet, setOctet] = useState(businessUnits.length + 1);
  const allModels = architectureData.models.map((m) => m.name);
  const [models, setModels] = useState<string[]>(["gpt-4o-mini"]);
  const [copied, setCopied] = useState(false);

  const name = slugify(displayName);
  const modelLines = (models.length ? models : ["gpt-4o-mini"]).map((m) => `      '${m}'`).join("\n");
  const snippet = `  {
    name: '${name}'
    displayName: '${displayName}'
    vnetAddressPrefix: '10.${octet}.0.0/16'
    appSubnetPrefix: '10.${octet}.1.0/24'
    peSubnetPrefix: '10.${octet}.2.0/24'
    allowedModels: [
${modelLines}
    ]
  }`;

  const copy = () => {
    navigator.clipboard?.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const toggleModel = (m: string) =>
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <div className="space-y-5">
      <Card className="p-4 border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <Plus size={15} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Onboard a Business Unit</span>
          <Badge color="purple">one parameter</Badge>
        </div>
        <p className="text-[12px] text-slate-400 mt-1">
          Federation is a single array entry. Fill the form to generate the exact{" "}
          <span className="font-mono text-slate-300">businessUnits[]</span> Bicep param &mdash; the orchestrator does the rest.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form */}
        <Card className="p-5 space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full bg-[#111827] border border-[#2d3561] rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              resource name → <span className="font-mono text-slate-400">{name}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide">Address space (second octet)</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="range"
                min={1}
                max={250}
                value={octet}
                onChange={(e) => setOctet(Number(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="font-mono text-sm text-white w-28 text-right">10.{octet}.0.0/16</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide">Allowed models (central catalog)</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {allModels.map((m) => {
                const on = models.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleModel(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                      on
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                        : "border-[#2d3561] text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {on ? "\u2713 " : ""}
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Policy blocks any model not in this list &mdash; central IT still owns the catalog.
            </p>
          </div>
        </Card>

        {/* Generated snippet */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2d3561] bg-[#0d1225]">
            <span className="text-xs font-mono text-slate-400">infra/main.bicepparam</span>
            <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="p-4 text-[12px] leading-relaxed font-mono text-slate-300 overflow-x-auto">
            <span className="text-slate-500">param businessUnits = [</span>
            {"\n"}
            <span className="text-slate-500">  {"// …existing BUs"}</span>
            {"\n"}
            {snippet}
            {"\n"}
            <span className="text-slate-500">]</span>
          </pre>
        </Card>
      </div>

      {/* What gets auto-created */}
      <Card className="p-5">
        <div className="text-xs font-semibold text-slate-400 uppercase mb-3">
          What that one entry auto-provisions
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {autoCreated.map((a) => (
            <div key={a.label} className="flex items-start gap-2.5 rounded-lg border border-[#2d3561] bg-[#0d1225] p-3">
              <span className="text-purple-400 mt-0.5">{a.icon}</span>
              <div>
                <div className="text-sm text-white font-medium">{a.label}</div>
                <div className="text-[11px] text-slate-500">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-4">
          Deploy with <span className="font-mono text-slate-300">./scripts/deploy.ps1 -Preview</span> to what-if, then{" "}
          <span className="font-mono text-slate-300">./scripts/deploy.ps1</span> to apply. No module edits required.
        </p>
      </Card>
    </div>
  );
}
