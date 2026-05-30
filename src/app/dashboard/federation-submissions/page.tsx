"use client";

import * as React from "react";
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
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Filter, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type FederationSubmission = {
  id: string;
  federation: "SKATE_CANADA" | "USFS" | "ISU";
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  submittedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  externalRef: string | null;
  createdAt: string;
  createdBy: { name: string | null; email: string };
  _count: { athletes: number };
};

const FEDERATION_LABELS: Record<string, string> = {
  SKATE_CANADA: "Skate Canada",
  USFS: "USFS",
  ISU: "ISU",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  ACCEPTED: "outline",
  REJECTED: "destructive",
};

function FederationBadge({ federation }: { federation: string }) {
  return <Badge variant="outline">{FEDERATION_LABELS[federation] ?? federation}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "MMM d, yyyy");
}

export default function FederationSubmissionsPage() {
  const [submissions, setSubmissions] = React.useState<FederationSubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  // Filters
  const [federationFilter, setFederationFilter] = React.useState<string>("all");

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  // Transition dialog state
  type DialogState =
    | { open: false }
    | {
        open: true;
        submissionId: string;
        to: "SUBMITTED" | "ACCEPTED" | "REJECTED";
        resolutionNote: string;
      };
  const [dialog, setDialog] = React.useState<DialogState>({ open: false });

  const fetchSubmissions = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (federationFilter !== "all") params.set("federation", federationFilter);
      const res = await fetch(`/api/federation-submissions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setSubmissions(json.data);
    } catch {
      setError("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  }, [federationFilter]);

  React.useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const openTransitionDialog = React.useCallback(
    (submissionId: string, to: "SUBMITTED" | "ACCEPTED" | "REJECTED") => {
      setDialog({ open: true, submissionId, to, resolutionNote: "" });
    },
    []
  );

  const handleTransition = async () => {
    if (!dialog.open) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/federation-submissions/${dialog.submissionId}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: dialog.to,
          ...(dialog.resolutionNote && { resolutionNote: dialog.resolutionNote }),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Transition failed");
      }
      toast.success(`Submission marked as ${dialog.to.toLowerCase()}`);
      setDialog({ open: false });
      await fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsTransitioning(false);
    }
  };

  const columns: ColumnDef<FederationSubmission>[] = React.useMemo(
    () => [
      {
        accessorKey: "federation",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Federation" />,
        cell: ({ row }) => <FederationBadge federation={row.original.federation} />,
        filterFn: (row, _id, value: string[]) => value.includes(row.original.federation),
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: (row, _id, value: string[]) => value.includes(row.original.status),
      },
      {
        id: "athletes",
        accessorFn: (row) => row._count.athletes,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Athletes" />,
        cell: ({ row }) => <span className="text-sm">{row.original._count.athletes}</span>,
      },
      {
        id: "createdBy",
        accessorFn: (row) => row.createdBy.name ?? row.createdBy.email,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created by" />,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.createdBy.name ?? row.original.createdBy.email}
          </span>
        ),
      },
      {
        accessorKey: "submittedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted at" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.submittedAt)}
          </span>
        ),
      },
      {
        accessorKey: "resolvedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Resolved at" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.resolvedAt)}
          </span>
        ),
      },
      {
        accessorKey: "externalRef",
        header: ({ column }) => <DataTableColumnHeader column={column} title="External ref" />,
        cell: ({ row }) => (
          <span className="text-sm font-mono">
            {row.original.externalRef ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const sub = row.original;
          if (sub.status === "DRAFT") {
            return (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openTransitionDialog(sub.id, "SUBMITTED")}
                >
                  Mark Submitted
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/dashboard/federation-submissions/${sub.id}`}>Edit</Link>
                </Button>
              </div>
            );
          }
          if (sub.status === "SUBMITTED") {
            return (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openTransitionDialog(sub.id, "ACCEPTED")}
                >
                  Mark Accepted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => openTransitionDialog(sub.id, "REJECTED")}
                >
                  Mark Rejected
                </Button>
              </div>
            );
          }
          return null;
        },
      },
    ],
    [openTransitionDialog]
  );

  const table = useReactTable({
    data: submissions,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    const col = table.getColumn("status");
    const current = (col?.getFilterValue() as string[]) ?? [];
    const next = checked ? [...current, status] : current.filter((s) => s !== status);
    col?.setFilterValue(next.length > 0 ? next : undefined);
  };

  const isFiltered = table.getState().columnFilters.length > 0;
  const allStatuses = ["DRAFT", "SUBMITTED", "ACCEPTED", "REJECTED"];

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Federation Submissions"
        description="Manage and track federation submission requests for your organisation."
        actions={
          <Button asChild>
            <Link href="/dashboard/federation-submissions/new">
              <Plus className="mr-2 h-4 w-4" />
              New Submission
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Federation filter — single-select */}
          <Select value={federationFilter} onValueChange={setFederationFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Federation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Federations</SelectItem>
              <SelectItem value="SKATE_CANADA">Skate Canada</SelectItem>
              <SelectItem value="USFS">USFS</SelectItem>
              <SelectItem value="ISU">ISU</SelectItem>
            </SelectContent>
          </Select>

          {/* Status filter — multi-select popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-dashed">
                <Filter className="mr-2 h-4 w-4" />
                Status
                {(table.getColumn("status")?.getFilterValue() as string[] | undefined)?.length ? (
                  <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                    {(table.getColumn("status")?.getFilterValue() as string[]).length}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-3" align="start">
              <div className="space-y-2">
                {allStatuses.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-filter-${status}`}
                      checked={
                        (
                          table.getColumn("status")?.getFilterValue() as string[] | undefined
                        )?.includes(status) ?? false
                      }
                      onCheckedChange={(checked) => handleStatusFilterChange(status, !!checked)}
                    />
                    <label
                      htmlFor={`status-filter-${status}`}
                      className="text-sm font-medium leading-none"
                    >
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </label>
                  </div>
                ))}
              </div>
              {isFiltered && (
                <Button
                  variant="ghost"
                  className="mt-2 w-full justify-center text-sm"
                  onClick={() => table.resetColumnFilters()}
                >
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <DataTableViewOptions table={table} />

          <Button variant="outline" onClick={() => void fetchSubmissions()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && submissions.length === 0 && (
        <div className="rounded-md border">
          <div className="border-b px-4 py-3">
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-24" />
              ))}
            </div>
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                {Array.from({ length: 6 }).map((__, j) => (
                  <Skeleton key={j} className="h-4 w-24" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>{error}</p>
            <Button variant="outline" onClick={() => void fetchSubmissions()}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {(!isLoading || submissions.length > 0) && !error && (
        <>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
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
                    <TableCell colSpan={columns.length} className="h-64 text-center">
                      <EmptyState
                        icon={Send}
                        title="No federation submissions yet"
                        description="Submit athletes to a federation for membership renewals or competition entries."
                        action={{
                          label: "New submission",
                          href: "/dashboard/federation-submissions/new",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
        </>
      )}

      {/* Transition confirmation dialog */}
      <AlertDialog open={dialog.open} onOpenChange={(open) => !open && setDialog({ open: false })}>
        {dialog.open && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dialog.to === "SUBMITTED"
                  ? "Mark as Submitted"
                  : dialog.to === "ACCEPTED"
                    ? "Mark as Accepted"
                    : "Mark as Rejected"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.to === "SUBMITTED"
                  ? "This will mark the submission as submitted to the federation. Are you sure?"
                  : dialog.to === "ACCEPTED"
                    ? "This will mark the submission as accepted. This action cannot be undone."
                    : "This will mark the submission as rejected. This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {(dialog.to === "ACCEPTED" || dialog.to === "REJECTED") && (
              <div className="space-y-2 py-2">
                <Label htmlFor="resolution-note">Resolution note (optional)</Label>
                <Textarea
                  id="resolution-note"
                  placeholder="Add a note about the resolution…"
                  value={dialog.resolutionNote}
                  onChange={(e) =>
                    setDialog((prev) =>
                      prev.open ? { ...prev, resolutionNote: e.target.value } : prev
                    )
                  }
                  rows={3}
                />
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isTransitioning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleTransition();
                }}
                disabled={isTransitioning}
                className={
                  dialog.to === "REJECTED"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }
              >
                {isTransitioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
