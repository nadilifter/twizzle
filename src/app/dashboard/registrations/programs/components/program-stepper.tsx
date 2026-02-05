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
  Stepper,
  StepperItem,
  StepperIndicator,
  StepperSeparator,
  StepperTitle,
  StepperDescription,
  StepperContent,
  StepperNav,
  useStepper,
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
  Plus,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { useStaff } from "@/hooks/use-staff"
import { useMemberships } from "@/hooks/use-memberships"
import type { ProgramStaffRole } from "@/types/staff"
import type { ProgramWithRelations, CreateProgramPayload, UpdateProgramPayload } from "@/types/programs"
import { cn } from "@/lib/utils"

interface Level {
  id: string
  name: string
  color: string | null
  order: number
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

interface ProgramFormData {
  // Step 1: General
  name: string
  description: string
  programType: "SINGLE_INSTANCE" | "SUBSCRIPTION" | "DROP_IN"
  
  // Step 2: Availability
  hasLevelRestriction: boolean
  levelRequirementIds: string[]
  hasCapacityRestriction: boolean
  capacity: number | null
  hasAgeRestriction: boolean
  minAge: number | null
  maxAge: number | null
  hasMembershipRestriction: boolean
  membershipRequirementIds: string[]
  
  // Step 3: Staff
  staffAssignments: StaffAssignment[]
  showCoachOnSite: boolean
}

interface ProgramStepperProps {
  program?: ProgramWithRelations | null
  onSuccess?: (program: ProgramWithRelations) => void
}

const ROLE_LABELS: Record<ProgramStaffRole, string> = {
  LEAD_COACH: "Lead Coach",
  ASSISTANT_COACH: "Assistant Coach",
  SUBSTITUTE: "Substitute",
  VOLUNTEER: "Volunteer",
}

export function ProgramStepper({ program, onSuccess }: ProgramStepperProps) {
  const router = useRouter()
  const isEditing = !!program
  
  // Hooks for data
  const { staff: availableStaff, isLoading: loadingStaff } = useStaff()
  const { memberships, isLoading: loadingMemberships } = useMemberships({ initialParams: { include: "instances" } })
  
  // Levels state
  const [levels, setLevels] = React.useState<Level[]>([])
  const [loadingLevels, setLoadingLevels] = React.useState(true)
  
  // Form state
  const [formData, setFormData] = React.useState<ProgramFormData>(() => ({
    // Step 1: General
    name: program?.name || "",
    description: program?.description || "",
    programType: program?.programType || "SUBSCRIPTION",
    
    // Step 2: Availability
    hasLevelRestriction: program?.hasLevelRestriction || false,
    levelRequirementIds: program?.levelRequirements?.map(lr => lr.levelId) || [],
    hasCapacityRestriction: program?.hasCapacityRestriction || false,
    capacity: program?.capacity || null,
    hasAgeRestriction: program?.hasAgeRestriction || false,
    minAge: program?.minAge || null,
    maxAge: program?.maxAge || null,
    hasMembershipRestriction: program?.hasMembershipRestriction || false,
    membershipRequirementIds: program?.requiredMemberships?.map(m => m.id) || [],
    
    // Step 3: Staff
    staffAssignments: program?.staffAssignments?.map(sa => ({
      staffProfileId: sa.staffProfileId,
      role: sa.role,
      isPrimary: sa.isPrimary,
      staffProfile: sa.staffProfile,
    })) || [],
    showCoachOnSite: program?.showCoachOnSite ?? true,
  }))
  
  const [isSaving, setIsSaving] = React.useState(false)
  const [currentStep, setCurrentStep] = React.useState(1)
  
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
    fetchLevels()
  }, [])
  
  // Flatten membership instances from groups
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
  
  // Filter out already assigned staff
  const unassignedStaff = React.useMemo(() => {
    return availableStaff?.filter(
      s => !formData.staffAssignments.some(a => a.staffProfileId === s.id)
    ) || []
  }, [availableStaff, formData.staffAssignments])
  
  // Validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          toast.error("Program name is required")
          return false
        }
        return true
      case 2:
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
        return true
      case 3:
        return true
      default:
        return true
    }
  }
  
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
    }
  }
  
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }
  
  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return
    }
    
    setIsSaving(true)
    
    try {
      const payload: CreateProgramPayload | UpdateProgramPayload = {
        name: formData.name,
        description: formData.description || undefined,
        programType: formData.programType,
        hasLevelRestriction: formData.hasLevelRestriction,
        hasCapacityRestriction: formData.hasCapacityRestriction,
        hasAgeRestriction: formData.hasAgeRestriction,
        hasMembershipRestriction: formData.hasMembershipRestriction,
        capacity: formData.hasCapacityRestriction ? formData.capacity : null,
        minAge: formData.hasAgeRestriction ? formData.minAge : null,
        maxAge: formData.hasAgeRestriction ? formData.maxAge : null,
        showCoachOnSite: formData.showCoachOnSite,
        levelRequirementIds: formData.hasLevelRestriction ? formData.levelRequirementIds : [],
        membershipRequirementIds: formData.hasMembershipRestriction ? formData.membershipRequirementIds : [],
        staffAssignments: formData.staffAssignments.map(sa => ({
          staffProfileId: sa.staffProfileId,
          role: sa.role,
          isPrimary: sa.isPrimary,
        })),
      }
      
      const url = isEditing ? `/api/programs/${program.id}` : "/api/programs"
      const method = isEditing ? "PATCH" : "POST"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save program")
      }
      
      const savedProgram = await response.json()
      
      toast.success(isEditing ? "Program updated successfully" : "Program created successfully")
      
      if (onSuccess) {
        onSuccess(savedProgram)
      } else {
        router.push("/dashboard/registrations/programs")
      }
    } catch (error: any) {
      console.error("Failed to save program:", error)
      toast.error(error.message || "Failed to save program")
    } finally {
      setIsSaving(false)
    }
  }
  
  // Staff management
  const handleAddStaff = (staffProfileId: string) => {
    const staff = availableStaff?.find(s => s.id === staffProfileId)
    if (!staff) return
    
    setFormData(prev => ({
      ...prev,
      staffAssignments: [
        ...prev.staffAssignments,
        {
          staffProfileId,
          role: "ASSISTANT_COACH" as ProgramStaffRole,
          isPrimary: prev.staffAssignments.length === 0, // First staff is primary
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
    setFormData(prev => {
      const newAssignments = prev.staffAssignments.filter(a => a.staffProfileId !== staffProfileId)
      // If we removed the primary, make the first one primary
      if (newAssignments.length > 0 && !newAssignments.some(a => a.isPrimary)) {
        newAssignments[0].isPrimary = true
      }
      return { ...prev, staffAssignments: newAssignments }
    })
  }
  
  const handleSetPrimary = (staffProfileId: string) => {
    setFormData(prev => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map(a => ({
        ...a,
        isPrimary: a.staffProfileId === staffProfileId,
      })),
    }))
  }
  
  const handleUpdateStaffRole = (staffProfileId: string, role: ProgramStaffRole) => {
    setFormData(prev => ({
      ...prev,
      staffAssignments: prev.staffAssignments.map(a => 
        a.staffProfileId === staffProfileId ? { ...a, role } : a
      ),
    }))
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Stepper value={currentStep} onValueChange={setCurrentStep}>
        {/* Step Navigation */}
        <StepperNav className="mb-8">
          <StepperItem step={1} completed={currentStep > 1}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-3"
            >
              <StepperIndicator />
              <div className="hidden sm:block text-left">
                <StepperTitle>General</StepperTitle>
                <StepperDescription>Basic information</StepperDescription>
              </div>
            </button>
            <StepperSeparator className="hidden sm:block" />
          </StepperItem>
          
          <StepperItem step={2} completed={currentStep > 2}>
            <button
              type="button"
              onClick={() => currentStep > 1 && setCurrentStep(2)}
              className="flex items-center gap-3"
              disabled={currentStep < 2}
            >
              <StepperIndicator />
              <div className="hidden sm:block text-left">
                <StepperTitle>Availability</StepperTitle>
                <StepperDescription>Restrictions & limits</StepperDescription>
              </div>
            </button>
            <StepperSeparator className="hidden sm:block" />
          </StepperItem>
          
          <StepperItem step={3} completed={currentStep > 3}>
            <button
              type="button"
              onClick={() => currentStep > 2 && setCurrentStep(3)}
              className="flex items-center gap-3"
              disabled={currentStep < 3}
            >
              <StepperIndicator />
              <div className="hidden sm:block text-left">
                <StepperTitle>Staff</StepperTitle>
                <StepperDescription>Assign coaches</StepperDescription>
              </div>
            </button>
          </StepperItem>
        </StepperNav>
        
        {/* Step Content */}
        <StepperContent value={1}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Program Details
              </CardTitle>
              <CardDescription>
                Enter the basic information about your program
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Program Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Recreational Gymnastics - Bronze"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <RichTextEditor
                  value={formData.description}
                  onChange={value => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Describe what this program offers, who it's for, and what participants will learn..."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="programType">Program Type</Label>
                <Select
                  value={formData.programType}
                  onValueChange={(value: "SINGLE_INSTANCE" | "SUBSCRIPTION" | "DROP_IN") => 
                    setFormData(prev => ({ ...prev, programType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUBSCRIPTION">
                      <div className="flex flex-col items-start">
                        <span>Subscription</span>
                        <span className="text-xs text-muted-foreground">Recurring enrollment (e.g., monthly classes)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="SINGLE_INSTANCE">
                      <div className="flex flex-col items-start">
                        <span>Single Instance</span>
                        <span className="text-xs text-muted-foreground">One-time event or camp</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="DROP_IN">
                      <div className="flex flex-col items-start">
                        <span>Drop-In</span>
                        <span className="text-xs text-muted-foreground">Pay per session attendance</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </StepperContent>
        
        <StepperContent value={2}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Availability & Restrictions
              </CardTitle>
              <CardDescription>
                Configure who can register for this program. Toggle on the restrictions you want to apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      placeholder="Enter maximum number of athletes"
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
                      Restrict registration by athlete age
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
            </CardContent>
          </Card>
        </StepperContent>
        
        <StepperContent value={3}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Staff Assignments
              </CardTitle>
              <CardDescription>
                Assign coaches and staff to this program
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
              
              {/* Display Settings */}
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
                    onCheckedChange={checked => setFormData(prev => ({
                      ...prev,
                      showCoachOnSite: checked,
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </StepperContent>
        
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/registrations/programs")}
          >
            Cancel
          </Button>
          
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            
            {currentStep < 3 ? (
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
                    {isEditing ? "Save Program" : "Create Program"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Stepper>
    </div>
  )
}
