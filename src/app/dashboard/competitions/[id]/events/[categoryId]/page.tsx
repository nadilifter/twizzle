"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
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
import {
  ArrowLeft,
  AlertCircle,
  Check,
  ClipboardList,
  Filter,
  Flag,
  Loader2,
  Minus,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react"
import { calculateAge } from "@/lib/age-utils"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ──────────────────────────────────────────────────────────

interface EntryAthlete {
  id: string
  firstName: string | null
  lastName: string | null
  gender: string | null
  birthDate: string | null
  family: { id: string; name: string } | null
}

interface EventEntry {
  id: string
  status: string
  athlete: EntryAthlete
  seedMark: string
  seedValue: number | null
  seedHandTimed: boolean
  seedMarkStatus: string | null
  seedMarkNotes: string | null
  hasSeed: boolean
}

interface CategoryDetail {
  id: string
  label: string
  resultType: string
  sortDirection: "ASC" | "DESC"
  precision: number
  seedMarkRequired: boolean
  isTeamEvent: boolean
  teamSize: number | null
  isActive: boolean
  entryCount: number
  resultCount: number
  seedSubmittedCount: number
}

interface EventDetailData {
  competitionName: string
  category: CategoryDetail
  entries: EventEntry[]
}

// ─── Constants ──────────────────────────────────────────────────────

const ENTRY_STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  PENDING_SEED: "bg-yellow-50 text-yellow-700 border-yellow-200",
  PENDING_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  WITHDRAWN: "bg-muted text-muted-foreground",
  SCRATCHED: "bg-muted text-muted-foreground",
}

const SEED_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
}

const RESULT_TYPE_LABELS: Record<string, string> = {
  TIME: "Time",
  DISTANCE: "Distance",
  HEIGHT: "Height",
  SCORE: "Score",
  PLACEMENT: "Placement",
}

const ALL_ENTRY_STATUSES = [
  "PENDING_SEED",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "SCRATCHED",
] as const

const ENTRY_STATUS_LABELS: Record<string, string> = {
  PENDING_SEED: "Pending seed",
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  SCRATCHED: "Scratched",
}

const ALL_GENDERS = [
  "MALE",
  "FEMALE",
  "OTHER",
  "PREFER_NOT_TO_SAY",
] as const

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
}

const SEED_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

function formatEntryStatus(status: string): string {
  return ENTRY_STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getAthleteName(athlete: EntryAthlete): string {
  return [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Unknown athlete"
}

// ─── Page Component ─────────────────────────────────────────────────

export default function CompetitionEventDetailPage() {
  const params = useParams()
  const competitionId = typeof params.id === "string" ? params.id : ""
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : ""

  const [data, setData] = React.useState<EventDetailData | null>(null)
  const [loading, setLoading] = React.useState(true)

  useBreadcrumbOverride(
    data ? `/dashboard/competitions/${competitionId}` : undefined,
    data?.competitionName,
  )
  useBreadcrumbOverride(
    data ? `/dashboard/competitions/${competitionId}/events/${categoryId}` : undefined,
    data?.category.label,
  )

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/competitions/${competitionId}/events/${categoryId}`
        )
        if (!response.ok) throw new Error("Failed to fetch")
        const json = await response.json()
        setData(json)
      } catch {
        toast.error("Failed to load event details")
      } finally {
        setLoading(false)
      }
    }
    if (competitionId && categoryId) fetchData()
  }, [competitionId, categoryId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground">
          Could not load this event&apos;s details.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/competitions/${competitionId}?tab=events`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>
    )
  }

  const { category, entries } = data

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/competitions/${competitionId}?tab=events`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Link>
        </Button>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Flag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{category.label}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {RESULT_TYPE_LABELS[category.resultType] ?? category.resultType}
              </Badge>
              {category.isTeamEvent && (
                <Badge variant="secondary">
                  Team Event{category.teamSize ? ` (${category.teamSize})` : ""}
                </Badge>
              )}
              {!category.isActive && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{category.entryCount}</p>
                <p className="text-xs text-muted-foreground">Registrants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{category.resultCount}</p>
                <p className="text-xs text-muted-foreground">Results Recorded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {category.seedSubmittedCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{category.entryCount}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">Seed Marks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {category.isTeamEvent && category.teamSize && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{category.teamSize}</p>
                  <p className="text-xs text-muted-foreground">Per Team</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Registrants table */}
      <RegistrantsTable
        entries={entries}
        competitionId={competitionId}
        category={category}
      />
    </div>
  )
}

// ─── Registrants Table ──────────────────────────────────────────────

function RegistrantsTable({
  entries,
  competitionId,
  category,
}: {
  entries: EventEntry[]
  competitionId: string
  category: CategoryDetail
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const isTimeEvent = category.resultType === "TIME"

  const columns = React.useMemo<ColumnDef<EventEntry>[]>(() => {
    const cols: ColumnDef<EventEntry>[] = [
      {
        id: "athlete",
        accessorFn: (row) => getAthleteName(row.athlete),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Athlete" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/dashboard/competitions/${competitionId}/athletes/${row.original.athlete.id}`}
            className="font-medium text-primary hover:underline"
          >
            {getAthleteName(row.original.athlete)}
          </Link>
        ),
        filterFn: "includesString",
      },
      {
        id: "gender",
        accessorFn: (row) => row.athlete.gender ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gender" />
        ),
        cell: ({ row }) => {
          const gender = row.original.athlete.gender
          if (!gender) return "-"
          return GENDER_LABELS[gender] ?? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id))
        },
      },
      {
        id: "age",
        accessorFn: (row) => calculateAge(row.athlete.birthDate),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Age" />
        ),
        cell: ({ row }) => {
          const age = calculateAge(row.original.athlete.birthDate)
          return age !== null ? age : "-"
        },
        filterFn: (row, id, value: [number | null, number | null]) => {
          const age = row.getValue(id) as number | null
          if (age === null) return false
          const [min, max] = value
          if (min !== null && age < min) return false
          if (max !== null && age > max) return false
          return true
        },
      },
      {
        id: "seedMark",
        accessorFn: (row) => row.seedValue,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Seed Mark" />
        ),
        cell: ({ row }) => {
          const mark = row.original.seedMark
          if (mark === "-") return <span className="text-muted-foreground">-</span>
          return <span className="font-mono text-sm">{mark}</span>
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.seedValue
          const b = rowB.original.seedValue
          if (a === null && b === null) return 0
          if (a === null) return 1
          if (b === null) return -1
          return a - b
        },
      },
    ]

    if (isTimeEvent) {
      cols.push({
        id: "handTimed",
        accessorFn: (row) => (row.seedHandTimed ? "Yes" : "No"),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Hand Timed" />
        ),
        cell: ({ row }) =>
          row.original.hasSeed ? (
            row.original.seedHandTimed ? (
              <Check className="h-4 w-4 text-yellow-600" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id))
        },
      })
    }

    cols.push({
      id: "entryStatus",
      accessorFn: (row) => row.status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Entry Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={ENTRY_STATUS_STYLES[row.original.status] ?? ""}
        >
          {formatEntryStatus(row.original.status)}
        </Badge>
      ),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    })

    if (category.seedMarkRequired) {
      cols.push({
        id: "seedStatus",
        accessorFn: (row) => row.seedMarkStatus ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Seed Status" />
        ),
        cell: ({ row }) => {
          const status = row.original.seedMarkStatus
          if (!status) return <span className="text-muted-foreground">-</span>
          return (
            <Badge
              variant="outline"
              className={SEED_STATUS_STYLES[status] ?? ""}
            >
              {SEED_STATUS_LABELS[status] ?? status}
            </Badge>
          )
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id))
        },
      })
    }

    return cols
  }, [competitionId, isTimeEvent, category.seedMarkRequired])

  const table = useReactTable({
    data: entries,
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
  })

  const handleFilterChange = (columnId: string, value: string, checked: boolean) => {
    const column = table.getColumn(columnId)
    const filterValue = (column?.getFilterValue() as string[]) || []
    if (checked) {
      column?.setFilterValue([...filterValue, value])
    } else {
      column?.setFilterValue(filterValue.filter((v) => v !== value))
    }
  }

  const isFiltered = table.getState().columnFilters.some((f) => f.id !== "athlete")

  const ageFilter = (table.getColumn("age")?.getFilterValue() as [number | null, number | null]) ?? [null, null]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Registrants</CardTitle>
            <CardDescription className="mt-1">
              {entries.length} athlete{entries.length === 1 ? "" : "s"} registered
              {category.seedMarkRequired && (
                <> &middot; {entries.filter((e) => e.hasSeed).length} seed mark{entries.filter((e) => e.hasSeed).length === 1 ? "" : "s"} submitted</>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search athletes..."
                value={(table.getColumn("athlete")?.getFilterValue() as string) ?? ""}
                onChange={(e) => table.getColumn("athlete")?.setFilterValue(e.target.value)}
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
                      {table.getState().columnFilters.filter((f) => f.id !== "athlete").length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0" align="end">
                <div className="p-4 pb-0">
                  <h4 className="font-medium leading-none">Filters</h4>
                </div>
                <div className="p-4 pt-2 space-y-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Gender</h4>
                    <div className="grid gap-2">
                      {ALL_GENDERS.map((gender) => (
                        <div key={gender} className="flex items-center space-x-2">
                          <Checkbox
                            id={`gender-${gender}`}
                            checked={(table.getColumn("gender")?.getFilterValue() as string[])?.includes(gender)}
                            onCheckedChange={(checked) => handleFilterChange("gender", gender, !!checked)}
                          />
                          <label htmlFor={`gender-${gender}`} className="text-sm leading-none">
                            {GENDER_LABELS[gender]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Age Range</h4>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        className="h-8 text-sm"
                        value={ageFilter[0] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null
                          table.getColumn("age")?.setFilterValue([val, ageFilter[1]])
                        }}
                      />
                      <span className="text-muted-foreground text-xs">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        className="h-8 text-sm"
                        value={ageFilter[1] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null
                          table.getColumn("age")?.setFilterValue([ageFilter[0], val])
                        }}
                      />
                    </div>
                  </div>
                  {isTimeEvent && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Hand Timed</h4>
                      <div className="grid gap-2">
                        {(["Yes", "No"] as const).map((val) => (
                          <div key={val} className="flex items-center space-x-2">
                            <Checkbox
                              id={`handTimed-${val}`}
                              checked={(table.getColumn("handTimed")?.getFilterValue() as string[])?.includes(val)}
                              onCheckedChange={(checked) => handleFilterChange("handTimed", val, !!checked)}
                            />
                            <label htmlFor={`handTimed-${val}`} className="text-sm leading-none">
                              {val}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Entry Status</h4>
                    <div className="grid gap-2">
                      {ALL_ENTRY_STATUSES.map((status) => (
                        <div key={status} className="flex items-center space-x-2">
                          <Checkbox
                            id={`entryStatus-${status}`}
                            checked={(table.getColumn("entryStatus")?.getFilterValue() as string[])?.includes(status)}
                            onCheckedChange={(checked) => handleFilterChange("entryStatus", status, !!checked)}
                          />
                          <label htmlFor={`entryStatus-${status}`} className="text-sm leading-none">
                            {ENTRY_STATUS_LABELS[status]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {category.seedMarkRequired && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Seed Status</h4>
                      <div className="grid gap-2">
                        {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                          <div key={status} className="flex items-center space-x-2">
                            <Checkbox
                              id={`seedStatus-${status}`}
                              checked={(table.getColumn("seedStatus")?.getFilterValue() as string[])?.includes(status)}
                              onCheckedChange={(checked) => handleFilterChange("seedStatus", status, !!checked)}
                            />
                            <label htmlFor={`seedStatus-${status}`} className="text-sm leading-none">
                              {SEED_STATUS_LABELS[status]}
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
                        const athleteFilter = table.getColumn("athlete")?.getFilterValue()
                        table.resetColumnFilters()
                        if (athleteFilter) {
                          table.getColumn("athlete")?.setFilterValue(athleteFilter)
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
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No Registrants Yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Athletes will appear here once they register for this event.
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
            <DataTablePagination table={table} pageSizeOptions={[10, 20, 30, 50]} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
