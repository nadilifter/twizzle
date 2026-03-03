"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  User,
  Star,
  Users,
  Calendar,
  Layers,
  CreditCard,
  Trash2,
  Info,
  MapPin,
  Clock,
  CalendarDays,
  FileText,
  Heart,
} from "lucide-react"
import { toast } from "sonner"
import { useFeatures } from "@/components/feature-context"
import { useStaff } from "@/hooks/use-staff"
import { useMemberships } from "@/hooks/use-memberships"
import { cn } from "@/lib/utils"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { format } from "date-fns"
import type { EventType, EventWithRelations } from "@/types/events"

type EventStaffRole = "LEAD" | "ASSISTANT" | "VOLUNTEER" | "OBSERVER"

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
}

interface MembershipInstance {
  id: string
  name: string
  price: number
  groupName: string
}

interface StaffAssignment {
  staffProfileId: string
  role: EventStaffRole
  staffProfile?: {
    id: string
    user: {
      name: string
      avatar: string | null
    }
    title: string | null
  }
}

interface EventFormData {
  // Step 1: General
  name: string
  description: string
  type: EventType
  price: number | null

  // Step 2: Date & Location
  date: Date | null
  startTime: string
  endTime: string
  facilityId: string | null

  // Step 3: Requirements
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

  // Step 4: Staff
  staffAssignments: StaffAssignment[]
}

interface EventStepperProps {
  event?: EventWithRelations | null
  onSuccess?: (event: EventWithRelations) => void
}

const EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  { value: "CLASS", label: "Class", description: "Regular training class or lesson" },
  { value: "CAMP", label: "Camp", description: "Multi-session camp or workshop" },
  { value: "PARTY", label: "Party", description: "Birthday party or celebration" },
  { value: "COMPETITION", label: "Competition", description: "Tournament, meet, or showcase" },
  { value: "MEETING", label: "Meeting", description: "Staff meeting or parent meeting" },
  { value: "OTHER", label: "Other", description: "Any other type of event" },
]

const ROLE_LABELS: Record<EventStaffRole, string> = {
  LEAD: "Lead",
  ASSISTANT: "Assistant",
  VOLUNTEER: "Volunteer",
  OBSERVER: "Observer",
}

const { useStepper } = defineStepper(
  { id: "general", title: "General" },
  { id: "dateLocation", title: "Schedule" },
  { id: "requirements", title: "Requirements" },
  { id: "staff", title: "Staff" },
)

export function EventStepper({ event, onSuccess }: EventStepperProps) {
  const router = useRouter()
  const isEditing = !!event
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  const membershipsEnabled = isFeatureEnabled("memberships")

  const { staff: availableStaff, isLoading: loadingStaff } = useStaff()
  const { memberships, isLoading: loadingMemberships } = useMemberships({ initialParams: { include: "instances" } })

  const [levels, setLevels] = React.useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = React.useState(true)

  const [facilities, setFacilities] = React.useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = React.useState(true)

  const [waivers, setWaivers] = React.useState<Array<{ id: string; title: string; status: string }>>([])
  const [loadingWaivers, setLoadingWaivers] = React.useState(true)

  const [formData, setFormData] = React.useState<EventFormData>(() => ({
    name: (event as any)?.title || "",
    description: (event as any)?.description || "",
    type: (event as any)?.type || "CLASS",
    price: null,

    date: event?.date ? new Date(event.date) : null,
    startTime: (event as any)?.startTime || "09:00",
    endTime: (event as any)?.endTime || "10:00",
    facilityId: (event as any)?.facilityId || null,

    hasLevelRestriction: false,
    levelRequirementIds: [],
    hasCapacityRestriction: (event as any)?.capacity ? true : false,
    capacity: (event as any)?.capacity || null,
    hasAgeRestriction: false,
    minAge: null,
    maxAge: null,
    hasMembershipRestriction: ((event as any)?.requiredMemberships?.length || 0) > 0,
    membershipRequirementIds: (event as any)?.requiredMemberships?.map((m: any) => m.id) || [],
    hasWaiverRestriction: false,
    waiverRequirementIds: [],
    hasMedicalRequirement: false,

    staffAssignments: [],
  }))

  const [isSaving, setIsSaving] = React.useState(false)
  const stepper = useStepper()

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
    fetchLevels()
  }, [])

  React.useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const response = await fetch("/api/organization/facilities")
        if (response.ok) {
          const data = await response.json()
          setFacilities(data)
        }
      } catch (error) {
        console.error("Failed to fetch facilities:", error)
      } finally {
        setLoadingFacilities(false)
      }
    }
    fetchFacilities()
  }, [])

  React.useEffect(() => {
    const fetchWaivers = async () => {
      try {
        const response = await fetch("/api/waivers?status=ACTIVE")
        if (response.ok) {
          const data = await response.json()
          setWaivers(data.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch waivers:", error)
      } finally {
        setLoadingWaivers(false)
      }
    }
    fetchWaivers()
  }, [])

  const allMembershipInstances = React.useMemo(() => {
    return memberships?.flatMap(group =>
      group.instances?.map((instance: any) => ({
        id: instance.id,
        name: instance.name,
        price: Number(instance.price),
        groupName: group.name,
      })) || []
    ) || []
  }, [memberships])

  const unassignedStaff = React.useMemo(() => {
    return availableStaff?.filter(
      s => !formData.staffAssignments.some(a => a.staffProfileId === s.id)
    ) || []
  }, [availableStaff, formData.staffAssignments])

  const validateStep = (stepId: string): boolean => {
    switch (stepId) {
      case "general":
        if (!formData.name.trim()) {
          toast.error("Event name is required")
          return false
        }
        if (formData.price !== null && formData.price !== undefined && formData.price < 0) {
          toast.error("Price cannot be negative")
          return false
        }
        return true
      case "dateLocation":
        if (!formData.date) {
          toast.error("Event date is required")
          return false
        }
        if (!formData.startTime) {
          toast.error("Start time is required")
          return false
        }
        if (!formData.endTime) {
          toast.error("End time is required")
          return false
        }
        if (formData.startTime >= formData.endTime) {
          toast.error("End time must be after start time")
          return false
        }
        return true
      case "requirements":
        if (formData.hasCapacityRestriction && (!formData.capacity || formData.capacity < 1)) {
          toast.error("Capacity must be at least 1 when enabled")
          return false
        }
        if (formData.hasAgeRestriction) {
          if (formData.minAge === null && formData.maxAge === null) {
            toast.error("At least one age value is required when age restriction is enabled")
            return false
          }
          if (formData.minAge !== null && (formData.minAge < 0 || formData.minAge > 100)) {
            toast.error("Minimum age must be between 0 and 100")
            return false
          }
          if (formData.maxAge !== null && (formData.maxAge < 0 || formData.maxAge > 100)) {
            toast.error("Maximum age must be between 0 and 100")
            return false
          }
          if (formData.minAge !== null && formData.maxAge !== null && formData.minAge > formData.maxAge) {
            toast.error("Minimum age cannot be greater than maximum age")
            return false
          }
        }
        if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
          toast.error("Select at least one level when level restriction is enabled")
          return false
        }
        if (formData.hasMembershipRestriction && formData.membershipRequirementIds.length === 0) {
          toast.error("Select at least one membership when membership restriction is enabled")
          return false
        }
        if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
          toast.error("Select at least one waiver when waiver restriction is enabled")
          return false
        }
        return true
      case "staff":
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
    if (!validateStep("general") || !validateStep("dateLocation") || !validateStep("requirements") || !validateStep("staff")) {
      return
    }

    setIsSaving(true)

    try {
      const dateStr = formData.date ? format(formData.date, "yyyy-MM-dd") : ""

      const payload: any = {
        title: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        date: dateStr,
        startTime: formData.startTime,
        endTime: formData.endTime,
        facilityId: formData.facilityId,
        capacity: formData.hasCapacityRestriction ? formData.capacity : undefined,
        requiredMembershipInstanceIds: formData.hasMembershipRestriction
          ? formData.membershipRequirementIds
          : [],
        staffAssignments: formData.staffAssignments.map(sa => ({
          staffProfileId: sa.staffProfileId,
          role: sa.role,
        })),
      }

      const url = isEditing ? `/api/events/${(event as any).id}` : "/api/events"
      const method = isEditing ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save event")
      }

      const savedEvent = await response.json()

      toast.success(isEditing ? "Event updated successfully" : "Event created successfully")

      if (onSuccess) {
        onSuccess(savedEvent)
      } else {
        router.push("/dashboard/events")
      }
    } catch (error: any) {
      console.error("Failed to save event:", error)
      toast.error(error.message || "Failed to save event")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddStaff = (staffProfileId: string) => {
    const staff = availableStaff?.find(s => s.id === staffProfileId)
    if (!staff) return

    setFormData(prev => ({
      ...prev,
      staffAssignments: [
        ...prev.staffAssignments,
        {
          staffProfileId,
          role: "ASSISTANT" as EventStaffRole,
          staffProfile: {
            id: staff.id,
            user: {
              name: staff.user?.name || "Unknown",
              avatar: staff.user?.avatar || null,
            },
            title: staff.title,
          },
        },
      ],
    }))
  }

  const handleRemoveStaff = (staffProfileId: string) => {
    setFormData(prev => ({
      ...prev,
      staffAssignments: prev.staffAssignments.filter(a => a.staffProfileId !== staffProfileId),
    }))
  }

  const handleUpdateStaffRole = (staffProfileId: string, role: EventStaffRole) => {
    setFormData(prev => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map(a =>
        a.staffProfileId === staffProfileId ? { ...a, role } : a
      ),
    }))
  }

  const currentIndex = stepper.state.all.findIndex(s => s.id === stepper.state.current.data.id)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
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
                <Layers className="h-5 w-5" />
                Event Details
              </CardTitle>
              <CardDescription>
                Enter the basic information about your event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Spring Showcase 2026"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={value => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Describe what this event is about, who it's for, and what to expect..."
                />
              </div>

              {/* Event Type Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Event Type</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value: EventType) =>
                    setFormData(prev => ({ ...prev, type: value }))
                  }
                  className="grid grid-cols-1 md:grid-cols-2 gap-3"
                >
                  {EVENT_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        formData.type === t.value
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={t.value} className="mt-0.5" />
                      <div className="flex-1 space-y-0.5">
                        <span className="font-medium text-sm">{t.label}</span>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-base font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Price
                </Label>
                <div className="relative max-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    className="pl-7"
                    value={formData.price === null ? "" : formData.price}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === "") {
                        setFormData(prev => ({ ...prev, price: null }))
                        return
                      }
                      const parsed = parseFloat(raw)
                      if (Number.isNaN(parsed)) return
                      if (parsed < 0) return
                      const rounded = Math.round(parsed * 100) / 100
                      setFormData(prev => ({ ...prev, price: rounded }))
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value
                      if (raw === "") return
                      const parsed = parseFloat(raw)
                      if (!Number.isNaN(parsed) && parsed >= 0) {
                        const rounded = Math.round(parsed * 100) / 100
                        if (rounded !== formData.price) {
                          setFormData(prev => ({ ...prev, price: rounded }))
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Optional. Leave blank or set to 0 for free events.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Date & Location */}
        {stepper.state.current.data.id === "dateLocation" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Date & Location
              </CardTitle>
              <CardDescription>
                Set when and where this event takes place
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date */}
              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.date || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, date: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Facility Selection */}
              <div className="space-y-2">
                <Label>Location</Label>
                {loadingFacilities ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading facilities...
                  </div>
                ) : facilities.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <MapPin className="h-6 w-6 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No facilities configured.{" "}
                      <a href="/dashboard/organization/facilities" className="text-primary underline">
                        Add a facility
                      </a>
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.facilityId || "__none__"}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      facilityId: value === "__none__" ? null : value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a facility (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No specific location</SelectItem>
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{facility.name}</span>
                            {facility.city && (
                              <span className="text-muted-foreground">
                                - {facility.city}{facility.stateProvince && `, ${facility.stateProvince}`}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Requirements */}
        {stepper.state.current.data.id === "requirements" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Requirements & Restrictions
              </CardTitle>
              <CardDescription>
                Configure who can register for this event. Toggle on the restrictions you want to apply.
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
                          No levels configured. <a href="/dashboard/training/levels" className="text-primary underline">Create levels</a> first.
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
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: level.color || "#64748b" }}
                              />
                              <span className="text-sm font-medium">{level.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Capacity Restriction */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Capacity Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit the number of attendees
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasCapacityRestriction}
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      hasCapacityRestriction: checked,
                      capacity: checked ? (prev.capacity || 20) : null,
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
                      placeholder="Enter maximum number of attendees"
                      value={formData.capacity || ""}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        capacity: e.target.value ? parseInt(e.target.value) : null,
                      }))}
                      className="mt-2 max-w-[200px]"
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
                      Restrict registration by attendee age
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
                  <div className="pt-2 border-t space-y-4">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        At least one age value is required. Leave the other blank for no limit in that direction.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minAge">Minimum Age</Label>
                        <Input
                          id="minAge"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="No minimum"
                          value={formData.minAge ?? ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            minAge: e.target.value ? parseInt(e.target.value) : null,
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAge">Maximum Age</Label>
                        <Input
                          id="maxAge"
                          type="number"
                          min={0}
                          max={100}
                          placeholder="No maximum"
                          value={formData.maxAge ?? ""}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            maxAge: e.target.value ? parseInt(e.target.value) : null,
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {membershipsEnabled && (
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Membership Requirement</Label>
                      <p className="text-sm text-muted-foreground">
                        Require attendees to have an active membership
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
                      ) : allMembershipInstances.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No memberships configured. <a href="/dashboard/athletes/memberships" className="text-primary underline">Create memberships</a> first.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {allMembershipInstances.map((instance: MembershipInstance) => (
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
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{instance.groupName} - {instance.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">${instance.price.toFixed(2)}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Waiver Requirement */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Waiver Requirement</Label>
                    <p className="text-sm text-muted-foreground">
                      Require customers to sign a waiver before checkout
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
                        No active waivers found. <a href="/dashboard/athletes/waivers/new" className="text-primary underline">Create a waiver</a> first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {waivers.map((waiver) => (
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
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{waiver.title}</span>
                              </div>
                            </div>
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
                      Require attendees to provide medical information during checkout
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
                      <Heart className="h-4 w-4" />
                      <span>
                        Medical information categories are configured in your{" "}
                        <a href="/dashboard/athletes/medical" className="text-primary underline">
                          Medical Information Settings
                        </a>.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Staff */}
        {stepper.state.current.data.id === "staff" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Assignments
              </CardTitle>
              <CardDescription>
                Assign staff to this event
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Staff */}
              <div className="space-y-2">
                <Label>Add Staff Member</Label>
                <div className="flex gap-2">
                  <Select
                    value=""
                    onValueChange={handleAddStaff}
                    disabled={loadingStaff || unassignedStaff.length === 0}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={
                        loadingStaff
                          ? "Loading..."
                          : unassignedStaff.length === 0
                          ? "All staff assigned"
                          : "Select staff member to add"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedStaff.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={s.user?.avatar || ""} />
                              <AvatarFallback>
                                <User className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                            <span>{s.user?.name || "Unknown"}</span>
                            {s.title && <span className="text-muted-foreground">({s.title})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assigned Staff List */}
              <div className="space-y-3">
                <Label>Assigned Staff ({formData.staffAssignments.length})</Label>

                {formData.staffAssignments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No staff assigned yet. Add staff members above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.staffAssignments.map(assignment => (
                      <div
                        key={assignment.staffProfileId}
                        className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={assignment.staffProfile?.user?.avatar || ""} />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {assignment.staffProfile?.user?.name || "Unknown"}
                            </span>
                            {assignment.role === "LEAD" && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                <Star className="h-3 w-3 mr-1" />
                                Lead
                              </Badge>
                            )}
                          </div>
                          {assignment.staffProfile?.title && (
                            <p className="text-xs text-muted-foreground truncate">
                              {assignment.staffProfile.title}
                            </p>
                          )}
                        </div>

                        <Select
                          value={assignment.role}
                          onValueChange={(value: EventStaffRole) =>
                            handleUpdateStaffRole(assignment.staffProfileId, value)
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LEAD">Lead</SelectItem>
                            <SelectItem value="ASSISTANT">Assistant</SelectItem>
                            <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                            <SelectItem value="OBSERVER">Observer</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStaff(assignment.staffProfileId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/events")}
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
                    {isEditing ? "Save Event" : "Create Event"}
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
