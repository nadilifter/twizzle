"use client"

import * as React from "react"
import Link from "next/link"
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
import { CheckCircle2, AlertCircle, Search, UserCheck } from "lucide-react"
import { toast } from "sonner"

import { calculateAge } from "@/lib/age-utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"

interface CompetitionAthlete {
  id: string
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  gender: string | null
  level: { id: string; name: string } | null
  eventCount: number
  compliance: {
    membership?: "verified" | "missing"
    waiver?: "signed" | "unsigned"
    medical?: "complete" | "incomplete"
  }
}

interface Requirements {
  hasLevelRestriction: boolean
  hasMembershipRestriction: boolean
  hasWaiverRestriction: boolean
  hasMedicalRequirement: boolean
}

interface AthletesTabProps {
  competitionId: string
}

function getAthleteName(athlete: CompetitionAthlete): string {
  return [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Unknown athlete"
}

function ComplianceBadge({ status, goodLabel, badLabel }: {
  status: "verified" | "missing" | "signed" | "unsigned" | "complete" | "incomplete"
  goodLabel: string
  badLabel: string
}) {
  const isGood = status === "verified" || status === "signed" || status === "complete"
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
  )
}

export function AthletesTab({ competitionId }: AthletesTabProps) {
  const [athletes, setAthletes] = React.useState<CompetitionAthlete[]>([])
  const [requirements, setRequirements] = React.useState<Requirements>({
    hasLevelRestriction: false,
    hasMembershipRestriction: false,
    hasWaiverRestriction: false,
    hasMedicalRequirement: false,
  })
  const [loading, setLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  React.useEffect(() => {
    const fetchAthletes = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/competitions/${competitionId}/athletes`)
        if (!response.ok) throw new Error("Failed to fetch athletes")
        const data = await response.json()
        setAthletes(data.athletes)
        setRequirements(data.requirements)
      } catch {
        toast.error("Failed to load athletes")
      } finally {
        setLoading(false)
      }
    }
    fetchAthletes()
  }, [competitionId])

  const columns = React.useMemo<ColumnDef<CompetitionAthlete>[]>(() => {
    const cols: ColumnDef<CompetitionAthlete>[] = [
      {
        id: "name",
        accessorFn: (row) => getAthleteName(row),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Athlete" />
        ),
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
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Events" />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.eventCount}</Badge>
        ),
      },
      {
        id: "age",
        accessorFn: (row) => calculateAge(row.birthDate),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Age" />
        ),
        cell: ({ row }) => {
          const age = calculateAge(row.original.birthDate)
          return age !== null ? age : "-"
        },
      },
      {
        accessorKey: "gender",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gender" />
        ),
        cell: ({ row }) => {
          const gender = row.original.gender
          if (!gender) return "-"
          return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
        },
      },
    ]

    if (requirements.hasLevelRestriction) {
      cols.push({
        id: "level",
        accessorFn: (row) => row.level?.name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Level" />
        ),
        cell: ({ row }) => {
          const level = row.original.level
          if (!level) return <span className="text-muted-foreground">-</span>
          return <Badge variant="outline">{level.name}</Badge>
        },
      })
    }

    if (requirements.hasMembershipRestriction) {
      cols.push({
        id: "membership",
        accessorFn: (row) => row.compliance.membership ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Membership" />
        ),
        cell: ({ row }) => {
          const status = row.original.compliance.membership
          if (!status) return "-"
          return <ComplianceBadge status={status} goodLabel="Verified" badLabel="Missing" />
        },
      })
    }

    if (requirements.hasWaiverRestriction) {
      cols.push({
        id: "waiver",
        accessorFn: (row) => row.compliance.waiver ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Waivers" />
        ),
        cell: ({ row }) => {
          const status = row.original.compliance.waiver
          if (!status) return "-"
          return <ComplianceBadge status={status} goodLabel="Signed" badLabel="Not Signed" />
        },
      })
    }

    if (requirements.hasMedicalRequirement) {
      cols.push({
        id: "medical",
        accessorFn: (row) => row.compliance.medical ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Medical" />
        ),
        cell: ({ row }) => {
          const status = row.original.compliance.medical
          if (!status) return "-"
          return <ComplianceBadge status={status} goodLabel="On File" badLabel="Incomplete" />
        },
      })
    }

    return cols
  }, [requirements, competitionId])

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
      pagination: { pageSize: 25 },
    },
  })

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
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
            {table.getPageCount() > 1 && (
              <DataTablePagination table={table} pageSizeOptions={[10, 25, 50]} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
