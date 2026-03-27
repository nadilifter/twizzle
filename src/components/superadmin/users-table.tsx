"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { Search, Users, MoreHorizontal, Pencil } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { formatDistanceToNow } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

// Type definitions
interface OrganizationMembership {
  id: string
  role: string
  organization: {
    id: string
    name: string
  }
}

interface User {
  id: string
  name: string
  email: string
  avatar: string | null
  role: string
  status: string
  isSuperAdmin: boolean
  createdAt: string
  lastActiveAt: string | null
  memberships: OrganizationMembership[]
}

interface SuperadminUsersTableProps {
  users: User[]
  organizations: { id: string; name: string }[]
}

// Helper function for role badge variants
const getRoleBadgeVariant = (role: string, isSuperAdmin: boolean): "default" | "secondary" | "destructive" | "outline" => {
  if (isSuperAdmin) return "destructive"
  switch (role) {
    case "ADMIN":
      return "destructive"
    case "COACH":
      return "default"
    case "VOLUNTEER":
    case "ACCOUNTANT":
    case "PARENT":
      return "secondary"
    case "CUSTOM":
      return "outline"
    default:
      return "secondary"
  }
}

// Helper function for status badge variants
const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "ACTIVE":
      return "default"
    case "INVITED":
      return "outline"
    case "INACTIVE":
      return "secondary"
    default:
      return "secondary"
  }
}

// Helper function for initials
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Format last active date
const formatLastActive = (date: string | null) => {
  if (!date) return "Never"
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return "Unknown"
  }
}

// Format created date
const formatCreatedDate = (date: string) => {
  try {
    return new Date(date).toLocaleDateString()
  } catch {
    return "Unknown"
  }
}

// Role options for filter
const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "COACH", label: "Coach" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "PARENT", label: "Parent" },
  { value: "CUSTOM", label: "Custom" },
]

// Status options for filter
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "INACTIVE", label: "Inactive" },
]

export function SuperadminUsersTable({ users, organizations }: SuperadminUsersTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  const [orgFilter, setOrgFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<User | null>(null)
  const [editFormData, setEditFormData] = React.useState({
    name: "",
    email: "",
    role: "",
    status: "",
    isSuperAdmin: false,
  })
  const [isUpdating, setIsUpdating] = React.useState(false)

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
    })
    setEditDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/superadmin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update user")
      }

      toast.success("User updated successfully")
      setEditDialogOpen(false)
      setEditingUser(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSendPasswordReset = async (user: User) => {
    try {
      const response = await fetch(`/api/superadmin/users/${user.id}/send-password-reset`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send password reset email")
      }

      toast.success(`Password reset email sent to ${user.email}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send password reset email")
    }
  }

  // Filter data based on all filters
  const filteredData = React.useMemo(() => {
    return users.filter((user) => {
      // Global search filter (name and email)
      if (globalFilter) {
        const searchLower = globalFilter.toLowerCase()
        const matchesName = user.name.toLowerCase().includes(searchLower)
        const matchesEmail = user.email.toLowerCase().includes(searchLower)
        if (!matchesName && !matchesEmail) return false
      }

      // Role filter
      if (roleFilter !== "all") {
        if (roleFilter === "SUPER_ADMIN") {
          if (!user.isSuperAdmin) return false
        } else {
          if (user.isSuperAdmin || user.role !== roleFilter) return false
        }
      }

      // Organization filter
      if (orgFilter !== "all") {
        const hasOrg = user.memberships.some((m) => m.organization.id === orgFilter)
        if (!hasOrg) return false
      }

      // Status filter
      if (statusFilter !== "all") {
        if (user.status !== statusFilter) return false
      }

      return true
    })
  }, [users, globalFilter, roleFilter, orgFilter, statusFilter])

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const user = row.original
        return (
          <Link 
            href={`/superadmin/users/${user.id}`}
            className="flex items-center gap-3 hover:underline"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{user.name}</span>
          </Link>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role (Platform)" />,
      cell: ({ row }) => {
        const user = row.original
        const displayRole = user.isSuperAdmin ? "Super Admin" : user.role
        return (
          <Badge variant={getRoleBadgeVariant(user.role, user.isSuperAdmin)}>
            {displayRole}
          </Badge>
        )
      },
    },
    {
      accessorKey: "memberships",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Organizations" />,
      cell: ({ row }) => {
        const memberships = row.original.memberships
        if (memberships.length === 0) {
          return <span className="text-xs text-muted-foreground">None</span>
        }
        return (
          <div className="flex flex-col gap-1">
            {memberships.slice(0, 2).map((m) => (
              <span key={m.id} className="text-xs text-muted-foreground">
                {m.organization.name} ({m.role})
              </span>
            ))}
            {memberships.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{memberships.length - 2} more
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        return (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "lastActiveAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Login" />,
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {formatLastActive(row.original.lastActiveAt)}
          </span>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {formatCreatedDate(row.original.createdAt)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSendPasswordReset(user)}>
                Send Password Reset
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {users.length} users
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
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
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No users found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="Enter email address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Platform Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) =>
                  setEditFormData((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger id="edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="COACH">Coach</SelectItem>
                  <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                  <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                  <SelectItem value="PARENT">Parent</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) =>
                  setEditFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="INVITED">Invited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-superadmin">Super Admin</Label>
              <Switch
                id="edit-superadmin"
                checked={editFormData.isSuperAdmin}
                onCheckedChange={(checked) =>
                  setEditFormData((prev) => ({ ...prev, isSuperAdmin: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
