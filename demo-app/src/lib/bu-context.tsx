"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type BUFilter = "all" | "Finance & Risk" | "Marketing & Sales" | "Engineering & Product";

type BUContextType = {
  activeBU: BUFilter;
  setActiveBU: (bu: BUFilter) => void;
};

const BUContext = createContext<BUContextType>({
  activeBU: "all",
  setActiveBU: () => {},
});

export function BUProvider({ children }: { children: ReactNode }) {
  const [activeBU, setActiveBU] = useState<BUFilter>("all");
  return (
    <BUContext.Provider value={{ activeBU, setActiveBU }}>
      {children}
    </BUContext.Provider>
  );
}

export function useBUFilter() {
  return useContext(BUContext);
}

export const BU_OPTIONS: { value: BUFilter; label: string; shortLabel: string; color: string }[] = [
  { value: "all", label: "All Business Units", shortLabel: "All BUs", color: "#8b5cf6" },
  { value: "Finance & Risk", label: "Finance & Risk", shortLabel: "Finance", color: "#10b981" },
  { value: "Marketing & Sales", label: "Marketing & Sales", shortLabel: "Marketing", color: "#3b82f6" },
  { value: "Engineering & Product", label: "Engineering & Product", shortLabel: "Engineering", color: "#f59e0b" },
];

export type { BUFilter };
