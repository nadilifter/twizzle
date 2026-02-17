"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSession, signIn } from "next-auth/react"
import { toast } from "sonner"
import { calculateAge, isAgeEligible } from "@/lib/age-utils"
import { useCart } from "@/components/sites/cart-context"
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Trophy,
  Check,
  Tag,
} from "lucide-react"

// ---------- Types ----------

interface SportEvent {
  id: string
  name: string
  code: string
  eventGroup: string | null
}

interface AgeCategory {
  id: string
  name: string
  code: string
  minAge: number
  maxAge: number | null
}

interface CompetitionCategory {
  id: string
  sportEvent: SportEvent | null
  ageCategory: AgeCategory | null
  isTeamEvent: boolean
  price: number | null
  displayOrder: number
}

interface PricingTier {
  id: string
  minEvents: number
  maxEvents: number | null
  pricePerEvent: number
  displayOrder: number
}

interface CompetitionData {
  id: string
  name: string
  competitionType: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  city?: string | null
  stateProvince?: string | null
  facility?: { id: string; name: string; city?: string | null; stateProvince?: string | null } | null
  pricingMode: string
  entryFee: number | null
  hasAgeRestriction: boolean
  minAge: number | null
  maxAge: number | null
  hasLevelRestriction: boolean
  levelRequirementIds: string[]
  hasCapacityRestriction: boolean
  capacity: number | null
  hasMembershipRestriction: boolean
  membershipRequirementIds: string[]
  hasWaiverRestriction: boolean
  waiverRequirementIds: string[]
  hasMedicalRequirement: boolean
  categories: CompetitionCategory[]
  pricingTiers: PricingTier[]
}

interface AthleteOption {
  id: string
  firstName: string
  lastName: string
  name: string
  birthDate: string | null
  gender: string | null
}

interface CompetitionRegistrationFlowProps {
  competition: CompetitionData
  slug: string
  primaryColor?: string
}

// ---------- Stepper definition ----------

const { useStepper } = defineStepper(
  { id: "athlete", title: "Select Athlete" },
  { id: "categories", title: "Select Events" },
  { id: "review", title: "Review & Add to Cart" }
)

// ---------- Helpers ----------

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer Not to Say",
}

function formatPrice(price: number): string {
  if (price === 0) return "Free"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

function getCategoryLabel(cat: CompetitionCategory): string {
  const parts: string[] = []
  if (cat.sportEvent) parts.push(cat.sportEvent.name)
  if (cat.ageCategory) parts.push(cat.ageCategory.name)
  return parts.join(" – ") || `Category ${cat.displayOrder + 1}`
}

// ---------- Main Component ----------

export function CompetitionRegistrationFlow({
  competition,
  slug,
  primaryColor,
}: CompetitionRegistrationFlowProps) {
  const { data: session } = useSession()
  const { addItem } = useCart()
  const stepper = useStepper()

  // State
  const [athletes, setAthletes] = useState<AthleteOption[]>([])
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreatingAthlete, setIsCreatingAthlete] = useState(false)
  const [newAthlete, setNewAthlete] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
  })

  const [selectedAthlete, setSelectedAthlete] = useState<AthleteOption | null>(null)
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false)
  const [eligibilityResult, setEligibilityResult] = useState<{
    eligible: boolean
    reasons: string[]
    eligibleCategoryIds: string[]
  } | null>(null)

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  // Fetch athletes on mount (if signed in)
  useEffect(() => {
    if (session?.user) {
      fetchAthletes()
    }
  }, [session?.user, slug])

  const fetchAthletes = async () => {
    setIsLoadingAthletes(true)
    try {
      const response = await fetch(`/api/sites/${slug}/athletes`)
      if (response.ok) {
        const data = await response.json()
        setAthletes(data.athletes || [])
      }
    } catch (error) {
      console.error("Error fetching athletes:", error)
    } finally {
      setIsLoadingAthletes(false)
    }
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

    setIsCreatingAthlete(true)
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
      toast.success(`${created.firstName} ${created.lastName} added successfully`)
      await fetchAthletes()
      setShowCreateForm(false)
      setNewAthlete({ firstName: "", lastName: "", birthDate: "", gender: "" })

      // Auto-select and check eligibility for the newly created athlete
      const athleteOption: AthleteOption = {
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        name: `${created.firstName} ${created.lastName}`,
        birthDate: created.birthDate,
        gender: created.gender,
      }
      await handleSelectAthlete(athleteOption)
    } catch (error: any) {
      toast.error(error.message || "Failed to create athlete")
    } finally {
      setIsCreatingAthlete(false)
    }
  }

  const handleSelectAthlete = async (athlete: AthleteOption) => {
    setSelectedAthlete(athlete)
    setEligibilityResult(null)
    setSelectedCategoryIds(new Set())
    setIsCheckingEligibility(true)

    try {
      const response = await fetch(
        `/api/sites/${slug}/competitions/${competition.id}/eligibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteId: athlete.id }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to check eligibility")
      }

      const result = await response.json()
      setEligibilityResult(result)

      if (result.eligible) {
        toast.success(
          `${athlete.firstName} is eligible! ${result.eligibleCategoryIds.length} event${result.eligibleCategoryIds.length !== 1 ? "s" : ""} available.`
        )
      }
    } catch (error) {
      toast.error("Failed to check eligibility. Please try again.")
      setSelectedAthlete(null)
    } finally {
      setIsCheckingEligibility(false)
    }
  }

  // Split athletes into competition-level eligible and ineligible
  const { eligibleAthletes, ineligibleAthletes } = useMemo(() => {
    if (!competition.hasAgeRestriction) {
      return { eligibleAthletes: athletes, ineligibleAthletes: [] as AthleteOption[] }
    }
    const eligible: AthleteOption[] = []
    const ineligible: AthleteOption[] = []
    for (const athlete of athletes) {
      const age = calculateAge(athlete.birthDate)
      if (isAgeEligible(age, competition.minAge, competition.maxAge)) {
        eligible.push(athlete)
      } else {
        ineligible.push(athlete)
      }
    }
    return { eligibleAthletes: eligible, ineligibleAthletes: ineligible }
  }, [athletes, competition.hasAgeRestriction, competition.minAge, competition.maxAge])

  // Filter categories to only show eligible ones
  const eligibleCategories = useMemo(() => {
    if (!eligibilityResult) return []
    return competition.categories.filter((cat) =>
      eligibilityResult.eligibleCategoryIds.includes(cat.id)
    )
  }, [competition.categories, eligibilityResult])

  // Group eligible categories by event group (for display)
  const categoriesByGroup = useMemo(() => {
    const groups = new Map<string, CompetitionCategory[]>()
    for (const cat of eligibleCategories) {
      const group = cat.sportEvent?.eventGroup || "Other"
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(cat)
    }
    return groups
  }, [eligibleCategories])

  // Calculate price
  const calculatedPrice = useMemo(() => {
    const count = selectedCategoryIds.size
    if (count === 0) return 0

    switch (competition.pricingMode) {
      case "FREE":
        return 0
      case "PER_COMPETITION":
        return competition.entryFee || 0
      case "PER_EVENT":
        return (competition.entryFee || 0) * count
      case "TIERED": {
        const tiers = [...competition.pricingTiers].sort(
          (a, b) => a.minEvents - b.minEvents
        )
        let applicableTier = tiers[0]
        for (const tier of tiers) {
          if (count >= tier.minEvents && (tier.maxEvents === null || count <= tier.maxEvents)) {
            applicableTier = tier
          }
        }
        return applicableTier ? applicableTier.pricePerEvent * count : 0
      }
      case "PER_CATEGORY": {
        let total = 0
        Array.from(selectedCategoryIds).forEach((catId) => {
          const cat = competition.categories.find((c) => c.id === catId)
          if (cat?.price != null) total += cat.price
        })
        return total
      }
      default:
        return 0
    }
  }, [selectedCategoryIds, competition])

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const handleAddToCart = () => {
    if (!selectedAthlete || selectedCategoryIds.size === 0) return

    setIsAddingToCart(true)

    const athleteName = `${selectedAthlete.firstName} ${selectedAthlete.lastName}`.trim()

    const selectedCats = competition.categories.filter((c) =>
      selectedCategoryIds.has(c.id)
    )
    const eventSummary = selectedCats
      .map((c) => getCategoryLabel(c))
      .join(", ")

    addItem({
      referenceId: competition.id,
      type: "competition",
      name: `${competition.name} – ${selectedCats.length} event${selectedCats.length !== 1 ? "s" : ""}`,
      description: eventSummary,
      price: calculatedPrice,
      quantity: 1,
      athleteId: selectedAthlete.id,
      athleteName,
      details: {
        competitionId: competition.id,
        competitionName: competition.name,
        categoryIds: Array.from(selectedCategoryIds),
        pricingMode: competition.pricingMode,
        entryFee: competition.entryFee,
      },
    })

    setIsAddingToCart(false)

    // Reset for another registration
    setSelectedAthlete(null)
    setEligibilityResult(null)
    setSelectedCategoryIds(new Set())
    stepper.navigation.goTo("athlete")
  }

  // ---------- Auth gate ----------

  if (!session?.user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In to Register</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            You need to be signed in to register for this competition.
          </p>
          <Button onClick={() => signIn(undefined, { callbackUrl: window.location.href })}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ---------- Stepper rendering ----------

  const steps = stepper.state.all
  const currentStepId = stepper.state.current.data.id
  const currentIndex = steps.findIndex((s: { id: string }) => s.id === currentStepId)

  const canProceedToCategories =
    selectedAthlete !== null &&
    eligibilityResult?.eligible === true

  const canProceedToReview = selectedCategoryIds.size > 0

  const ageLabel =
    competition.hasAgeRestriction && (competition.minAge != null || competition.maxAge != null)
      ? competition.minAge != null && competition.maxAge != null
        ? `Ages ${competition.minAge}–${competition.maxAge}`
        : competition.minAge != null
        ? `Ages ${competition.minAge}+`
        : `Up to age ${competition.maxAge}`
      : null

  return (
    <div className="space-y-8">
      {/* Stepper Navigation */}
      <StepperNav>
        {steps.map((step: { id: string; title: string }, index: number) => {
          const status = getStepStatus(index, currentIndex)
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-initial">
              <StepperItem status={status}>
                <StepperIndicator
                  status={status}
                  step={index + 1}
                />
                <StepperTitle status={status}>
                  {step.title}
                </StepperTitle>
              </StepperItem>
              {index < steps.length - 1 && (
                <StepperSeparator
                  status={status}
                  className="mx-2"
                />
              )}
            </div>
          )
        })}
      </StepperNav>

      {/* Step 1: Select Athlete */}
      {currentStepId === "athlete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Who is competing?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingAthletes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showCreateForm ? (
              /* Create New Athlete Form */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="comp-athlete-first">First Name</Label>
                    <Input
                      id="comp-athlete-first"
                      value={newAthlete.firstName}
                      onChange={(e) =>
                        setNewAthlete((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                      placeholder="First name"
                      disabled={isCreatingAthlete}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-athlete-last">Last Name</Label>
                    <Input
                      id="comp-athlete-last"
                      value={newAthlete.lastName}
                      onChange={(e) =>
                        setNewAthlete((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                      placeholder="Last name"
                      disabled={isCreatingAthlete}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-athlete-dob">Date of Birth</Label>
                  <Input
                    id="comp-athlete-dob"
                    type="date"
                    value={newAthlete.birthDate}
                    onChange={(e) =>
                      setNewAthlete((prev) => ({ ...prev, birthDate: e.target.value }))
                    }
                    disabled={isCreatingAthlete}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comp-athlete-gender">Gender Declaration</Label>
                  <Select
                    value={newAthlete.gender}
                    onValueChange={(value) =>
                      setNewAthlete((prev) => ({ ...prev, gender: value }))
                    }
                    disabled={isCreatingAthlete}
                  >
                    <SelectTrigger id="comp-athlete-gender">
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
                    disabled={isCreatingAthlete}
                    className="flex-1"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateAthlete}
                    disabled={isCreatingAthlete}
                    className="flex-1"
                  >
                    {isCreatingAthlete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Athlete
                  </Button>
                </div>
              </div>
            ) : (
              /* Athlete Selection */
              <div className="space-y-3">
                {/* Age restriction banner */}
                {ageLabel && (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    This competition requires athletes to be {ageLabel.toLowerCase()}
                  </div>
                )}

                {/* Eligibility checking indicator */}
                {isCheckingEligibility && (
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    Checking eligibility...
                  </div>
                )}

                {/* Eligibility error */}
                {eligibilityResult && !eligibilityResult.eligible && (
                  <div className="flex items-start gap-2 text-xs font-medium text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">
                        {selectedAthlete?.firstName} is not eligible for this competition
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {eligibilityResult.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Selected athlete confirmation */}
                {selectedAthlete && eligibilityResult?.eligible && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {selectedAthlete.firstName} {selectedAthlete.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Eligible – {eligibilityResult.eligibleCategoryIds.length} event
                        {eligibilityResult.eligibleCategoryIds.length !== 1 ? "s" : ""} available
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAthlete(null)
                        setEligibilityResult(null)
                        setSelectedCategoryIds(new Set())
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {/* Athlete list (only show if no athlete selected or eligibility failed) */}
                {(!selectedAthlete || (eligibilityResult && !eligibilityResult.eligible)) && (
                  <>
                    {athletes.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {eligibleAthletes.map((athlete) => {
                          const displayName = `${athlete.firstName} ${athlete.lastName}`.trim()
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
                              disabled={isCheckingEligibility}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-left disabled:opacity-50"
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

                        {ineligibleAthletes.length > 0 && (
                          <>
                            <div className="pt-2 pb-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Ineligible for this competition
                              </p>
                            </div>
                            {ineligibleAthletes.map((athlete) => {
                              const displayName = `${athlete.firstName} ${athlete.lastName}`.trim()
                              const age = calculateAge(athlete.birthDate)

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
                  </>
                )}

                {/* Next button */}
                {canProceedToCategories && (
                  <div className="pt-4">
                    <Button
                      className="w-full gap-2"
                      onClick={() => stepper.navigation.goTo("categories")}
                    >
                      Continue to Event Selection
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Events/Categories */}
      {currentStepId === "categories" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Select Events for {selectedAthlete?.firstName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eligibleCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No eligible events found for this athlete.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(categoriesByGroup.entries()).map(([groupName, cats]) => (
                  <div key={groupName}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {groupName}
                    </h3>
                    <div className="space-y-2">
                      {cats.map((cat) => {
                        const isSelected = selectedCategoryIds.has(cat.id)
                        const label = getCategoryLabel(cat)
                        const showPrice =
                          competition.pricingMode === "PER_CATEGORY" && cat.price != null

                        return (
                          <label
                            key={cat.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCategory(cat.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{label}</div>
                              {cat.isTeamEvent && (
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  Team Event
                                </Badge>
                              )}
                            </div>
                            {showPrice && (
                              <span className="text-sm font-medium text-muted-foreground">
                                {formatPrice(cat.price!)}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Pricing summary */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedCategoryIds.size} event{selectedCategoryIds.size !== 1 ? "s" : ""}{" "}
                      selected
                    </span>
                    <span className="text-lg font-bold">
                      {formatPrice(calculatedPrice)}
                    </span>
                  </div>
                  {competition.pricingMode === "TIERED" &&
                    competition.pricingTiers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Tiered pricing applies – more events may lower your per-event cost
                      </p>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => stepper.navigation.goTo("athlete")}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    disabled={!canProceedToReview}
                    onClick={() => stepper.navigation.goTo("review")}
                  >
                    Review Registration
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Add to Cart */}
      {currentStepId === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Review Registration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Athlete */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Athlete
                </h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="font-medium text-sm">
                    {selectedAthlete?.firstName} {selectedAthlete?.lastName}
                  </div>
                </div>
              </div>

              {/* Selected Events */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Events ({selectedCategoryIds.size})
                </h3>
                <div className="space-y-1.5">
                  {competition.categories
                    .filter((c) => selectedCategoryIds.has(c.id))
                    .map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-card"
                      >
                        <span className="text-sm">{getCategoryLabel(cat)}</span>
                        {competition.pricingMode === "PER_CATEGORY" && cat.price != null && (
                          <span className="text-sm text-muted-foreground">
                            {formatPrice(cat.price)}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {competition.pricingMode === "FREE"
                      ? "Free Entry"
                      : competition.pricingMode === "PER_COMPETITION"
                      ? "Competition Entry Fee"
                      : competition.pricingMode === "PER_EVENT"
                      ? `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""} × ${formatPrice(competition.entryFee || 0)}`
                      : competition.pricingMode === "TIERED"
                      ? `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""} (tiered pricing)`
                      : `${selectedCategoryIds.size} event${selectedCategoryIds.size !== 1 ? "s" : ""}`}
                  </span>
                  <span className="font-medium">{formatPrice(calculatedPrice)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">{formatPrice(calculatedPrice)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => stepper.navigation.goTo("categories")}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Add to Cart
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
