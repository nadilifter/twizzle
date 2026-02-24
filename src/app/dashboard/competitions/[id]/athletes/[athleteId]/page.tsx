"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Shield,
  Heart,
  ClipboardList,
  Users,
  X,
  Eye,
} from "lucide-react"
import { calculateAge } from "@/lib/age-utils"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Types ──────────────────────────────────────────────────────────

interface WaiverPageData {
  id: string
  pageNumber: number
  title: string | null
  content: string
  signature: {
    signatureData: string
    signedByName: string
    signedByEmail: string
    signedAt: string
  } | null
}

interface WaiverData {
  id: string
  title: string
  signed: boolean
  signedAt: string | null
  pages: WaiverPageData[]
}

interface AthleteDetail {
  competitionName: string
  athlete: {
    id: string
    firstName: string | null
    lastName: string | null
    birthDate: string | null
    gender: string | null
    level: { id: string; name: string } | null
    guardians: {
      id: string
      name: string
      email: string
      phone: string | null
      relationship: string | null
      isPrimary: boolean
    }[]
  }
  entries: {
    id: string
    status: string
    category: { id: string; label: string; resultType: string }
    seedMark: string | null
    seedMarkStatus: string | null
  }[]
  compliance: {
    membership: {
      required: boolean
      status: string
      memberships: { name: string; groupName: string; status: string }[]
    }
    waivers: {
      required: boolean
      status: string
      waivers: WaiverData[]
    }
    medical: {
      required: boolean
      status: string
      info: {
        id: string
        allergies: string[]
        medications: string[]
        conditions: string[]
        dietaryRestrictions: string[]
        insuranceProvider: string | null
        insurancePolicyNumber: string | null
        emergencyContactName: string | null
        emergencyContactPhone: string | null
        emergencyContactRelation: string | null
        additionalNotes: string | null
        createdAt: string
        updatedAt: string
      } | null
    }
  }
  requirements: {
    hasLevelRestriction: boolean
    hasMembershipRestriction: boolean
    hasWaiverRestriction: boolean
    hasMedicalRequirement: boolean
  }
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

function formatEntryStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const f = firstName?.charAt(0) ?? ""
  const l = lastName?.charAt(0) ?? ""
  return (f + l).toUpperCase() || "?"
}

// ─── Page Component ─────────────────────────────────────────────────

export default function CompetitionAthleteDetailPage() {
  const params = useParams()
  const competitionId = typeof params.id === "string" ? params.id : ""
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : ""

  const [data, setData] = React.useState<AthleteDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [viewingWaiver, setViewingWaiver] = React.useState<WaiverData | null>(null)

  const athleteName = data
    ? [data.athlete.firstName, data.athlete.lastName].filter(Boolean).join(" ") || "Unknown Athlete"
    : undefined

  useBreadcrumbOverride(
    data ? `/dashboard/competitions/${competitionId}` : undefined,
    data?.competitionName,
  )
  useBreadcrumbOverride(
    data ? `/dashboard/competitions/${competitionId}/athletes/${athleteId}` : undefined,
    athleteName,
  )

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/competitions/${competitionId}/athletes/${athleteId}`
        )
        if (!response.ok) throw new Error("Failed to fetch")
        const json = await response.json()
        setData(json)
      } catch {
        toast.error("Failed to load athlete details")
      } finally {
        setLoading(false)
      }
    }
    if (competitionId && athleteId) fetchData()
  }, [competitionId, athleteId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading athlete details...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Athlete Not Found</h1>
        <p className="text-muted-foreground">
          Could not load this athlete&apos;s competition details.
        </p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/competitions/${competitionId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Competition
          </Link>
        </Button>
      </div>
    )
  }

  const { athlete, entries, compliance, requirements } = data
  const age = calculateAge(athlete.birthDate)
  const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) ?? athlete.guardians[0]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/competitions/${competitionId}?tab=athletes`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Athletes
          </Link>
        </Button>
      </div>

      {/* Profile + Medical row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-8 pb-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                <AvatarFallback className="text-2xl font-bold bg-primary/10">
                  {getInitials(athlete.firstName, athlete.lastName)}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-xl font-bold tracking-tight mt-4">{athleteName ?? "Unknown Athlete"}</h1>
              {athlete.level && (
                <Badge variant="outline" className="mt-2">{athlete.level.name}</Badge>
              )}
              <Separator className="my-4 w-full" />
              <div className="w-full space-y-2.5 text-sm text-left">
                {athlete.birthDate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span>
                      {format(new Date(athlete.birthDate), "MMM d, yyyy")}
                      {age !== null && (
                        <span className="ml-1 text-foreground font-medium">({age} yrs)</span>
                      )}
                    </span>
                  </div>
                )}
                {athlete.gender && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-4 w-4 shrink-0 flex items-center justify-center text-xs font-bold">
                      {athlete.gender.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      {athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1).toLowerCase()}
                    </span>
                  </div>
                )}
                {primaryGuardian && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {primaryGuardian.name}
                      {primaryGuardian.email && (
                        <span className="text-xs ml-1">
                          ({primaryGuardian.email})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Card (front and center, 2/3 width) */}
        {requirements.hasMedicalRequirement ? (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Heart className="h-5 w-5" />
                Medical Information
                <ComplianceStatusBadge status={compliance.medical.status} />
              </CardTitle>
              {compliance.medical.info && (
                <CardDescription>
                  Last updated: {format(new Date(compliance.medical.info.updatedAt), "MMM d, yyyy")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {compliance.medical.info ? (
                <MedicalInfoDisplay info={compliance.medical.info} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No medical information on file for this athlete.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="md:col-span-2" />
        )}
      </div>

      {/* Registrations */}
      <RegistrationsTable entries={entries} />

      {/* Membership + Waivers row */}
      {(requirements.hasMembershipRestriction || requirements.hasWaiverRestriction) && (
        <div className="grid gap-6 md:grid-cols-2">
          {requirements.hasMembershipRestriction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5" />
                  Membership
                  <ComplianceStatusBadge status={compliance.membership.status} />
                </CardTitle>
                <CardDescription>Required memberships for this competition</CardDescription>
              </CardHeader>
              <CardContent>
                {compliance.membership.memberships.length > 0 ? (
                  <div className="space-y-3">
                    {compliance.membership.memberships.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{m.groupName}</p>
                          <p className="text-xs text-muted-foreground">{m.name}</p>
                        </div>
                        <MembershipStatusBadge status={m.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No membership data available.</p>
                )}
              </CardContent>
            </Card>
          )}

          {requirements.hasWaiverRestriction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" />
                  Waivers
                  <ComplianceStatusBadge status={compliance.waivers.status} />
                </CardTitle>
                <CardDescription>Required waivers for this competition</CardDescription>
              </CardHeader>
              <CardContent>
                {compliance.waivers.waivers.length > 0 ? (
                  <div className="space-y-3">
                    {compliance.waivers.waivers.map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{w.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {w.signed ? (
                            <>
                              <div className="flex items-center gap-1.5 text-green-700">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm">Signed</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setViewingWaiver(w)}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                View
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5 text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Not Signed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No waiver data available.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Waiver Viewer Dialog */}
      <WaiverViewerDialog
        waiver={viewingWaiver}
        onClose={() => setViewingWaiver(null)}
      />
    </div>
  )
}

// ─── Registrations Table ─────────────────────────────────────────────

type EntryRow = AthleteDetail["entries"][number]

const registrationColumns: ColumnDef<EntryRow>[] = [
  {
    id: "event",
    accessorFn: (row) => row.category.label,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.category.label}</span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={ENTRY_STATUS_STYLES[row.original.status] ?? ""}
      >
        {formatEntryStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    id: "resultType",
    accessorFn: (row) => row.category.resultType,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Result Type" />
    ),
    cell: ({ row }) => row.original.category.resultType,
  },
  {
    accessorKey: "seedMark",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Seed Mark" />
    ),
    cell: ({ row }) => row.original.seedMark ?? "-",
  },
  {
    accessorKey: "seedMarkStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Seed Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.seedMarkStatus
      if (!status) return "-"
      return (
        <Badge
          variant="outline"
          className={ENTRY_STATUS_STYLES[status] ?? ""}
        >
          {formatEntryStatus(status)}
        </Badge>
      )
    },
  },
]

function RegistrationsTable({ entries }: { entries: EntryRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data: entries,
    columns: registrationColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Registrations
        </CardTitle>
        <CardDescription>
          {entries.length} event{entries.length === 1 ? "" : "s"} registered
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                  <TableCell
                    colSpan={registrationColumns.length}
                    className="h-24 text-center"
                  >
                    No event registrations found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Waiver Viewer Dialog ───────────────────────────────────────────

function WaiverViewerDialog({
  waiver,
  onClose,
}: {
  waiver: WaiverData | null
  onClose: () => void
}) {
  if (!waiver) return null

  return (
    <Dialog open={!!waiver} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {waiver.title}
          </DialogTitle>
          <DialogDescription>
            {waiver.signed && waiver.signedAt
              ? `Signed on ${format(new Date(waiver.signedAt), "MMMM d, yyyy 'at' h:mm a")}`
              : "This waiver has not been signed"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {waiver.pages.map((page) => (
            <div key={page.id} className="space-y-4">
              {page.title && (
                <h3 className="font-semibold text-sm">
                  {waiver.pages.length > 1 && `Page ${page.pageNumber}: `}
                  {page.title}
                </h3>
              )}

              <div
                className="prose prose-sm max-w-none text-sm border rounded-lg p-4 bg-muted/30"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />

              {page.signature ? (
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Signature
                  </p>
                  <div className="bg-white rounded border p-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.signature.signatureData}
                      alt={`Signature by ${page.signature.signedByName}`}
                      className="h-20 w-auto"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Signed by: {page.signature.signedByName} ({page.signature.signedByEmail})</p>
                    <p>Date: {format(new Date(page.signature.signedAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 border-dashed">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No signature on file for this page
                  </p>
                </div>
              )}

              {page.pageNumber < waiver.pages.length && <Separator />}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Status Badges ──────────────────────────────────────────────────

function ComplianceStatusBadge({ status }: { status: string }) {
  const isGood = status === "verified" || status === "signed" || status === "complete"
  if (status === "not_required") return null

  const label =
    status === "verified"
      ? "Verified"
      : status === "missing"
        ? "Missing"
        : status === "signed"
          ? "All Signed"
          : status === "unsigned"
            ? "Incomplete"
            : status === "complete"
              ? "On File"
              : "Incomplete"

  return (
    <Badge
      variant="outline"
      className={
        isGood
          ? "ml-2 bg-green-50 text-green-700 border-green-200"
          : "ml-2 bg-red-50 text-destructive border-red-200"
      }
    >
      {isGood ? (
        <CheckCircle2 className="h-3 w-3 mr-1" />
      ) : (
        <AlertCircle className="h-3 w-3 mr-1" />
      )}
      {label}
    </Badge>
  )
}

function MembershipStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Active
      </Badge>
    )
  }
  if (status === "none") {
    return (
      <Badge variant="outline" className="bg-red-50 text-destructive border-red-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Not Found
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

// ─── Medical Display ────────────────────────────────────────────────

function MedicalInfoDisplay({
  info,
}: {
  info: NonNullable<AthleteDetail["compliance"]["medical"]["info"]>
}) {
  const hasAllergies = info.allergies.length > 0
  const hasConditions = info.conditions.length > 0
  const hasMedications = info.medications.length > 0
  const hasDietary = info.dietaryRestrictions.length > 0
  const hasEmergencyContact = info.emergencyContactName || info.emergencyContactPhone
  const hasInsurance = info.insuranceProvider || info.insurancePolicyNumber

  return (
    <div className="space-y-3">
      {/* Allergies + Conditions (most critical) */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Allergies</h4>
        {hasAllergies ? (
          <div className="flex flex-wrap gap-1.5">
            {info.allergies.map((a, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            None
          </p>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Conditions</h4>
        {hasConditions ? (
          <div className="flex flex-wrap gap-1.5">
            {info.conditions.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            None
          </p>
        )}
      </div>

      {hasMedications && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Medications</h4>
          <div className="flex flex-wrap gap-1.5">
            {info.medications.map((m, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasEmergencyContact && (
        <>
          <Separator />
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Emergency Contact</h4>
            <p className="text-sm">
              {info.emergencyContactName}
              {info.emergencyContactPhone && ` \u2022 ${info.emergencyContactPhone}`}
            </p>
            {info.emergencyContactRelation && (
              <p className="text-xs text-muted-foreground">{info.emergencyContactRelation}</p>
            )}
          </div>
        </>
      )}

      {(hasDietary || hasInsurance || info.additionalNotes) && (
        <>
          <Separator />
          {hasDietary && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Dietary Restrictions</h4>
              <div className="flex flex-wrap gap-1.5">
                {info.dietaryRestrictions.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {d}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {hasInsurance && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Insurance</h4>
              <p className="text-sm">{info.insuranceProvider}</p>
              {info.insurancePolicyNumber && (
                <p className="text-xs text-muted-foreground">Policy: {info.insurancePolicyNumber}</p>
              )}
            </div>
          )}
          {info.additionalNotes && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{info.additionalNotes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
