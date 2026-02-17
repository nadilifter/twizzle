"use client"

import { CompetitionStepper } from "../components/competition-stepper"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NewCompetitionPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/competitions">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Competition</h1>
          <p className="text-muted-foreground">
            Set up a new competition for your organization.
          </p>
        </div>
      </div>

      <CompetitionStepper />
    </div>
  )
}
