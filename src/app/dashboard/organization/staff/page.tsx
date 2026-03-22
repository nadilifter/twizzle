"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MoreHorizontal, 
  Filter,
  Loader2,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { formatPhoneNumberIntl } from "react-phone-number-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useStaff } from "@/hooks/use-staff"
import { api } from "@/lib/api-client"
import type { 
  MemberWithUser, 
  EmploymentType, 
  Certification,
  CreateMemberPayload,
  UpdateMemberPayload 
} from "@/types/staff"

// Common certifications
const CERTIFICATIONS = [
  { id: "usag-safety", name: "USAG Safety Certification" },
  { id: "cpr-first-aid", name: "CPR / First Aid" },
  { id: "safesport", name: "SafeSport Trained" },
  { id: "background-check", name: "Background Check Cleared" },
]

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACTOR: "Contractor",
  VOLUNTEER: "Volunteer",
}

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function StaffPage() {
  const { staff, isLoading, isCreating, isUpdating, isDeleting, error, fetchStaff, createStaff, updateStaff, deleteStaff, clearError } = useStaff()
  const [searchQuery, setSearchQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<MemberWithUser | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<MemberWithUser | null>(null)
  
  // Available users (users in org without staff profiles)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Form state
  const [formUserId, setFormUserId] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formEmploymentType, setFormEmploymentType] = useState<EmploymentType>("FULL_TIME")
  const [formPhone, setFormPhone] = useState("")
  const [formHourlyRate, setFormHourlyRate] = useState("")
  const [formCertifications, setFormCertifications] = useState<string[]>([])

  // Fetch available users when sheet opens
  useEffect(() => {
    if (sheetOpen && !editingStaff) {
      fetchAvailableUsers()
    }
  }, [sheetOpen, editingStaff])

  const fetchAvailableUsers = async () => {
    setLoadingUsers(true)
    try {
      const users = await api.get<User[]>("/api/users")
      // Filter out users who already have staff profiles
      const staffUserIds = new Set(staff.map(s => s.userId))
      setAvailableUsers(users.filter(u => !staffUserIds.has(u.id)))
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const filteredStaff = staff.filter(person => 
    person.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (person.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    person.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const resetForm = () => {
    setFormUserId("")
    setFormTitle("")
    setFormEmploymentType("FULL_TIME")
    setFormPhone("")
    setFormHourlyRate("")
    setFormCertifications([])
    setEditingStaff(null)
  }

  const openEditSheet = (staffMember: MemberWithUser) => {
    setEditingStaff(staffMember)
    setFormTitle(staffMember.title || "")
    setFormEmploymentType(staffMember.employmentType)
    setFormPhone(staffMember.phone || "")
    setFormHourlyRate(staffMember.hourlyRate?.toString() || "")
    setFormCertifications(
      staffMember.certifications?.map((c: Certification) => c.name) || []
    )
    setSheetOpen(true)
  }

  const handleSubmit = async () => {
    if (editingStaff) {
      // Update existing staff
      const data: UpdateMemberPayload = {
        title: formTitle || null,
        employmentType: formEmploymentType,
        phone: formPhone || null,
        hourlyRate: formHourlyRate ? parseFloat(formHourlyRate) : null,
        certifications: formCertifications.map(name => ({ name, verified: true })),
      }
      const result = await updateStaff(editingStaff.id, data)
      if (result) {
        setSheetOpen(false)
        resetForm()
      }
    } else {
      // Create new staff
      if (!formUserId) return
      const data: CreateMemberPayload = {
        userId: formUserId,
        title: formTitle || null,
        employmentType: formEmploymentType,
        phone: formPhone || null,
        hourlyRate: formHourlyRate ? parseFloat(formHourlyRate) : null,
        certifications: formCertifications.map(name => ({ name, verified: true })),
      }
      const result = await createStaff(data)
      if (result) {
        setSheetOpen(false)
        resetForm()
      }
    }
  }

  const handleDelete = async () => {
    if (!staffToDelete) return
    const success = await deleteStaff(staffToDelete.id)
    if (success) {
      setDeleteConfirmOpen(false)
      setStaffToDelete(null)
    }
  }

  const toggleCertification = (certName: string) => {
    setFormCertifications(prev => 
      prev.includes(certName)
        ? prev.filter(c => c !== certName)
        : [...prev, certName]
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground">
            Manage your coaches, administrators, and support staff.
          </p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) resetForm()
        }}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</SheetTitle>
              <SheetDescription>
                {editingStaff 
                  ? "Update staff profile details."
                  : "Create a staff profile for an existing user."
                }
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              {!editingStaff && (
                <div className="grid gap-2">
                  <Label htmlFor="user">Select User</Label>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  ) : availableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      All users already have staff profiles.
                    </p>
                  ) : (
                    <Select value={formUserId} onValueChange={setFormUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="title">Job Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Head Coach, Front Desk" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employmentType">Employment Type</Label>
                <Select value={formEmploymentType} onValueChange={(v) => setFormEmploymentType(v as EmploymentType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full-time</SelectItem>
                    <SelectItem value="PART_TIME">Part-time</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <PhoneInput
                  id="phone"
                  defaultCountry="US"
                  value={formPhone}
                  onChange={(value) => setFormPhone(value || "")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input 
                  id="hourlyRate" 
                  type="number"
                  step="0.01"
                  placeholder="0.00" 
                  value={formHourlyRate}
                  onChange={(e) => setFormHourlyRate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Certifications</Label>
                <div className="flex flex-col gap-2">
                  {CERTIFICATIONS.map((cert) => (
                    <div key={cert.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={cert.id} 
                        checked={formCertifications.includes(cert.name)}
                        onCheckedChange={() => toggleCertification(cert.name)}
                      />
                      <Label htmlFor={cert.id}>{cert.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button 
                onClick={handleSubmit}
                disabled={(!editingStaff && !formUserId) || isCreating || isUpdating}
              >
                {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingStaff ? "Save Changes" : "Create Staff Profile"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button variant="ghost" size="sm" onClick={clearError} className="ml-auto">
            Dismiss
          </Button>
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, title, or email..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Certifications</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="text-muted-foreground mt-2">Loading staff...</p>
                </TableCell>
              </TableRow>
            ) : filteredStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No staff found matching your search." : "No staff members yet."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredStaff.map((person) => {
                const certifications = (person.certifications as Certification[]) || []
                return (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={person.user.avatar || undefined} alt={person.user.name} />
                          <AvatarFallback>{getInitials(person.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{person.user.name}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{person.title || "Staff"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{person.title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={person.employmentType === "FULL_TIME" ? "default" : "secondary"}>
                        {EMPLOYMENT_TYPE_LABELS[person.employmentType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {person.user.email}
                        </div>
                        {person.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {formatPhoneNumberIntl(person.phone) || person.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {certifications.length > 0 ? (
                          certifications.map((cert) => (
                            <Badge key={cert.name} variant="outline" className="text-xs font-normal">
                              {cert.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
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
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEditSheet(person)}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Manage Schedule</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => {
                              setStaffToDelete(person)
                              setDeleteConfirmOpen(true)
                            }}
                          >
                            Remove Staff Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the staff profile for {staffToDelete?.user.name}. 
              The user account will remain but they will no longer have a staff profile.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
