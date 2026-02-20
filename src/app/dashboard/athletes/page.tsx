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
  VisibilityState,
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
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { toast } from "sonner"

import { AthleteConfiguration } from "./athlete-configuration"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAthletes } from "@/hooks/use-athletes"
import { useFamilies } from "@/hooks/use-families"
import { useLevels } from "@/hooks/use-levels"
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
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    { id: "status", value: ["ACTIVE", "TRIAL", "GRADUATED"] },
  ])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [selectedAthlete, setSelectedAthlete] = React.useState<AthleteWithRelations | null>(null)
  
  // Form state for adding new athlete
  const [newAthlete, setNewAthlete] = React.useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    level: "",
    familyId: "",
    parentEmail: "",
  })

  // Fetch athletes from API
  const {
    athletes,
    isLoading,
    isCreating,
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

  // Fetch configured levels for dropdowns
  const { levels: configuredLevels, isLoading: isLevelsLoading } = useLevels()

  const levelColorMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const level of configuredLevels) {
      if (level.color) map.set(level.name, level.color)
    }
    return map
  }, [configuredLevels])

  // Open edit sheet with selected athlete data
  const handleEditClick = React.useCallback((athlete: AthleteWithRelations) => {
    setSelectedAthlete(athlete)
    setIsEditOpen(true)
  }, [])

  // Open delete confirmation dialog
  const handleDeleteClick = React.useCallback((athlete: AthleteWithRelations) => {
    setSelectedAthlete(athlete)
    setIsDeleteDialogOpen(true)
  }, [])

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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Athlete" />,
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
      header: ({ column }) => <DataTableColumnHeader column={column} title="Level" />,
      cell: ({ row }) => {
        const color = levelColorMap.get(row.original.level)
        return color ? (
          <Badge
            variant="outline"
            style={{ borderColor: color, color, backgroundColor: `${color}15` }}
          >
            {row.original.level}
          </Badge>
        ) : (
          <Badge variant="outline">{row.original.level}</Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
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
      id: "programs",
      accessorFn: (row) => row.activePrograms ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Programs" className="justify-end" />,
      cell: ({ row }) => {
        const count = row.original.activePrograms ?? 0
        return (
          <div className="text-right">
            {count > 0 ? (
              <Badge variant="outline">{count}</Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        )
      },
    },
    {
      id: "memberships",
      accessorFn: (row) => row.activeMemberships ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Memberships" className="justify-end" />,
      cell: ({ row }) => {
        const count = row.original.activeMemberships ?? 0
        return (
          <div className="text-right">
            {count > 0 ? (
              <Badge variant="outline">{count}</Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        )
      },
    },
    {
      id: "competitions",
      accessorFn: (row) => row.upcomingCompetitions ?? 0,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Competitions" className="justify-end" />,
      cell: ({ row }) => {
        const count = row.original.upcomingCompetitions ?? 0
        return (
          <div className="text-right">
            {count > 0 ? (
              <Badge variant="outline">{count}</Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        )
      },
    },
    {
      id: "parent",
      accessorFn: (row) => row.family?.primaryContact ?? row.parent ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Parent/Guardian" />,
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
  ], [handleEditClick, handleDeleteClick, handleViewAttendance, handleContactParent, levelColorMap])

  const table = useReactTable({
    data: athletes,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  // Get unique values for filters from current data
  const levels = React.useMemo(() => 
    Array.from(new Set(athletes.map(a => a.level))).sort(),
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
    
    if (!newAthlete.firstName || !newAthlete.lastName || !newAthlete.level || !newAthlete.familyId) {
      toast.error("Please fill in all required fields")
      return
    }

    const payload: CreateAthletePayload = {
      name: `${newAthlete.firstName} ${newAthlete.lastName}`,
      level: newAthlete.level,
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
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="level">Level *</Label>
                    <Select 
                      value={newAthlete.level}
                      onValueChange={(value) => setNewAthlete(prev => ({ ...prev, level: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLevelsLoading ? "Loading..." : "Select level"} />
                      </SelectTrigger>
                      <SelectContent>
                        {configuredLevels.map((level) => (
                          <SelectItem key={level.id} value={level.name}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
        <DataTableViewOptions table={table} />
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
          <div className="overflow-hidden rounded-md border">
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
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
        </>
      )}

      {/* Edit Athlete Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          {selectedAthlete ? (
            <AthleteConfiguration
              athlete={{
                id: selectedAthlete.id,
                name: selectedAthlete.name,
                firstName: selectedAthlete.firstName,
                lastName: selectedAthlete.lastName,
                email: selectedAthlete.email,
                level: selectedAthlete.level,
                status: selectedAthlete.status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED",
                birthDate: selectedAthlete.birthDate,
                gender: selectedAthlete.gender ?? null,
                family: selectedAthlete.family
                  ? { id: selectedAthlete.family.id, name: selectedAthlete.family.name }
                  : null,
              }}
              onClose={() => {
                setIsEditOpen(false)
                setSelectedAthlete(null)
              }}
              onUpdated={async (data) => {
                await updateAthlete(selectedAthlete.id, data)
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </SheetContent>
      </Sheet>

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
