"use client"

import * as React from "react"
import Link from "next/link"
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
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    case "STAFF":
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
  { value: "STAFF", label: "Staff" },
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
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  const [orgFilter, setOrgFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

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
      header: "Name",
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
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role (Platform)",
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
      header: "Organizations",
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
      header: "Status",
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
      header: "Last Login",
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
      header: "Created",
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {formatCreatedDate(row.original.createdAt)}
          </span>
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
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
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
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {users.length} users
      </div>

      {/* Table */}
      <div className="rounded-md border">
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
