"use client";

import { Eye, Gauge } from "lucide-react";
import RequestTraceViewer from "@/components/trace/RequestTraceViewer";
import MultiLoadTest from "@/components/loadtest/MultiLoadTest";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubTabs } from "@/components/ui/SubTabs";

// Live Proof = the enforced seam between federated calls and central controls.
export default function LiveProof() {
  return (
    <SubTabs
      tabs={[
        {
          id: "trace",
          label: "Request Trace",
          icon: <Eye size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Trace error">
              <RequestTraceViewer />
            </ErrorBoundary>
          ),
        },
        {
          id: "loadtest",
          label: "Load Test",
          icon: <Gauge size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Load Test error">
              <MultiLoadTest />
            </ErrorBoundary>
          ),
        },
      ]}
    />
  );
}
