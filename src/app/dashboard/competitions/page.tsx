"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DemoDataBanner } from "@/components/demo-data-banner"
import {
  Plus, Search, CalendarDays, Clock, MapPin, Trophy,
} from "lucide-react"

const COMPETITION_TYPE_LABELS: Record<string, string> = {
  GYMNASTICS: "Gymnastics",
  TRACK_AND_FIELD: "Track & Field",
}

export default function CompetitionsPage() {
  const [searchTerm, setSearchTerm] = React.useState("")

  return (
    <div className="flex flex-col gap-6 p-6">
      <DemoDataBanner />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competitions</h1>
          <p className="text-muted-foreground">
            Manage competitions, meets, and large-scale events.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/competitions/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Competition
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search competitions..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Empty state */}
        <div className="col-span-full flex flex-col items-center justify-center py-12 border rounded-lg border-dashed">
          <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No competitions yet. Create one to get started.</p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/competitions/new">
              <Plus className="mr-2 h-4 w-4" />
              Create your first competition
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
