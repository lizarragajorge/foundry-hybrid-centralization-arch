"use client";

import { Play, Swords, ShieldAlert } from "lucide-react";
import SimulationPanel from "@/components/simulation/SimulationPanel";
import ModelArena from "@/components/arena/ModelArena";
import GuardrailsDemo from "@/components/guardrails/GuardrailsDemo";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubTabs } from "@/components/ui/SubTabs";

// BU Workspace = federated self-service running inside central guardrails.
export default function BUWorkspace() {
  return (
    <SubTabs
      scope="federated"
      tabs={[
        {
          id: "simulation",
          label: "Simulation",
          icon: <Play size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Simulation error">
              <SimulationPanel />
            </ErrorBoundary>
          ),
        },
        {
          id: "arena",
          label: "Arena",
          icon: <Swords size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Arena error">
              <ModelArena />
            </ErrorBoundary>
          ),
        },
        {
          id: "guardrails",
          label: "Guardrails",
          icon: <ShieldAlert size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Guardrails error">
              <GuardrailsDemo />
            </ErrorBoundary>
          ),
        },
      ]}
    />
  );
}
