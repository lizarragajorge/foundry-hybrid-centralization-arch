"use client";

import { BookOpen, Shield, Bot, UserPlus } from "lucide-react";
import ModelCatalog from "@/components/catalog/ModelCatalog";
import GovernanceShowcase from "@/components/governance/GovernanceShowcase";
import AgentGatewayDemo from "@/components/agent/AgentGatewayDemo";
import OnboardBU from "@/components/platform/OnboardBU";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubTabs } from "@/components/ui/SubTabs";

// Central Platform = the functions the AI CoE hub owns once for every BU.
export default function CentralPlatform() {
  return (
    <SubTabs
      scope="central"
      tabs={[
        {
          id: "catalog",
          label: "Model Catalog",
          icon: <BookOpen size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Model Catalog error">
              <ModelCatalog />
            </ErrorBoundary>
          ),
        },
        {
          id: "governance",
          label: "Governance & Security",
          icon: <Shield size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Governance error">
              <GovernanceShowcase />
            </ErrorBoundary>
          ),
        },
        {
          id: "onboard",
          label: "Onboard BU",
          icon: <UserPlus size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Onboard BU error">
              <OnboardBU />
            </ErrorBoundary>
          ),
        },
        {
          id: "agent",
          label: "Agent Gateway",
          icon: <Bot size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Agent Gateway error">
              <AgentGatewayDemo />
            </ErrorBoundary>
          ),
        },
      ]}
    />
  );
}
