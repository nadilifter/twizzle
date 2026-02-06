"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Dumbbell, Settings, Loader2, AlertCircle, CalendarDays } from "lucide-react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { usePrograms } from "@/hooks/use-programs"
import { ProgramConfiguration } from "./program-configuration"

export default function ProgramsPage() {
  const router = useRouter()
  const { programs, isLoading, error, fetchPrograms } = usePrograms()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isConfigOpen, setIsConfigOpen] = React.useState(false)
  const [selectedProgram, setSelectedProgram] = React.useState<any>(null)

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPrograms({ search: searchTerm })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchPrograms])

  const handleQuickConfigure = (program: any) => {
    setSelectedProgram(program)
    setIsConfigOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage your registration programs and enrollment options.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/registrations/programs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Program
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search programs..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && programs.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {/* Quick Configuration Sheet - kept for advanced settings */}
      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
            {selectedProgram ? (
                <ProgramConfiguration 
                    program={selectedProgram} 
                    onClose={() => setIsConfigOpen(false)} 
                />
            ) : (
                <div className="p-6">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
            )}
        </SheetContent>
      </Sheet>

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{program.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {program._count.enrollments} Athletes
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  {program.description || "No description provided."}
                </p>
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Dumbbell className="h-4 w-4" />
                    Status: <Badge variant="outline">{program.status}</Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/dashboard/registrations/programs/${program.id}/sessions`}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {(program as any).recurrenceType === "NON_RECURRING" ? "View Session" : "View Sessions"}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleQuickConfigure(program)} title="Configure">
                    <Settings className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
          {programs.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No programs found. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
