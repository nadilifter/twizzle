"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { usePrograms } from "@/hooks/use-programs"
import { useStaff } from "@/hooks/use-staff"
import { useMemberships } from "@/hooks/use-memberships"
import type { ProgramStaffRole } from "@/types/staff"
import { cn } from "@/lib/utils"
import { RecurrencePicker, parseRRule } from "@/components/ui/recurrence-picker"

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
  staffProfileId: string
  role: ProgramStaffRole
  isPrimary: boolean
  staffProfile?: {
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

    // Requirements
    hasLevelRestriction: program.hasLevelRestriction || false,
    levelRequirementIds: (program.levelRequirements?.map((lr: any) => lr.levelId) || []) as string[],
    hasCapacityRestriction: program.hasCapacityRestriction || false,
    capacity: (program.capacity || null) as number | null,
    hasAgeRestriction: program.hasAgeRestriction || false,
    minAge: (program.minAge ?? null) as number | null,
    maxAge: (program.maxAge ?? null) as number | null,
    hasMembershipRestriction: program.hasMembershipRestriction || false,
    membershipRequirementIds: (program.requiredMemberships?.map((m: any) => m.id) || []) as string[],

    // Staff
    staffAssignments: (program.staffAssignments?.map((sa: any) => ({
      staffProfileId: sa.staffProfileId,
      role: sa.role as ProgramStaffRole,
      isPrimary: sa.isPrimary,
      staffProfile: sa.staffProfile,
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
        (s) => !formData.staffAssignments.some((a) => a.staffProfileId === s.id)
      ) || []
    )
  }, [availableStaff, formData.staffAssignments])

  // Staff handlers
  const handleAddStaff = useCallback(
    (staffProfileId: string) => {
      const staff = availableStaff?.find((s) => s.id === staffProfileId)
      if (!staff) return
      setFormData((prev) => ({
        ...prev,
        staffAssignments: [
          ...prev.staffAssignments,
          {
            staffProfileId: staff.id,
            role: "ASSISTANT_COACH" as ProgramStaffRole,
            isPrimary: prev.staffAssignments.length === 0,
            staffProfile: {
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

  const handleRemoveStaff = (staffProfileId: string) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.filter(
        (a) => a.staffProfileId !== staffProfileId
      ),
    }))
  }

  const handleUpdateStaffRole = (staffProfileId: string, role: ProgramStaffRole) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) =>
        a.staffProfileId === staffProfileId ? { ...a, role } : a
      ),
    }))
  }

  const handleSetPrimary = (staffProfileId: string) => {
    setFormData((prev) => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map((a) => ({
        ...a,
        isPrimary: a.staffProfileId === staffProfileId,
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
      } as any)
      toast.success("Requirements saved")
      fetchPrograms()
    } catch (error) {
      toast.error("Failed to save requirements")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveStaff = async () => {
    setIsSaving(true)
    try {
      await updateProgram(program.id, {
        staffAssignments: formData.staffAssignments.map((sa) => ({
          staffProfileId: sa.staffProfileId,
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
  const startDateObj = formData.startDate ? new Date(formData.startDate + "T00:00:00") : null
  const endDateObj = formData.endDate ? new Date(formData.endDate + "T00:00:00") : null

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
            {/* Level Restriction */}
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
                      capacity: checked ? prev.capacity || 20 : null,
                    }))
                  }
                />
              </div>

              {formData.hasCapacityRestriction && (
                <div className="pt-2 border-t">
                  <Label htmlFor="config-capacity">Maximum Capacity</Label>
                  <Input
                    id="config-capacity"
                    type="number"
                    min={1}
                    placeholder="Enter maximum number of athletes"
                    value={formData.capacity || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        capacity: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
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

            {/* Membership Restriction */}
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

            {/* Save */}
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSaveRequirements} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Requirements
              </Button>
            </div>
          </TabsContent>

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
                          {assignment.isPrimary && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
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
                        onValueChange={(value: ProgramStaffRole) =>
                          handleUpdateStaffRole(assignment.staffProfileId, value)
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
                            onClick={() => handleSetPrimary(assignment.staffProfileId)}
                            title="Set as primary"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
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
