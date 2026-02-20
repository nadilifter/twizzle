"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Shield,
  Heart,
  Eye,
  Settings,
  Info,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  History,
  ExternalLink,
  Plus,
  MoreHorizontal,
  Clock,
  DollarSign,
  Pause,
  XCircle,
  Play,
  Trash2,
  Trophy,
  MapPin,
  Calendar,
} from "lucide-react"
import { calculateAge } from "@/lib/age-utils"
import { useBreadcrumbOverride } from "@/components/breadcrumb-context"
import { useAthlete } from "@/hooks/use-athletes"
import { useFeatures } from "@/components/feature-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { AthleteConfiguration } from "../athlete-configuration"
import { api, ApiError } from "@/lib/api-client"
import type {
  AthleteWaiverSummary,
  AthleteMedicalSummary,
  AthleteMembershipSummary,
  EnrollmentWithProgram,
  CompetitionEntrySummary,
  EventRegistrationSummary,
} from "@/types/athletes"

interface RegistrationItem {
  id: string
  type: "competition" | "program" | "membership" | "waiver"
  name: string
  detail: string | null
  status: string
  date: string
  link: string | null
}

const REGISTRATION_TYPE_CONFIG: Record<RegistrationItem["type"], { label: string; className: string }> = {
  competition: { label: "Competition", className: "bg-purple-50 text-purple-700 border-purple-200" },
  program: { label: "Program", className: "bg-blue-50 text-blue-700 border-blue-200" },
  membership: { label: "Membership", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  waiver: { label: "Waiver", className: "bg-amber-50 text-amber-700 border-amber-200" },
}

const registrationColumns: ColumnDef<RegistrationItem>[] = [
  {
    id: "type",
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const config = REGISTRATION_TYPE_CONFIG[row.original.type]
      return (
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    id: "detail",
    accessorKey: "detail",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Detail" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.detail ?? "-"}</span>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-normal">
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: "date",
    accessorFn: (row) => new Date(row.date).getTime(),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {format(new Date(row.original.date), "MMM d, yyyy")}
      </span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) =>
      row.original.link ? (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
          <Link href={row.original.link}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null,
    size: 50,
  },
]

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?"
}

export default function AthleteProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const athleteId = typeof params.id === "string" ? params.id : null
  const { isFeatureEnabled } = useFeatures()
  const trainingEnabled = isFeatureEnabled("training")

  const { athlete, isLoading, error, fetchAthlete, updateAthlete } = useAthlete(athleteId)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [viewingWaiver, setViewingWaiver] = React.useState<AthleteWaiverSummary | null>(null)
  const [activeTab, setActiveTabState] = React.useState(searchParams.get("tab") ?? "overview")

  const setActiveTab = React.useCallback((tab: string) => {
    setActiveTabState(tab)
    const p = new URLSearchParams(searchParams.toString())
    if (tab === "overview") {
      p.delete("tab")
    } else {
      p.set("tab", tab)
    }
    const qs = p.toString()
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [searchParams, router])

  useBreadcrumbOverride(
    athlete ? `/dashboard/athletes/${athleteId}` : undefined,
    athlete?.name,
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading athlete profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Error Loading Profile</h1>
        <p className="text-muted-foreground">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => fetchAthlete()}>Try Again</Button>
        </div>
      </div>
    )
  }

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <h1 className="text-2xl font-bold">Athlete Not Found</h1>
        <p className="text-muted-foreground">The athlete you are looking for does not exist.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard/athletes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Athletes
          </Link>
        </Button>
      </div>
    )
  }

  const age = calculateAge(athlete.birthDate)
  const levelInfo = (athlete as any).levelInfo as { id: string; name: string; color: string | null } | null
  const memberships = ((athlete as any).memberships ?? []) as AthleteMembershipSummary[]
  const waivers = ((athlete as any).waivers ?? []) as AthleteWaiverSummary[]
  const medicalInfo = ((athlete as any).medicalInfo ?? null) as AthleteMedicalSummary | null
  const registrations = ((athlete as any).registrations ?? []) as RegistrationItem[]
  const competitionEntries = ((athlete as any).competitionEntries ?? []) as CompetitionEntrySummary[]
  const eventRegistrations = ((athlete as any).eventRegistrations ?? []) as EventRegistrationSummary[]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-background shadow-sm shrink-0">
            <AvatarImage src={athlete.avatar ?? undefined} alt={athlete.name} />
            <AvatarFallback className="text-lg font-bold bg-primary/10">
              {getInitials(athlete.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{athlete.name}</h1>
              {levelInfo ? (
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0"
                  style={levelInfo.color ? { borderColor: levelInfo.color, color: levelInfo.color, backgroundColor: `${levelInfo.color}15` } : undefined}
                >
                  {levelInfo.name}
                </Badge>
              ) : athlete.level ? (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0">
                  {athlete.level}
                </Badge>
              ) : null}
              <Badge variant={athlete.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0">
                {formatStatus(athlete.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap text-sm text-muted-foreground">
              {athlete.birthDate && (
                <>
                  <span>
                    {format(new Date(athlete.birthDate), "MMM d, yyyy")}
                    {age !== null && <span className="text-foreground font-medium ml-1">({age} yrs)</span>}
                  </span>
                  <span className="text-border">·</span>
                </>
              )}
              {athlete.gender && (
                <>
                  <span>{athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1).toLowerCase()}</span>
                  <span className="text-border">·</span>
                </>
              )}
              {athlete.email && (
                <>
                  <span className="truncate max-w-[200px]">{athlete.email}</span>
                  {athlete.family && <span className="text-border">·</span>}
                </>
              )}
              {athlete.family && (
                <span className="truncate max-w-[200px]">
                  {athlete.family.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setIsEditOpen(true)} className="shrink-0">
          <Settings className="mr-2 h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="sm:max-w-2xl p-0">
          <AthleteConfiguration
            athlete={{
              id: athlete.id,
              name: athlete.name,
              firstName: athlete.firstName,
              lastName: athlete.lastName,
              email: athlete.email,
              level: athlete.level,
              status: athlete.status as "ACTIVE" | "INACTIVE" | "TRIAL" | "GRADUATED",
              birthDate: athlete.birthDate,
              gender: athlete.gender ?? null,
              family: athlete.family ? { id: athlete.family.id, name: athlete.family.name } : null,
            }}
            onClose={() => setIsEditOpen(false)}
            onUpdated={async (data) => {
              await updateAthlete(data)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Info className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Calendar className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="competitions" className="gap-2">
            <Trophy className="h-4 w-4" />
            Competitions
          </TabsTrigger>
          <TabsTrigger value="memberships" className="gap-2">
            <Shield className="h-4 w-4" />
            Memberships
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <CalendarCheck className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          {trainingEnabled && (
            <TabsTrigger value="evaluations" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Evaluations
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview">
          <div className="flex flex-col gap-6">
            {/* Medical + Memberships + Waivers row */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Medical Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="h-5 w-5" />
                    Medical Information
                    {medicalInfo && (
                      <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        On File
                      </Badge>
                    )}
                  </CardTitle>
                  {medicalInfo && (
                    <CardDescription>
                      Updated {format(new Date(medicalInfo.updatedAt), "MMM d, yyyy")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {medicalInfo ? (
                    <MedicalInfoDisplay info={medicalInfo} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No medical information on file.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Memberships Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5" />
                    Memberships
                  </CardTitle>
                  <CardDescription>Active memberships</CardDescription>
                </CardHeader>
                <CardContent>
                  {memberships.length > 0 ? (
                    <div className="space-y-3">
                      {memberships.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.groupName}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.instanceName}</p>
                          </div>
                          <MembershipStatusBadge status={m.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No memberships found.</p>
                  )}
                </CardContent>
              </Card>

              {/* Waivers Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Waivers
                  </CardTitle>
                  <CardDescription>Signed waivers</CardDescription>
                </CardHeader>
                <CardContent>
                  {waivers.length > 0 ? (
                    <div className="space-y-3">
                      {waivers.map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{w.title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setViewingWaiver(w)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No signed waivers found.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Latest Registrations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-5 w-5" />
                  Latest Registrations
                </CardTitle>
                <CardDescription className="mt-1">
                  {registrations.length} registration{registrations.length === 1 ? "" : "s"} found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={registrationColumns}
                  data={registrations}
                  pageSize={10}
                  pageSizeOptions={[5, 10, 20]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== PROGRAMS TAB ===== */}
        <TabsContent value="programs">
          <AthleteProgramsTab
            athleteId={athlete.id}
            enrollments={athlete.enrollments}
            onEnrollmentChange={() => fetchAthlete()}
          />
        </TabsContent>

        {/* ===== EVENTS TAB ===== */}
        <TabsContent value="events">
          <AthleteEventsTab eventRegistrations={eventRegistrations} />
        </TabsContent>

        {/* ===== COMPETITIONS TAB ===== */}
        <TabsContent value="competitions">
          <AthleteCompetitionsTab competitionEntries={competitionEntries} />
        </TabsContent>

        {/* ===== MEMBERSHIPS TAB ===== */}
        <TabsContent value="memberships">
          <AthleteMembershipsTab memberships={memberships} />
        </TabsContent>

        {/* ===== ATTENDANCE TAB (placeholder) ===== */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
              <CardDescription>Attendance history and records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Coming Soon</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Attendance tracking, history, and reporting will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== EVALUATIONS TAB (placeholder) ===== */}
        {trainingEnabled && (
          <TabsContent value="evaluations">
            <Card>
              <CardHeader>
                <CardTitle>Evaluations</CardTitle>
                <CardDescription>Performance evaluations and progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">Coming Soon</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Skill evaluations, progress tracking, and coaching feedback will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Waiver Viewer Dialog */}
      <WaiverViewerDialog
        waiver={viewingWaiver}
        onClose={() => setViewingWaiver(null)}
      />
    </div>
  )
}

// ─── Programs Tab ───────────────────────────────────────────────────

interface ProgramOption {
  id: string
  name: string
  status: string
}

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ACTIVE: { label: "Active", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
  PAUSED: { label: "Paused", icon: Pause, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  CANCELLED: { label: "Cancelled", icon: XCircle, className: "bg-red-50 text-destructive border-red-200" },
  COMPLETED: { label: "Completed", icon: CheckCircle2, className: "bg-blue-50 text-blue-700 border-blue-200" },
}

function EnrollmentStatusBadge({ status }: { status: string }) {
  const config = ENROLLMENT_STATUS_CONFIG[status] ?? {
    label: status,
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground",
  }
  const Icon = config.icon
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  )
}

function AthleteProgramsTab({
  athleteId,
  enrollments,
  onEnrollmentChange,
}: {
  athleteId: string
  enrollments: EnrollmentWithProgram[]
  onEnrollmentChange: () => void
}) {
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = React.useState(false)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  const activeCount = enrollments.filter((e) => e.status === "ACTIVE").length
  const pausedCount = enrollments.filter((e) => e.status === "PAUSED").length
  const completedCount = enrollments.filter((e) => e.status === "COMPLETED").length

  const handleStatusChange = async (enrollmentId: string, newStatus: string) => {
    setUpdatingId(enrollmentId)
    try {
      await api.patch(`/api/enrollments/${enrollmentId}`, { status: newStatus })
      toast.success(`Enrollment ${newStatus.toLowerCase()}`)
      onEnrollmentChange()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update enrollment")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (enrollmentId: string) => {
    setUpdatingId(enrollmentId)
    try {
      await api.delete(`/api/enrollments/${enrollmentId}`)
      toast.success("Enrollment removed")
      onEnrollmentChange()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove enrollment")
    } finally {
      setUpdatingId(null)
    }
  }

  const enrollmentColumns: ColumnDef<EnrollmentWithProgram>[] = [
    {
      id: "program",
      accessorFn: (row) => row.program?.name ?? "Unknown",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Program" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/registrations/programs/${row.original.programId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.program?.name ?? "Unknown Program"}
        </Link>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <EnrollmentStatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "enrolled",
      accessorFn: (row) => new Date(row.startDate).getTime(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Enrolled" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {format(new Date(row.original.startDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "endDate",
      accessorFn: (row) => (row.endDate ? new Date(row.endDate).getTime() : 0),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="End Date" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {row.original.endDate
            ? format(new Date(row.original.endDate), "MMM d, yyyy")
            : "—"}
        </span>
      ),
    },
    {
      id: "schedule",
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Schedule" />
      ),
      cell: ({ row }) => {
        const program = row.original.program
        if (!program?.startTime || !program?.duration) {
          return <span className="text-muted-foreground">—</span>
        }
        const hours = Math.floor(program.duration / 60)
        const mins = program.duration % 60
        const durationStr = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`
        return (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{program.startTime} · {durationStr}</span>
          </div>
        )
      },
    },
    {
      id: "price",
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Price" />
      ),
      cell: ({ row }) => {
        const program = row.original.program
        const price = program?.pricingModel === "PER_SESSION"
          ? program.perSessionPrice
          : program?.basePrice
        if (price == null) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>
              {Number(price).toFixed(2)}
              {program?.pricingModel === "PER_SESSION" && (
                <span className="text-xs ml-0.5">/session</span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const enrollment = row.original
        const isUpdating = updatingId === enrollment.id
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/registrations/programs/${enrollment.programId}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Program
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED" && (
                <DropdownMenuItem onClick={() => handleStatusChange(enrollment.id, "ACTIVE")}>
                  <Play className="h-4 w-4 mr-2" />
                  Set Active
                </DropdownMenuItem>
              )}
              {enrollment.status === "ACTIVE" && (
                <DropdownMenuItem onClick={() => handleStatusChange(enrollment.id, "PAUSED")}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}
              {enrollment.status !== "COMPLETED" && (
                <DropdownMenuItem onClick={() => handleStatusChange(enrollment.id, "COMPLETED")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              {enrollment.status !== "CANCELLED" && (
                <DropdownMenuItem onClick={() => handleStatusChange(enrollment.id, "CANCELLED")}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Enrollment
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleDelete(enrollment.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      size: 50,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
              <div className="rounded-full bg-green-100 p-2.5">
                <BookOpen className="h-5 w-5 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold">{pausedCount}</p>
              </div>
              <div className="rounded-full bg-yellow-100 p-2.5">
                <Pause className="h-5 w-5 text-yellow-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{enrollments.length}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Program Enrollments</CardTitle>
              <CardDescription className="mt-1">
                {enrollments.length} enrollment{enrollments.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsEnrollDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Enroll in Program
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {enrollments.length > 0 ? (
            <DataTable
              columns={enrollmentColumns}
              data={enrollments}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-sm font-medium">No program enrollments</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                This athlete is not enrolled in any programs yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsEnrollDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Enroll in Program
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enroll Dialog */}
      <EnrollInProgramDialog
        athleteId={athleteId}
        open={isEnrollDialogOpen}
        onOpenChange={setIsEnrollDialogOpen}
        onEnrolled={onEnrollmentChange}
        existingProgramIds={enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.programId)}
      />
    </div>
  )
}

// ─── Enroll In Program Dialog ───────────────────────────────────────

function EnrollInProgramDialog({
  athleteId,
  open,
  onOpenChange,
  onEnrolled,
  existingProgramIds,
}: {
  athleteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnrolled: () => void
  existingProgramIds: string[]
}) {
  const [programs, setPrograms] = React.useState<ProgramOption[]>([])
  const [isLoadingPrograms, setIsLoadingPrograms] = React.useState(false)
  const [selectedProgramId, setSelectedProgramId] = React.useState("")
  const [startDate, setStartDate] = React.useState(() => format(new Date(), "yyyy-MM-dd"))
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setSelectedProgramId("")
    setStartDate(format(new Date(), "yyyy-MM-dd"))
    setIsLoadingPrograms(true)
    api
      .get<{ data: ProgramOption[] }>("/api/programs", { status: "ACTIVE", limit: 200 })
      .then((res) => setPrograms(res.data))
      .catch(() => toast.error("Failed to load programs"))
      .finally(() => setIsLoadingPrograms(false))
  }, [open])

  const availablePrograms = programs.filter((p) => !existingProgramIds.includes(p.id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProgramId || !startDate) return

    setIsSubmitting(true)
    try {
      await api.post("/api/enrollments", {
        athleteId,
        programId: selectedProgramId,
        startDate,
      })
      toast.success("Athlete enrolled successfully")
      onOpenChange(false)
      onEnrolled()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enroll athlete")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll in Program</DialogTitle>
          <DialogDescription>
            Select a program to enroll this athlete in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="program">Program</Label>
            {isLoadingPrograms ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading programs...
              </div>
            ) : (
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger id="program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms.length > 0 ? (
                    availablePrograms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled>
                      No available programs
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedProgramId || !startDate || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                "Enroll"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Events Tab ─────────────────────────────────────────────────────

const EVENT_REG_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  REGISTERED: { label: "Registered", className: "bg-green-50 text-green-700 border-green-200" },
  WAITLISTED: { label: "Waitlisted", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-destructive border-red-200" },
  ATTENDED: { label: "Attended", className: "bg-blue-50 text-blue-700 border-blue-200" },
  NO_SHOW: { label: "No Show", className: "bg-muted text-muted-foreground" },
}

function AthleteEventsTab({
  eventRegistrations,
}: {
  eventRegistrations: EventRegistrationSummary[]
}) {
  const now = new Date()
  const upcoming = eventRegistrations.filter((r) => new Date(r.date) >= now)
  const past = eventRegistrations.filter((r) => new Date(r.date) < now)

  const eventColumns: ColumnDef<EventRegistrationSummary>[] = [
    {
      id: "program",
      accessorFn: (row) => row.programName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Program" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/registrations/programs/${row.original.programId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.programName}
        </Link>
      ),
    },
    {
      id: "date",
      accessorFn: (row) => new Date(row.date).getTime(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {format(new Date(row.original.date), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "time",
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Time" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap">
            {row.original.startTime} – {row.original.endTime}
          </span>
        </div>
      ),
    },
    {
      id: "facility",
      accessorFn: (row) => row.facilityName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Facility" />
      ),
      cell: ({ row }) =>
        row.original.facilityName ? (
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[180px]">{row.original.facilityName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const config = EVENT_REG_STATUS_CONFIG[row.original.status] ?? {
          label: row.original.status,
          className: "bg-muted text-muted-foreground",
        }
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{upcoming.length}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-2.5">
                <Calendar className="h-5 w-5 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attended</p>
                <p className="text-2xl font-bold">
                  {eventRegistrations.filter((r) => r.status === "ATTENDED").length}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{eventRegistrations.length}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Events</CardTitle>
          <CardDescription className="mt-1">
            {upcoming.length} upcoming event{upcoming.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length > 0 ? (
            <DataTable
              columns={eventColumns}
              data={upcoming}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Past Events</CardTitle>
          <CardDescription className="mt-1">
            {past.length} past event{past.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {past.length > 0 ? (
            <DataTable
              columns={eventColumns}
              data={past}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No past events</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Competitions Tab ───────────────────────────────────────────────

const ENTRY_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING_SEED: { label: "Pending Seed", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  PENDING_REVIEW: { label: "Pending Review", className: "bg-orange-50 text-orange-700 border-orange-200" },
  APPROVED: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-destructive border-red-200" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-muted text-muted-foreground" },
  SCRATCHED: { label: "Scratched", className: "bg-muted text-muted-foreground" },
}

function AthleteCompetitionsTab({
  competitionEntries,
}: {
  competitionEntries: CompetitionEntrySummary[]
}) {
  const now = new Date()
  const upcoming = competitionEntries.filter(
    (e) => new Date(e.competitionStartDate) >= now
  )
  const past = competitionEntries.filter(
    (e) => new Date(e.competitionStartDate) < now
  )

  const competitionColumns: ColumnDef<CompetitionEntrySummary>[] = [
    {
      id: "competition",
      accessorFn: (row) => row.competitionName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Competition" />
      ),
      cell: ({ row }) => (
        <Link
          href={row.original.link}
          className="font-medium text-primary hover:underline"
        >
          {row.original.competitionName}
        </Link>
      ),
    },
    {
      id: "category",
      accessorFn: (row) => row.category,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event / Category" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.category}</span>
      ),
    },
    {
      id: "date",
      accessorFn: (row) => new Date(row.competitionStartDate).getTime(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => {
        const start = new Date(row.original.competitionStartDate)
        const end = new Date(row.original.competitionEndDate)
        const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")
        return (
          <span className="text-muted-foreground whitespace-nowrap">
            {sameDay
              ? format(start, "MMM d, yyyy")
              : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`}
          </span>
        )
      },
    },
    {
      id: "location",
      accessorFn: (row) => row.location ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) =>
        row.original.location ? (
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[180px]">{row.original.location}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const config = ENTRY_STATUS_CONFIG[row.original.status] ?? {
          label: row.original.status,
          className: "bg-muted text-muted-foreground",
        }
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
          <Link href={row.original.link}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      ),
      size: 50,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{upcoming.length}</p>
              </div>
              <div className="rounded-full bg-purple-100 p-2.5">
                <Trophy className="h-5 w-5 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">
                  {competitionEntries.filter((e) => e.status === "APPROVED").length}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{competitionEntries.length}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Competitions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Competitions</CardTitle>
          <CardDescription className="mt-1">
            {upcoming.length} upcoming competition{upcoming.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length > 0 ? (
            <DataTable
              columns={competitionColumns}
              data={upcoming}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No upcoming competitions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Competitions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Past Competitions</CardTitle>
          <CardDescription className="mt-1">
            {past.length} past competition{past.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {past.length > 0 ? (
            <DataTable
              columns={competitionColumns}
              data={past}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No past competitions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Memberships Tab ────────────────────────────────────────────────

const MEMBERSHIP_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
  expired: { label: "Expired", icon: AlertCircle, className: "bg-red-50 text-destructive border-red-200" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-muted text-muted-foreground" },
  archived: { label: "Archived", icon: History, className: "bg-muted text-muted-foreground" },
}

function AthleteMembershipsTab({
  memberships,
}: {
  memberships: AthleteMembershipSummary[]
}) {
  const activeMembers = memberships.filter((m) => m.status === "active")
  const inactiveMembers = memberships.filter((m) => m.status !== "active")

  const membershipColumns: ColumnDef<AthleteMembershipSummary>[] = [
    {
      id: "group",
      accessorFn: (row) => row.groupName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Membership" />
      ),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.groupName}</p>
          <p className="text-xs text-muted-foreground">{row.original.instanceName}</p>
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const config = MEMBERSHIP_STATUS_CONFIG[row.original.status] ?? {
          label: row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1),
          icon: AlertCircle,
          className: "bg-yellow-50 text-yellow-700 border-yellow-200",
        }
        const Icon = config.icon
        return (
          <Badge variant="outline" className={config.className}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        )
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      id: "startDate",
      accessorFn: (row) => new Date(row.startDate).getTime(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Start Date" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {format(new Date(row.original.startDate), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "endDate",
      accessorFn: (row) => (row.endDate ? new Date(row.endDate).getTime() : 0),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="End Date" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {row.original.endDate
            ? format(new Date(row.original.endDate), "MMM d, yyyy")
            : "—"}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{activeMembers.length}</p>
              </div>
              <div className="rounded-full bg-green-100 p-2.5">
                <Shield className="h-5 w-5 text-green-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired / Cancelled</p>
                <p className="text-2xl font-bold">{inactiveMembers.length}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{memberships.length}</p>
              </div>
              <div className="rounded-full bg-muted p-2.5">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Memberships */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Memberships</CardTitle>
          <CardDescription className="mt-1">
            {activeMembers.length} active membership{activeMembers.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeMembers.length > 0 ? (
            <DataTable
              columns={membershipColumns}
              data={activeMembers}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No active memberships</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Memberships */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Past Memberships</CardTitle>
          <CardDescription className="mt-1">
            {inactiveMembers.length} past membership{inactiveMembers.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inactiveMembers.length > 0 ? (
            <DataTable
              columns={membershipColumns}
              data={inactiveMembers}
              pageSize={10}
              pageSizeOptions={[5, 10, 20]}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No past memberships</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Waiver Viewer Dialog ───────────────────────────────────────────

function WaiverViewerDialog({
  waiver,
  onClose,
}: {
  waiver: AthleteWaiverSummary | null
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

function MembershipStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Active
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="bg-red-50 text-destructive border-red-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Expired
      </Badge>
    )
  }
  if (status === "cancelled") {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        Cancelled
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

function MedicalInfoDisplay({ info }: { info: AthleteMedicalSummary }) {
  const hasAllergies = info.allergies.length > 0
  const hasConditions = info.conditions.length > 0
  const hasMedications = info.medications.length > 0
  const hasDietary = info.dietaryRestrictions.length > 0
  const hasEmergencyContact = info.emergencyContactName || info.emergencyContactPhone
  const hasInsurance = info.insuranceProvider || info.insurancePolicyNumber

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Allergies</h4>
        {hasAllergies ? (
          <div className="flex flex-wrap gap-1.5">
            {info.allergies.map((a, i) => (
              <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
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
              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
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
              <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
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
                  <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
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
