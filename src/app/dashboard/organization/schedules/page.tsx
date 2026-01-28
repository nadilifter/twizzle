"use client"

import { useState, useEffect } from "react"
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { useStaff, useStaffAvailability } from "@/hooks/use-staff"
import { useShifts } from "@/hooks/use-shifts"
import { api } from "@/lib/api-client"
import type { 
  ShiftWithRelations, 
  ShiftStatus, 
  StaffProfileWithUser,
  AvailabilityEntry 
} from "@/types/staff"

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const SHIFT_STATUS_COLORS: Record<ShiftStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-orange-100 text-orange-800",
}

interface Facility {
  id: string
  name: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState("assignments")
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table")
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek // Start on Sunday
    return new Date(today.setDate(diff))
  })
  
  // Staff and Shifts data
  const { staff, isLoading: loadingStaff } = useStaff()
  const { 
    shifts, 
    isLoading: loadingShifts, 
    isCreating, 
    isUpdating, 
    isDeleting,
    error: shiftsError,
    createShift, 
    updateShift, 
    deleteShift,
    refresh: refreshShifts,
    clearError 
  } = useShifts()
  
  // Facilities
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loadingFacilities, setLoadingFacilities] = useState(false)
  
  // Shift form state
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftWithRelations | null>(null)
  const [formStaffId, setFormStaffId] = useState("")
  const [formFacilityId, setFormFacilityId] = useState("")
  const [formDate, setFormDate] = useState("")
  const [formStartTime, setFormStartTime] = useState("09:00")
  const [formEndTime, setFormEndTime] = useState("17:00")
  const [formShiftType, setFormShiftType] = useState("")
  const [formNotes, setFormNotes] = useState("")
  
  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<ShiftWithRelations | null>(null)
  
  // Availability editing
  const [editingAvailabilityStaff, setEditingAvailabilityStaff] = useState<StaffProfileWithUser | null>(null)
  const [availabilitySheetOpen, setAvailabilitySheetOpen] = useState(false)

  // Fetch facilities
  useEffect(() => {
    fetchFacilities()
  }, [])

  const fetchFacilities = async () => {
    setLoadingFacilities(true)
    try {
      const data = await api.get<Facility[]>("/api/organization/facilities")
      setFacilities(data)
    } catch (err) {
      console.error("Failed to fetch facilities:", err)
    } finally {
      setLoadingFacilities(false)
    }
  }

  const resetShiftForm = () => {
    setFormStaffId("")
    setFormFacilityId("")
    setFormDate("")
    setFormStartTime("09:00")
    setFormEndTime("17:00")
    setFormShiftType("")
    setFormNotes("")
    setEditingShift(null)
  }

  const openEditShift = (shift: ShiftWithRelations) => {
    setEditingShift(shift)
    setFormStaffId(shift.staffProfileId)
    setFormFacilityId(shift.facilityId || "")
    setFormDate(new Date(shift.date).toISOString().split("T")[0])
    setFormStartTime(shift.startTime)
    setFormEndTime(shift.endTime)
    setFormShiftType(shift.shiftType)
    setFormNotes(shift.notes || "")
    setShiftSheetOpen(true)
  }

  const handleSubmitShift = async () => {
    if (!formStaffId || !formDate || !formShiftType) return

    if (editingShift) {
      const result = await updateShift(editingShift.id, {
        staffProfileId: formStaffId,
        facilityId: formFacilityId || null,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        shiftType: formShiftType,
        notes: formNotes || null,
      })
      if (result) {
        setShiftSheetOpen(false)
        resetShiftForm()
      }
    } else {
      const result = await createShift({
        staffProfileId: formStaffId,
        facilityId: formFacilityId || null,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        shiftType: formShiftType,
        notes: formNotes || null,
      })
      if (result) {
        setShiftSheetOpen(false)
        resetShiftForm()
      }
    }
  }

  const handleDeleteShift = async () => {
    if (!shiftToDelete) return
    const success = await deleteShift(shiftToDelete.id)
    if (success) {
      setDeleteConfirmOpen(false)
      setShiftToDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules & Availability</h1>
          <p className="text-muted-foreground">
            Manage employee shifts, facility usage, and role assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={viewMode === "table" ? "outline" : "default"}
            size="sm"
            onClick={() => setViewMode(viewMode === "table" ? "calendar" : "table")}
          >
            {viewMode === "table" ? (
              <>
                <CalendarIcon className="mr-2 h-4 w-4" />
                Calendar View
              </>
            ) : (
              <>
                <List className="mr-2 h-4 w-4" />
                List View
              </>
            )}
          </Button>
        </div>
      </div>

      {shiftsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{shiftsError}</AlertDescription>
          <Button variant="ghost" size="sm" onClick={clearError} className="ml-auto">
            Dismiss
          </Button>
        </Alert>
      )}

      <Tabs defaultValue="assignments" className="space-y-4" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assignments">Shifts & Assignments</TabsTrigger>
          <TabsTrigger value="employee-availability">Employee Availability</TabsTrigger>
          <TabsTrigger value="facility-availability">Facility Usage</TabsTrigger>
        </TabsList>

        {/* Shifts & Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search shifts..." className="w-[250px]" />
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            <Sheet open={shiftSheetOpen} onOpenChange={(open) => {
              setShiftSheetOpen(open)
              if (!open) resetShiftForm()
            }}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create Shift
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>{editingShift ? "Edit Shift" : "Create New Shift"}</SheetTitle>
                  <SheetDescription>Assign an employee to a specific role and time.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="staff">Employee</Label>
                    <Select value={formStaffId} onValueChange={setFormStaffId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shiftType">Shift Type / Role</Label>
                    <Input 
                      id="shiftType" 
                      placeholder="e.g. Opening Manager, Coach, Front Desk"
                      value={formShiftType}
                      onChange={(e) => setFormShiftType(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start-time">Start Time</Label>
                      <Input 
                        id="start-time" 
                        type="time" 
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="end-time">End Time</Label>
                      <Input 
                        id="end-time" 
                        type="time" 
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="facility">Location (Optional)</Label>
                    <Select value={formFacilityId || "none"} onValueChange={(v) => setFormFacilityId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific location</SelectItem>
                        {facilities.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input 
                      id="notes" 
                      placeholder="Optional notes..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>
                </div>
                <SheetFooter>
                  <Button 
                    onClick={handleSubmitShift}
                    disabled={!formStaffId || !formDate || !formShiftType || isCreating || isUpdating}
                  >
                    {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingShift ? "Save Changes" : "Create Shift"}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {viewMode === "table" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingShifts ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <p className="text-muted-foreground mt-2">Loading shifts...</p>
                      </TableCell>
                    </TableRow>
                  ) : shifts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-muted-foreground">No shifts scheduled.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    shifts.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">
                          {formatDate(shift.date)}
                        </TableCell>
                        <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{shift.shiftType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={shift.staffProfile.user.avatar || undefined} />
                              <AvatarFallback>{getInitials(shift.staffProfile.user.name)}</AvatarFallback>
                            </Avatar>
                            <span>{shift.staffProfile.user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{shift.facility?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge className={SHIFT_STATUS_COLORS[shift.status]}>
                            {shift.status.replace("_", " ")}
                          </Badge>
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
                              <DropdownMenuItem onClick={() => openEditShift(shift)}>
                                Edit Shift
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateShift(shift.id, { status: "CONFIRMED" })}>
                                Mark Confirmed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateShift(shift.id, { status: "COMPLETED" })}>
                                Mark Completed
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => {
                                  setShiftToDelete(shift)
                                  setDeleteConfirmOpen(true)
                                }}
                              >
                                Delete Shift
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <WeeklyCalendarView 
              shifts={shifts}
              currentWeekStart={currentWeekStart}
              onWeekChange={setCurrentWeekStart}
              onEditShift={openEditShift}
              onDeleteShift={(shift) => {
                setShiftToDelete(shift)
                setDeleteConfirmOpen(true)
              }}
              isLoading={loadingShifts}
            />
          )}
        </TabsContent>

        {/* Employee Availability Tab */}
        <TabsContent value="employee-availability" className="space-y-4">
          {loadingStaff ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="ml-2 text-muted-foreground">Loading staff...</p>
            </div>
          ) : staff.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No staff members found. Add staff first.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {staff.map((staffMember) => (
                <StaffAvailabilityCard 
                  key={staffMember.id} 
                  staffMember={staffMember}
                  onEdit={() => {
                    setEditingAvailabilityStaff(staffMember)
                    setAvailabilitySheetOpen(true)
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Availability Edit Sheet */}
          <AvailabilityEditSheet
            staffMember={editingAvailabilityStaff}
            open={availabilitySheetOpen}
            onOpenChange={(open) => {
              setAvailabilitySheetOpen(open)
              if (!open) setEditingAvailabilityStaff(null)
            }}
          />
        </TabsContent>

        {/* Facility Usage Tab */}
        <TabsContent value="facility-availability" className="space-y-4">
          {loadingFacilities ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="ml-2 text-muted-foreground">Loading facilities...</p>
            </div>
          ) : facilities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No facilities found. Add facilities first.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {facilities.map((facility) => (
                <FacilityUsageCard 
                  key={facility.id} 
                  facility={facility}
                  shifts={shifts.filter(s => s.facilityId === facility.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this shift assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteShift}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Staff Availability Card Component
function StaffAvailabilityCard({ 
  staffMember, 
  onEdit 
}: { 
  staffMember: StaffProfileWithUser
  onEdit: () => void 
}) {
  const { availability, isLoading } = useStaffAvailability(staffMember.id)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <Avatar className="h-12 w-12">
          <AvatarImage src={staffMember.user.avatar || undefined} />
          <AvatarFallback>{getInitials(staffMember.user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle className="text-base">{staffMember.user.name}</CardTitle>
          <CardDescription>{staffMember.title || "Staff"}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium">Weekly Availability</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {DAYS_OF_WEEK.map((day, index) => {
                const dayAvail = availability.find(a => a.dayOfWeek === index)
                const isAvailable = dayAvail?.isAvailable ?? false
                return (
                  <div key={day} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      isAvailable ? "bg-green-500" : "bg-red-500"
                    }`} />
                    <span>
                      {day.slice(0, 3)}: {dayAvail 
                        ? `${dayAvail.startTime}-${dayAvail.endTime}` 
                        : "Unavailable"
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onEdit}>
          Edit Availability
        </Button>
      </CardFooter>
    </Card>
  )
}

// Availability Edit Sheet Component
function AvailabilityEditSheet({
  staffMember,
  open,
  onOpenChange,
}: {
  staffMember: StaffProfileWithUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { availability, saveAvailability, isSaving } = useStaffAvailability(staffMember?.id || null)
  const [formAvailability, setFormAvailability] = useState<AvailabilityEntry[]>([])

  useEffect(() => {
    if (open && availability) {
      // Initialize form with existing availability or defaults
      const entries = DAYS_OF_WEEK.map((_, index) => {
        const existing = availability.find(a => a.dayOfWeek === index)
        return {
          dayOfWeek: index,
          startTime: existing?.startTime || "09:00",
          endTime: existing?.endTime || "17:00",
          isAvailable: existing?.isAvailable ?? (index !== 0 && index !== 6), // Default weekdays available
        }
      })
      setFormAvailability(entries)
    }
  }, [open, availability])

  const toggleDay = (dayIndex: number) => {
    setFormAvailability(prev => 
      prev.map(entry => 
        entry.dayOfWeek === dayIndex 
          ? { ...entry, isAvailable: !entry.isAvailable }
          : entry
      )
    )
  }

  const updateTime = (dayIndex: number, field: "startTime" | "endTime", value: string) => {
    setFormAvailability(prev =>
      prev.map(entry =>
        entry.dayOfWeek === dayIndex
          ? { ...entry, [field]: value }
          : entry
      )
    )
  }

  const handleSave = async () => {
    // Only save available days
    const toSave = formAvailability.filter(e => e.isAvailable)
    const success = await saveAvailability(toSave)
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Availability - {staffMember?.user.name}</SheetTitle>
          <SheetDescription>Set standard weekly availability.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {DAYS_OF_WEEK.map((day, index) => {
            const entry = formAvailability.find(e => e.dayOfWeek === index)
            return (
              <div key={day} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id={`avail-${day}`} 
                    checked={entry?.isAvailable ?? false}
                    onCheckedChange={() => toggleDay(index)}
                  />
                  <Label htmlFor={`avail-${day}`}>{day}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="time" 
                    className="w-24 h-8" 
                    value={entry?.startTime || "09:00"}
                    onChange={(e) => updateTime(index, "startTime", e.target.value)}
                    disabled={!entry?.isAvailable}
                  />
                  <span>-</span>
                  <Input 
                    type="time" 
                    className="w-24 h-8" 
                    value={entry?.endTime || "17:00"}
                    onChange={(e) => updateTime(index, "endTime", e.target.value)}
                    disabled={!entry?.isAvailable}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <SheetFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Facility Usage Card Component
function FacilityUsageCard({ 
  facility, 
  shifts 
}: { 
  facility: Facility
  shifts: ShiftWithRelations[] 
}) {
  // Group shifts by day for today's view
  const today = new Date().toISOString().split("T")[0]
  const todayShifts = shifts.filter(s => s.date.startsWith(today))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{facility.name}</CardTitle>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {todayShifts.length} shifts today
          </Badge>
        </div>
        <CardDescription>Scheduled shifts and usage.</CardDescription>
      </CardHeader>
      <CardContent>
        {todayShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shifts scheduled for today.</p>
        ) : (
          <div className="space-y-2">
            {todayShifts.map((shift) => (
              <div 
                key={shift.id} 
                className="flex items-center justify-between p-2 rounded-md bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{getInitials(shift.staffProfile.user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{shift.staffProfile.user.name}</span>
                  <Badge variant="outline" className="text-xs">{shift.shiftType}</Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {shift.startTime} - {shift.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Weekly Calendar View Component
function WeeklyCalendarView({
  shifts,
  currentWeekStart,
  onWeekChange,
  onEditShift,
  onDeleteShift,
  isLoading,
}: {
  shifts: ShiftWithRelations[]
  currentWeekStart: Date
  onWeekChange: (date: Date) => void
  onEditShift: (shift: ShiftWithRelations) => void
  onDeleteShift: (shift: ShiftWithRelations) => void
  isLoading: boolean
}) {
  // Generate array of 7 days for the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart)
    date.setDate(currentWeekStart.getDate() + i)
    return date
  })

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(currentWeekStart.getDate() + (direction === "next" ? 7 : -7))
    onWeekChange(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = today.getDate() - dayOfWeek
    onWeekChange(new Date(today.setDate(diff)))
  }

  // Group shifts by date
  const shiftsByDate = shifts.reduce((acc, shift) => {
    const dateKey = new Date(shift.date).toISOString().split("T")[0]
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(shift)
    return acc
  }, {} as Record<string, ShiftWithRelations[]>)

  const formatWeekRange = () => {
    const startMonth = weekDays[0].toLocaleDateString("en-US", { month: "short" })
    const endMonth = weekDays[6].toLocaleDateString("en-US", { month: "short" })
    const startDay = weekDays[0].getDate()
    const endDay = weekDays[6].getDate()
    const year = weekDays[0].getFullYear()
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2 text-muted-foreground">Loading calendar...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <h3 className="text-lg font-semibold">{formatWeekRange()}</h3>
        <div className="w-[120px]" /> {/* Spacer for alignment */}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {weekDays.map((date, index) => (
          <div 
            key={index}
            className={`text-center p-2 rounded-t-lg border-b-2 ${
              isToday(date) ? "bg-primary/10 border-primary" : "bg-muted border-transparent"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground">
              {DAYS_OF_WEEK[date.getDay()].slice(0, 3)}
            </div>
            <div className={`text-lg font-bold ${isToday(date) ? "text-primary" : ""}`}>
              {date.getDate()}
            </div>
          </div>
        ))}

        {/* Day Columns with Shifts */}
        {weekDays.map((date, index) => {
          const dateKey = date.toISOString().split("T")[0]
          const dayShifts = shiftsByDate[dateKey] || []
          const sortedShifts = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime))

          return (
            <div 
              key={index}
              className={`min-h-[200px] border rounded-b-lg p-1 ${
                isToday(date) ? "bg-primary/5 border-primary/30" : "bg-background"
              }`}
            >
              {sortedShifts.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No shifts</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className={`p-2 rounded-md text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                        SHIFT_STATUS_COLORS[shift.status]
                      }`}
                      onClick={() => onEditShift(shift)}
                    >
                      <div className="font-medium truncate">
                        {shift.startTime} - {shift.endTime}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">
                            {getInitials(shift.staffProfile.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{shift.staffProfile.user.name.split(" ")[0]}</span>
                      </div>
                      <div className="mt-1 truncate text-[10px] opacity-75">
                        {shift.shiftType}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs pt-2 border-t">
        <span className="text-muted-foreground font-medium">Status:</span>
        {Object.entries(SHIFT_STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${colors}`} />
            <span>{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
