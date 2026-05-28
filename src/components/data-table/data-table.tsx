"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Updater,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /**
   * In client-side mode this is only the INITIAL page size (it seeds
   * `initialState` once; later prop changes have no effect). In
   * `manualPagination` mode it is the controlled page size.
   */
  pageSize?: number;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  /**
   * Opt into server-side ("manual") pagination. When set, the table stops
   * paginating `data` in memory — `data` is treated as the current page and
   * the parent is responsible for fetching the next page in `onPaginationChange`.
   * Requires `pageCount` (or `rowCount`) so the pagination controls know the
   * total number of pages.
   */
  manualPagination?: boolean;
  /** Total page count for manual pagination. Use this or `rowCount`. */
  pageCount?: number;
  /** Total row count for manual pagination; TanStack derives `pageCount` from it. */
  rowCount?: number;
  /** Controlled current page index (0-based) for manual pagination. */
  pageIndex?: number;
  /** Called with the next `{ pageIndex, pageSize }` when the user pages/resizes. */
  onPaginationChange?: (pagination: PaginationState) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  pageSizeOptions,
  showPagination = true,
  manualPagination = false,
  pageCount,
  rowCount,
  pageIndex = 0,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const handlePaginationChange: OnChangeFn<PaginationState> = (
    updater: Updater<PaginationState>
  ) => {
    if (!onPaginationChange) return;
    const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
    onPaginationChange(next);
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(manualPagination ? { pagination: { pageIndex, pageSize } } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true,
          ...(pageCount !== undefined ? { pageCount } : {}),
          ...(rowCount !== undefined ? { rowCount } : {}),
          onPaginationChange: handlePaginationChange,
        }
      : {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: {
            pagination: { pageSize },
          },
        }),
  });

  return (
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
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
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
      {showPagination && table.getPageCount() > 1 && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}
