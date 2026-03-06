"use client";

import { useBUFilter, BU_OPTIONS } from "@/lib/bu-context";
import { Users } from "lucide-react";

export default function BUFilterBar() {
  const { activeBU, setActiveBU } = useBUFilter();

  return (
    <div className="flex items-center gap-2">
      <Users size={14} className="text-slate-500" />
      <span className="text-xs text-slate-500 mr-1">BU:</span>
      {BU_OPTIONS.map((bu) => (
        <button
          key={bu.value}
          onClick={() => setActiveBU(bu.value)}
          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
            activeBU === bu.value
              ? "text-white"
              : "border-[#2d3561] text-slate-500 hover:text-slate-300 hover:border-slate-500"
          }`}
          style={
            activeBU === bu.value
              ? { borderColor: bu.color, backgroundColor: `${bu.color}20`, color: bu.color }
              : {}
          }
        >
          {bu.value === "all" && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5" />
          )}
          {bu.value !== "all" && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
              style={{ backgroundColor: bu.color }}
            />
          )}
          {bu.shortLabel}
        </button>
      ))}
    </div>
  );
}
