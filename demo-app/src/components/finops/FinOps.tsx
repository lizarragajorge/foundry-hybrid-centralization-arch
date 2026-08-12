"use client";

import { DollarSign, BarChart3 } from "lucide-react";
import CostCalculator from "@/components/cost/CostCalculator";
import TelemetryDashboard from "@/components/dashboard/TelemetryDashboard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubTabs } from "@/components/ui/SubTabs";

// Chargeback & Telemetry = central financial + operational visibility across BUs.
export default function FinOps() {
  return (
    <SubTabs
      tabs={[
        {
          id: "chargeback",
          label: "Chargeback",
          icon: <DollarSign size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Chargeback error">
              <CostCalculator />
            </ErrorBoundary>
          ),
        },
        {
          id: "telemetry",
          label: "Telemetry",
          icon: <BarChart3 size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Telemetry error">
              <TelemetryDashboard />
            </ErrorBoundary>
          ),
        },
      ]}
    />
  );
}
