"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ActionItemsPanel,
  ActionItemsPanelSkeleton,
} from "@/components/dashboard/action-items-panel";
import type { ActionItemsResponse } from "@/types/onboarding";

const DISMISSED_KEY = "action-items-dismissed";

export function DashboardGrid({
  actionItems,
  children,
}: {
  actionItems: ActionItemsResponse | null;
  children: React.ReactNode;
}) {
  const [panelVisible, setPanelVisible] = useState(!!actionItems);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (
      !actionItems ||
      (actionItems.allComplete && localStorage.getItem(DISMISSED_KEY) === "true")
    ) {
      setPanelVisible(false);
    }
    setHydrated(true);
  }, [actionItems]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setPanelVisible(false);
  }, []);

  return (
    <div
      className={`grid w-full max-w-[2000px] grid-cols-1 gap-4 ${
        panelVisible
          ? "xl:grid-cols-[360px_minmax(0,1fr)] min-[1920px]:grid-cols-[minmax(360px,1fr)_minmax(0,1400px)]"
          : ""
      }`}
    >
      {panelVisible && (
        <div className="flex">
          {hydrated ? (
            <ActionItemsPanel data={actionItems!} onDismiss={handleDismiss} />
          ) : (
            <ActionItemsPanelSkeleton />
          )}
        </div>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
