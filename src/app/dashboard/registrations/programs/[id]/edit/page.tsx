"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ProgramStepper } from "../../components/program-stepper"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import type { ProgramWithRelations } from "@/types/programs"

export default function EditProgramPage() {
  const params = useParams()
  const programId = params.id as string
  
  const [program, setProgram] = useState<ProgramWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useBreadcrumbOverride(
    program ? `/dashboard/registrations/programs/${programId}` : undefined,
    program?.name,
  )

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        const response = await fetch(`/api/programs/${programId}`)
        if (!response.ok) {
          throw new Error("Failed to load program")
        }
        const data = await response.json()
        setProgram(data)
      } catch (err: any) {
        setError(err.message || "Failed to load program")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchProgram()
  }, [programId])
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading program...</p>
      </div>
    )
  }
  
  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-destructive">{error || "Program not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/registrations/programs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </Link>
        </Button>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/registrations/programs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">Edit Program</p>
          <h1 className="text-3xl font-bold tracking-tight">{program.name}</h1>
        </div>
      </div>

      <ProgramStepper program={program} />
    </div>
  )
}
