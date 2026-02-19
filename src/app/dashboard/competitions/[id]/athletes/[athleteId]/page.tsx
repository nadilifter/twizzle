"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarDays,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Shield,
  Heart,
  ClipboardList,
} from "lucide-react"
import { calculateAge } from "@/lib/age-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AthleteDetail {
  athlete: {
    id: string
    firstName: string | null
    lastName: string | null
    birthDate: string | null
    gender: string | null
    level: { id: string; name: string } | null
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
      waivers: { id: string; title: string; signed: boolean; signedAt: string | null }[]
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

export default function CompetitionAthleteDetailPage() {
  const params = useParams()
  const competitionId = typeof params.id === "string" ? params.id : ""
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : ""

  const [data, setData] = React.useState<AthleteDetail | null>(null)
  const [loading, setLoading] = React.useState(true)

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
  const athleteName =
    [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") || "Unknown Athlete"
  const age = calculateAge(athlete.birthDate)

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

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{athleteName}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {age !== null && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {age} years old
              {athlete.birthDate && (
                <span className="text-xs">
                  ({format(new Date(athlete.birthDate), "MMM d, yyyy")})
                </span>
              )}
            </span>
          )}
          {athlete.gender && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1).toLowerCase()}
            </span>
          )}
          {athlete.level && (
            <Badge variant="outline">{athlete.level.name}</Badge>
          )}
        </div>
      </div>

      {/* Registrations */}
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
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No event registrations found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result Type</TableHead>
                  <TableHead>Seed Mark</TableHead>
                  <TableHead>Seed Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.category.label}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ENTRY_STATUS_STYLES[entry.status] ?? ""}
                      >
                        {formatEntryStatus(entry.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.category.resultType}</TableCell>
                    <TableCell>{entry.seedMark ?? "-"}</TableCell>
                    <TableCell>
                      {entry.seedMarkStatus ? (
                        <Badge
                          variant="outline"
                          className={ENTRY_STATUS_STYLES[entry.seedMarkStatus] ?? ""}
                        >
                          {formatEntryStatus(entry.seedMarkStatus)}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Compliance Cards */}
      {(requirements.hasMembershipRestriction ||
        requirements.hasWaiverRestriction ||
        requirements.hasMedicalRequirement) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Membership Card */}
          {requirements.hasMembershipRestriction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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

          {/* Waivers Card */}
          {requirements.hasWaiverRestriction && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                      <div key={w.id} className="flex items-center justify-between">
                        <p className="text-sm font-medium">{w.title}</p>
                        <div className="flex items-center gap-2">
                          {w.signed ? (
                            <div className="flex items-center gap-1.5 text-green-700">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm">Signed</span>
                              {w.signedAt && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(w.signedAt), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
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

          {/* Medical Card */}
          {requirements.hasMedicalRequirement && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Medical Information
                  <ComplianceStatusBadge status={compliance.medical.status} />
                </CardTitle>
                <CardDescription>
                  {compliance.medical.info
                    ? `Last updated: ${format(new Date(compliance.medical.info.updatedAt), "MMM d, yyyy")}`
                    : "No medical information on file"}
                </CardDescription>
              </CardHeader>
              {compliance.medical.info && (
                <CardContent>
                  <MedicalInfoDisplay info={compliance.medical.info} />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

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
    <div className="space-y-4">
      {/* Allergies */}
      <div>
        <h4 className="text-sm font-medium mb-1.5">Allergies</h4>
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
            No known allergies
          </p>
        )}
      </div>

      {/* Conditions */}
      <div>
        <h4 className="text-sm font-medium mb-1.5">Medical Conditions</h4>
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
            No known conditions
          </p>
        )}
      </div>

      <Separator />

      {/* Medications */}
      {hasMedications && (
        <div>
          <h4 className="text-sm font-medium mb-1.5">Medications</h4>
          <div className="flex flex-wrap gap-1.5">
            {info.medications.map((m, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Restrictions */}
      {hasDietary && (
        <div>
          <h4 className="text-sm font-medium mb-1.5">Dietary Restrictions</h4>
          <div className="flex flex-wrap gap-1.5">
            {info.dietaryRestrictions.map((d, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Contact & Insurance */}
      {(hasEmergencyContact || hasInsurance) && (
        <>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            {hasEmergencyContact && (
              <div>
                <h4 className="text-sm font-medium mb-1">Emergency Contact</h4>
                <p className="text-sm">{info.emergencyContactName}</p>
                {info.emergencyContactPhone && (
                  <p className="text-sm text-muted-foreground">{info.emergencyContactPhone}</p>
                )}
                {info.emergencyContactRelation && (
                  <p className="text-xs text-muted-foreground">{info.emergencyContactRelation}</p>
                )}
              </div>
            )}
            {hasInsurance && (
              <div>
                <h4 className="text-sm font-medium mb-1">Insurance</h4>
                <p className="text-sm">{info.insuranceProvider}</p>
                {info.insurancePolicyNumber && (
                  <p className="text-sm text-muted-foreground">
                    Policy: {info.insurancePolicyNumber}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Additional Notes */}
      {info.additionalNotes && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-1">Additional Notes</h4>
            <p className="text-sm text-muted-foreground">{info.additionalNotes}</p>
          </div>
        </>
      )}
    </div>
  )
}
