"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Save, Loader2, DollarSign, User, Star, AlertTriangle, Eye, EyeOff, Settings, Percent } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { usePrograms } from "@/hooks/use-programs"
import { useStaff } from "@/hooks/use-staff"
import { useMemberships } from "@/hooks/use-memberships"
import type { ProgramStaffRole } from "@/types/staff"

interface ProgramConfigProps {
  program: any 
  onClose: () => void
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
  const [isAddingTier, setIsAddingTier] = useState(false)
  const [isDeletingTier, setIsDeletingTier] = useState<string | null>(null)
  
  // Local state for form fields
  const [formData, setFormData] = useState({
    name: program.name || "",
    description: program.description || "",
    level: program.level || "",
    status: program.status || "ACTIVE",
    // New fields
    programType: program.programType || "SUBSCRIPTION",
    pricingModel: program.pricingModel || "FLAT_RATE",
    basePrice: program.basePrice ? Number(program.basePrice) : null,
    perSessionPrice: program.perSessionPrice ? Number(program.perSessionPrice) : null,
    startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : "",
    endDate: program.endDate ? new Date(program.endDate).toISOString().split('T')[0] : "",
    capacity: program.capacity || null,
    levelId: program.levelId || null,
    showLevelOnSite: program.showLevelOnSite ?? true,
    showCoachOnSite: program.showCoachOnSite ?? true,
  })
  
  // State for levels
  const [levels, setLevels] = useState<any[]>([])
  const [loadingLevels, setLoadingLevels] = useState(true)
  
  // State for bulk discounts
  const [bulkDiscounts, setBulkDiscounts] = useState<any[]>(program.bulkDiscounts || [])
  const [isAddingDiscount, setIsAddingDiscount] = useState(false)
  const [isDeletingDiscount, setIsDeletingDiscount] = useState<string | null>(null)
  const [newBulkDiscount, setNewBulkDiscount] = useState({
    type: "FAMILY_SIBLING" as "FAMILY_SIBLING" | "MULTI_SESSION",
    minQuantity: 2,
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: 10,
    description: "",
  })
  
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

  // State for membership tiers
  const [tiers, setTiers] = useState<any[]>(program.membershipTiers || [])
  const [newTier, setNewTier] = useState({
    name: "",
    price: "",
    interval: "MONTHLY",
  })
  
  // State for coaches
  const [assignedStaff, setAssignedStaff] = useState<any[]>(program.staffAssignments || [])
  const [isAddingStaff, setIsAddingStaff] = useState(false)
  const [isDeletingStaff, setIsDeletingStaff] = useState<string | null>(null)
  const [newStaffAssignment, setNewStaffAssignment] = useState({
    staffProfileId: "",
    role: "ASSISTANT_COACH" as ProgramStaffRole,
    isPrimary: false,
  })
  
  // State for requirements
  const [requirements, setRequirements] = useState<any[]>(program.requiredMemberships || [])
  const [isAddingRequirement, setIsAddingRequirement] = useState(false)
  const [isDeletingRequirement, setIsDeletingRequirement] = useState<string | null>(null)
  const [selectedMembershipInstance, setSelectedMembershipInstance] = useState("")
  
  // Flatten membership instances from groups
  const allMembershipInstances = memberships?.flatMap(group => 
    group.instances?.map((instance: any) => ({
      ...instance,
      groupName: group.name,
    })) || []
  ) || []
  
  // Filter out already required memberships
  const availableMembershipInstances = allMembershipInstances.filter(
    (instance: any) => !requirements.some(r => r.id === instance.id)
  )
  
  // Filter out already assigned staff
  const unassignedStaff = availableStaff?.filter(
    s => !assignedStaff.some(a => a.staffProfile?.id === s.id || a.staffProfileId === s.id)
  ) || []

  const handleSaveGeneral = async () => {
    setIsSaving(true)
    try {
      await updateProgram(program.id, formData)
      toast.success("Program details updated")
    } catch (error) {
      toast.error("Failed to update program")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTier = async () => {
    if (!newTier.name || !newTier.price) {
        toast.error("Name and Price are required")
        return
    }

    setIsAddingTier(true)
    try {
        const response = await fetch(`/api/programs/${program.id}/tiers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTier)
        })

        if (!response.ok) throw new Error("Failed to add tier")
        
        const addedTier = await response.json()
        setTiers([...tiers, addedTier])
        setNewTier({ name: "", price: "", interval: "MONTHLY" })
        toast.success("Membership option added")
        
        // Refresh parent list silently to keep sync
        fetchPrograms()
    } catch (error) {
        console.error(error)
        toast.error("Failed to add membership option")
    } finally {
        setIsAddingTier(false)
    }
  }

  const handleRemoveTier = async (id: string) => {
    setIsDeletingTier(id)
    try {
        const response = await fetch(`/api/programs/${program.id}/tiers/${id}`, {
            method: "DELETE",
        })

        if (!response.ok) throw new Error("Failed to delete tier")
        
        setTiers(tiers.filter(t => t.id !== id))
        toast.success("Membership option removed")
        fetchPrograms()
    } catch (error) {
        console.error(error)
        toast.error("Failed to remove option")
    } finally {
        setIsDeletingTier(null)
    }
  }
  
  // Staff/Coach handlers
  const handleAddStaff = async () => {
    if (!newStaffAssignment.staffProfileId) {
      toast.error("Please select a staff member")
      return
    }

    setIsAddingStaff(true)
    try {
      const response = await fetch(`/api/programs/${program.id}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaffAssignment),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add coach")
      }

      const addedStaff = await response.json()
      setAssignedStaff([...assignedStaff, addedStaff])
      setNewStaffAssignment({ staffProfileId: "", role: "ASSISTANT_COACH", isPrimary: false })
      toast.success("Coach added to program")
      fetchPrograms()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to add coach")
    } finally {
      setIsAddingStaff(false)
    }
  }

  const handleRemoveStaff = async (assignmentId: string) => {
    setIsDeletingStaff(assignmentId)
    try {
      const response = await fetch(`/api/programs/${program.id}/staff/${assignmentId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to remove coach")

      setAssignedStaff(assignedStaff.filter(a => a.id !== assignmentId))
      toast.success("Coach removed from program")
      fetchPrograms()
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove coach")
    } finally {
      setIsDeletingStaff(null)
    }
  }

  const handleSetPrimary = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/programs/${program.id}/staff/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      })

      if (!response.ok) throw new Error("Failed to update")

      // Update local state - remove primary from others, set on this one
      setAssignedStaff(assignedStaff.map(a => ({
        ...a,
        isPrimary: a.id === assignmentId,
      })))
      toast.success("Primary coach updated")
    } catch (error) {
      console.error(error)
      toast.error("Failed to update primary coach")
    }
  }
  
  // Bulk discount handlers
  const handleAddBulkDiscount = async () => {
    if (newBulkDiscount.discountValue <= 0) {
      toast.error("Discount value must be greater than 0")
      return
    }

    setIsAddingDiscount(true)
    try {
      const response = await fetch(`/api/programs/${program.id}/bulk-discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBulkDiscount),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add discount")
      }

      const addedDiscount = await response.json()
      setBulkDiscounts([...bulkDiscounts, addedDiscount])
      setNewBulkDiscount({
        type: "FAMILY_SIBLING",
        minQuantity: 2,
        discountType: "PERCENTAGE",
        discountValue: 10,
        description: "",
      })
      toast.success("Bulk discount added")
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to add bulk discount")
    } finally {
      setIsAddingDiscount(false)
    }
  }

  const handleRemoveBulkDiscount = async (discountId: string) => {
    setIsDeletingDiscount(discountId)
    try {
      const response = await fetch(`/api/programs/${program.id}/bulk-discounts/${discountId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to remove discount")

      setBulkDiscounts(bulkDiscounts.filter(d => d.id !== discountId))
      toast.success("Bulk discount removed")
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove bulk discount")
    } finally {
      setIsDeletingDiscount(null)
    }
  }

  // Requirements handlers
  const handleAddRequirement = async () => {
    if (!selectedMembershipInstance) {
      toast.error("Please select a membership")
      return
    }

    setIsAddingRequirement(true)
    try {
      const response = await fetch(`/api/programs/${program.id}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipInstanceId: selectedMembershipInstance }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to add requirement")
      }

      const updatedRequirements = await response.json()
      setRequirements(updatedRequirements)
      setSelectedMembershipInstance("")
      toast.success("Membership requirement added")
      fetchPrograms()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to add requirement")
    } finally {
      setIsAddingRequirement(false)
    }
  }

  const handleRemoveRequirement = async (instanceId: string) => {
    setIsDeletingRequirement(instanceId)
    try {
      const response = await fetch(`/api/programs/${program.id}/requirements/${instanceId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to remove requirement")

      setRequirements(requirements.filter(r => r.id !== instanceId))
      toast.success("Requirement removed")
      fetchPrograms()
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove requirement")
    } finally {
      setIsDeletingRequirement(null)
    }
  }

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
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                {/* Discounts tab temporarily hidden - will be re-enabled later */}
                {/* <TabsTrigger value="discounts">Discounts</TabsTrigger> */}
                {/* Memberships tab removed - functionality moved to new program stepper */}
                <TabsTrigger value="requirements">Requirements</TabsTrigger>
                <TabsTrigger value="coaches">Coaches</TabsTrigger>
                <TabsTrigger value="display">Display</TabsTrigger>
            </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="general" className="mt-0 space-y-6 max-w-2xl">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="config-name">Program Name</Label>
                        <Input 
                            id="config-name" 
                            value={formData.name} 
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="config-desc">Description</Label>
                        <RichTextEditor 
                            value={formData.description || ""} 
                            onChange={(value) => setFormData({...formData, description: value})}
                            placeholder="Enter program description..."
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="config-type">Program Type</Label>
                            <Select 
                                value={formData.programType} 
                                onValueChange={(val) => setFormData({...formData, programType: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SINGLE_INSTANCE">Single Instance (One-off)</SelectItem>
                                    <SelectItem value="SUBSCRIPTION">Subscription (Recurring)</SelectItem>
                                    <SelectItem value="DROP_IN">Drop-In (Per Class)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="config-status">Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val) => setFormData({...formData, status: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="config-level-select">Level</Label>
                            <Select 
                                value={formData.levelId || "none"} 
                                onValueChange={(val) => setFormData({...formData, levelId: val === "none" ? null : val})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Level</SelectItem>
                                    {levels.map((level) => (
                                        <SelectItem key={level.id} value={level.id}>
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded-full" 
                                                    style={{ backgroundColor: level.color || "#64748b" }}
                                                />
                                                {level.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input 
                                placeholder="Or enter level text (legacy)"
                                value={formData.level} 
                                onChange={(e) => setFormData({...formData, level: e.target.value})}
                                className="text-sm"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="config-capacity">Capacity (optional)</Label>
                            <Input 
                                id="config-capacity" 
                                type="number"
                                min="1"
                                placeholder="Unlimited"
                                value={formData.capacity || ""} 
                                onChange={(e) => setFormData({...formData, capacity: e.target.value ? parseInt(e.target.value) : null})}
                            />
                        </div>
                    </div>
                    {(formData.programType === "SUBSCRIPTION" || formData.programType === "SINGLE_INSTANCE") && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="config-start">Start Date</Label>
                                <Input 
                                    id="config-start" 
                                    type="date"
                                    value={formData.startDate} 
                                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="config-end">End Date</Label>
                                <Input 
                                    id="config-end" 
                                    type="date"
                                    value={formData.endDate} 
                                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                />
                            </div>
                        </div>
                    )}
                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSaveGeneral} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </TabsContent>
            
            <TabsContent value="pricing" className="mt-0 space-y-6 max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Pricing Model</CardTitle>
                        <CardDescription>Configure how this program is priced</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Pricing Type</Label>
                            <Select 
                                value={formData.pricingModel} 
                                onValueChange={(val) => setFormData({...formData, pricingModel: val})}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FLAT_RATE">Flat Rate (Fixed Price)</SelectItem>
                                    <SelectItem value="PER_SESSION">Per Session</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {formData.pricingModel === "FLAT_RATE" && (
                            <div className="grid gap-2">
                                <Label>Total Price</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="number" 
                                        className="pl-8"
                                        placeholder="0.00" 
                                        value={formData.basePrice || ""}
                                        onChange={(e) => setFormData({...formData, basePrice: e.target.value ? parseFloat(e.target.value) : null})}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    The total price for the entire program duration
                                </p>
                            </div>
                        )}
                        
                        {formData.pricingModel === "PER_SESSION" && (
                            <div className="grid gap-2">
                                <Label>Price Per Session</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="number" 
                                        className="pl-8"
                                        placeholder="0.00" 
                                        value={formData.perSessionPrice || ""}
                                        onChange={(e) => setFormData({...formData, perSessionPrice: e.target.value ? parseFloat(e.target.value) : null})}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Total will be calculated based on number of sessions
                                </p>
                            </div>
                        )}
                        
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSaveGeneral} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Pricing
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="discounts" className="mt-0 space-y-6 max-w-3xl">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Add Bulk Discount</CardTitle>
                        <CardDescription>Configure family or multi-session discounts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-3 grid gap-2">
                                <Label>Type</Label>
                                <Select 
                                    value={newBulkDiscount.type} 
                                    onValueChange={(val: "FAMILY_SIBLING" | "MULTI_SESSION") => setNewBulkDiscount({...newBulkDiscount, type: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FAMILY_SIBLING">Family/Sibling</SelectItem>
                                        <SelectItem value="MULTI_SESSION">Multi-Session</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2 grid gap-2">
                                <Label>{newBulkDiscount.type === "FAMILY_SIBLING" ? "Child #" : "Min Qty"}</Label>
                                <Input 
                                    type="number" 
                                    min="2"
                                    value={newBulkDiscount.minQuantity}
                                    onChange={(e) => setNewBulkDiscount({...newBulkDiscount, minQuantity: parseInt(e.target.value) || 2})}
                                />
                            </div>
                            <div className="md:col-span-2 grid gap-2">
                                <Label>Discount</Label>
                                <Select 
                                    value={newBulkDiscount.discountType} 
                                    onValueChange={(val: "PERCENTAGE" | "FIXED_AMOUNT") => setNewBulkDiscount({...newBulkDiscount, discountType: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                                        <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2 grid gap-2">
                                <Label>Value</Label>
                                <div className="relative">
                                    {newBulkDiscount.discountType === "PERCENTAGE" ? (
                                        <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    )}
                                    <Input 
                                        type="number" 
                                        className="pl-8"
                                        value={newBulkDiscount.discountValue}
                                        onChange={(e) => setNewBulkDiscount({...newBulkDiscount, discountValue: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2 grid gap-2">
                                <Label>Description</Label>
                                <Input 
                                    placeholder="Optional"
                                    value={newBulkDiscount.description}
                                    onChange={(e) => setNewBulkDiscount({...newBulkDiscount, description: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <Button onClick={handleAddBulkDiscount} disabled={isAddingDiscount} size="icon" className="w-full">
                                    {isAddingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                {bulkDiscounts.length > 0 ? (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Active Discounts</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {bulkDiscounts.map((discount: any) => (
                                <div key={discount.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Badge variant={discount.type === "FAMILY_SIBLING" ? "default" : "secondary"}>
                                            {discount.type === "FAMILY_SIBLING" ? "Family" : "Multi-Session"}
                                        </Badge>
                                        <span className="font-medium">
                                            {discount.type === "FAMILY_SIBLING" 
                                                ? `${discount.minQuantity}${discount.minQuantity === 2 ? "nd" : discount.minQuantity === 3 ? "rd" : "th"} child`
                                                : `${discount.minQuantity}+ sessions`
                                            }
                                        </span>
                                        <span className="text-muted-foreground">→</span>
                                        <span className="text-green-600 font-medium">
                                            {discount.discountType === "PERCENTAGE" 
                                                ? `${Number(discount.discountValue)}% off`
                                                : `$${Number(discount.discountValue)} off`
                                            }
                                        </span>
                                        {discount.description && (
                                            <span className="text-sm text-muted-foreground">({discount.description})</span>
                                        )}
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => handleRemoveBulkDiscount(discount.id)}
                                        disabled={isDeletingDiscount === discount.id}
                                    >
                                        {isDeletingDiscount === discount.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No bulk discounts configured. Add one above to offer family or volume pricing.
                        </CardContent>
                    </Card>
                )}
            </TabsContent>

            <TabsContent value="memberships" className="mt-0 space-y-6 max-w-3xl">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Add New Option</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5 grid gap-2">
                                <Label>Option Name</Label>
                                <Input 
                                    placeholder="e.g. Monthly Pass" 
                                    value={newTier.name}
                                    onChange={(e) => setNewTier({...newTier, name: e.target.value})}
                                />
                            </div>
                            <div className="md:col-span-3 grid gap-2">
                                <Label>Price</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="number" 
                                        className="pl-8"
                                        placeholder="0.00" 
                                        value={newTier.price}
                                        onChange={(e) => setNewTier({...newTier, price: e.target.value})}
                                    />
                                </div>
                            </div>
                             <div className="md:col-span-3 grid gap-2">
                                <Label>Billing</Label>
                                <Select 
                                    value={newTier.interval} 
                                    onValueChange={(val) => setNewTier({...newTier, interval: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                        <SelectItem value="YEARLY">Yearly</SelectItem>
                                        <SelectItem value="SESSION">Per Session</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-1">
                                <Button onClick={handleAddTier} disabled={isAddingTier} size="icon" className="w-full">
                                    {isAddingTier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Options</h3>
                    <div className="grid gap-3">
                        {tiers.length === 0 ? (
                            <div className="p-8 text-center border rounded-md bg-muted/10">
                                <p className="text-sm text-muted-foreground">No membership options configured yet.</p>
                            </div>
                        ) : (
                            tiers.map((tier) => (
                                <div key={tier.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">{tier.name}</span>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span className="capitalize">{tier.interval.toLowerCase()}</span>
                                            <span>•</span>
                                            <span>${Number(tier.price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleRemoveTier(tier.id)}
                                        disabled={isDeletingTier === tier.id}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        {isDeletingTier === tier.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-0 space-y-6 max-w-3xl">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Add Membership Requirement</CardTitle>
                        <CardDescription>
                            Athletes must have an active membership to enroll in this program.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1 grid gap-2">
                                <Label>Membership</Label>
                                <Select
                                    value={selectedMembershipInstance}
                                    onValueChange={setSelectedMembershipInstance}
                                    disabled={loadingMemberships}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingMemberships ? "Loading..." : "Select a membership"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMembershipInstances.map((instance: any) => (
                                            <SelectItem key={instance.id} value={instance.id}>
                                                {instance.groupName} - {instance.name} (${Number(instance.price).toFixed(2)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={handleAddRequirement}
                                disabled={isAddingRequirement || !selectedMembershipInstance}
                            >
                                {isAddingRequirement ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                Add
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {requirements.length > 0 && (
                    <div className="p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <div className="flex gap-2 items-start">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                Athletes without these memberships will be prompted to purchase when registering for this program.
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Required Memberships</h3>
                    <div className="grid gap-3">
                        {requirements.length === 0 ? (
                            <div className="p-8 text-center border rounded-md bg-muted/10">
                                <p className="text-sm text-muted-foreground">No membership requirements set. Any athlete can enroll.</p>
                            </div>
                        ) : (
                            requirements.map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">{req.group?.name || "Membership"} - {req.name}</span>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>${Number(req.price).toFixed(2)}</span>
                                            <span>•</span>
                                            <span className="capitalize">{req.billingInterval?.toLowerCase()}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveRequirement(req.id)}
                                        disabled={isDeletingRequirement === req.id}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        {isDeletingRequirement === req.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="coaches" className="mt-0 space-y-6 max-w-3xl">
                <Card className="border-dashed shadow-none">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">Assign Coach</CardTitle>
                        <CardDescription>
                            Add coaches to this program. They will be visible on the marketing site and in the coach portal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5 grid gap-2">
                                <Label>Staff Member</Label>
                                <Select
                                    value={newStaffAssignment.staffProfileId}
                                    onValueChange={(val) => setNewStaffAssignment({ ...newStaffAssignment, staffProfileId: val })}
                                    disabled={loadingStaff}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingStaff ? "Loading..." : "Select staff member"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unassignedStaff.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.user?.name || "Unknown"} {s.title ? `(${s.title})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-4 grid gap-2">
                                <Label>Role</Label>
                                <Select
                                    value={newStaffAssignment.role}
                                    onValueChange={(val) => setNewStaffAssignment({ ...newStaffAssignment, role: val as ProgramStaffRole })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LEAD_COACH">Lead Coach</SelectItem>
                                        <SelectItem value="ASSISTANT_COACH">Assistant Coach</SelectItem>
                                        <SelectItem value="SUBSTITUTE">Substitute</SelectItem>
                                        <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-3">
                                <Button
                                    onClick={handleAddStaff}
                                    disabled={isAddingStaff || !newStaffAssignment.staffProfileId}
                                    className="w-full"
                                >
                                    {isAddingStaff ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Assigned Coaches</h3>
                    <div className="grid gap-3">
                        {assignedStaff.length === 0 ? (
                            <div className="p-8 text-center border rounded-md bg-muted/10">
                                <p className="text-sm text-muted-foreground">No coaches assigned to this program yet.</p>
                            </div>
                        ) : (
                            assignedStaff.map((assignment) => (
                                <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={assignment.staffProfile?.user?.avatar || ""} />
                                            <AvatarFallback>
                                                <User className="h-4 w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{assignment.staffProfile?.user?.name || "Unknown"}</span>
                                                {assignment.isPrimary && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Star className="h-3 w-3 mr-1" />
                                                        Primary
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{ROLE_LABELS[assignment.role as ProgramStaffRole] || assignment.role}</span>
                                                {assignment.staffProfile?.title && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{assignment.staffProfile.title}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!assignment.isPrimary && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetPrimary(assignment.id)}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                <Star className="h-4 w-4 mr-1" />
                                                Set Primary
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveStaff(assignment.id)}
                                            disabled={isDeletingStaff === assignment.id}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            {isDeletingStaff === assignment.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </TabsContent>
            
            <TabsContent value="display" className="mt-0 space-y-6 max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Marketing Site Display
                        </CardTitle>
                        <CardDescription>
                            Control what information is shown on your public program listing
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Show Level</Label>
                                <p className="text-sm text-muted-foreground">
                                    Display the program level on the marketing site
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.showLevelOnSite ? (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Switch
                                    checked={formData.showLevelOnSite}
                                    onCheckedChange={(checked) => setFormData({...formData, showLevelOnSite: checked})}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Show Coach</Label>
                                <p className="text-sm text-muted-foreground">
                                    Display the primary coach on the marketing site
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {formData.showCoachOnSite ? (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                )}
                                <Switch
                                    checked={formData.showCoachOnSite}
                                    onCheckedChange={(checked) => setFormData({...formData, showCoachOnSite: checked})}
                                />
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleSaveGeneral} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Display Settings
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </div>
      </Tabs>
      <div className="p-4 border-t flex justify-end bg-background">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
