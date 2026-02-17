"use client"

import { FeatureGate } from "@/components/feature-gate"

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FeatureGate feature="training">
      {children}
    </FeatureGate>
  )
}
