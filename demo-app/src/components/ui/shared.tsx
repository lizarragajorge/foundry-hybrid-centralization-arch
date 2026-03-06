"use client";

import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  glow = false,
  onClick,
  style,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`
        bg-[#1a1f36] border border-[#2d3561] rounded-xl
        transition-all duration-300
        ${glow ? "hover:border-indigo-500/40 hover:shadow-[0_4px_30px_rgba(99,102,241,0.1)]" : ""}
        ${onClick ? "cursor-pointer hover:-translate-y-0.5" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  color = "purple",
}: {
  children: ReactNode;
  color?: "purple" | "blue" | "green" | "amber" | "rose" | "cyan";
}) {
  const colors = {
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[color]}`}>
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: "active" | "warning" | "error" }) {
  const colors = {
    active: "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    warning: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    error: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card glow className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">
            {value}
            {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">{icon}</div>
      </div>
    </Card>
  );
}

export function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {badge && <Badge color="purple">{badge}</Badge>}
      </div>
      {subtitle && <p className="text-slate-400">{subtitle}</p>}
    </div>
  );
}
