"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { Layers, Users, Tags, Workflow } from "lucide-react"

export default function AdvancedRegistrationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DemoDataBanner />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Advanced</h1>
        <p className="text-muted-foreground mt-1">
          Complex event registrations with interconnected logic, hundreds of categories, and thousands of participants.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Advanced Registrations will support large-scale events with complex registration workflows.
            This feature is currently in development.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Layers className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Hundreds of Categories</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Organize events into deeply nested category structures with flexible grouping.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Thousands of Participants</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Handle mass registrations with bulk import, waitlists, and capacity management.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Workflow className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Interconnected Logic</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Build registration flows with prerequisites, dependencies, and conditional rules.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Tags className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Flexible Pricing</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tiered pricing, early-bird discounts, group rates, and bundle packages.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
