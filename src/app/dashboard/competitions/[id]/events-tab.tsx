"use client";

import * as React from "react";
import Link from "next/link";
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
import { Check, Flag, Filter, Minus, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";

export interface EventCategory {
  id: string;
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE";
  sortDirection: "ASC" | "DESC";
  precision: number;
  seedMarkRequired: boolean;
  isTeamEvent: boolean;
  teamSize: number | null;
  price: string | number | null;
  isActive: boolean;
  displayOrder: number;
  combinationEntry: {
    id: string;
    rowValue: { id: string; name: string };
    colValue: { id: string; name: string };
    template: { id: string; name: string };
  } | null;
  individualEntry: {
    id: string;
    name: string;
    template: { id: string; name: string };
  } | null;
  sportEvent: { id: string; name: string; code: string } | null;
  ageCategory: { id: string; name: string; code: string } | null;
  _count: { entries: number; results: number };
}

interface EventsTabProps {
  categories: EventCategory[];
  pricingMode: string;
  competitionId: string;
}

export function getCategoryLabel(category: EventCategory): string {
  if (category.ageCategory && category.sportEvent) {
    return `${category.ageCategory.code} ${category.sportEvent.name}`;
  }
  if (category.sportEvent) return category.sportEvent.name;
  if (category.ageCategory) return category.ageCategory.name;
  if (category.individualEntry?.name) return category.individualEntry.name;
  if (category.combinationEntry) {
    return `${category.combinationEntry.rowValue.name} - ${category.combinationEntry.colValue.name}`;
  }
  return `Category ${category.id.slice(-4)}`;
}

const RESULT_TYPE_LABELS: Record<string, string> = {
  TIME: "Time",
  DISTANCE: "Distance",
  HEIGHT: "Height",
  SCORE: "Score",
};

function formatPrice(price: string | number | null): string {
  if (price === null || price === undefined) return "-";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "-";
  return `$${num.toFixed(2)}`;
}

export function EventsTab({ categories, pricingMode, competitionId }: EventsTabProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const showPrice = pricingMode === "PER_CATEGORY";

  const columns = React.useMemo<ColumnDef<EventCategory>[]>(() => {
    const cols: ColumnDef<EventCategory>[] = [
      {
        id: "event",
        accessorFn: (row) => getCategoryLabel(row),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Event" />,
        cell: ({ row }) => (
          <Link
            href={`/dashboard/competitions/${competitionId}/events/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {getCategoryLabel(row.original)}
          </Link>
        ),
        filterFn: "includesString",
      },
      {
        id: "registrants",
        accessorFn: (row) => row._count.entries,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Registrants" />,
        cell: ({ row }) => <Badge variant="secondary">{row.original._count.entries}</Badge>,
      },
      {
        id: "results",
        accessorFn: (row) => row._count.results,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Results" />,
        cell: ({ row }) => {
          const count = row.original._count.results;
          return count > 0 ? (
            <Badge variant="outline">{count}</Badge>
          ) : (
            <span className="text-muted-foreground">0</span>
          );
        },
      },
      {
        id: "resultType",
        accessorFn: (row) => row.resultType,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <Badge variant="outline">
            {RESULT_TYPE_LABELS[row.original.resultType] ?? row.original.resultType}
          </Badge>
        ),
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        id: "teamEvent",
        accessorFn: (row) => (row.isTeamEvent ? "Yes" : "No"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Team" />,
        cell: ({ row }) =>
          row.original.isTeamEvent ? (
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                {row.original.teamSize ? `${row.original.teamSize} per team` : "Yes"}
              </span>
            </div>
          ) : (
            <Minus className="h-4 w-4 text-muted-foreground" />
          ),
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        id: "seedMark",
        accessorFn: (row) => (row.seedMarkRequired ? "Required" : "None"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Seed Mark" />,
        cell: ({ row }) =>
          row.original.seedMarkRequired ? (
            <Badge variant="secondary">Required</Badge>
          ) : (
            <span className="text-muted-foreground text-sm">None</span>
          ),
      },
      {
        id: "status",
        accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                row.original.isActive ? "bg-green-500" : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-sm">{row.original.isActive ? "Active" : "Inactive"}</span>
          </div>
        ),
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
    ];

    if (showPrice) {
      cols.splice(6, 0, {
        id: "price",
        accessorFn: (row) => {
          if (row.price === null || row.price === undefined) return 0;
          return typeof row.price === "string" ? parseFloat(row.price) : row.price;
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
        cell: ({ row }) => <span className="text-sm">{formatPrice(row.original.price)}</span>,
      });
    }

    return cols;
  }, [showPrice, competitionId]);

  const table = useReactTable({
    data: categories,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const handleFilterChange = (columnId: string, value: string, checked: boolean) => {
    const column = table.getColumn(columnId);
    const filterValue = (column?.getFilterValue() as string[]) || [];
    if (checked) {
      column?.setFilterValue([...filterValue, value]);
    } else {
      column?.setFilterValue(filterValue.filter((v) => v !== value));
    }
  };

  const isFiltered = table.getState().columnFilters.some((f) => f.id !== "event");

  const resultTypes = React.useMemo(
    () => Array.from(new Set(categories.map((c) => c.resultType))).sort(),
    [categories]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Events</CardTitle>
            <CardDescription className="mt-1">
              {categories.length} event{categories.length === 1 ? "" : "s"} in this competition
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={(table.getColumn("event")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("event")?.setFilterValue(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 border-dashed">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                  {isFiltered && (
                    <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                      {table.getState().columnFilters.filter((f) => f.id !== "event").length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <div className="p-4 pb-0">
                  <h4 className="font-medium leading-none">Filters</h4>
                </div>
                <div className="p-4 pt-2 space-y-4 max-h-[400px] overflow-y-auto">
                  {resultTypes.length > 1 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Result Type</h4>
                      <div className="grid gap-2">
                        {resultTypes.map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={`resultType-${type}`}
                              checked={(
                                table.getColumn("resultType")?.getFilterValue() as string[]
                              )?.includes(type)}
                              onCheckedChange={(checked) =>
                                handleFilterChange("resultType", type, !!checked)
                              }
                            />
                            <label htmlFor={`resultType-${type}`} className="text-sm leading-none">
                              {RESULT_TYPE_LABELS[type] ?? type}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Team Event</h4>
                    <div className="grid gap-2">
                      {(["Yes", "No"] as const).map((val) => (
                        <div key={val} className="flex items-center space-x-2">
                          <Checkbox
                            id={`teamEvent-${val}`}
                            checked={(
                              table.getColumn("teamEvent")?.getFilterValue() as string[]
                            )?.includes(val)}
                            onCheckedChange={(checked) =>
                              handleFilterChange("teamEvent", val, !!checked)
                            }
                          />
                          <label htmlFor={`teamEvent-${val}`} className="text-sm leading-none">
                            {val}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    <div className="grid gap-2">
                      {(["Active", "Inactive"] as const).map((val) => (
                        <div key={val} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${val}`}
                            checked={(
                              table.getColumn("status")?.getFilterValue() as string[]
                            )?.includes(val)}
                            onCheckedChange={(checked) =>
                              handleFilterChange("status", val, !!checked)
                            }
                          />
                          <label htmlFor={`status-${val}`} className="text-sm leading-none">
                            {val}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isFiltered && (
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-center h-8"
                      onClick={() => {
                        const eventFilter = table.getColumn("event")?.getFilterValue();
                        table.resetColumnFilters();
                        if (eventFilter) {
                          table.getColumn("event")?.setFilterValue(eventFilter);
                        }
                      }}
                    >
                      <X className="mr-2 h-3 w-3" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <DataTableViewOptions table={table} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Flag className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Events Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Events will appear here once categories are configured for this competition.
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
            <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
