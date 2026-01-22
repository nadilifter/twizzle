"use client"

import * as React from "react"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { MoreHorizontal, Plus, Search, Calendar as CalendarIcon, Wand2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT"

type Discount = {
  id: string
  name: string
  code: string
  type: DiscountType
  amount: number
  validFrom: string
  validTo?: string
  userScope: "ALL" | "NEW_USERS" | "MEMBERS" | "VIP"
  productScope: "ALL" | "MERCHANDISE" | "EVENTS" | "MEMBERSHIP"
  status: "ACTIVE" | "EXPIRED" | "SCHEDULED" | "DRAFT"
  usageCount: number
}

const data: Discount[] = [
  {
    id: "DSC-001",
    name: "Summer Sale 2025",
    code: "SUMMER25",
    type: "PERCENTAGE",
    amount: 15,
    validFrom: "2025-06-01",
    validTo: "2025-08-31",
    userScope: "ALL",
    productScope: "ALL",
    status: "SCHEDULED",
    usageCount: 0,
  },
  {
    id: "DSC-002",
    name: "New Member Welcome",
    code: "WELCOME10",
    type: "FIXED_AMOUNT",
    amount: 10,
    validFrom: "2024-01-01",
    userScope: "NEW_USERS",
    productScope: "MEMBERSHIP",
    status: "ACTIVE",
    usageCount: 145,
  },
  {
    id: "DSC-003",
    name: "Black Friday",
    code: "BF2024",
    type: "PERCENTAGE",
    amount: 25,
    validFrom: "2024-11-29",
    validTo: "2024-11-30",
    userScope: "ALL",
    productScope: "MERCHANDISE",
    status: "EXPIRED",
    usageCount: 890,
  },
  {
    id: "DSC-004",
    name: "VIP Discount",
    code: "VIPONLY",
    type: "PERCENTAGE",
    amount: 20,
    validFrom: "2024-01-01",
    userScope: "VIP",
    productScope: "EVENTS",
    status: "ACTIVE",
    usageCount: 34,
  },
]

export default function DiscountsPage() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  
  // Dialog state
  const [open, setOpen] = React.useState(false)
  const [dateFrom, setDateFrom] = React.useState<Date>()
  const [dateTo, setDateTo] = React.useState<Date>()
  const [generatedCode, setGeneratedCode] = React.useState("")

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setGeneratedCode(result)
  }

  const columns: ColumnDef<Discount>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
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
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("name")}</span>
          <span className="text-xs text-muted-foreground">{row.original.code}</span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Discount",
      cell: ({ row }) => {
        const type = row.getValue("type") as DiscountType
        const amount = row.original.amount
        return (
          <div className="font-medium">
            {type === "PERCENTAGE" ? `${amount}%` : `$${amount.toFixed(2)}`}
          </div>
        )
      },
    },
    {
      accessorKey: "scopes",
      header: "Scope",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">User: <span className="foreground font-medium text-foreground">{row.original.userScope}</span></span>
          <span className="text-muted-foreground">Product: <span className="foreground font-medium text-foreground">{row.original.productScope}</span></span>
        </div>
      ),
    },
    {
      accessorKey: "validity",
      header: "Validity",
      cell: ({ row }) => {
        const from = new Date(row.original.validFrom).toLocaleDateString()
        const to = row.original.validTo ? new Date(row.original.validTo).toLocaleDateString() : "Indefinite"
        return (
          <div className="text-xs text-muted-foreground">
            {from} - {to}
          </div>
        )
      },
    },
    {
      accessorKey: "usageCount",
      header: "Uses",
      cell: ({ row }) => (
         <div className="text-center">{row.getValue("usageCount")}</div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <Badge variant={status === "ACTIVE" ? "default" : status === "SCHEDULED" ? "secondary" : "outline"}>
            {status}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit Discount</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const table = useReactTable({
    data,
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Discounts & Coupons</h2>
          <p className="text-sm text-muted-foreground">
            Manage discount codes, coupons, and promotional campaigns.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Discount
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Discount</DialogTitle>
              <DialogDescription>
                Create a new discount code or coupon. Fill in the details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input id="name" placeholder="e.g. Summer Sale" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="code" 
                      placeholder="SUMMER25" 
                      value={generatedCode} 
                      onChange={(e) => setGeneratedCode(e.target.value.toUpperCase())}
                    />
                    <Button variant="outline" size="icon" onClick={generateCode} title="Generate Code">
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Discount Type</Label>
                  <Select defaultValue="PERCENTAGE">
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                      <SelectItem value="FIXED_AMOUNT">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" placeholder="0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <Label>Valid From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Valid To (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userScope">User Scope</Label>
                  <Select defaultValue="ALL">
                    <SelectTrigger>
                      <SelectValue placeholder="Select users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Users</SelectItem>
                      <SelectItem value="NEW_USERS">New Users Only</SelectItem>
                      <SelectItem value="MEMBERS">Members Only</SelectItem>
                      <SelectItem value="VIP">VIP Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productScope">Product Scope</Label>
                  <Select defaultValue="ALL">
                    <SelectTrigger>
                      <SelectValue placeholder="Select products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Products</SelectItem>
                      <SelectItem value="MEMBERSHIP">Membership</SelectItem>
                      <SelectItem value="EVENTS">Events</SelectItem>
                      <SelectItem value="MERCHANDISE">Merchandise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={() => setOpen(false)}>Create Discount</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search discounts..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
       <div className="flex items-center justify-end space-x-2">
         <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
      </div>
    </div>
  )
}



