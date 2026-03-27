"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  Plus,
  MapPin,
  Building,
  Star,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import { COUNTRIES, getRegionsForCountry } from "@/lib/location-data"
import { DashboardPageHeader } from "@/components/dashboard-page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StateProvinceCombobox } from "@/components/ui/state-province-combobox"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
import { MultiLocationMap } from "@/components/location-map"
import type { FacilityListItem } from "@/types/locations"

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "outline" as const
    case "MAINTENANCE":
      return "secondary" as const
    default:
      return "destructive" as const
  }
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [facilityToDelete, setFacilityToDelete] = useState<FacilityListItem | null>(null)

  const [country, setCountry] = useState("US")
  const [stateProvince, setStateProvince] = useState("")
  const [phone, setPhone] = useState("")
  const [status, setStatus] = useState("ACTIVE")
  const [isDefault, setIsDefault] = useState(false)

  const fetchFacilities = useCallback(async () => {
    try {
      const res = await fetch("/api/organization/facilities")
      if (!res.ok) throw new Error("Failed to fetch facilities")
      setFacilities(await res.json())
    } catch {
      toast.error("Failed to load facilities")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFacilities()
  }, [fetchFacilities])

  const openCreateForm = () => {
    setCountry("US")
    setStateProvince("")
    setPhone("")
    setStatus("ACTIVE")
    setIsDefault(false)
    setFormOpen(true)
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name") as string,
      street: (formData.get("street") as string) || null,
      city: (formData.get("city") as string) || null,
      stateProvince: stateProvince || null,
      postalCode: (formData.get("postalCode") as string) || null,
      country: country || null,
      phone: phone || null,
      email: (formData.get("email") as string) || null,
      squareFootage: formData.get("squareFootage") ? Number(formData.get("squareFootage")) : null,
      maxCapacity: formData.get("maxCapacity") ? Number(formData.get("maxCapacity")) : null,
      description: (formData.get("description") as string) || null,
      status,
      isDefault,
    }

    try {
      const res = await fetch("/api/organization/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create facility")
      }

      toast.success("Facility created")
      setFormOpen(false)
      await fetchFacilities()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create facility")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!facilityToDelete) return
    setSaving(true)
    try {
      const res = await fetch(`/api/organization/facilities/${facilityToDelete.id}`, { method: "DELETE" })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete facility")
      }
      toast.success("Facility deleted")
      setDeleteDialogOpen(false)
      setFacilityToDelete(null)
      await fetchFacilities()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete facility")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const mappable = facilities.filter((f) => f.latitude != null && f.longitude != null)

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Facilities"
        description="Manage your organization's locations and facilities."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" /> Add Facility
          </Button>
        }
      />

      {mappable.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <MultiLocationMap
              className="h-64 min-h-0 rounded-lg"
              locations={mappable.map((f) => ({
                latitude: f.latitude!,
                longitude: f.longitude!,
                label: f.name,
                sublabel: [f.city, f.stateProvince].filter(Boolean).join(", "),
              }))}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {facilities.map((facility) => (
          <Link key={facility.id} href={`/dashboard/organization/facilities/${facility.id}`}>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50 h-full">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium line-clamp-1">{facility.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {facility.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.preventDefault()
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
                      <span>
                        {facility.city},{" "}
                        {getRegionsForCountry(facility.country || "").find((r) => r.code === facility.stateProvince)?.name ?? facility.stateProvince}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Badge variant={getStatusBadgeVariant(facility.status)}>{facility.status}</Badge>
                  <span className="text-muted-foreground">
                    {facility._count.spaces} spaces &bull; {facility._count.equipment} equipment
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {facilities.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">No facilities yet. Add your first facility to get started.</p>
              <Button className="mt-4" onClick={openCreateForm}>
                <Plus className="mr-2 h-4 w-4" /> Add Facility
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Facility Sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="overflow-y-auto">
          <form onSubmit={handleCreate}>
            <SheetHeader>
              <SheetTitle>Add New Facility</SheetTitle>
              <SheetDescription>Add a new location for your organization.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Facility Name *</Label>
                <Input id="name" name="name" placeholder="e.g. Main Gym" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="street">Street Address</Label>
                <Input id="street" name="street" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="grid gap-2">
                  <Label>{country === "CA" ? "Province" : country === "US" ? "State" : "State / Province"}</Label>
                  <StateProvinceCombobox country={country} value={stateProvince} onChange={setStateProvince} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">{country === "CA" ? "Postal Code" : country === "US" ? "ZIP Code" : "Postal Code"}</Label>
                  <Input id="postalCode" name="postalCode" placeholder={country === "CA" ? "A1A 1A1" : country === "US" ? "12345" : ""} />
                </div>
                <div className="grid gap-2">
                  <Label>Country</Label>
                  <Select value={country} onValueChange={(v) => { setCountry(v); if (country !== v) setStateProvince("") }}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <PhoneInput defaultCountry="US" value={phone} onChange={(v) => setPhone(v || "")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="squareFootage">Square Footage</Label>
                  <Input id="squareFootage" name="squareFootage" type="number" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxCapacity">Max Capacity</Label>
                  <Input id="maxCapacity" name="maxCapacity" type="number" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Default Facility</Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                    <span className="text-sm text-muted-foreground">{isDefault ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Facility
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Facility</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{facilityToDelete?.name}&quot;? This will also delete all spaces and equipment associated with this facility. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
