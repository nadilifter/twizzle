"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  AlertCircle,
  Mail,
  Trash2,
  Pencil,
  Calendar,
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAthletes } from "@/hooks/use-athletes"
import { useFamilies } from "@/hooks/use-families"
import type { AthleteWithRelations, CreateAthletePayload, UpdateAthletePayload, AthleteStatus } from "@/types/athletes"

// Transform status for display
function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

// Get badge variant based on status
function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  const normalizedStatus = status.toUpperCase()
  if (normalizedStatus === "ACTIVE") return "default"
  if (normalizedStatus === "INACTIVE" || normalizedStatus === "GRADUATED") return "secondary"
  if (normalizedStatus === "TRIAL") return "secondary"
  return "secondary"
}

export default function AthletesPage() {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [selectedAthlete, setSelectedAthlete] = React.useState<AthleteWithRelations | null>(null)
  
  // Form state for adding new athlete
  const [newAthlete, setNewAthlete] = React.useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    level: "",
    group: "",
    familyId: "",
    parentEmail: "",
  })

  // Form state for editing athlete
  const [editAthlete, setEditAthlete] = React.useState({
    name: "",
    email: "",
    birthDate: "",
    level: "",
    group: "",
    status: "" as AthleteStatus,
    familyId: "",
  })

  // Fetch athletes from API
  const {
    athletes,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    createAthlete,
    updateAthlete,
    deleteAthlete,
    fetchAthletes,
    clearError,
  } = useAthletes()

  // Fetch families for the dropdown
  const { families, isLoading: isFamiliesLoading } = useFamilies()

  // Open edit dialog with selected athlete data
  const handleEditClick = React.useCallback((athlete: AthleteWithRelations) => {
    setSelectedAthlete(athlete)
    setEditAthlete({
      name: athlete.name,
      email: athlete.email || "",
      birthDate: athlete.birthDate ? new Date(athlete.birthDate).toISOString().split("T")[0] : "",
      level: athlete.level,
      group: athlete.group,
      status: athlete.status as AthleteStatus,
      familyId: athlete.familyId,
    })
    setIsEditDialogOpen(true)
  }, [])

  // Open delete confirmation dialog
  const handleDeleteClick = React.useCallback((athlete: AthleteWithRelations) => {
    setSelectedAthlete(athlete)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle edit form submission
  const handleEditAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAthlete) return

    const payload: UpdateAthletePayload = {
      name: editAthlete.name,
      email: editAthlete.email || null,
      level: editAthlete.level,
      group: editAthlete.group,
      status: editAthlete.status,
      familyId: editAthlete.familyId,
      birthDate: editAthlete.birthDate || null,
    }

    const result = await updateAthlete(selectedAthlete.id, payload)
    
    if (result) {
      toast.success("Athlete updated successfully")
      setIsEditDialogOpen(false)
      setSelectedAthlete(null)
    } else {
      toast.error(error || "Failed to update athlete")
    }
  }

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!selectedAthlete) return

    const success = await deleteAthlete(selectedAthlete.id)
    
    if (success) {
      toast.success("Athlete deleted successfully")
      setIsDeleteDialogOpen(false)
      setSelectedAthlete(null)
    } else {
      toast.error(error || "Failed to delete athlete")
    }
  }

  // Handle contact parent - opens email client
  const handleContactParent = React.useCallback((athlete: AthleteWithRelations) => {
    const email = athlete.family?.email
    if (email) {
      window.location.href = `mailto:${email}?subject=Regarding ${athlete.name}`
    } else {
      toast.error("No email address available for this family")
    }
  }, [])

  // Navigate to athlete profile with attendance tab
  const handleViewAttendance = React.useCallback((athlete: AthleteWithRelations) => {
    router.push(`/dashboard/athletes/${athlete.id}?tab=attendance`)
  }, [router])

  // Define columns
  const columns: ColumnDef<AthleteWithRelations>[] = React.useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Athlete",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={row.original.avatar ?? undefined} alt={row.original.name} />
            <AvatarFallback>{row.original.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <Link href={`/dashboard/athletes/${row.original.id}`} className="font-medium hover:underline">
              {row.original.name}
            </Link>
            <span className="text-xs text-muted-foreground">{row.original.email ?? "No email"}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "level",
      header: "Level",
      cell: ({ row }) => <Badge variant="outline">{row.original.level}</Badge>,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "group",
      header: "Group",
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "parent",
      header: "Parent/Guardian",
      cell: ({ row }) => row.original.family?.primaryContact ?? row.original.parent ?? "N/A",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/athletes/${row.original.id}`}>
                  View Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditClick(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewAttendance(row.original)}>
                <Calendar className="mr-2 h-4 w-4" />
                View Attendance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleContactParent(row.original)}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Parent
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteClick(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Athlete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [handleEditClick, handleDeleteClick, handleViewAttendance, handleContactParent])

  const table = useReactTable({
    data: athletes,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
  })

  // Get unique values for filters from current data
  const levels = React.useMemo(() => 
    Array.from(new Set(athletes.map(a => a.level))).sort(),
    [athletes]
  )
  const groups = React.useMemo(() => 
    Array.from(new Set(athletes.map(a => a.group))).sort(),
    [athletes]
  )
  const statuses = React.useMemo(() => 
    Array.from(new Set(athletes.map(a => a.status))).sort(),
    [athletes]
  )

  // Helper to handle checkbox changes for filters
  const handleFilterChange = (columnId: string, value: string, checked: boolean) => {
    const column = table.getColumn(columnId)
    const filterValue = (column?.getFilterValue() as string[]) || []
    
    if (checked) {
      column?.setFilterValue([...filterValue, value])
    } else {
      column?.setFilterValue(filterValue.filter((v) => v !== value))
    }
  }

  const isFiltered = table.getState().columnFilters.length > 0

  // Handle form submission for adding athlete
  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newAthlete.firstName || !newAthlete.lastName || !newAthlete.level || !newAthlete.group || !newAthlete.familyId) {
      toast.error("Please fill in all required fields")
      return
    }

    const payload: CreateAthletePayload = {
      name: `${newAthlete.firstName} ${newAthlete.lastName}`,
      level: newAthlete.level,
      group: newAthlete.group,
      familyId: newAthlete.familyId,
      birthDate: newAthlete.birthDate || null,
      status: "ACTIVE" as AthleteStatus,
    }

    const result = await createAthlete(payload)
    
    if (result) {
      toast.success("Athlete added successfully")
      setIsAddDialogOpen(false)
      setNewAthlete({
        firstName: "",
        lastName: "",
        birthDate: "",
        level: "",
        group: "",
        familyId: "",
        parentEmail: "",
      })
    } else {
      toast.error(error || "Failed to add athlete")
    }
  }

  // Show error toast when error changes
  React.useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Athlete Directory</h1>
          <p className="text-muted-foreground">
            Manage your club&apos;s gymnasts, levels, and group assignments.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Athlete
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Athlete</DialogTitle>
              <DialogDescription>
                Add a new athlete to your roster manually or invite them via email.
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="invite">Invite via Email</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="space-y-4 py-4">
                <form onSubmit={handleAddAthlete}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input 
                        id="firstName" 
                        placeholder="Enter first name"
                        value={newAthlete.firstName}
                        onChange={(e) => setNewAthlete(prev => ({ ...prev, firstName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input 
                        id="lastName" 
                        placeholder="Enter last name"
                        value={newAthlete.lastName}
                        onChange={(e) => setNewAthlete(prev => ({ ...prev, lastName: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="dob">Date of Birth</Label>
                      <Input 
                        id="dob" 
                        type="date"
                        value={newAthlete.birthDate}
                        onChange={(e) => setNewAthlete(prev => ({ ...prev, birthDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="family">Family *</Label>
                      <Select 
                        value={newAthlete.familyId}
                        onValueChange={(value) => setNewAthlete(prev => ({ ...prev, familyId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isFamiliesLoading ? "Loading..." : "Select family"} />
                        </SelectTrigger>
                        <SelectContent>
                          {families.map((family) => (
                            <SelectItem key={family.id} value={family.id}>
                              {family.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="level">Level *</Label>
                      <Select 
                        value={newAthlete.level}
                        onValueChange={(value) => setNewAthlete(prev => ({ ...prev, level: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Level 1">Level 1</SelectItem>
                          <SelectItem value="Level 2">Level 2</SelectItem>
                          <SelectItem value="Level 3">Level 3</SelectItem>
                          <SelectItem value="Level 4">Level 4</SelectItem>
                          <SelectItem value="Level 5">Level 5</SelectItem>
                          <SelectItem value="Level 6">Level 6</SelectItem>
                          <SelectItem value="Level 7">Level 7</SelectItem>
                          <SelectItem value="Level 8">Level 8</SelectItem>
                          <SelectItem value="Level 9">Level 9</SelectItem>
                          <SelectItem value="Level 10">Level 10</SelectItem>
                          <SelectItem value="Elite">Elite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="group">Group *</Label>
                      <Select 
                        value={newAthlete.group}
                        onValueChange={(value) => setNewAthlete(prev => ({ ...prev, group: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Elite Squad">Elite Squad</SelectItem>
                          <SelectItem value="National Team">National Team</SelectItem>
                          <SelectItem value="Juniors A">Juniors A</SelectItem>
                          <SelectItem value="Juniors B">Juniors B</SelectItem>
                          <SelectItem value="Development">Development</SelectItem>
                          <SelectItem value="Boys Team">Boys Team</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Athlete"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
              <TabsContent value="invite" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Email Address</Label>
                  <Input id="inviteEmail" type="email" placeholder="athlete@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Custom Message (Optional)</Label>
                  <Textarea id="message" placeholder="Join our team on Uplifter!" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full">Send Invitation</Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search athletes..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-8"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-dashed">
              <Filter className="mr-2 h-4 w-4" />
              Filter
              {isFiltered && (
                <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal lg:hidden">
                  {table.getState().columnFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="end">
            <div className="p-4 pb-0">
              <h4 className="font-medium leading-none">Filters</h4>
            </div>
            <div className="p-4 pt-2 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Level</h4>
                <div className="grid gap-2">
                  {levels.map((level) => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`level-${level}`} 
                        checked={(table.getColumn("level")?.getFilterValue() as string[])?.includes(level)}
                        onCheckedChange={(checked) => handleFilterChange("level", level, !!checked)}
                      />
                      <label
                        htmlFor={`level-${level}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {level}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Group</h4>
                <div className="grid gap-2">
                  {groups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`group-${group}`} 
                        checked={(table.getColumn("group")?.getFilterValue() as string[])?.includes(group)}
                        onCheckedChange={(checked) => handleFilterChange("group", group, !!checked)}
                      />
                      <label
                        htmlFor={`group-${group}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {group}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                <div className="grid gap-2">
                  {statuses.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${status}`} 
                        checked={(table.getColumn("status")?.getFilterValue() as string[])?.includes(status)}
                        onCheckedChange={(checked) => handleFilterChange("status", status, !!checked)}
                      />
                      <label
                        htmlFor={`status-${status}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {formatStatus(status)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {isFiltered && (
                <Button 
                  variant="ghost" 
                  className="w-full justify-center text-center"
                  onClick={() => table.resetColumnFilters()}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" onClick={() => fetchAthletes()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && athletes.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading athletes...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && athletes.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>Failed to load athletes</p>
            <Button variant="outline" onClick={() => fetchAthletes()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {(!isLoading || athletes.length > 0) && !error && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No athletes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex-1 text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
              {total > 0 && (
                <span className="ml-2">({total} total)</span>
              )}
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value))
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Athlete Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Athlete</DialogTitle>
            <DialogDescription>
              Update athlete information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditAthlete}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Name *</Label>
                <Input
                  id="editName"
                  value={editAthlete.name}
                  onChange={(e) => setEditAthlete(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editAthlete.email}
                  onChange={(e) => setEditAthlete(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editDob">Date of Birth</Label>
                  <Input
                    id="editDob"
                    type="date"
                    value={editAthlete.birthDate}
                    onChange={(e) => setEditAthlete(prev => ({ ...prev, birthDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editStatus">Status *</Label>
                  <Select
                    value={editAthlete.status}
                    onValueChange={(value) => setEditAthlete(prev => ({ ...prev, status: value as AthleteStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="GRADUATED">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editLevel">Level *</Label>
                  <Select
                    value={editAthlete.level}
                    onValueChange={(value) => setEditAthlete(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Level 1">Level 1</SelectItem>
                      <SelectItem value="Level 2">Level 2</SelectItem>
                      <SelectItem value="Level 3">Level 3</SelectItem>
                      <SelectItem value="Level 4">Level 4</SelectItem>
                      <SelectItem value="Level 5">Level 5</SelectItem>
                      <SelectItem value="Level 6">Level 6</SelectItem>
                      <SelectItem value="Level 7">Level 7</SelectItem>
                      <SelectItem value="Level 8">Level 8</SelectItem>
                      <SelectItem value="Level 9">Level 9</SelectItem>
                      <SelectItem value="Level 10">Level 10</SelectItem>
                      <SelectItem value="Elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editGroup">Group *</Label>
                  <Select
                    value={editAthlete.group}
                    onValueChange={(value) => setEditAthlete(prev => ({ ...prev, group: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Elite Squad">Elite Squad</SelectItem>
                      <SelectItem value="National Team">National Team</SelectItem>
                      <SelectItem value="Juniors A">Juniors A</SelectItem>
                      <SelectItem value="Juniors B">Juniors B</SelectItem>
                      <SelectItem value="Development">Development</SelectItem>
                      <SelectItem value="Boys Team">Boys Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editFamily">Family *</Label>
                <Select
                  value={editAthlete.familyId}
                  onValueChange={(value) => setEditAthlete(prev => ({ ...prev, familyId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isFamiliesLoading ? "Loading..." : "Select family"} />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((family) => (
                      <SelectItem key={family.id} value={family.id}>
                        {family.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Athlete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedAthlete?.name}? This action cannot be undone.
              All associated data including attendance records and evaluations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
