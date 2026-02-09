"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Loader2, Plus, User, Calendar, ChevronLeft } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AthleteOption {
  id: string
  firstName: string
  lastName: string
  name: string
  birthDate: string | null
  gender: string | null
}

interface AthleteSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAthleteSelected: (athlete: { id: string; name: string }) => void
  /** The slug of the current marketing site */
  slug: string
}

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
}

export function AthleteSelectionDialog({
  open,
  onOpenChange,
  onAthleteSelected,
  slug,
}: AthleteSelectionDialogProps) {
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const [newAthlete, setNewAthlete] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
  })

  // Fetch athletes when dialog opens
  useEffect(() => {
    if (open) {
      fetchAthletes()
    }
  }, [open, slug])

  const fetchAthletes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`)
      if (response.ok) {
        const data = await response.json()
        setAthletes(data.athletes || [])
      } else {
        console.error("Failed to fetch athletes")
      }
    } catch (error) {
      console.error("Error fetching athletes:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAthlete = (athlete: AthleteOption) => {
    const displayName = `${athlete.firstName} ${athlete.lastName}`.trim() || athlete.name
    onAthleteSelected({ id: athlete.id, name: displayName })
    onOpenChange(false)
    resetForm()
  }

  const handleCreateAthlete = async () => {
    if (!newAthlete.firstName.trim()) {
      toast.error("First name is required")
      return
    }
    if (!newAthlete.lastName.trim()) {
      toast.error("Last name is required")
      return
    }
    if (!newAthlete.birthDate) {
      toast.error("Date of birth is required")
      return
    }
    if (!newAthlete.gender) {
      toast.error("Gender declaration is required")
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAthlete),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Failed to create athlete")
      }

      const data = await response.json()
      const created = data.athlete
      const displayName = `${created.firstName} ${created.lastName}`.trim() || created.name
      toast.success(`${displayName} added successfully`)
      onAthleteSelected({ id: created.id, name: displayName })
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      console.error("Error creating athlete:", error)
      toast.error(error.message || "Failed to create athlete")
    } finally {
      setIsCreating(false)
    }
  }

  const resetForm = () => {
    setShowCreateForm(false)
    setNewAthlete({ firstName: "", lastName: "", birthDate: "", gender: "" })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? "Add New Athlete" : "Who is this registration for?"}
          </DialogTitle>
          <DialogDescription>
            {showCreateForm
              ? "Enter the details of the athlete you're registering."
              : "Select an existing athlete or add a new one."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : showCreateForm ? (
          /* Create New Athlete Form */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="athlete-first-name">First Name</Label>
                <Input
                  id="athlete-first-name"
                  value={newAthlete.firstName}
                  onChange={(e) =>
                    setNewAthlete((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  placeholder="First name"
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="athlete-last-name">Last Name</Label>
                <Input
                  id="athlete-last-name"
                  value={newAthlete.lastName}
                  onChange={(e) =>
                    setNewAthlete((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  placeholder="Last name"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="athlete-birth-date">Date of Birth</Label>
              <Input
                id="athlete-birth-date"
                type="date"
                value={newAthlete.birthDate}
                onChange={(e) =>
                  setNewAthlete((prev) => ({ ...prev, birthDate: e.target.value }))
                }
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="athlete-gender">Gender Declaration</Label>
              <Select
                value={newAthlete.gender}
                onValueChange={(value) =>
                  setNewAthlete((prev) => ({ ...prev, gender: value }))
                }
                disabled={isCreating}
              >
                <SelectTrigger id="athlete-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                  <SelectItem value="PREFER_NOT_TO_SAY">Prefer Not to Say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                disabled={isCreating}
                className="flex-1"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleCreateAthlete}
                disabled={isCreating}
                className="flex-1"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Athlete
              </Button>
            </div>
          </div>
        ) : (
          /* Athlete Selection List */
          <div className="space-y-3">
            {athletes.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {athletes.map((athlete) => {
                  const displayName =
                    `${athlete.firstName} ${athlete.lastName}`.trim() || athlete.name
                  const birthLabel = athlete.birthDate
                    ? new Date(athlete.birthDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null
                  const genderLabel = athlete.gender
                    ? GENDER_LABELS[athlete.gender] || athlete.gender
                    : null

                  return (
                    <button
                      key={athlete.id}
                      onClick={() => handleSelectAthlete(athlete)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {displayName}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {birthLabel && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {birthLabel}
                            </span>
                          )}
                          {genderLabel && <span>{genderLabel}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {athletes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No athletes found on your account. Add one to get started.
              </p>
            )}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4" />
              Add New Athlete
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
