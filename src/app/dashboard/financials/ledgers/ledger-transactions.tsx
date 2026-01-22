"use client"

import * as React from "react"
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
import { ArrowUpDown, ChevronDown, Download, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface LedgerEntry {
  id: string
  date: string
  description: string
  glCode: string
  glDescription: string
  reference: string
  debit: number | null
  credit: number | null
  status: "Posted" | "Pending"
}

// Mock Data for Ledger Entries (Double Entry)
const initialEntries: LedgerEntry[] = [
  {
    id: "LE-001-1",
    date: "2023-12-01",
    description: "November Membership Revenue",
    glCode: "1001",
    glDescription: "Checking Account",
    reference: "INV-2023-11",
    debit: 45000.00,
    credit: null,
    status: "Posted",
  },
  {
    id: "LE-001-2",
    date: "2023-12-01",
    description: "November Membership Revenue",
    glCode: "4000",
    glDescription: "Membership Income",
    reference: "INV-2023-11",
    debit: null,
    credit: 45000.00,
    status: "Posted",
  },
  {
    id: "LE-002-1",
    date: "2023-12-02",
    description: "Office Supplies - Staples",
    glCode: "5001",
    glDescription: "Office Supplies",
    reference: "EXP-2023-12-001",
    debit: 145.50,
    credit: null,
    status: "Posted",
  },
  {
    id: "LE-002-2",
    date: "2023-12-02",
    description: "Office Supplies - Staples",
    glCode: "1001",
    glDescription: "Checking Account",
    reference: "EXP-2023-12-001",
    debit: null,
    credit: 145.50,
    status: "Posted",
  },
  {
    id: "LE-003-1",
    date: "2023-12-05",
    description: "Quarterly Rent Payment",
    glCode: "5003",
    glDescription: "Rent Expense",
    reference: "BILL-2023-12-R",
    debit: 3500.00,
    credit: null,
    status: "Posted",
  },
  {
    id: "LE-003-2",
    date: "2023-12-05",
    description: "Quarterly Rent Payment",
    glCode: "1001",
    glDescription: "Checking Account",
    reference: "BILL-2023-12-R",
    debit: null,
    credit: 3500.00,
    status: "Posted",
  },
  {
    id: "LE-004-1",
    date: "2023-12-06",
    description: "Pending: Event Deposit",
    glCode: "1002",
    glDescription: "Savings Account",
    reference: "DEP-2023-12-E",
    debit: 2500.00,
    credit: null,
    status: "Pending",
  },
  {
    id: "LE-004-2",
    date: "2023-12-06",
    description: "Pending: Event Deposit",
    glCode: "2000",
    glDescription: "Deferred Revenue",
    reference: "DEP-2023-12-E",
    debit: null,
    credit: 2500.00,
    status: "Pending",
  },
]

export const columns: ColumnDef<LedgerEntry>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="ml-4">{row.getValue("date")}</div>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div>{row.getValue("description")}</div>,
  },
  {
    accessorKey: "glCode",
    header: "GL Code",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.getValue("glCode")}</span>
        <span className="text-xs text-muted-foreground">{row.original.glDescription}</span>
      </div>
    ),
  },
  {
    accessorKey: "reference",
    header: "Reference",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("reference")}</div>,
  },
  {
    accessorKey: "debit",
    header: () => <div className="text-right">Debit</div>,
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue("debit") || "0")
        if (!amount) return <div className="text-right text-muted-foreground">-</div>
        const formatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount)
        return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "credit",
    header: () => <div className="text-right">Credit</div>,
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue("credit") || "0")
        if (!amount) return <div className="text-right text-muted-foreground">-</div>
        const formatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount)
        return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
            <Badge variant={status === "Posted" ? "outline" : "secondary"}>
                {status}
            </Badge>
        )
    }
  },
]

export function LedgerTransactions() {
  const [data] = React.useState<LedgerEntry[]>(initialEntries)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <Card>
        <CardHeader>
            <CardTitle>General Ledger Transactions</CardTitle>
            <CardDescription>
                View detailed debits and credits for all financial activities.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Filter transactions..."
                    value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                        table.getColumn("description")?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                        Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                            return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) =>
                                column.toggleVisibility(!!value)
                                }
                            >
                                {column.id}
                            </DropdownMenuCheckboxItem>
                            )
                        })}
                    </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>
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
                        No results.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
                </div>
            </div>
        </CardContent>
    </Card>
  )
}


