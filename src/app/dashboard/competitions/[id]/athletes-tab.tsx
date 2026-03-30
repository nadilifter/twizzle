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
import { CheckCircle2, AlertCircle, Search, UserCheck, Filter, X } from "lucide-react";
import { toast } from "sonner";

import { calculateAge } from "@/lib/age-utils";
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

interface CompetitionAthlete {
  id: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  gender: string | null;
  level: { id: string; name: string } | null;
  eventCount: number;
  compliance: {
    membership?: "verified" | "missing";
    waiver?: "signed" | "unsigned";
    medical?: "complete" | "incomplete";
  };
}

interface Requirements {
  hasLevelRestriction: boolean;
  hasMembershipRestriction: boolean;
  hasWaiverRestriction: boolean;
  hasMedicalRequirement: boolean;
}

interface AthletesTabProps {
  competitionId: string;
}

function getAthleteName(athlete: CompetitionAthlete): string {
  return [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Unknown athlete";
}

function ComplianceBadge({
  status,
  goodLabel,
  badLabel,
}: {
  status: "verified" | "missing" | "signed" | "unsigned" | "complete" | "incomplete";
  goodLabel: string;
  badLabel: string;
}) {
  const isGood = status === "verified" || status === "signed" || status === "complete";
  return (
    <div className="flex items-center gap-1.5">
      {isGood ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <AlertCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={isGood ? "text-green-700 text-sm" : "text-destructive text-sm"}>
        {isGood ? goodLabel : badLabel}
      </span>
    </div>
  );
}

export function AthletesTab({ competitionId }: AthletesTabProps) {
  const [athletes, setAthletes] = React.useState<CompetitionAthlete[]>([]);
  const [requirements, setRequirements] = React.useState<Requirements>({
    hasLevelRestriction: false,
    hasMembershipRestriction: false,
    hasWaiverRestriction: false,
    hasMedicalRequirement: false,
  });
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  React.useEffect(() => {
    const fetchAthletes = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/competitions/${competitionId}/athletes`);
        if (!response.ok) throw new Error("Failed to fetch athletes");
        const data = await response.json();
        setAthletes(data.athletes);
        setRequirements(data.requirements);
      } catch {
        toast.error("Failed to load athletes");
      } finally {
        setLoading(false);
      }
    };
    fetchAthletes();
  }, [competitionId]);

  const columns = React.useMemo<ColumnDef<CompetitionAthlete>[]>(() => {
    const cols: ColumnDef<CompetitionAthlete>[] = [
      {
        id: "name",
        accessorFn: (row) => getAthleteName(row),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Athlete" />,
        cell: ({ row }) => (
          <Link
            href={`/dashboard/competitions/${competitionId}/athletes/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {getAthleteName(row.original)}
          </Link>
        ),
        filterFn: "includesString",
      },
      {
        accessorKey: "eventCount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Events" />,
        cell: ({ row }) => <Badge variant="secondary">{row.original.eventCount}</Badge>,
      },
      {
        id: "age",
        accessorFn: (row) => calculateAge(row.birthDate),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Age" />,
        cell: ({ row }) => {
          const age = calculateAge(row.original.birthDate);
          return age !== null ? age : "-";
        },
        filterFn: (row, id, value: [number | null, number | null]) => {
          const age = row.getValue(id) as number | null;
          if (age === null) return false;
          const [min, max] = value;
          if (min !== null && age < min) return false;
          if (max !== null && age > max) return false;
          return true;
        },
      },
      {
        accessorKey: "gender",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Gender" />,
        cell: ({ row }) => {
          const gender = row.original.gender;
          if (!gender) return "-";
          return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
    ];

    if (requirements.hasLevelRestriction) {
      cols.push({
        id: "level",
        accessorFn: (row) => row.level?.name ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Level" />,
        cell: ({ row }) => {
          const level = row.original.level;
          if (!level) return <span className="text-muted-foreground">-</span>;
          return <Badge variant="outline">{level.name}</Badge>;
        },
      });
    }

    if (requirements.hasMembershipRestriction) {
      cols.push({
        id: "membership",
        accessorFn: (row) => row.compliance.membership ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Membership" />,
        cell: ({ row }) => {
          const status = row.original.compliance.membership;
          if (!status) return "-";
          return <ComplianceBadge status={status} goodLabel="Verified" badLabel="Missing" />;
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      });
    }

    if (requirements.hasWaiverRestriction) {
      cols.push({
        id: "waiver",
        accessorFn: (row) => row.compliance.waiver ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Waivers" />,
        cell: ({ row }) => {
          const status = row.original.compliance.waiver;
          if (!status) return "-";
          return <ComplianceBadge status={status} goodLabel="Signed" badLabel="Not Signed" />;
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      });
    }

    if (requirements.hasMedicalRequirement) {
      cols.push({
        id: "medical",
        accessorFn: (row) => row.compliance.medical ?? "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Medical" />,
        cell: ({ row }) => {
          const status = row.original.compliance.medical;
          if (!status) return "-";
          return <ComplianceBadge status={status} goodLabel="On File" badLabel="Incomplete" />;
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      });
    }

    return cols;
  }, [requirements, competitionId]);

  const table = useReactTable({
    data: athletes,
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

  const genders = React.useMemo(
    () => Array.from(new Set(athletes.map((a) => a.gender).filter(Boolean))).sort() as string[],
    [athletes]
  );

  const handleFilterChange = (columnId: string, value: string, checked: boolean) => {
    const column = table.getColumn(columnId);
    const filterValue = (column?.getFilterValue() as string[]) || [];
    if (checked) {
      column?.setFilterValue([...filterValue, value]);
    } else {
      column?.setFilterValue(filterValue.filter((v) => v !== value));
    }
  };

  const isFiltered = table.getState().columnFilters.some((f) => f.id !== "name");

  const ageFilter = (table.getColumn("age")?.getFilterValue() as [
    number | null,
    number | null,
  ]) ?? [null, null];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Athletes</CardTitle>
            <CardDescription className="mt-1">
              {loading
                ? "Loading athletes..."
                : `${athletes.length} athlete${athletes.length === 1 ? "" : "s"} registered`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athletes..."
                value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
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
                      {table.getState().columnFilters.filter((f) => f.id !== "name").length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <div className="p-4 pb-0">
                  <h4 className="font-medium leading-none">Filters</h4>
                </div>
                <div className="p-4 pt-2 space-y-4 max-h-[400px] overflow-y-auto">
                  {genders.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Gender</h4>
                      <div className="grid gap-2">
                        {genders.map((gender) => (
                          <div key={gender} className="flex items-center space-x-2">
                            <Checkbox
                              id={`gender-${gender}`}
                              checked={(
                                table.getColumn("gender")?.getFilterValue() as string[]
                              )?.includes(gender)}
                              onCheckedChange={(checked) =>
                                handleFilterChange("gender", gender, !!checked)
                              }
                            />
                            <label htmlFor={`gender-${gender}`} className="text-sm leading-none">
                              {gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Age Range</h4>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        className="h-8 text-sm"
                        value={ageFilter[0] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          table.getColumn("age")?.setFilterValue([val, ageFilter[1]]);
                        }}
                      />
                      <span className="text-muted-foreground text-xs">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        className="h-8 text-sm"
                        value={ageFilter[1] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          table.getColumn("age")?.setFilterValue([ageFilter[0], val]);
                        }}
                      />
                    </div>
                  </div>
                  {requirements.hasMembershipRestriction && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Membership</h4>
                      <div className="grid gap-2">
                        {(["verified", "missing"] as const).map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`membership-${status}`}
                              checked={(
                                table.getColumn("membership")?.getFilterValue() as string[]
                              )?.includes(status)}
                              onCheckedChange={(checked) =>
                                handleFilterChange("membership", status, !!checked)
                              }
                            />
                            <label
                              htmlFor={`membership-${status}`}
                              className="text-sm leading-none"
                            >
                              {status === "verified" ? "Verified" : "Missing"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {requirements.hasWaiverRestriction && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Waivers</h4>
                      <div className="grid gap-2">
                        {(["signed", "unsigned"] as const).map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`waiver-${status}`}
                              checked={(
                                table.getColumn("waiver")?.getFilterValue() as string[]
                              )?.includes(status)}
                              onCheckedChange={(checked) =>
                                handleFilterChange("waiver", status, !!checked)
                              }
                            />
                            <label htmlFor={`waiver-${status}`} className="text-sm leading-none">
                              {status === "signed" ? "Signed" : "Not Signed"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {requirements.hasMedicalRequirement && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Medical</h4>
                      <div className="grid gap-2">
                        {(["complete", "incomplete"] as const).map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`medical-${status}`}
                              checked={(
                                table.getColumn("medical")?.getFilterValue() as string[]
                              )?.includes(status)}
                              onCheckedChange={(checked) =>
                                handleFilterChange("medical", status, !!checked)
                              }
                            />
                            <label htmlFor={`medical-${status}`} className="text-sm leading-none">
                              {status === "complete" ? "On File" : "Incomplete"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isFiltered && (
                    <Button
                      variant="ghost"
                      className="w-full justify-center text-center h-8"
                      onClick={() => {
                        const nameFilter = table.getColumn("name")?.getFilterValue();
                        table.resetColumnFilters();
                        if (nameFilter) {
                          table.getColumn("name")?.setFilterValue(nameFilter);
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
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : athletes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Athletes Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Athletes will appear here once they register for events in this competition.
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
