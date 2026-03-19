"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2, Plus, User, Calendar, ChevronLeft, AlertCircle, Shield, Info } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { calculateAge, isAgeEligible } from "@/lib/age-utils"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
import { Switch } from "@/components/ui/switch"

interface AthleteOption {
  id: string
  firstName: string
  lastName: string
  name: string
  birthDate: string | null
  gender: string | null
  allowGuardianClaims?: boolean
  userId?: string | null
}

interface AthleteSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAthleteSelected: (athlete: { id: string; name: string }) => void
  slug: string
  hasAgeRestriction?: boolean
  minAge?: number | null
  maxAge?: number | null
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
  hasAgeRestriction,
  minAge,
  maxAge,
}: AthleteSelectionDialogProps) {
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  const [hasSelfAthlete, setHasSelfAthlete] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null)

  const [newAthlete, setNewAthlete] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    isSelf: false,
    allowGuardianClaims: false,
  })

  const ageRestrictionActive = hasAgeRestriction && (minAge != null || maxAge != null)
  const ageLabel = ageRestrictionActive
    ? minAge != null && maxAge != null
      ? `Ages ${minAge}–${maxAge}`
      : minAge != null
      ? `Ages ${minAge}+`
      : `Up to age ${maxAge}`
    : null

  const { eligibleAthletes, ineligibleAthletes } = useMemo(() => {
    if (!ageRestrictionActive) {
      return { eligibleAthletes: athletes, ineligibleAthletes: [] }
    }
    const eligible: AthleteOption[] = []
    const ineligible: AthleteOption[] = []
    for (const athlete of athletes) {
      const age = calculateAge(athlete.birthDate)
      if (isAgeEligible(age, minAge, maxAge)) {
        eligible.push(athlete)
      } else {
        ineligible.push(athlete)
      }
    }
    return { eligibleAthletes: eligible, ineligibleAthletes: ineligible }
  }, [athletes, ageRestrictionActive, minAge, maxAge])

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
        setHasSelfAthlete(data.hasSelfAthlete ?? false)
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
    setDuplicateMessage(null)
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAthlete),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === "duplicate_found") {
          setDuplicateMessage(data.message)
          return
        }
        if (data.claimed) {
          const displayName = `${data.athlete.firstName} ${data.athlete.lastName}`.trim() || data.athlete.name
          toast.success(data.message || `${displayName} claimed successfully`)
          onAthleteSelected({ id: data.athlete.id, name: displayName })
          onOpenChange(false)
          resetForm()
          return
        }
        throw new Error(data.error || "Failed to create athlete")
      }

      if (data.claimed) {
        const displayName = `${data.athlete.firstName} ${data.athlete.lastName}`.trim() || data.athlete.name
        toast.success(data.message || `${displayName} claimed successfully`)
        onAthleteSelected({ id: data.athlete.id, name: displayName })
        onOpenChange(false)
        resetForm()
        return
      }

      const created = data.athlete
      const displayName = `${created.firstName} ${created.lastName}`.trim() || created.name
      toast.success(`${displayName} added successfully`)

      if (ageRestrictionActive) {
        const age = calculateAge(newAthlete.birthDate)
        if (!isAgeEligible(age, minAge, maxAge)) {
          toast.error(
            `${displayName} does not meet the age requirement (${ageLabel}) for this program`
          )
          await fetchAthletes()
          setShowCreateForm(false)
          setNewAthlete({ firstName: "", lastName: "", birthDate: "", gender: "", isSelf: false, allowGuardianClaims: false })
          return
        }
      }

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
    setDuplicateMessage(null)
    setNewAthlete({ firstName: "", lastName: "", birthDate: "", gender: "", isSelf: false, allowGuardianClaims: false })
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
          <div className="space-y-4">
            {duplicateMessage && (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{duplicateMessage}</span>
              </div>
            )}

            {/* "This is me" toggle -- hidden if a self-athlete already exists */}
            {!hasSelfAthlete && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="is-self" className="text-sm font-medium cursor-pointer">
                      This athlete is me
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      I am registering myself, not a dependent
                    </p>
                  </div>
                </div>
                <Switch
                  id="is-self"
                  checked={newAthlete.isSelf}
                  onCheckedChange={(checked) =>
                    setNewAthlete((prev) => ({ ...prev, isSelf: checked }))
                  }
                  disabled={isCreating}
                />
              </div>
            )}

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
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCreating}
                    className={cn("w-full justify-start text-left font-normal", !newAthlete.birthDate && "text-muted-foreground")}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {newAthlete.birthDate ? format(new Date(newAthlete.birthDate + "T12:00:00Z"), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={newAthlete.birthDate ? new Date(newAthlete.birthDate + "T12:00:00Z") : undefined}
                    onSelect={(date) => setNewAthlete((prev) => ({ ...prev, birthDate: date ? format(date, "yyyy-MM-dd") : "" }))}
                    captionLayout="dropdown"
                    fromYear={1940}
                    toYear={new Date().getFullYear()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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

            {/* Guardian claims configuration */}
            {!newAthlete.isSelf && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="allow-guardian-claims" className="text-sm font-medium cursor-pointer">
                      Allow other guardians
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let other guardians find and claim this athlete
                    </p>
                  </div>
                </div>
                <Switch
                  id="allow-guardian-claims"
                  checked={newAthlete.allowGuardianClaims}
                  onCheckedChange={(checked) =>
                    setNewAthlete((prev) => ({ ...prev, allowGuardianClaims: checked }))
                  }
                  disabled={isCreating}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setDuplicateMessage(null)
                }}
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
                {newAthlete.isSelf ? "Register Myself" : "Add Athlete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {ageRestrictionActive && ageLabel && (
              <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                This program requires athletes to be {ageLabel.toLowerCase()}
              </div>
            )}

            {athletes.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {eligibleAthletes.map((athlete) => {
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
                  const isSelfAthlete = !!athlete.userId

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
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {displayName}
                          {isSelfAthlete && (
                            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
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

                {ineligibleAthletes.length > 0 && (
                  <>
                    <div className="pt-2 pb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Ineligible for this program
                      </p>
                    </div>
                    {ineligibleAthletes.map((athlete) => {
                      const displayName =
                        `${athlete.firstName} ${athlete.lastName}`.trim() || athlete.name
                      const age = calculateAge(athlete.birthDate)
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
                        <div
                          key={athlete.id}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card opacity-50 cursor-not-allowed text-left"
                        >
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted text-muted-foreground shrink-0">
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
                            <div className="text-xs text-destructive mt-1">
                              Age {age} — requires {ageLabel?.toLowerCase()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
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
