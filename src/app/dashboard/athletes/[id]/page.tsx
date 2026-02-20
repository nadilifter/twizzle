"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Shield,
  Heart,
  Users,
  Eye,
  Settings,
  Info,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Mail,
  History,
  ExternalLink,
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
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { AthleteConfiguration } from "../athlete-configuration"
import type {
  AthleteWaiverSummary,
  AthleteMedicalSummary,
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
  const memberships = (athlete as any).memberships as { id: string; instanceName: string; groupName: string; status: string; startDate: string; endDate: string | null }[] ?? []
  const waivers = ((athlete as any).waivers ?? []) as AthleteWaiverSummary[]
  const medicalInfo = ((athlete as any).medicalInfo ?? null) as AthleteMedicalSummary | null
  const registrations = ((athlete as any).registrations ?? []) as RegistrationItem[]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{athlete.name}</h1>
          {levelInfo ? (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider font-semibold h-5 px-1.5 shrink-0"
              style={levelInfo.color ? {
                borderColor: levelInfo.color,
                color: levelInfo.color,
                backgroundColor: `${levelInfo.color}15`,
              } : undefined}
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
        <Button onClick={() => setIsEditOpen(true)}>
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
            {/* Profile + Medical row */}
            <div className="grid gap-6 md:grid-cols-3">
              {/* Profile Card */}
              <Card>
                <CardContent className="pt-8 pb-6">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                      <AvatarImage src={athlete.avatar ?? undefined} alt={athlete.name} />
                      <AvatarFallback className="text-2xl font-bold bg-primary/10">
                        {getInitials(athlete.name)}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold tracking-tight mt-4">{athlete.name}</h2>
                    {levelInfo && (
                      <Badge
                        variant="outline"
                        className="mt-2"
                        style={levelInfo.color ? {
                          borderColor: levelInfo.color,
                          color: levelInfo.color,
                          backgroundColor: `${levelInfo.color}15`,
                        } : undefined}
                      >
                        {levelInfo.name}
                      </Badge>
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
                      {athlete.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{athlete.email}</span>
                        </div>
                      )}
                      {athlete.family && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {athlete.family.name}
                            {athlete.family.primaryContact && (
                              <span className="text-xs ml-1">
                                ({athlete.family.primaryContact})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Medical Card */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="h-5 w-5" />
                    Medical Information
                    {medicalInfo && (
                      <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        On File
                      </Badge>
                    )}
                  </CardTitle>
                  {medicalInfo && (
                    <CardDescription>
                      Last updated: {format(new Date(medicalInfo.updatedAt), "MMM d, yyyy")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {medicalInfo ? (
                    <MedicalInfoDisplay info={medicalInfo} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No medical information on file for this athlete.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Membership + Waivers row */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5" />
                    Memberships
                  </CardTitle>
                  <CardDescription>Active memberships for this athlete</CardDescription>
                </CardHeader>
                <CardContent>
                  {memberships.length > 0 ? (
                    <div className="space-y-3">
                      {memberships.map((m) => (
                        <div key={m.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{m.groupName}</p>
                            <p className="text-xs text-muted-foreground">{m.instanceName}</p>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    Waivers
                  </CardTitle>
                  <CardDescription>Signed waivers for this athlete</CardDescription>
                </CardHeader>
                <CardContent>
                  {waivers.length > 0 ? (
                    <div className="space-y-3">
                      {waivers.map((w) => (
                        <div key={w.id} className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{w.title}</p>
                          <div className="flex items-center gap-2 shrink-0">
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

        {/* ===== PROGRAMS TAB (placeholder) ===== */}
        <TabsContent value="programs">
          <Card>
            <CardHeader>
              <CardTitle>Programs</CardTitle>
              <CardDescription>Program enrollments and history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Coming Soon</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Program enrollment details, history, and management will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
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
