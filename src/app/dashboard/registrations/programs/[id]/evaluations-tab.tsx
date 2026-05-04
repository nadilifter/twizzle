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
import { ClipboardList, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface ProgramEvaluation {
  id: string;
  date: string;
  overallScore: string | number;
  status: string;
  athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  } | null;
  coach: { id: string; name: string | null } | null;
  template: { id: string; name: string } | null;
  programInstance: { id: string; date: string } | null;
}

interface EvaluationsTabProps {
  programId: string;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  PASS: "bg-green-50 text-green-700 border-green-200",
  RETRY: "bg-red-50 text-red-700 border-red-200",
  EXCELLENT: "bg-purple-50 text-purple-700 border-purple-200",
  SATISFACTORY: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export function EvaluationsTab({ programId }: EvaluationsTabProps) {
  const [evaluations, setEvaluations] = React.useState<ProgramEvaluation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/programs/${programId}/evaluations?limit=500`);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setEvaluations(json.data ?? []);
      } catch {
        toast.error("Failed to load evaluations");
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [programId]);

  const columns = React.useMemo<ColumnDef<ProgramEvaluation>[]>(
    () => [
      {
        id: "date",
        accessorFn: (row) => new Date(row.date).getTime(),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => format(new Date(row.original.date), "MMM d, yyyy"),
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
              href={`/dashboard/registrations/programs/${programId}/athletes/${a.id}`}
              className="text-primary hover:underline"
            >
              {display || "Unknown"}
            </Link>
          );
        },
        filterFn: "includesString",
      },
      {
        id: "template",
        accessorFn: (row) => row.template?.name ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Template" />,
        cell: ({ row }) => row.original.template?.name ?? "-",
      },
      {
        id: "coach",
        accessorFn: (row) => row.coach?.name ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Coach" />,
        cell: ({ row }) => row.original.coach?.name ?? "-",
      },
      {
        id: "session",
        accessorFn: (row) => row.programInstance?.date ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Session" />,
        cell: ({ row }) => {
          const pi = row.original.programInstance;
          if (!pi) return <span className="text-muted-foreground">-</span>;
          return (
            <Link
              href={`/dashboard/registrations/programs/${programId}/sessions/${pi.id}`}
              className="text-sm text-primary hover:underline"
            >
              {format(new Date(pi.date), "MMM d")}
            </Link>
          );
        },
      },
      {
        id: "score",
        accessorFn: (row) => Number(row.overallScore) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium">{String(row.original.overallScore)}</div>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant="outline" className={STATUS_STYLE[status] ?? ""}>
              {status}
            </Badge>
          );
        },
      },
    ],
    [programId]
  );

  const table = useReactTable({
    data: evaluations,
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
            <CardTitle>Evaluations</CardTitle>
            <CardDescription className="mt-1">
              {loading
                ? "Loading evaluations..."
                : `${evaluations.length} evaluation${
                    evaluations.length === 1 ? "" : "s"
                  } across this program`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athlete..."
                value={(table.getColumn("athlete")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("athlete")?.setFilterValue(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
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
        ) : evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Evaluations Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Generate evaluations from an assigned template or record skill assessments in a
              session.
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
