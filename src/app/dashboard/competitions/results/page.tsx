"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { BarChart3 } from "lucide-react"

export default function ResultsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DemoDataBanner />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          View and manage competition results.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Competition Results
          </CardTitle>
          <CardDescription>
            Track scores, times, and placements across all your competitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-medium text-muted-foreground mb-1">Results Management Coming Soon</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This page will allow you to enter results, view leaderboards, manage scoring,
              and publish results for participants and spectators.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
