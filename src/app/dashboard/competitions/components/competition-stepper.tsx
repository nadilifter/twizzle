"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  defineStepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  getStepStatus,
} from "@/components/ui/stepper"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Users,
  Layers,
  CreditCard,
  Trophy,
  MapPin,
  Clock,
  CalendarDays,
  Info,
  Heart,
  Shield,
  Tag,
  BarChart3,
  Settings,
} from "lucide-react"
import { toast } from "sonner"
import { useFeatures } from "@/components/feature-context"
import { useMemberships } from "@/hooks/use-memberships"
import { cn } from "@/lib/utils"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { format } from "date-fns"

type CompetitionType = "GYMNASTICS" | "TRACK_AND_FIELD"

interface OrgSport {
  id: string
  name: string
  slug: string
}

const SPORT_SLUG_TO_COMPETITION_TYPE: Record<string, CompetitionType> = {
  gymnastics: "GYMNASTICS",
  "track-and-field": "TRACK_AND_FIELD",
}

type PublishStatus = "LIVE" | "DRAFT" | "SCHEDULED"

interface Level {
  id: string
  name: string
  color: string | null
  order: number
}

interface Facility {
  id: string
  name: string
  street: string | null
  city: string | null
  stateProvince: string | null
  country: string | null
}

interface MembershipInstance {
  id: string
  name: string
  price: number
  groupName: string
}

interface CompetitionFormData {
  // Step 1: General
  name: string
  competitionType: CompetitionType | null
  facilityId: string | null
  country: string
  stateProvince: string
  city: string
  streetAddress: string
  startDate: Date | null
  endDate: Date | null
  startTime: string
  endTime: string

  // Step 2: Categories
  categoryMode: "ALL" | "SPECIFIC"
  selectedCategoryIds: string[]

  // Step 3: Restrictions
  hasLevelRestriction: boolean
  levelRequirementIds: string[]
  hasCapacityRestriction: boolean
  capacity: number | null
  hasAgeRestriction: boolean
  minAge: number | null
  maxAge: number | null
  hasMembershipRestriction: boolean
  membershipRequirementIds: string[]
  hasWaiverRestriction: boolean
  waiverRequirementIds: string[]
  hasMedicalRequirement: boolean

  // Step 4: Results (placeholder)

  // Step 5: Pricing (placeholder)

  // Step 6: Confirmation
  publishStatus: PublishStatus
  scheduledGoLiveDate: Date | null
  scheduledGoLiveTime: string
}

interface CompetitionStepperProps {
  competitionId?: string | null
}

const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  GYMNASTICS: "Gymnastics",
  TRACK_AND_FIELD: "Track & Field",
}

const { useStepper } = defineStepper(
  { id: "general", title: "General" },
  { id: "categories", title: "Categories" },
  { id: "restrictions", title: "Restrictions" },
  { id: "results", title: "Results" },
  { id: "pricing", title: "Pricing" },
  { id: "confirmation", title: "Confirmation" },
)

export function CompetitionStepper({ competitionId }: CompetitionStepperProps) {
  const router = useRouter()
  const isEditing = !!competitionId
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")

  const { memberships, isLoading: loadingMemberships } = useMemberships({ initialParams: { include: "instances" } })

  // Levels state
  const [levels, setLevels] = React.useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = React.useState(true)

  // Facilities state
  const [facilities, setFacilities] = React.useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = React.useState(true)

  // Waivers state
  const [waivers, setWaivers] = React.useState<Array<{ id: string; title: string; status: string }>>([])
  const [loadingWaivers, setLoadingWaivers] = React.useState(true)

  // Organization sports state
  const [orgSports, setOrgSports] = React.useState<OrgSport[]>([])

  // Form state
  const [formData, setFormData] = React.useState<CompetitionFormData>({
    // Step 1: General
    name: "",
    competitionType: null,
    facilityId: null,
    country: "",
    stateProvince: "",
    city: "",
    streetAddress: "",
    startDate: null,
    endDate: null,
    startTime: "09:00",
    endTime: "17:00",

    // Step 2: Categories
    categoryMode: "ALL",
    selectedCategoryIds: [],

    // Step 3: Restrictions
    hasLevelRestriction: false,
    levelRequirementIds: [],
    hasCapacityRestriction: false,
    capacity: null,
    hasAgeRestriction: false,
    minAge: null,
    maxAge: null,
    hasMembershipRestriction: false,
    membershipRequirementIds: [],
    hasWaiverRestriction: false,
    waiverRequirementIds: [],
    hasMedicalRequirement: false,

    // Step 6: Confirmation
    publishStatus: "DRAFT",
    scheduledGoLiveDate: null,
    scheduledGoLiveTime: "09:00",
  })

  const [isSaving, setIsSaving] = React.useState(false)
  const stepper = useStepper()

  // Fetch levels
  React.useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch("/api/levels")
        if (response.ok) {
          const data = await response.json()
          setLevels(data)
        }
      } catch (error) {
        console.error("Failed to fetch levels:", error)
      } finally {
        setLoadingLevels(false)
      }
    }
    if (trainingEnabled) fetchLevels()
    else setLoadingLevels(false)
  }, [trainingEnabled])

  // Fetch facilities
  React.useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await fetch("/api/facilities")
        if (response.ok) {
          const data = await response.json()
          setFacilities(Array.isArray(data) ? data : data.facilities || [])
        }
      } catch (error) {
        console.error("Failed to fetch facilities:", error)
      } finally {
        setLoadingFacilities(false)
      }
    }
    fetchFacilities()
  }, [])

  // Fetch waivers
  React.useEffect(() => {
    const fetchWaivers = async () => {
      try {
        const response = await fetch("/api/waivers")
        if (response.ok) {
          const data = await response.json()
          const activeWaivers = (Array.isArray(data) ? data : data.waivers || [])
            .filter((w: any) => w.status === "ACTIVE")
          setWaivers(activeWaivers)
        }
      } catch (error) {
        console.error("Failed to fetch waivers:", error)
      } finally {
        setLoadingWaivers(false)
      }
    }
    fetchWaivers()
  }, [])

  // Fetch organization sports
  React.useEffect(() => {
    const fetchOrgSports = async () => {
      try {
        const response = await fetch("/api/organization/sports")
        if (response.ok) {
          const data: OrgSport[] = await response.json()
          setOrgSports(data)

          // If org has exactly one sport with a matching competition type, auto-select it
          const competitionTypes = data
            .map((s) => SPORT_SLUG_TO_COMPETITION_TYPE[s.slug])
            .filter(Boolean) as CompetitionType[]
          const uniqueTypes = [...new Set(competitionTypes)]
          if (uniqueTypes.length === 1) {
            setFormData((prev) => ({ ...prev, competitionType: uniqueTypes[0] }))
          }
        }
      } catch (error) {
        console.error("Failed to fetch org sports:", error)
      }
    }
    fetchOrgSports()
  }, [])

  // Handle facility selection to auto-fill address
  const handleFacilityChange = (facilityId: string) => {
    if (facilityId === "__manual__") {
      setFormData(prev => ({
        ...prev,
        facilityId: null,
        country: "",
        stateProvince: "",
        city: "",
        streetAddress: "",
      }))
      return
    }
    const facility = facilities.find(f => f.id === facilityId)
    if (facility) {
      setFormData(prev => ({
        ...prev,
        facilityId: facility.id,
        country: facility.country || "",
        stateProvince: facility.stateProvince || "",
        city: facility.city || "",
        streetAddress: facility.street || "",
      }))
    }
  }

  // Flatten membership instances for the restriction picker
  const membershipInstances: MembershipInstance[] = React.useMemo(() => {
    if (!memberships) return []
    return memberships.flatMap((group: any) =>
      (group.instances || []).map((inst: any) => ({
        id: inst.id,
        name: inst.name,
        price: inst.price ? Number(inst.price) : 0,
        groupName: group.name,
      }))
    )
  }, [memberships])

  // Step validation
  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "general":
        if (!formData.name.trim()) {
          toast.error("Please enter a competition name")
          return false
        }
        if (!formData.competitionType) {
          toast.error("Please select a competition type")
          return false
        }
        if (!formData.startDate) {
          toast.error("Please select a start date")
          return false
        }
        if (!formData.endDate) {
          toast.error("Please select an end date")
          return false
        }
        if (!formData.city.trim() && !formData.facilityId) {
          toast.error("Please enter a city or select a facility")
          return false
        }
        return true
      case "categories":
        return true
      case "restrictions":
        if (formData.hasAgeRestriction && !formData.minAge && !formData.maxAge) {
          toast.error("Please set at least a minimum or maximum age")
          return false
        }
        if (formData.hasCapacityRestriction && (!formData.capacity || formData.capacity <= 0)) {
          toast.error("Please set a valid capacity")
          return false
        }
        if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
          toast.error("Please select at least one level")
          return false
        }
        if (formData.hasMembershipRestriction && formData.membershipRequirementIds.length === 0) {
          toast.error("Please select at least one membership")
          return false
        }
        if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
          toast.error("Please select at least one waiver")
          return false
        }
        return true
      case "results":
        return true
      case "pricing":
        return true
      case "confirmation":
        if (formData.publishStatus === "SCHEDULED" && !formData.scheduledGoLiveDate) {
          toast.error("Please select a scheduled go-live date")
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(stepper.state.current.data.id)) {
      stepper.navigation.next()
    }
  }

  const handlePrev = () => {
    stepper.navigation.prev()
  }

  const handleSubmit = async () => {
    if (!validateStep(stepper.state.current.data.id)) return

    setIsSaving(true)
    try {
      // Placeholder: API call will go here
      toast.success(isEditing ? "Competition updated!" : "Competition created!")
      router.push("/dashboard/competitions")
    } catch (error) {
      console.error("Failed to save competition:", error)
      toast.error("Failed to save competition. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const currentIndex = stepper.state.all.findIndex(s => s.id === stepper.state.current.data.id)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        {/* Step Navigation */}
        <StepperNav className="mb-4">
          {stepper.state.all.map((step, index) => {
            const status = getStepStatus(index, currentIndex)
            return (
              <React.Fragment key={step.id}>
                <StepperItem status={status}>
                  <StepperIndicator
                    status={status}
                    step={index + 1}
                    onClick={() => {
                      if (index < currentIndex) stepper.navigation.goTo(step.id)
                    }}
                  />
                  <StepperTitle status={status} className="hidden sm:block">{step.title}</StepperTitle>
                </StepperItem>
                {index < stepper.state.all.length - 1 && (
                  <StepperSeparator status={status} className="hidden sm:block" />
                )}
              </React.Fragment>
            )
          })}
        </StepperNav>

        {/* Step 1: General */}
        {stepper.state.current.data.id === "general" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Competition Details
              </CardTitle>
              <CardDescription>
                Enter the basic information about your competition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Competition Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Competition Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Spring Invitational Meet 2026"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Competition Type */}
              {(() => {
                // Determine which competition types to show based on org's sports
                const allTypes: { value: CompetitionType; label: string; description: string }[] = [
                  { value: "GYMNASTICS", label: "Gymnastics", description: "Gymnastics competitions with apparatus events and scoring" },
                  { value: "TRACK_AND_FIELD", label: "Track & Field", description: "Track & field meets with running, jumping, and throwing events" },
                ]

                const orgCompetitionTypes = orgSports.length > 0
                  ? orgSports
                      .map((s) => SPORT_SLUG_TO_COMPETITION_TYPE[s.slug])
                      .filter(Boolean) as CompetitionType[]
                  : []

                const uniqueOrgTypes = [...new Set(orgCompetitionTypes)]
                const availableTypes = uniqueOrgTypes.length > 0
                  ? allTypes.filter((t) => uniqueOrgTypes.includes(t.value))
                  : allTypes

                // If only one type available, it's already auto-selected, just show info
                if (availableTypes.length === 1 && formData.competitionType === availableTypes[0].value) {
                  return (
                    <div className="space-y-2">
                      <Label className="text-base font-medium">Competition Type</Label>
                      <div className="flex items-center gap-2 rounded-lg border p-4 bg-muted/30">
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{availableTypes[0].label}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">Auto-selected</Badge>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    <Label className="text-base font-medium">Competition Type *</Label>
                    <RadioGroup
                      value={formData.competitionType || ""}
                      onValueChange={(value: CompetitionType) =>
                        setFormData(prev => ({ ...prev, competitionType: value }))
                      }
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {availableTypes.map((type) => (
                        <label
                          key={type.value}
                          className={cn(
                            "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                            formData.competitionType === type.value
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <RadioGroupItem value={type.value} className="mt-1" />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{type.label}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )
              })()}

              {/* Location */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Location *</Label>

                {/* Facility Selector */}
                <div className="space-y-2">
                  <Label htmlFor="facility">Select a Facility (optional)</Label>
                  <Select
                    value={formData.facilityId || "__manual__"}
                    onValueChange={handleFacilityChange}
                    disabled={loadingFacilities}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingFacilities ? "Loading facilities..." : "Enter address manually"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">Enter address manually</SelectItem>
                      {facilities.map(facility => (
                        <SelectItem key={facility.id} value={facility.id}>
                          {facility.name}{facility.city ? ` - ${facility.city}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a facility to auto-fill the address, or enter it manually below.
                  </p>
                </div>

                {/* Address Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="e.g., Canada"
                      value={formData.country}
                      onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stateProvince">Province / State</Label>
                    <Input
                      id="stateProvince"
                      placeholder="e.g., Ontario"
                      value={formData.stateProvince}
                      onChange={e => setFormData(prev => ({ ...prev, stateProvince: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="e.g., Toronto"
                      value={formData.city}
                      onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">Street Address (optional)</Label>
                    <Input
                      id="streetAddress"
                      placeholder="e.g., 123 Main St"
                      value={formData.streetAddress}
                      onChange={e => setFormData(prev => ({ ...prev, streetAddress: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Dates & Times */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Dates & Times *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {formData.startDate
                            ? format(formData.startDate, "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.startDate || undefined}
                          onSelect={(date) =>
                            setFormData(prev => ({
                              ...prev,
                              startDate: date || null,
                              endDate: prev.endDate && date && prev.endDate < date ? date : prev.endDate,
                            }))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {formData.endDate
                            ? format(formData.endDate, "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.endDate || undefined}
                          onSelect={(date) =>
                            setFormData(prev => ({ ...prev, endDate: date || null }))
                          }
                          disabled={(date) =>
                            formData.startDate ? date < formData.startDate : false
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Categories */}
        {stepper.state.current.data.id === "categories" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categories
              </CardTitle>
              <CardDescription>
                Choose which categories are available for this competition
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={formData.categoryMode}
                onValueChange={(value: "ALL" | "SPECIFIC") =>
                  setFormData(prev => ({
                    ...prev,
                    categoryMode: value,
                    selectedCategoryIds: value === "ALL" ? [] : prev.selectedCategoryIds,
                  }))
                }
                className="space-y-4"
              >
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.categoryMode === "ALL"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="ALL" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Use All Categories</span>
                    <p className="text-sm text-muted-foreground">
                      All defined categories will be available for registration
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.categoryMode === "SPECIFIC"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="SPECIFIC" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium">Pick Specific Categories</span>
                    <p className="text-sm text-muted-foreground">
                      Only selected categories will be available for registration
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {formData.categoryMode === "SPECIFIC" && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <Info className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Categories will be configurable from the{" "}
                    <a href="/dashboard/competitions/categories" className="text-primary underline">
                      Categories page
                    </a>{" "}
                    once defined.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Restrictions */}
        {stepper.state.current.data.id === "restrictions" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Requirements & Restrictions
              </CardTitle>
              <CardDescription>
                Configure who can register for this competition. Toggle on the restrictions you want to apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Level Restriction */}
              {trainingEnabled && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Level Restriction</Label>
                      <p className="text-sm text-muted-foreground">
                        Require athletes to be at one of the selected levels
                      </p>
                    </div>
                    <Switch
                      checked={formData.hasLevelRestriction}
                      onCheckedChange={checked => setFormData(prev => ({
                        ...prev,
                        hasLevelRestriction: checked,
                        levelRequirementIds: checked ? prev.levelRequirementIds : [],
                      }))}
                    />
                  </div>

                  {formData.hasLevelRestriction && (
                    <div className="pt-2 border-t">
                      {loadingLevels ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading levels...
                        </div>
                      ) : levels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No levels configured.{" "}
                          <a href="/dashboard/training/levels" className="text-primary underline">Create levels</a> first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {levels.map(level => (
                            <label
                              key={level.id}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                formData.levelRequirementIds.includes(level.id)
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50"
                              )}
                            >
                              <Checkbox
                                checked={formData.levelRequirementIds.includes(level.id)}
                                onCheckedChange={checked => {
                                  setFormData(prev => ({
                                    ...prev,
                                    levelRequirementIds: checked
                                      ? [...prev.levelRequirementIds, level.id]
                                      : prev.levelRequirementIds.filter(id => id !== level.id),
                                  }))
                                }}
                              />
                              <div className="flex items-center gap-2">
                                {level.color && (
                                  <div
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: level.color }}
                                  />
                                )}
                                <span className="text-sm font-medium">{level.name}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Capacity Limit */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Capacity Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Set a maximum number of participants
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasCapacityRestriction}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasCapacityRestriction: checked,
                      capacity: checked ? prev.capacity : null,
                    }))}
                  />
                </div>

                {formData.hasCapacityRestriction && (
                  <div className="pt-2 border-t">
                    <Label htmlFor="capacity">Maximum Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      placeholder="e.g., 200"
                      value={formData.capacity ?? ""}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        capacity: e.target.value ? parseInt(e.target.value, 10) : null,
                      }))}
                      className="mt-2 max-w-xs"
                    />
                  </div>
                )}
              </div>

              {/* Age Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Age Restriction</Label>
                    <p className="text-sm text-muted-foreground">
                      Restrict registration by age range
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasAgeRestriction}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasAgeRestriction: checked,
                      minAge: checked ? prev.minAge : null,
                      maxAge: checked ? prev.maxAge : null,
                    }))}
                  />
                </div>

                {formData.hasAgeRestriction && (
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-4 max-w-sm">
                      <div className="space-y-2">
                        <Label htmlFor="minAge">Minimum Age</Label>
                        <Input
                          id="minAge"
                          type="number"
                          min={0}
                          placeholder="e.g., 6"
                          value={formData.minAge ?? ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            minAge: e.target.value ? parseInt(e.target.value, 10) : null,
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAge">Maximum Age</Label>
                        <Input
                          id="maxAge"
                          type="number"
                          min={0}
                          placeholder="e.g., 18"
                          value={formData.maxAge ?? ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            maxAge: e.target.value ? parseInt(e.target.value, 10) : null,
                          }))}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      At least one of minimum or maximum age is required.
                    </p>
                  </div>
                )}
              </div>

              {/* Membership Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Membership Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require athletes to have an active membership
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasMembershipRestriction}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasMembershipRestriction: checked,
                      membershipRequirementIds: checked ? prev.membershipRequirementIds : [],
                    }))}
                  />
                </div>

                {formData.hasMembershipRestriction && (
                  <div className="pt-2 border-t">
                    {loadingMemberships ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading memberships...
                      </div>
                    ) : membershipInstances.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No memberships configured.{" "}
                        <a href="/dashboard/athletes/memberships" className="text-primary underline">Create memberships</a> first.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {membershipInstances.map(instance => (
                          <label
                            key={instance.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                              formData.membershipRequirementIds.includes(instance.id)
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={formData.membershipRequirementIds.includes(instance.id)}
                              onCheckedChange={checked => {
                                setFormData(prev => ({
                                  ...prev,
                                  membershipRequirementIds: checked
                                    ? [...prev.membershipRequirementIds, instance.id]
                                    : prev.membershipRequirementIds.filter(id => id !== instance.id),
                                }))
                              }}
                            />
                            <div>
                              <span className="text-sm font-medium">{instance.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">({instance.groupName})</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Waiver Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Waiver Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require participants to sign a waiver before registering
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasWaiverRestriction}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasWaiverRestriction: checked,
                      waiverRequirementIds: checked ? prev.waiverRequirementIds : [],
                    }))}
                  />
                </div>

                {formData.hasWaiverRestriction && (
                  <div className="pt-2 border-t">
                    {loadingWaivers ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading waivers...
                      </div>
                    ) : waivers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No active waivers found.{" "}
                        <a href="/dashboard/forms/waivers" className="text-primary underline">Create a waiver</a> first.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {waivers.map(waiver => (
                          <label
                            key={waiver.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                              formData.waiverRequirementIds.includes(waiver.id)
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={formData.waiverRequirementIds.includes(waiver.id)}
                              onCheckedChange={checked => {
                                setFormData(prev => ({
                                  ...prev,
                                  waiverRequirementIds: checked
                                    ? [...prev.waiverRequirementIds, waiver.id]
                                    : prev.waiverRequirementIds.filter(id => id !== waiver.id),
                                }))
                              }}
                            />
                            <span className="text-sm font-medium">{waiver.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Medical Information Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Medical Information Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require athletes to have medical information on file
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasMedicalRequirement}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasMedicalRequirement: checked,
                    }))}
                  />
                </div>

                {formData.hasMedicalRequirement && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span>
                        Configure medical form fields in{" "}
                        <a href="/dashboard/organization/medical" className="text-primary underline">
                          Medical Settings
                        </a>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {stepper.state.current.data.id === "results" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Results Configuration
              </CardTitle>
              <CardDescription>
                Configure how results are tracked and displayed for this competition
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium text-muted-foreground mb-1">Results Configuration Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  This section will allow you to configure scoring systems, result tracking,
                  and display options for your competition.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Pricing */}
        {stepper.state.current.data.id === "pricing" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pricing
              </CardTitle>
              <CardDescription>
                Set registration fees and pricing options for this competition
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium text-muted-foreground mb-1">Pricing Configuration Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  This section will allow you to configure registration fees, early-bird pricing,
                  group rates, and payment options.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Confirmation */}
        {stepper.state.current.data.id === "confirmation" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                Confirmation & Publishing
              </CardTitle>
              <CardDescription>
                Review your competition settings and choose when to publish
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Publish Status */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Publishing Status</Label>
                <RadioGroup
                  value={formData.publishStatus}
                  onValueChange={(value: PublishStatus) =>
                    setFormData(prev => ({
                      ...prev,
                      publishStatus: value,
                      scheduledGoLiveDate: value === "SCHEDULED" ? prev.scheduledGoLiveDate : null,
                    }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "LIVE"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="LIVE" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Go Live Now</span>
                      <p className="text-sm text-muted-foreground">
                        The competition will be immediately visible and open for registration
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "DRAFT"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="DRAFT" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Save as Draft</span>
                      <p className="text-sm text-muted-foreground">
                        The competition will be saved but not visible to the public
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      formData.publishStatus === "SCHEDULED"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="SCHEDULED" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium">Schedule Go-Live</span>
                      <p className="text-sm text-muted-foreground">
                        Set a specific date and time for the competition to go live
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Scheduled date/time picker */}
                {formData.publishStatus === "SCHEDULED" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    <div className="space-y-2">
                      <Label>Go-Live Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.scheduledGoLiveDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {formData.scheduledGoLiveDate
                              ? format(formData.scheduledGoLiveDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={formData.scheduledGoLiveDate || undefined}
                            onSelect={(date) =>
                              setFormData(prev => ({ ...prev, scheduledGoLiveDate: date || null }))
                            }
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">Go-Live Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="scheduledTime"
                          type="time"
                          value={formData.scheduledGoLiveTime}
                          onChange={e => setFormData(prev => ({ ...prev, scheduledGoLiveTime: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Options Placeholder */}
              <div className="rounded-lg border border-dashed p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">Advanced Options</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Additional configuration options will be available here in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/competitions")}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!stepper.state.isFirst && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}

            {!stepper.state.isLast ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {isEditing ? "Save Competition" : "Create Competition"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
