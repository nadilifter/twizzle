"use client";

import { FeatureGate } from "@/components/feature-gate";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="reports">{children}</FeatureGate>;
}
