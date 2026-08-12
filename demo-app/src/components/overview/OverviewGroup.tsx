"use client";

import { Network, Map } from "lucide-react";
import HybridSplitView from "@/components/overview/HybridSplitView";
import ArchitectureDiagram from "@/components/architecture/ArchitectureDiagram";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SubTabs } from "@/components/ui/SubTabs";

// Overview = the hero split view, with the detailed architecture map preserved.
export default function OverviewGroup() {
  return (
    <SubTabs
      tabs={[
        {
          id: "split",
          label: "Split View",
          icon: <Network size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Split View error">
              <HybridSplitView />
            </ErrorBoundary>
          ),
        },
        {
          id: "map",
          label: "Architecture Map",
          icon: <Map size={14} />,
          content: (
            <ErrorBoundary fallbackTitle="Architecture Map error">
              <ArchitectureDiagram />
            </ErrorBoundary>
          ),
        },
      ]}
    />
  );
}
