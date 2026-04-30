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
import { Calendar, Filter, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatTime12h } from "@/lib/date-utils";

interface ProgramSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number | null;
  facility: { id: string; name: string } | null;
  _count: { registrations: number; attendances: number };
}

interface SessionsTabProps {
  programId: string;
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SCHEDULED: "default",
  CANCELLED: "destructive",
  COMPLETED: "secondary",
};

export function SessionsTab({ programId }: SessionsTabProps) {
  const [sessions, setSessions] = React.useState<ProgramSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: false }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/programs/${programId}/instances?limit=500`);
        if (!response.ok) throw new Error("Failed to fetch sessions");
        const data = await response.json();
        setSessions(data.instances ?? data);
      } catch {
        toast.error("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [programId]);

  const columns = React.useMemo<ColumnDef<ProgramSession>[]>(
    () => [
      {
        id: "date",
        accessorFn: (row) => new Date(row.date).getTime(),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => {
          const d = new Date(row.original.date);
          return (
            <Link
              href={`/dashboard/registrations/programs/${programId}/sessions/${row.original.id}`}
              className="font-medium text-primary hover:underline"
            >
              {format(d, "MMM d, yyyy")}
            </Link>
          );
        },
      },
      {
        id: "day",
        accessorFn: (row) => format(new Date(row.date), "EEEE"),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Day" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {format(new Date(row.original.date), "EEE")}
          </span>
        ),
      },
      {
        id: "time",
        accessorFn: (row) => row.startTime,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
        cell: ({ row }) => (
          <span className="text-sm">
            {formatTime12h(row.original.startTime)} &ndash; {formatTime12h(row.original.endTime)}
          </span>
        ),
      },
      {
        id: "facility",
        accessorFn: (row) => row.facility?.name ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Facility" />,
        cell: ({ row }) => {
          const f = row.original.facility;
          if (!f) return <span className="text-muted-foreground">-</span>;
          return <span className="text-sm">{f.name}</span>;
        },
      },
      {
        id: "registered",
        accessorFn: (row) => row._count.registrations,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Registered" className="justify-end" />
        ),
        cell: ({ row }) => {
          const r = row.original._count.registrations;
          const cap = row.original.capacity;
          return (
            <div className="text-right text-sm font-medium">
              {r}
              {cap ? <span className="text-muted-foreground">/{cap}</span> : null}
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          );
        },
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
    ],
    [programId]
  );

  const table = useReactTable({
    data: sessions,
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

  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Sessions</CardTitle>
            <CardDescription className="mt-1">
              {loading
                ? "Loading sessions..."
                : `${sessions.length} session${sessions.length === 1 ? "" : "s"} scheduled`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search facility..."
                value={(table.getColumn("facility")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("facility")?.setFilterValue(e.target.value)}
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
                    <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    <div className="grid gap-2">
                      {(["SCHEDULED", "CANCELLED", "COMPLETED"] as const).map((st) => (
                        <div key={st} className="flex items-center space-x-2">
                          <Checkbox
                            id={`sess-status-${st}`}
                            checked={(
                              table.getColumn("status")?.getFilterValue() as string[]
                            )?.includes(st)}
                            onCheckedChange={(checked) => {
                              const col = table.getColumn("status");
                              const current = (col?.getFilterValue() as string[]) || [];
                              if (checked) col?.setFilterValue([...current, st]);
                              else col?.setFilterValue(current.filter((v) => v !== st));
                            }}
                          />
                          <label htmlFor={`sess-status-${st}`} className="text-sm leading-none">
                            {STATUS_LABEL[st]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isFiltered && (
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-center h-8"
                      onClick={() => table.resetColumnFilters()}
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
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Sessions Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Sessions will appear here once the program schedule is set up.
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
