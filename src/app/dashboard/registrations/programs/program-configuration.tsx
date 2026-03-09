"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useFeatures } from "@/components/feature-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Trash2,
  Loader2,
  User,
  Star,
  Users,
  CreditCard,
  MapPin,
  Clock,
  Repeat,
  CalendarDays,
  Info,
  FileText,
  Heart,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { usePrograms } from "@/hooks/use-programs"
import { useStaff } from "@/hooks/use-staff"
import { useMemberships } from "@/hooks/use-memberships"
import type { ProgramStaffRole } from "@/types/staff"
import type { TrainingZoneWithAvailability } from "@/types/programs"
import { cn } from "@/lib/utils"
import { RecurrencePicker, parseRRule } from "@/components/ui/recurrence-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"

interface ProgramConfigProps {
  program: any
  onClose: () => void
}

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
  memberId: string
  role: ProgramStaffRole
  isPrimary: boolean
  member?: {
    id: string
    user: {
      name: string
      avatar: string | null
    }
    title: string | null
  }
}

const ROLE_LABELS: Record<ProgramStaffRole, string> = {
  LEAD_COACH: "Lead Coach",
  ASSISTANT_COACH: "Assistant Coach",
  SUBSTITUTE: "Substitute",
  VOLUNTEER: "Volunteer",
}

export function ProgramConfiguration({ program, onClose }: ProgramConfigProps) {
  const { updateProgram, fetchPrograms } = usePrograms()
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")
  const membershipsEnabled = isFeatureEnabled("memberships")
  const waitlistsEnabled = isFeatureEnabled("waitlists")
  const { staff: availableStaff, isLoading: loadingStaff } = useStaff()
  const { memberships, isLoading: loadingMemberships } = useMemberships({ initialParams: { include: "instances" } })

  const [activeTab, setActiveTab] = useState("general")
  const [isSaving, setIsSaving] = useState(false)

  // Levels state
  const [levels, setLevels] = useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)

  // Facilities state
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)

  // Waivers state
  const [waivers, setWaivers] = useState<Array<{ id: string; title: string; status: string }>>([])
  const [loadingWaivers, setLoadingWaivers] = useState(true)

  // Training zones state
  const [trainingZones, setTrainingZones] = useState<TrainingZoneWithAvailability[]>([])
  const [loadingZones, setLoadingZones] = useState(false)
  const [fullyBookedOverride, setFullyBookedOverride] = useState<string | null>(null)
  const [conflictDetailsZoneId, setConflictDetailsZoneId] = useState<string | null>(null)

  // Form state - mirrors the stepper's ProgramFormData
  const [formData, setFormData] = useState(() => ({
    // General
    name: program.name || "",
    description: program.description || "",
    recurrenceType: (program.recurrenceType || "RECURRING") as "NON_RECURRING" | "RECURRING",
    registrationType: (program.registrationType || "ALL_INSTANCES") as "ALL_INSTANCES" | "PER_INSTANCE" | null,
    price: (() => {
      const isFlatRate = program.pricingModel === "FLAT_RATE"
      const val = isFlatRate ? program.basePrice : program.perSessionPrice
      return val != null ? Number(val) : null
    })(),

    // Schedule
    startDate: program.startDate ? new Date(program.startDate).toISOString().split("T")[0] : "",
    endDate: program.endDate ? new Date(program.endDate).toISOString().split("T")[0] : "",
    startTime: program.startTime || "09:00",
    duration: program.duration || 60,
    facilityId: (program.facilityId || null) as string | null,
    rrule: (program.rrule || null) as string | null,
    trainingZoneIds: (program.trainingZones?.map((tz: any) => tz.trainingZoneId) || []) as string[],

    // Requirements
    hasLevelRestriction: program.hasLevelRestriction || false,
    levelRequirementIds: (program.levelRequirements?.map((lr: any) => lr.levelId) || []) as string[],
    hasCapacityRestriction: program.hasCapacityRestriction || false,
    hasTrainingZoneRestriction: program.hasTrainingZoneRestriction || false,
    trainingZoneCapacityMode: (program.trainingZoneCapacityMode || "MINIMUM") as "MINIMUM" | "SUM",
    capacity: (program.capacity || null) as number | null,
    hasAgeRestriction: program.hasAgeRestriction || false,
    minAge: (program.minAge ?? null) as number | null,
    maxAge: (program.maxAge ?? null) as number | null,
    hasMembershipRestriction: program.hasMembershipRestriction || false,
    membershipRequirementIds: (program.requiredMemberships?.map((m: any) => m.id) || []) as string[],
    hasWaiverRestriction: (program as any).hasWaiverRestriction || false,
    waiverRequirementIds: ((program as any).waiverRequirements?.map((wr: any) => wr.waiverId) || []) as string[],
    hasMedicalRequirement: (program as any).hasMedicalRequirement || false,

    // Waitlist
    waitlistEnabled: program.waitlistEnabled || false,
    waitlistAutoPromote: program.waitlistAutoPromote || false,
    waitlistCapacity: (program.waitlistCapacity ?? null) as number | null,

    // Staff
    staffAssignments: (program.staffAssignments?.map((sa: any) => ({
      memberId: sa.memberId,
      role: sa.role as ProgramStaffRole,
      isPrimary: sa.isPrimary,
      member: sa.member,
    })) || []) as StaffAssignment[],
    showCoachOnSite: program.showCoachOnSite ?? true,
  }))

  // Fetch levels
  useEffect(() => {
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

  // Fetch facilities
  useEffect(() => {
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

  // Fetch waivers
  useEffect(() => {
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

  // Fetch training zones + availability when facility or time changes
  const rruleDays = useMemo(() => {
    if (!formData.rrule) return []
    const match = formData.rrule.match(/BYDAY=([A-Z,]+)/)
    if (!match) return []
    const dayMap: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 }
    return match[1].split(",").map(d => dayMap[d]).filter((d): d is number => d != null)
  }, [formData.rrule])

  const fetchZoneAvailability = useCallback(async (
    facilityId: string,
    startTime?: string,
    duration?: number | null,
    daysOfWeek?: number[],
    programStartDate?: string,
    programEndDate?: string,
  ) => {
    setLoadingZones(true)
    try {
      const params = new URLSearchParams()
      if (startTime && duration) {
        params.set("startTime", startTime)
        const [h, m] = startTime.split(":").map(Number)
        const endDate = new Date(2000, 0, 1, h, m + duration)
        params.set("endTime", `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`)
      }
      if (daysOfWeek && daysOfWeek.length > 0) {
        params.set("daysOfWeek", daysOfWeek.join(","))
      }
      if (programStartDate) params.set("programStartDate", programStartDate)
      if (programEndDate) params.set("programEndDate", programEndDate)
      params.set("excludeProgramId", program.id)
      const qs = params.toString()
      const response = await fetch(`/api/organization/facilities/${facilityId}/zones/availability${qs ? `?${qs}` : ""}`)
      if (response.ok) {
        const data = await response.json()
        setTrainingZones(data)
      }
    } catch (error) {
      console.error("Failed to fetch training zones:", error)
    } finally {
      setLoadingZones(false)
    }
  }, [program.id])

  useEffect(() => {
    if (formData.facilityId) {
      fetchZoneAvailability(
        formData.facilityId,
        formData.startTime,
        formData.duration,
        rruleDays,
        formData.startDate,
        formData.endDate,
      )
    } else {
      setTrainingZones([])
      setFormData(prev => ({ ...prev, trainingZoneIds: [] }))
    }
  }, [formData.facilityId, formData.startTime, formData.duration, rruleDays, formData.startDate, formData.endDate, fetchZoneAvailability])

  const zoneDerivedCapacity = useMemo(() => {
    if (formData.trainingZoneIds.length === 0) return null
    const selectedZones = trainingZones.filter(z => formData.trainingZoneIds.includes(z.id))
    const capacities = selectedZones.map(z => z.capacity).filter((c): c is number => c != null)
    if (capacities.length === 0) return null
    if (formData.trainingZoneCapacityMode === "SUM") {
      return capacities.reduce((sum, c) => sum + c, 0)
    }
    return Math.min(...capacities)
  }, [formData.trainingZoneIds, formData.trainingZoneCapacityMode, trainingZones])

  // Flatten membership instances from groups
  const allMembershipInstances = useMemo(() => {
    return (
      memberships?.flatMap((group) =>
        group.instances?.map((instance: any) => ({
          id: instance.id,
          name: instance.name,
          price: Number(instance.price),
          groupName: group.name,
        })) || []
      ) || []
    )
  }, [memberships])

  // Filter out already assigned staff
  const unassignedStaff = useMemo(() => {
    return (
      availableStaff?.filter(
        (s) => !formData.staffAssignments.some((a) => a.memberId === s.id)
      ) || []
    )
  }, [availableStaff, formData.staffAssignments])

  // Staff handlers
  const handleAddStaff = useCallback(
    (memberId: string) => {
      const staff = availableStaff?.find((s) => s.id === memberId)
      if (!staff) return
      setFormData((prev) => ({
        ...prev,
        staffAssignments: [
          ...prev.staffAssignments,
          {
            memberId: staff.id,
            role: "ASSISTANT_COACH" as ProgramStaffRole,
            isPrimary: prev.staffAssignments.length === 0,
            member: {
              id: staff.id,
              user: {
                name: staff.user?.name || "Unknown",
                avatar: staff.user?.avatar || null,
              },
              title: staff.title || null,
            },
          },
        ],
      }))
    },
    [availableStaff]
  )

  const handleRemoveStaff = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.filter(
        (a) => a.memberId !== memberId
      ),
    }))
  }

  const handleUpdateStaffRole = (memberId: string, role: ProgramStaffRole) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) =>
        a.memberId === memberId ? { ...a, role } : a
      ),
    }))
  }

  const handleSetPrimary = (memberId: string) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) => ({
        ...a,
        isPrimary: a.memberId === memberId,
      })),
    }))
  }

  // --- Save handlers per tab ---
  const handleSaveGeneral = async () => {
    if (!formData.name.trim()) {
      toast.error("Program name is required")
      return
    }
    if (formData.price !== null && formData.price < 0) {
      toast.error("Price cannot be negative")
      return
    }

    setIsSaving(true)
    try {
      const isFlatRate =
        formData.recurrenceType === "RECURRING" &&
        formData.registrationType === "ALL_INSTANCES"
      const priceValue =
        formData.price != null
          ? Math.max(0, Math.round(formData.price * 100) / 100)
          : null

      await updateProgram(program.id, {
        name: formData.name,
        description: formData.description || undefined,
        recurrenceType: formData.recurrenceType as any,
        registrationType:
          formData.recurrenceType === "RECURRING"
            ? (formData.registrationType as any)
            : null,
        pricingModel: isFlatRate ? ("FLAT_RATE" as any) : ("PER_SESSION" as any),
        basePrice: isFlatRate ? priceValue : null,
        perSessionPrice: !isFlatRate ? priceValue : null,
      })
      toast.success("General settings saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save general settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (!formData.startDate) {
      toast.error("Start date is required")
      return
    }
    if (formData.recurrenceType === "RECURRING" && !formData.endDate) {
      toast.error("End date is required for recurring programs")
      return
    }
    if (!formData.startTime) {
      toast.error("Start time is required")
      return
    }
    if (!formData.duration || formData.duration < 1) {
      toast.error("Duration must be at least 1 minute")
      return
    }

    setIsSaving(true)
    try {
      await updateProgram(program.id, {
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        startTime: formData.startTime,
        duration: formData.duration,
        facilityId: formData.facilityId,
        rrule: formData.rrule,
        trainingZoneIds: formData.trainingZoneIds,
      } as any)
      toast.success("Schedule saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save schedule")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveRequirements = async () => {
    if (
      formData.hasCapacityRestriction &&
      (!formData.capacity || formData.capacity < 1)
    ) {
      toast.error("Capacity must be at least 1 when enabled")
      return
    }
    if (formData.hasAgeRestriction) {
      if (formData.minAge === null && formData.maxAge === null) {
        toast.error("At least one age value is required when age restriction is enabled")
        return
      }
      if (formData.minAge !== null && formData.maxAge !== null && formData.minAge > formData.maxAge) {
        toast.error("Minimum age cannot be greater than maximum age")
        return
      }
    }
    if (formData.hasLevelRestriction && formData.levelRequirementIds.length === 0) {
      toast.error("Select at least one level when level restriction is enabled")
      return
    }
    if (formData.hasMembershipRestriction && formData.membershipRequirementIds.length === 0) {
      toast.error("Select at least one membership when membership restriction is enabled")
      return
    }
    if (formData.hasWaiverRestriction && formData.waiverRequirementIds.length === 0) {
      toast.error("Select at least one waiver when waiver restriction is enabled")
      return
    }

    setIsSaving(true)
    try {
      await updateProgram(program.id, {
        hasLevelRestriction: formData.hasLevelRestriction,
        levelRequirementIds: formData.hasLevelRestriction ? formData.levelRequirementIds : [],
        hasCapacityRestriction: formData.hasCapacityRestriction,
        capacity: formData.hasCapacityRestriction ? formData.capacity : null,
        hasAgeRestriction: formData.hasAgeRestriction,
        minAge: formData.hasAgeRestriction ? formData.minAge : null,
        maxAge: formData.hasAgeRestriction ? formData.maxAge : null,
        hasMembershipRestriction: formData.hasMembershipRestriction,
        membershipRequirementIds: formData.hasMembershipRestriction
          ? formData.membershipRequirementIds
          : [],
        hasWaiverRestriction: formData.hasWaiverRestriction,
        waiverRequirementIds: formData.hasWaiverRestriction
          ? formData.waiverRequirementIds
          : [],
        hasMedicalRequirement: formData.hasMedicalRequirement,
        hasTrainingZoneRestriction: formData.hasTrainingZoneRestriction,
        trainingZoneCapacityMode: formData.trainingZoneCapacityMode,
      } as any)
      toast.success("Requirements saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save requirements")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveWaitlist = async () => {
    setIsSaving(true)
    try {
      await updateProgram(program.id, {
        waitlistEnabled: formData.waitlistEnabled,
        waitlistAutoPromote: formData.waitlistEnabled ? formData.waitlistAutoPromote : false,
        waitlistCapacity: formData.waitlistEnabled ? formData.waitlistCapacity : null,
      } as any)
      toast.success("Waitlist settings saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save waitlist settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveStaff = async () => {
    setIsSaving(true)
    try {
      await updateProgram(program.id, {
        staffAssignments: formData.staffAssignments.map((sa) => ({
          memberId: sa.memberId,
          role: sa.role,
          isPrimary: sa.isPrimary,
        })),
        showCoachOnSite: formData.showCoachOnSite,
      } as any)
      toast.success("Staff settings saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save staff settings")
    } finally {
      setIsSaving(false)
    }
  }

  // Derived values for schedule tab
  const startDateObj = formData.startDate ? new Date(formData.startDate + "T12:00:00Z") : null
  const endDateObj = formData.endDate ? new Date(formData.endDate + "T12:00:00Z") : null

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <h2 className="text-xl font-semibold">{formData.name || "Configure Program"}</h2>
        <p className="text-sm text-muted-foreground">Manage program details and options.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 border-b bg-muted/30">
          <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="requirements">Requirements</TabsTrigger>
            {waitlistsEnabled && <TabsTrigger value="waitlist">Waitlist</TabsTrigger>}
            <TabsTrigger value="staff">Staff</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* ============================================= */}
          {/* GENERAL TAB                                   */}
          {/* ============================================= */}
          <TabsContent value="general" className="mt-0 space-y-6 max-w-2xl">
            {/* Program Name */}
            <div className="space-y-2">
              <Label htmlFor="config-name">Program Name *</Label>
              <Input
                id="config-name"
                placeholder="e.g., Recreational Gymnastics - Bronze"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="config-desc">Description</Label>
              <RichTextEditor
                value={formData.description || ""}
                onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                placeholder="Describe what this program offers, who it's for, and what participants will learn..."
              />
            </div>

            {/* Schedule Type */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Schedule Type</Label>
              <RadioGroup
                value={formData.recurrenceType}
                onValueChange={(value: "NON_RECURRING" | "RECURRING") =>
                  setFormData((prev) => ({
                    ...prev,
                    recurrenceType: value,
                    registrationType:
                      value === "RECURRING"
                        ? prev.registrationType || "ALL_INSTANCES"
                        : null,
                  }))
                }
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.recurrenceType === "NON_RECURRING"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="NON_RECURRING" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Single Session</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      One-time event like a camp, workshop, or clinic
                    </p>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                    formData.recurrenceType === "RECURRING"
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value="RECURRING" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Repeating Schedule</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Weekly or recurring classes on a regular schedule
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Registration Type - only for recurring */}
            {formData.recurrenceType === "RECURRING" && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <Label className="text-base font-medium">Registration Style</Label>
                <RadioGroup
                  value={formData.registrationType || "ALL_INSTANCES"}
                  onValueChange={(value: "ALL_INSTANCES" | "PER_INSTANCE") =>
                    setFormData((prev) => ({ ...prev, registrationType: value }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-background p-3 cursor-pointer transition-colors",
                      formData.registrationType === "ALL_INSTANCES"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="ALL_INSTANCES" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium text-sm">Enroll in entire program</span>
                      <p className="text-xs text-muted-foreground">
                        Athletes register once for all sessions during the program period
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-background p-3 cursor-pointer transition-colors",
                      formData.registrationType === "PER_INSTANCE"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <RadioGroupItem value="PER_INSTANCE" className="mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <span className="font-medium text-sm">Sign up per class</span>
                      <p className="text-xs text-muted-foreground">
                        Athletes register individually for each session they want to attend
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="config-price" className="text-base font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {formData.recurrenceType === "RECURRING" &&
                formData.registrationType === "ALL_INSTANCES"
                  ? "Price (flat rate)"
                  : "Price (per session)"}
              </Label>
              <div className="relative max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="config-price"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  className="pl-7"
                  value={formData.price === null ? "" : formData.price}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === "") {
                      setFormData((prev) => ({ ...prev, price: null }))
                      return
                    }
                    const parsed = parseFloat(raw)
                    if (Number.isNaN(parsed)) return
                    if (parsed < 0) return
                    const rounded = Math.round(parsed * 100) / 100
                    setFormData((prev) => ({ ...prev, price: rounded }))
                  }}
                  onBlur={(e) => {
                    const raw = e.target.value
                    if (raw === "") return
                    const parsed = parseFloat(raw)
                    if (!Number.isNaN(parsed) && parsed >= 0) {
                      const rounded = Math.round(parsed * 100) / 100
                      if (rounded !== formData.price) {
                        setFormData((prev) => ({ ...prev, price: rounded }))
                      }
                    }
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Optional. Leave blank or set to 0 for free programs. Maximum 2 decimal places.
              </p>
            </div>

            {/* Save */}
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveGeneral} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* ============================================= */}
          {/* SCHEDULE TAB                                  */}
          {/* ============================================= */}
          <TabsContent value="schedule" className="mt-0 space-y-6 max-w-2xl">
            {/* Date Selection */}
            <div
              className={cn(
                "grid gap-4",
                formData.recurrenceType === "RECURRING"
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1"
              )}
            >
              <div className="space-y-2">
                <Label htmlFor="config-start-date">
                  {formData.recurrenceType === "RECURRING" ? "Start Date *" : "Program Date *"}
                </Label>
                <Input
                  id="config-start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: e.target.value,
                      endDate:
                        e.target.value &&
                        prev.endDate &&
                        prev.endDate < e.target.value
                          ? ""
                          : prev.endDate,
                    }))
                  }
                />
              </div>

              {formData.recurrenceType === "RECURRING" && (
                <div className="space-y-2">
                  <Label htmlFor="config-end-date">End Date *</Label>
                  <Input
                    id="config-end-date"
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Time and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="config-start-time">Start Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="config-start-time"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-duration">Duration (minutes) *</Label>
                <Input
                  id="config-duration"
                  type="number"
                  min={1}
                  max={480}
                  placeholder="60"
                  value={formData.duration || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                />
                {formData.duration && (
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(formData.duration / 60)}h {formData.duration % 60}m
                  </p>
                )}
              </div>
            </div>

            {/* Recurrence Pattern */}
            {formData.recurrenceType === "RECURRING" && startDateObj && endDateObj && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Recurrence Pattern</Label>
                </div>
                <RecurrencePicker
                  startDate={startDateObj}
                  endDate={endDateObj}
                  value={
                    formData.rrule
                      ? parseRRule(formData.rrule, startDateObj, endDateObj)
                      : undefined
                  }
                  onRRuleChange={(rrule) =>
                    setFormData((prev) => ({ ...prev, rrule }))
                  }
                />
              </div>
            )}

            {/* Facility */}
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
                    <a href="/dashboard/settings/facilities" className="text-primary underline">
                      Add a facility
                    </a>
                  </p>
                </div>
              ) : (
                <Select
                  value={formData.facilityId || "__none__"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      facilityId: value === "__none__" ? null : value,
                      trainingZoneIds: value === "__none__" ? [] : prev.trainingZoneIds,
                    }))
                  }
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
                              - {facility.city}
                              {facility.stateProvince && `, ${facility.stateProvince}`}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Training Zone Selection */}
            {formData.facilityId && (
              <div className="space-y-3">
                <Label>Training Zones (optional)</Label>
                {loadingZones ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading training zones...
                  </div>
                ) : trainingZones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No training zones configured for this facility.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {trainingZones.map(zone => {
                        const isSelected = formData.trainingZoneIds.includes(zone.id)
                        const hasConflicts = zone.totalConflicts > 0
                        const hasClosed = zone.closedDays?.length > 0
                        const hasWarnings = hasConflicts || hasClosed
                        return (
                          <label
                            key={zone.id}
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50",
                              (zone.isFullyBooked || !zone.isAvailable) && !isSelected && "opacity-60"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={checked => {
                                if (checked && hasWarnings) {
                                  setFullyBookedOverride(zone.id)
                                  return
                                }
                                setFormData(prev => {
                                  const newIds = checked
                                    ? [...prev.trainingZoneIds, zone.id]
                                    : prev.trainingZoneIds.filter(id => id !== zone.id)
                                  const hasZones = newIds.length > 0
                                  const selectedZones = trainingZones.filter(z => newIds.includes(z.id))
                                  const capacities = selectedZones.map(z => z.capacity).filter((c): c is number => c != null)
                                  const derived = capacities.length > 0
                                    ? (prev.trainingZoneCapacityMode === "SUM"
                                        ? capacities.reduce((sum, c) => sum + c, 0)
                                        : Math.min(...capacities))
                                    : null
                                  return {
                                    ...prev,
                                    trainingZoneIds: newIds,
                                    hasCapacityRestriction: hasZones ? true : prev.hasCapacityRestriction,
                                    hasTrainingZoneRestriction: hasZones ? true : false,
                                    capacity: hasZones && derived != null ? derived : prev.capacity,
                                  }
                                })
                              }}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{zone.name}</span>
                                <Badge variant="outline" className="text-xs">{zone.type}</Badge>
                                {zone.isFullyBooked ? (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Fully booked
                                  </Badge>
                                ) : hasConflicts && zone.totalConflicts <= 3 ? (
                                  <Badge variant="secondary" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Full on {zone.conflictDates.map(c => format(new Date(c.date + "T12:00:00Z"), "MMM d")).join(", ")}
                                  </Badge>
                                ) : hasConflicts ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs text-amber-600 border-amber-300 bg-amber-50 cursor-pointer"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConflictDetailsZoneId(zone.id) }}
                                  >
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    {zone.totalConflicts} date conflicts
                                  </Badge>
                                ) : null}
                                {hasClosed && (
                                  <Badge variant="secondary" className="text-xs text-orange-600 border-orange-300 bg-orange-50">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {zone.closedDays.length === 1
                                      ? `Closed ${zone.closedDays[0].day}`
                                      : zone.closedDays.every(d => d.reason === "closed")
                                        ? `Closed ${zone.closedDays.map(d => d.day).join(", ")}`
                                        : `${zone.closedDays.length} day${zone.closedDays.length !== 1 ? "s" : ""} outside hours`
                                    }
                                  </Badge>
                                )}
                              </div>
                              {zone.capacity != null && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Capacity: {zone.capacity}
                                  {hasConflicts && !zone.isFullyBooked && (
                                    <> &middot; <span className="text-amber-600">{zone.totalConflicts} date{zone.totalConflicts !== 1 ? "s" : ""} at capacity</span></>
                                  )}
                                </p>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>

                    {/* Conflict details dialog */}
                    <Dialog open={!!conflictDetailsZoneId} onOpenChange={(open) => !open && setConflictDetailsZoneId(null)}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>
                            Conflict Details &mdash; {trainingZones.find(z => z.id === conflictDetailsZoneId)?.name}
                          </DialogTitle>
                        </DialogHeader>
                        {(() => {
                          const zone = trainingZones.find(z => z.id === conflictDetailsZoneId)
                          if (!zone) return null
                          return (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                This zone (capacity {zone.capacity}) is fully booked on the following {zone.totalConflicts} date{zone.totalConflicts !== 1 ? "s" : ""}:
                              </p>
                              <div className="max-h-64 overflow-y-auto rounded border divide-y">
                                {zone.conflictDates.map(c => (
                                  <div key={c.date} className="flex items-center justify-between px-3 py-2 text-sm">
                                    <span>{format(new Date(c.date + "T12:00:00Z"), "EEE, MMM d, yyyy")}</span>
                                    <span className="text-destructive font-medium">{c.used}/{zone.capacity} used</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </DialogContent>
                    </Dialog>

                    {/* Conflict / closed-hours override dialog */}
                    <AlertDialog open={!!fullyBookedOverride} onOpenChange={(open) => !open && setFullyBookedOverride(null)}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Training Zone Warning
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-3">
                              {(() => {
                                const zone = trainingZones.find(z => z.id === fullyBookedOverride)
                                if (!zone) return <p>This training zone has issues.</p>
                                const sections: React.ReactNode[] = []

                                if (zone.closedDays?.length > 0) {
                                  sections.push(
                                    <div key="closed">
                                      <p className="font-medium text-foreground">Outside operating hours</p>
                                      <ul className="mt-1 space-y-0.5 text-sm">
                                        {zone.closedDays.map(d => (
                                          <li key={d.day} className="text-orange-600">
                                            {d.day}: {d.reason === "closed" ? "Zone is closed" : `Zone is ${d.reason}`}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )
                                }

                                if (zone.isFullyBooked) {
                                  sections.push(
                                    <div key="full">
                                      <p className="font-medium text-foreground">Fully booked</p>
                                      <p className="text-sm">This zone is at capacity on all dates during the selected time slot.</p>
                                    </div>
                                  )
                                } else if (zone.totalConflicts > 0) {
                                  sections.push(
                                    <div key="conflicts">
                                      <p className="font-medium text-foreground">Capacity conflicts</p>
                                      {zone.totalConflicts <= 5 ? (
                                        <ul className="mt-1 space-y-0.5 text-sm">
                                          {zone.conflictDates.map(c => (
                                            <li key={c.date} className="text-destructive">
                                              {format(new Date(c.date + "T12:00:00Z"), "EEE, MMM d, yyyy")} ({c.used}/{zone.capacity} used)
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          {zone.totalConflicts} dates at capacity, from {format(new Date(zone.conflictDates[0].date + "T12:00:00Z"), "MMM d")} through {format(new Date(zone.conflictDates[zone.conflictDates.length - 1].date + "T12:00:00Z"), "MMM d, yyyy")}.
                                        </p>
                                      )}
                                    </div>
                                  )
                                }

                                return sections.length > 0 ? sections : <p>This training zone has issues.</p>
                              })()}
                              <p>Are you sure you want to proceed?</p>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (fullyBookedOverride) {
                                setFormData(prev => {
                                  const newIds = [...prev.trainingZoneIds, fullyBookedOverride]
                                  const selectedZones = trainingZones.filter(z => newIds.includes(z.id))
                                  const capacities = selectedZones.map(z => z.capacity).filter((c): c is number => c != null)
                                  const derived = capacities.length > 0
                                    ? (prev.trainingZoneCapacityMode === "SUM"
                                        ? capacities.reduce((sum, c) => sum + c, 0)
                                        : Math.min(...capacities))
                                    : null
                                  return {
                                    ...prev,
                                    trainingZoneIds: newIds,
                                    hasCapacityRestriction: true,
                                    hasTrainingZoneRestriction: true,
                                    capacity: derived ?? prev.capacity,
                                  }
                                })
                              }
                              setFullyBookedOverride(null)
                            }}
                          >
                            Proceed Anyway
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}

            {/* Save */}
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveSchedule} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Schedule
              </Button>
            </div>
          </TabsContent>

          {/* ============================================= */}
          {/* REQUIREMENTS TAB                              */}
          {/* ============================================= */}
          <TabsContent value="requirements" className="mt-0 space-y-6 max-w-2xl">
            {/* Level Restriction - only shown when Training feature is enabled */}
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
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasLevelRestriction: checked,
                      levelRequirementIds: checked ? prev.levelRequirementIds : [],
                    }))
                  }
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
                      <a href="/dashboard/training/levels" className="text-primary underline">
                        Create levels
                      </a>{" "}
                      first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {levels.map((level) => (
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
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                levelRequirementIds: checked
                                  ? [...prev.levelRequirementIds, level.id]
                                  : prev.levelRequirementIds.filter((id) => id !== level.id),
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
                    Limit the number of athletes who can enroll
                  </p>
                </div>
                <Switch
                  checked={formData.hasCapacityRestriction}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasCapacityRestriction: checked,
                      capacity: checked ? prev.capacity || zoneDerivedCapacity || 20 : null,
                    }))
                  }
                />
              </div>

              {formData.hasCapacityRestriction && (
                <div className="pt-2 border-t space-y-4">
                  {/* Training zone capacity restriction */}
                  {formData.trainingZoneIds.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">Restrict by Training Zone Capacity</Label>
                          <p className="text-xs text-muted-foreground">
                            Derive capacity from the selected training zones
                          </p>
                        </div>
                        <Switch
                          checked={formData.hasTrainingZoneRestriction}
                          onCheckedChange={checked => {
                            setFormData(prev => ({
                              ...prev,
                              hasTrainingZoneRestriction: checked,
                              capacity: checked && zoneDerivedCapacity ? zoneDerivedCapacity : prev.capacity,
                            }))
                          }}
                        />
                      </div>

                      {formData.hasTrainingZoneRestriction && formData.trainingZoneIds.length > 1 && (
                        <div className="pl-4 border-l-2 space-y-2">
                          <Label className="text-sm">Multi-zone capacity mode</Label>
                          <RadioGroup
                            value={formData.trainingZoneCapacityMode}
                            onValueChange={(value: "MINIMUM" | "SUM") => {
                              setFormData(prev => {
                                const selectedZones = trainingZones.filter(z => prev.trainingZoneIds.includes(z.id))
                                const capacities = selectedZones.map(z => z.capacity).filter((c): c is number => c != null)
                                const derived = value === "SUM"
                                  ? capacities.reduce((s, c) => s + c, 0)
                                  : capacities.length > 0 ? Math.min(...capacities) : null
                                return {
                                  ...prev,
                                  trainingZoneCapacityMode: value,
                                  capacity: derived ?? prev.capacity,
                                }
                              })
                            }}
                            className="space-y-2"
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <RadioGroupItem value="MINIMUM" />
                              <span className="text-sm">Use smallest zone capacity</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <RadioGroupItem value="SUM" />
                              <span className="text-sm">Use combined zone capacity</span>
                            </label>
                          </RadioGroup>
                          {zoneDerivedCapacity != null && (
                            <p className="text-xs text-muted-foreground">
                              Derived capacity: {zoneDerivedCapacity} athletes
                            </p>
                          )}
                        </div>
                      )}

                      {formData.hasTrainingZoneRestriction && zoneDerivedCapacity != null && formData.trainingZoneIds.length === 1 && (
                        <p className="text-xs text-muted-foreground pl-4 border-l-2">
                          Zone capacity: {zoneDerivedCapacity} athletes
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="config-capacity">Maximum Capacity</Label>
                    <Input
                      id="config-capacity"
                      type="number"
                      min={1}
                      max={formData.hasTrainingZoneRestriction && zoneDerivedCapacity ? zoneDerivedCapacity : undefined}
                      placeholder="Max athletes"
                      value={formData.capacity || ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null
                        const capped = formData.hasTrainingZoneRestriction && zoneDerivedCapacity && val
                          ? Math.min(val, zoneDerivedCapacity)
                          : val
                        setFormData((prev) => ({ ...prev, capacity: capped }))
                      }}
                      className="mt-2 max-w-[200px]"
                    />
                    {formData.hasTrainingZoneRestriction && zoneDerivedCapacity != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Cannot exceed zone capacity of {zoneDerivedCapacity}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Age Restriction */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Age Restriction</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict registration by athlete age
                  </p>
                </div>
                <Switch
                  checked={formData.hasAgeRestriction}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasAgeRestriction: checked,
                      minAge: checked ? prev.minAge : null,
                      maxAge: checked ? prev.maxAge : null,
                    }))
                  }
                />
              </div>

              {formData.hasAgeRestriction && (
                <div className="pt-2 border-t space-y-4">
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      At least one age value is required. Leave the other blank for no limit in that
                      direction.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="config-min-age">Minimum Age</Label>
                      <Input
                        id="config-min-age"
                        type="number"
                        min={0}
                        max={100}
                        placeholder="No minimum"
                        value={formData.minAge ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            minAge: e.target.value ? parseInt(e.target.value) : null,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="config-max-age">Maximum Age</Label>
                      <Input
                        id="config-max-age"
                        type="number"
                        min={0}
                        max={100}
                        placeholder="No maximum"
                        value={formData.maxAge ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            maxAge: e.target.value ? parseInt(e.target.value) : null,
                          }))
                        }
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
                      Require athletes to have an active membership
                    </p>
                  </div>
                  <Switch
                    checked={formData.hasMembershipRestriction}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        hasMembershipRestriction: checked,
                        membershipRequirementIds: checked ? prev.membershipRequirementIds : [],
                      }))
                    }
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
                        No memberships configured.{" "}
                        <a
                          href="/dashboard/athletes/memberships"
                          className="text-primary underline"
                        >
                          Create memberships
                        </a>{" "}
                        first.
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
                              onCheckedChange={(checked) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  membershipRequirementIds: checked
                                    ? [...prev.membershipRequirementIds, instance.id]
                                    : prev.membershipRequirementIds.filter(
                                        (id) => id !== instance.id
                                      ),
                                }))
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {instance.groupName} - {instance.name}
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              ${instance.price.toFixed(2)}
                            </span>
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
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasWaiverRestriction: checked,
                      waiverRequirementIds: checked ? prev.waiverRequirementIds : [],
                    }))
                  }
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
                      <a href="/dashboard/athletes/waivers/new" className="text-primary underline">
                        Create a waiver
                      </a>{" "}
                      first.
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
                            onCheckedChange={(checked) => {
                              setFormData((prev) => ({
                                ...prev,
                                waiverRequirementIds: checked
                                  ? [...prev.waiverRequirementIds, waiver.id]
                                  : prev.waiverRequirementIds.filter((id) => id !== waiver.id),
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
                    Require athletes to provide medical information during checkout
                  </p>
                </div>
                <Switch
                  checked={formData.hasMedicalRequirement}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasMedicalRequirement: checked,
                    }))
                  }
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

            {/* Save */}
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveRequirements} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Requirements
              </Button>
            </div>
          </TabsContent>

          {/* ============================================= */}
          {/* WAITLIST TAB                                   */}
          {/* ============================================= */}
          {waitlistsEnabled && (
          <TabsContent value="waitlist" className="mt-0 space-y-6 max-w-2xl">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="config-waitlist-enabled" className="text-base">Enable Waitlist</Label>
                <p className="text-sm text-muted-foreground">
                  Allow athletes to join a waitlist when the program is full
                </p>
              </div>
              <Switch
                id="config-waitlist-enabled"
                checked={formData.waitlistEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, waitlistEnabled: checked }))}
              />
            </div>

            {formData.waitlistEnabled && (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="config-waitlist-auto-promote" className="text-base">Automatic Promotion</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically promote the next person on the waitlist when a spot opens, in registration order
                    </p>
                  </div>
                  <Switch
                    id="config-waitlist-auto-promote"
                    checked={formData.waitlistAutoPromote}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, waitlistAutoPromote: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="config-waitlist-capacity">Maximum Waitlist Size</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit how many people can join the waitlist. Leave empty for unlimited.
                  </p>
                  <Input
                    id="config-waitlist-capacity"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={formData.waitlistCapacity ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null
                      setFormData(prev => ({ ...prev, waitlistCapacity: val }))
                    }}
                    className="max-w-[200px]"
                  />
                </div>
              </>
            )}

            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveWaitlist} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Waitlist
              </Button>
            </div>
          </TabsContent>
          )}

          {/* ============================================= */}
          {/* STAFF TAB                                     */}
          {/* ============================================= */}
          <TabsContent value="staff" className="mt-0 space-y-6 max-w-2xl">
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
                    <SelectValue
                      placeholder={
                        loadingStaff
                          ? "Loading..."
                          : unassignedStaff.length === 0
                            ? "All staff assigned"
                            : "Select staff member to add"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={s.user?.avatar || ""} />
                            <AvatarFallback>
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{s.user?.name || "Unknown"}</span>
                          {s.title && (
                            <span className="text-muted-foreground">({s.title})</span>
                          )}
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
                  {formData.staffAssignments.map((assignment) => (
                    <div
                      key={assignment.memberId}
                      className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={assignment.member?.user?.avatar || ""} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {assignment.member?.user?.name || "Unknown"}
                          </span>
                          {assignment.isPrimary && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        {assignment.member?.title && (
                          <p className="text-xs text-muted-foreground truncate">
                            {assignment.member.title}
                          </p>
                        )}
                      </div>

                      <Select
                        value={assignment.role}
                        onValueChange={(value: ProgramStaffRole) =>
                          handleUpdateStaffRole(assignment.memberId, value)
                        }
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LEAD_COACH">Lead Coach</SelectItem>
                          <SelectItem value="ASSISTANT_COACH">Assistant Coach</SelectItem>
                          <SelectItem value="SUBSTITUTE">Substitute</SelectItem>
                          <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1">
                        {!assignment.isPrimary && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(assignment.memberId)}
                            title="Set as primary"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStaff(assignment.memberId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Show Coach on Site */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Show Coach on Marketing Site</Label>
                  <p className="text-sm text-muted-foreground">
                    Display the primary coach on the public program listing
                  </p>
                </div>
                <Switch
                  checked={formData.showCoachOnSite}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, showCoachOnSite: checked }))
                  }
                />
              </div>
            </div>

            {/* Save */}
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveStaff} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Staff
              </Button>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-4 border-t flex justify-end bg-background">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
