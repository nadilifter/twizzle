"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { Download, Search } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
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

const formatCurrency = (value: number | null) => {
  if (!value) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export const columns: ColumnDef<LedgerEntry>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => <div>{row.getValue("date")}</div>,
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => <div>{row.getValue("description")}</div>,
  },
  {
    accessorKey: "glCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="GL Code" />
    ),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.getValue("glCode")}</span>
        <span className="text-xs text-muted-foreground">{row.original.glDescription}</span>
      </div>
    ),
  },
  {
    accessorKey: "reference",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reference" />
    ),
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("reference")}</div>,
  },
  {
    accessorKey: "debit",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Debit" className="justify-end" />
    ),
    cell: ({ row }) => {
      const formatted = formatCurrency(row.getValue("debit"))
      if (!formatted) return <div className="text-right text-muted-foreground">-</div>
      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "credit",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Credit" className="justify-end" />
    ),
    cell: ({ row }) => {
      const formatted = formatCurrency(row.getValue("credit"))
      if (!formatted) return <div className="text-right text-muted-foreground">-</div>
      return <div className="text-right font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "Posted" ? "outline" : "secondary"}>
          {status}
        </Badge>
      )
    },
  },
]

export function LedgerTransactions() {
  const [data] = React.useState<LedgerEntry[]>(initialEntries)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
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
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter transactions..."
                value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  table.getColumn("description")?.setFilterValue(event.target.value)
                }
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <DataTableViewOptions table={table} />
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
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
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
        </div>
      </CardContent>
    </Card>
  )
}
