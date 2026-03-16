"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Building, 
  Dumbbell,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Filter,
  Star,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  Clock,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface Facility {
  id: string
  name: string
  street: string | null
  city: string | null
  stateProvince: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  email: string | null
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE"
  isDefault: boolean
  squareFootage: number | null
  maxCapacity: number | null
  description: string | null
  _count: {
    spaces: number
    equipment: number
    assignments: number
    events: number
  }
}

interface Space {
  id: string
  name: string
  capacity: number | null
  status: "OPEN" | "CLOSED" | "MAINTENANCE"
  description: string | null
  _count: {
    equipment: number
  }
}

interface Equipment {
  id: string
  name: string
  serialNumber: string | null
  condition: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNSAFE"
  status: "ACTIVE" | "RETIRED" | "MAINTENANCE"
  lastInspectionDate: string | null
  space: { id: string; name: string } | null
}

export default function FacilitiesPage() {
  const [facilityTab, setFacilityTab] = useState("overview")
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form states
  const [facilityFormOpen, setFacilityFormOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [spaceFormOpen, setSpaceFormOpen] = useState(false)
  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null)

  // Search states
  const [spaceSearch, setSpaceSearch] = useState("")
  const [equipmentSearch, setEquipmentSearch] = useState("")

  // Space availability state
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [editingSpaceAvailability, setEditingSpaceAvailability] = useState<Space | null>(null)
  const [availabilitySlots, setAvailabilitySlots] = useState<Record<number, { enabled: boolean; openTime: string; closeTime: string }>>({})
  const [savingAvailability, setSavingAvailability] = useState(false)

  // Facility operating hours state
  type TimeBlock = { openTime: string; closeTime: string }
  const [operatingHours, setOperatingHours] = useState<Record<number, TimeBlock[]>>({
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  })

  // Fetch facilities
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await fetch("/api/organization/facilities")
      if (!res.ok) throw new Error("Failed to fetch facilities")
      const data = await res.json()
      setFacilities(data)
      
      // Auto-select the default facility or first one
      if (data.length > 0 && !selectedFacility) {
        const defaultFacility = data.find((f: Facility) => f.isDefault) || data[0]
        setSelectedFacility(defaultFacility)
      }
    } catch (error) {
      toast.error("Failed to load facilities")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [selectedFacility])

  // Fetch spaces and equipment for selected facility
  const fetchFacilityDetails = useCallback(async (facilityId: string) => {
    setLoadingDetail(true)
    try {
      const [spacesRes, equipmentRes] = await Promise.all([
        fetch(`/api/organization/facilities/${facilityId}/spaces`),
        fetch(`/api/organization/facilities/${facilityId}/equipment`),
      ])
      
      if (!spacesRes.ok || !equipmentRes.ok) throw new Error("Failed to fetch details")
      
      const [spacesData, equipmentData] = await Promise.all([
        spacesRes.json(),
        equipmentRes.json(),
      ])
      
      setSpaces(spacesData)
      setEquipment(equipmentData)
    } catch (error) {
      toast.error("Failed to load facility details")
      console.error(error)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    fetchFacilities()
  }, [fetchFacilities])

  useEffect(() => {
    if (selectedFacility) {
      fetchFacilityDetails(selectedFacility.id)
    }
  }, [selectedFacility, fetchFacilityDetails])

  const emptyOperatingHours = (): Record<number, TimeBlock[]> =>
    ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] })

  const loadOperatingHours = async (facilityId: string) => {
    try {
      const res = await fetch(`/api/organization/facilities/${facilityId}/operating-hours`)
      if (res.ok) {
        const data: Array<{ dayOfWeek: number; openTime: string; closeTime: string }> = await res.json()
        const hours = emptyOperatingHours()
        for (const slot of data) {
          hours[slot.dayOfWeek].push({ openTime: slot.openTime, closeTime: slot.closeTime })
        }
        setOperatingHours(hours)
      }
    } catch {
      // Leave defaults on error
    }
  }

  const openFacilityForm = (facility: Facility | null) => {
    setEditingFacility(facility)
    if (facility) {
      loadOperatingHours(facility.id)
    } else {
      setOperatingHours(emptyOperatingHours())
    }
    setFacilityFormOpen(true)
  }

  // Create or update facility
  const handleSaveFacility = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      street: formData.get("street") as string || null,
      city: formData.get("city") as string || null,
      stateProvince: formData.get("stateProvince") as string || null,
      postalCode: formData.get("postalCode") as string || null,
      country: formData.get("country") as string || null,
      phone: formData.get("phone") as string || null,
      email: formData.get("email") as string || null,
      squareFootage: formData.get("squareFootage") ? Number(formData.get("squareFootage")) : null,
      maxCapacity: formData.get("maxCapacity") ? Number(formData.get("maxCapacity")) : null,
      description: formData.get("description") as string || null,
    }

    try {
      const url = editingFacility 
        ? `/api/organization/facilities/${editingFacility.id}`
        : "/api/organization/facilities"
      const method = editingFacility ? "PATCH" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save facility")
      }
      
      const savedFacility = await res.json()

      // Save operating hours
      const slots = Object.entries(operatingHours).flatMap(([day, blocks]) =>
        blocks.map((b) => ({ dayOfWeek: parseInt(day), openTime: b.openTime, closeTime: b.closeTime }))
      )
      try {
        const hoursRes = await fetch(
          `/api/organization/facilities/${savedFacility.id}/operating-hours`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slots }),
          }
        )
        if (!hoursRes.ok) {
          const err = await hoursRes.json()
          toast.error(err.error || "Facility saved but failed to save operating hours")
        }
      } catch {
        toast.error("Facility saved but failed to save operating hours")
      }

      toast.success(editingFacility ? "Facility updated" : "Facility created")
      setFacilityFormOpen(false)
      setEditingFacility(null)
      await fetchFacilities()
      
      if (!editingFacility) {
        setSelectedFacility(savedFacility)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save facility")
    } finally {
      setSaving(false)
    }
  }

  // Delete facility
  const handleDeleteFacility = async () => {
    if (!facilityToDelete) return
    setSaving(true)
    
    try {
      const res = await fetch(`/api/organization/facilities/${facilityToDelete.id}`, {
        method: "DELETE",
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete facility")
      }
      
      toast.success("Facility deleted")
      setDeleteDialogOpen(false)
      setFacilityToDelete(null)
      
      if (selectedFacility?.id === facilityToDelete.id) {
        setSelectedFacility(null)
      }
      
      await fetchFacilities()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete facility")
    } finally {
      setSaving(false)
    }
  }

  // Create space
  const handleCreateSpace = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFacility) return
    setSaving(true)
    
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
    }

    try {
      const res = await fetch(`/api/organization/facilities/${selectedFacility.id}/spaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create space")
      }
      
      toast.success("Space created")
      setSpaceFormOpen(false)
      await fetchFacilityDetails(selectedFacility.id)
      await fetchFacilities()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create space")
    } finally {
      setSaving(false)
    }
  }

  // Create equipment
  const handleCreateEquipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFacility) return
    setSaving(true)
    
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      condition: formData.get("condition") as string || "GOOD",
      spaceId: formData.get("spaceId") as string || null,
    }

    try {
      const res = await fetch(`/api/organization/facilities/${selectedFacility.id}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create equipment")
      }
      
      toast.success("Equipment added")
      setEquipmentFormOpen(false)
      await fetchFacilityDetails(selectedFacility.id)
      await fetchFacilities()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create equipment")
    } finally {
      setSaving(false)
    }
  }

  // Delete space
  const handleDeleteSpace = async (spaceId: string) => {
    if (!selectedFacility) return
    
    try {
      const res = await fetch(`/api/organization/facilities/${selectedFacility.id}/spaces/${spaceId}`, {
        method: "DELETE",
      })
      
      if (!res.ok) throw new Error("Failed to delete space")
      
      toast.success("Space deleted")
      await fetchFacilityDetails(selectedFacility.id)
      await fetchFacilities()
    } catch (error) {
      toast.error("Failed to delete space")
    }
  }

  // Delete equipment
  const handleDeleteEquipment = async (equipmentId: string) => {
    try {
      const res = await fetch(`/api/organization/equipment/${equipmentId}`, {
        method: "DELETE",
      })
      
      if (!res.ok) throw new Error("Failed to delete equipment")
      
      toast.success("Equipment deleted")
      if (selectedFacility) {
        await fetchFacilityDetails(selectedFacility.id)
        await fetchFacilities()
      }
    } catch (error) {
      toast.error("Failed to delete equipment")
    }
  }

  const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  const handleOpenAvailability = async (space: Space) => {
    setEditingSpaceAvailability(space)
    if (!selectedFacility) return
    try {
      const res = await fetch(`/api/organization/facilities/${selectedFacility.id}/spaces/${space.id}/availability`)
      if (res.ok) {
        const slots: Array<{ dayOfWeek: number; openTime: string; closeTime: string }> = await res.json()
        const initial: Record<number, { enabled: boolean; openTime: string; closeTime: string }> = {}
        for (let d = 0; d < 7; d++) {
          const existing = slots.find(s => s.dayOfWeek === d)
          initial[d] = existing
            ? { enabled: true, openTime: existing.openTime, closeTime: existing.closeTime }
            : { enabled: false, openTime: "08:00", closeTime: "18:00" }
        }
        setAvailabilitySlots(initial)
      }
    } catch {
      toast.error("Failed to load space availability")
    }
    setAvailabilityDialogOpen(true)
  }

  const handleSaveAvailability = async () => {
    if (!selectedFacility || !editingSpaceAvailability) return
    setSavingAvailability(true)
    try {
      const slots = Object.entries(availabilitySlots)
        .filter(([, v]) => v.enabled)
        .map(([day, v]) => ({
          dayOfWeek: parseInt(day),
          openTime: v.openTime,
          closeTime: v.closeTime,
        }))
      const res = await fetch(
        `/api/organization/facilities/${selectedFacility.id}/spaces/${editingSpaceAvailability.id}/availability`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      toast.success("Availability hours saved")
      setAvailabilityDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save availability")
    } finally {
      setSavingAvailability(false)
    }
  }

  // Filter spaces and equipment by search
  const filteredSpaces = spaces.filter(s => 
    s.name.toLowerCase().includes(spaceSearch.toLowerCase())
  )

  const filteredEquipment = equipment.filter(e => 
    e.name.toLowerCase().includes(equipmentSearch.toLowerCase())
  )

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "OPEN":
        return "outline"
      case "MAINTENANCE":
        return "secondary"
      default:
        return "destructive"
    }
  }

  const getConditionIcon = (condition: string) => {
    if (condition === "EXCELLENT" || condition === "GOOD") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    } else if (condition === "FAIR") {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else {
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facilities</h1>
          <p className="text-muted-foreground">
            Manage your locations, spaces, and equipment inventory.
          </p>
        </div>
        <Sheet open={facilityFormOpen} onOpenChange={setFacilityFormOpen}>
          <SheetTrigger asChild>
            <Button onClick={() => openFacilityForm(null)}>
              <Plus className="mr-2 h-4 w-4" /> Add Facility
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <form onSubmit={handleSaveFacility}>
              <SheetHeader>
                <SheetTitle>{editingFacility ? "Edit Facility" : "Add New Facility"}</SheetTitle>
                <SheetDescription>
                  {editingFacility ? "Update facility details." : "Add a new location for your organization."}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Facility Name *</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    defaultValue={editingFacility?.name || ""} 
                    placeholder="e.g. Main Gym" 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input 
                    id="street" 
                    name="street" 
                    defaultValue={editingFacility?.street || ""} 
                    placeholder="123 Main St" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                      id="city" 
                      name="city" 
                      defaultValue={editingFacility?.city || ""} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stateProvince">State/Province</Label>
                    <Input 
                      id="stateProvince" 
                      name="stateProvince" 
                      defaultValue={editingFacility?.stateProvince || ""} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input 
                      id="postalCode" 
                      name="postalCode" 
                      defaultValue={editingFacility?.postalCode || ""} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Input 
                      id="country" 
                      name="country" 
                      defaultValue={editingFacility?.country || ""} 
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      defaultValue={editingFacility?.phone || ""} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email"
                      defaultValue={editingFacility?.email || ""} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="squareFootage">Square Footage</Label>
                    <Input 
                      id="squareFootage" 
                      name="squareFootage" 
                      type="number"
                      defaultValue={editingFacility?.squareFootage || ""} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxCapacity">Max Capacity</Label>
                    <Input 
                      id="maxCapacity" 
                      name="maxCapacity" 
                      type="number"
                      defaultValue={editingFacility?.maxCapacity || ""} 
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    defaultValue={editingFacility?.description || ""} 
                    rows={3}
                  />
                </div>
                <Separator />
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-semibold">Operating Hours</Label>
                  </div>
                  <p className="text-sm text-muted-foreground -mt-1">
                    Set when this facility is open each day. Add multiple blocks per day for break periods.
                  </p>
                  {DAY_LABELS.map((label, dayIndex) => {
                    const blocks = operatingHours[dayIndex] ?? []
                    const isOpen = blocks.length > 0
                    return (
                      <div key={dayIndex} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-24 flex items-center gap-2">
                            <Switch
                              checked={isOpen}
                              onCheckedChange={(checked) => {
                                setOperatingHours(prev => ({
                                  ...prev,
                                  [dayIndex]: checked
                                    ? [{ openTime: "09:00", closeTime: "17:00" }]
                                    : [],
                                }))
                              }}
                            />
                            <span className="text-sm font-medium">{label.slice(0, 3)}</span>
                          </div>
                          {isOpen ? (
                            <div className="flex-1 space-y-2">
                              {blocks.map((block, blockIdx) => (
                                <div key={blockIdx} className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={block.openTime}
                                    onChange={(e) => {
                                      setOperatingHours(prev => {
                                        const updated = [...prev[dayIndex]]
                                        updated[blockIdx] = { ...updated[blockIdx], openTime: e.target.value }
                                        return { ...prev, [dayIndex]: updated }
                                      })
                                    }}
                                    className="w-[120px]"
                                  />
                                  <span className="text-muted-foreground text-sm">to</span>
                                  <Input
                                    type="time"
                                    value={block.closeTime}
                                    onChange={(e) => {
                                      setOperatingHours(prev => {
                                        const updated = [...prev[dayIndex]]
                                        updated[blockIdx] = { ...updated[blockIdx], closeTime: e.target.value }
                                        return { ...prev, [dayIndex]: updated }
                                      })
                                    }}
                                    className="w-[120px]"
                                  />
                                  {blocks.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0"
                                      onClick={() => {
                                        setOperatingHours(prev => ({
                                          ...prev,
                                          [dayIndex]: prev[dayIndex].filter((_, i) => i !== blockIdx),
                                        }))
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setOperatingHours(prev => ({
                                    ...prev,
                                    [dayIndex]: [
                                      ...prev[dayIndex],
                                      { openTime: "09:00", closeTime: "17:00" },
                                    ],
                                  }))
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" /> Add hours
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Closed</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <SheetFooter>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingFacility ? "Save Changes" : "Create Facility"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Facility List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {facilities.map((facility) => (
          <Card 
            key={facility.id} 
            className={`cursor-pointer transition-colors hover:bg-accent/50 ${
              selectedFacility?.id === facility.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedFacility(facility)}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium line-clamp-1">
                  {facility.name}
                </CardTitle>
              </div>
              <div className="flex items-center gap-1">
                {facility.isDefault && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      openFacilityForm(facility)
                    }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFacilityToDelete(facility)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                {facility.city && facility.stateProvince && (
                  <>
                    <MapPin className="h-3 w-3" />
                    <span>{facility.city}, {facility.stateProvince}</span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <Badge variant={getStatusBadgeVariant(facility.status)}>
                  {facility.status}
                </Badge>
                <span className="text-muted-foreground">
                  {facility._count.spaces} spaces • {facility._count.equipment} equipment
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {facilities.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No facilities yet. Add your first facility to get started.
              </p>
              <Button className="mt-4" onClick={() => setFacilityFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Facility
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected Facility Details */}
      {selectedFacility && (
        <>
          <Separator className="my-2" />
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="h-4 w-4" />
            <span className="font-medium text-foreground">{selectedFacility.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>Details</span>
          </div>

          <Tabs value={facilityTab} onValueChange={setFacilityTab} className="space-y-4">
            <ResponsiveTabsList value={facilityTab} onValueChange={setFacilityTab}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="spaces">Spaces ({spaces.length})</TabsTrigger>
              <TabsTrigger value="equipment">Equipment ({equipment.length})</TabsTrigger>
            </ResponsiveTabsList>

            <TabsContent value="overview" className="space-y-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                  <Card className="col-span-4">
                    <CardHeader>
                      <CardTitle>General Information</CardTitle>
                      <CardDescription>
                        Facility details and contact information.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {[
                              selectedFacility.street,
                              selectedFacility.city,
                              selectedFacility.stateProvince,
                              selectedFacility.postalCode,
                              selectedFacility.country
                            ].filter(Boolean).join(", ") || "No address set"}
                          </span>
                        </div>
                        {selectedFacility.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedFacility.phone}</span>
                          </div>
                        )}
                        {selectedFacility.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedFacility.email}</span>
                          </div>
                        )}
                      </div>
                      {selectedFacility.description && (
                        <>
                          <Separator />
                          <p className="text-sm text-muted-foreground">
                            {selectedFacility.description}
                          </p>
                        </>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => openFacilityForm(selectedFacility)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit Details
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <Card className="col-span-3">
                    <CardHeader>
                      <CardTitle>Facility Stats</CardTitle>
                      <CardDescription>
                        Current status and quick stats.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant={getStatusBadgeVariant(selectedFacility.status)}>
                          {selectedFacility.status}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-2xl font-bold">
                            {selectedFacility.squareFootage?.toLocaleString() || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">Square Footage</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-2xl font-bold">
                            {selectedFacility.maxCapacity || "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">Max Capacity</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-2xl font-bold">{spaces.length}</span>
                          <span className="text-xs text-muted-foreground">Spaces</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-2xl font-bold">{equipment.length}</span>
                          <span className="text-xs text-muted-foreground">Equipment Items</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="spaces" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search spaces..." 
                    className="w-[150px] lg:w-[250px]" 
                    value={spaceSearch}
                    onChange={(e) => setSpaceSearch(e.target.value)}
                  />
                </div>
                <Sheet open={spaceFormOpen} onOpenChange={setSpaceFormOpen}>
                  <SheetTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add Space
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <form onSubmit={handleCreateSpace}>
                      <SheetHeader>
                        <SheetTitle>Add New Space</SheetTitle>
                        <SheetDescription>Define a new space in this facility.</SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="space-name">Space Name *</Label>
                          <Input id="space-name" name="name" placeholder="e.g. Balance Beam Area" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="capacity">Max Capacity</Label>
                          <Input id="capacity" name="capacity" type="number" placeholder="20" />
                        </div>
                      </div>
                      <SheetFooter>
                        <Button type="submit" disabled={saving}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Space
                        </Button>
                      </SheetFooter>
                    </form>
                  </SheetContent>
                </Sheet>
              </div>
              
              {loadingDetail ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSpaces.map((space) => (
                    <Card key={space.id}>
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          {space.name}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          <Badge variant={getStatusBadgeVariant(space.status)}>
                            {space.status}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteSpace(space.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {space.capacity ? `Max Capacity: ${space.capacity} students` : "No capacity set"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {space._count.equipment} equipment items
                        </p>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleOpenAvailability(space)}
                        >
                          <Clock className="mr-2 h-3.5 w-3.5" />
                          Availability Hours
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  
                  {filteredSpaces.length === 0 && (
                    <Card className="col-span-full">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-center">
                          {spaceSearch ? "No spaces match your search." : "No spaces yet."}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="equipment" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search equipment..." 
                    className="w-[150px] lg:w-[250px]" 
                    value={equipmentSearch}
                    onChange={(e) => setEquipmentSearch(e.target.value)}
                  />
                </div>
                <Sheet open={equipmentFormOpen} onOpenChange={setEquipmentFormOpen}>
                  <SheetTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add Equipment
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <form onSubmit={handleCreateEquipment}>
                      <SheetHeader>
                        <SheetTitle>Add Equipment</SheetTitle>
                        <SheetDescription>Register a new piece of equipment.</SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="equip-name">Name/ID *</Label>
                          <Input id="equip-name" name="name" placeholder="e.g. Beam #3" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="equip-condition">Condition</Label>
                          <Select name="condition" defaultValue="GOOD">
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXCELLENT">Excellent</SelectItem>
                              <SelectItem value="GOOD">Good</SelectItem>
                              <SelectItem value="FAIR">Fair</SelectItem>
                              <SelectItem value="POOR">Poor</SelectItem>
                              <SelectItem value="UNSAFE">Unsafe / Out of Order</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {spaces.length > 0 && (
                          <div className="grid gap-2">
                            <Label htmlFor="equip-space">Assign to Space</Label>
                            <Select name="spaceId">
                              <SelectTrigger>
                                <SelectValue placeholder="Select space (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {spaces.map((space) => (
                                  <SelectItem key={space.id} value={space.id}>
                                    {space.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <SheetFooter>
                        <Button type="submit" disabled={saving}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Equipment
                        </Button>
                      </SheetFooter>
                    </form>
                  </SheetContent>
                </Sheet>
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEquipment.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Name</TableHead>
                        <TableHead>Space</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Last Inspection</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEquipment.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.space?.name || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getConditionIcon(item.condition)}
                              <span>{item.condition}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.lastInspectionDate 
                              ? new Date(item.lastInspectionDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Log Inspection</DropdownMenuItem>
                                <DropdownMenuItem>Report Issue</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleDeleteEquipment(item.id)}
                                >
                                  Delete Equipment
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      {equipmentSearch ? "No equipment matches your search." : "No equipment registered yet."}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Facility</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{facilityToDelete?.name}&quot;? 
              This will also delete all spaces and equipment associated with this facility.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFacility} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Space Availability Dialog */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Availability Hours &mdash; {editingSpaceAvailability?.name}
            </DialogTitle>
            <DialogDescription>
              Set the weekly operating hours for this space. Programs can only be scheduled within these windows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
            {DAY_LABELS.map((label, dayIndex) => {
              const slot = availabilitySlots[dayIndex]
              if (!slot) return null
              return (
                <div key={dayIndex} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-2">
                    <Switch
                      checked={slot.enabled}
                      onCheckedChange={(checked) =>
                        setAvailabilitySlots(prev => ({
                          ...prev,
                          [dayIndex]: { ...prev[dayIndex], enabled: checked },
                        }))
                      }
                    />
                    <span className="text-sm font-medium">{label.slice(0, 3)}</span>
                  </div>
                  {slot.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={slot.openTime}
                        onChange={(e) =>
                          setAvailabilitySlots(prev => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], openTime: e.target.value },
                          }))
                        }
                        className="w-[120px]"
                      />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input
                        type="time"
                        value={slot.closeTime}
                        onChange={(e) =>
                          setAvailabilitySlots(prev => ({
                            ...prev,
                            [dayIndex]: { ...prev[dayIndex], closeTime: e.target.value },
                          }))
                        }
                        className="w-[120px]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAvailability} disabled={savingAvailability}>
              {savingAvailability && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Hours
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
