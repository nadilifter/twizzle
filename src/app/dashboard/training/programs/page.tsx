"use client"

import * as React from "react"
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
import { Plus, Search, Users, Dumbbell, Settings, Loader2, AlertCircle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { usePrograms } from "@/hooks/use-programs"
import { toast } from "sonner"
import { ProgramConfiguration } from "./program-configuration"

export default function ProgramsPage() {
  const { programs, isLoading, error, fetchPrograms, createProgram, updateProgram } = usePrograms()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [selectedProgram, setSelectedProgram] = React.useState<any>(null)

  // Form states
  const [newProgram, setNewProgram] = React.useState({
    name: "",
    description: "",
    level: "",
  })

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPrograms({ search: searchTerm })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchPrograms])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProgram.name) {
      toast.error("Program Name is required")
      return
    }

    const result = await createProgram({
        ...newProgram,
        level: newProgram.level || "Beginner" // Default level if optional
    })
    if (result) {
      toast.success("Program created successfully")
      setIsAddOpen(false)
      setNewProgram({ name: "", description: "", level: "" })
      
      // Open configuration for the new program
      setSelectedProgram(result)
      setIsEditOpen(true)
    }
  }

  const handleConfigure = (program: any) => {
    setSelectedProgram(program)
    setIsEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
          <p className="text-muted-foreground">
            Manage your gym&apos;s training programs and curriculum levels.
          </p>
        </div>
        <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Program
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Add New Program</SheetTitle>
                    <SheetDescription>
                        Create a new training program for your gym.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleCreate} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Program Name</Label>
                        <Input 
                          id="name" 
                          placeholder="e.g. Recreational - Bronze" 
                          value={newProgram.name}
                          onChange={e => setNewProgram(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Describe the program goals..." 
                          value={newProgram.description}
                          onChange={e => setNewProgram(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="level">Level (Optional)</Label>
                        <Input 
                          id="level" 
                          placeholder="e.g. Bronze" 
                          value={newProgram.level}
                          onChange={e => setNewProgram(prev => ({ ...prev, level: e.target.value }))}
                        />
                    </div>
                    <Button type="submit">Create Program</Button>
                </form>
            </SheetContent>
        </Sheet>
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

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
            {selectedProgram ? (
                <ProgramConfiguration 
                    program={selectedProgram} 
                    onClose={() => setIsEditOpen(false)} 
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
                    <CardDescription className="mt-1">{program.level}</CardDescription>
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
                <Button variant="outline" className="w-full" onClick={() => handleConfigure(program)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
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
