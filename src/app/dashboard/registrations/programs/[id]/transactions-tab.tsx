"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
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
} from "@tanstack/react-table";
import { Receipt, Search } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format-utils";
import { INVOICE_STATUS_STYLES } from "@/lib/invoice-status";

export interface ProgramLineItem {
  id: string;
  description: string;
  total: string | number;
  createdAt: string;
  athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  } | null;
  invoice: {
    id: string;
    reference: string;
    status: string;
    user: { id: string; name: string | null; email: string } | null;
  } | null;
}

interface TransactionsTabProps {
  lineItems: ProgramLineItem[];
  athleteHrefPrefix: string;
}

export function TransactionsTab({ lineItems, athleteHrefPrefix }: TransactionsTabProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const columns = React.useMemo<ColumnDef<ProgramLineItem>[]>(
    () => [
      {
        id: "reference",
        accessorFn: (row) => row.invoice?.reference ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice" />,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.invoice?.reference ?? "-"}</span>
        ),
      },
      {
        id: "athlete",
        accessorFn: (row) =>
          row.athlete ? `${row.athlete.firstName ?? ""} ${row.athlete.lastName ?? ""}`.trim() : "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Athlete" />,
        cell: ({ row }) => {
          const a = row.original.athlete;
          if (!a) return <span className="text-muted-foreground">-</span>;
          const display = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
          return (
            <Link
              href={`${athleteHrefPrefix}/${a.id}`}
              className="text-sm text-primary hover:underline"
            >
              {display || "Unknown"}
            </Link>
          );
        },
      },
      {
        id: "guardian",
        accessorFn: (row) => row.invoice?.user?.name ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Guardian" />,
        cell: ({ row }) => {
          const user = row.original.invoice?.user;
          if (!user) return <span className="text-muted-foreground">-</span>;
          return (
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <span>{row.original.description}</span>,
        filterFn: "includesString",
      },
      {
        id: "date",
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => format(new Date(row.original.createdAt), "MMM d, yyyy"),
      },
      {
        id: "status",
        accessorFn: (row) => row.invoice?.status ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.invoice?.status;
          if (!status) return <span className="text-muted-foreground">-</span>;
          return (
            <Badge variant="outline" className={INVOICE_STATUS_STYLES[status] ?? ""}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </Badge>
          );
        },
      },
      {
        id: "amount",
        accessorFn: (row) => {
          const val = row.total;
          return typeof val === "string" ? parseFloat(val) : val;
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Amount" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium">{formatPrice(row.original.total)}</div>
        ),
      },
    ],
    [athleteHrefPrefix]
  );

  const table = useReactTable({
    data: lineItems,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription className="mt-1">
              {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} across all invoices
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={(table.getColumn("description")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("description")?.setFilterValue(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <DataTableViewOptions table={table} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {lineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Transactions Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Transactions will appear here once athletes register or pay for this program.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
