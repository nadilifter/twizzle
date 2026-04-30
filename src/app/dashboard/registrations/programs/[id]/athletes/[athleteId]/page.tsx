"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Eye,
  Heart,
  Loader2,
  Shield,
  Users,
} from "lucide-react";

import { formatPhoneNumberIntl } from "react-phone-number-input";

import { calculateAge } from "@/lib/age-utils";
import { formatPrice } from "@/lib/format-utils";
import { INVOICE_STATUS_STYLES } from "@/lib/invoice-status";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/date-utils";
import { WaiverViewerDialog } from "@/components/waiver-viewer-dialog";
import type { AthleteWaiverSummary } from "@/types/athletes";

interface AthleteDetail {
  programName: string;
  registrationType: string;
  athlete: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatar: string | null;
    birthDate: string | null;
    gender: string | null;
    level: { id: string; name: string } | null;
    guardians: {
      id: string;
      name: string | null;
      email: string;
      phone: string | null;
      relationship: string | null;
      isPrimary: boolean;
    }[];
  };
  enrollments: {
    id: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
  }[];
  instanceRegistrations: {
    id: string;
    status: string;
    createdAt: string;
    programInstance: {
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
      facility: { id: string; name: string } | null;
    };
  }[];
  attendances: {
    id: string;
    status: string;
    checkedIn: string | null;
    notes: string | null;
    programInstance: { id: string; date: string; startTime: string; endTime: string };
  }[];
  evaluations: {
    id: string;
    date: string;
    overallScore: string | number;
    status: string;
    notes: string | null;
    template: { id: string; name: string } | null;
    coach: { id: string; name: string | null } | null;
    programInstance: { id: string; date: string } | null;
  }[];
  lineItems: {
    id: string;
    description: string;
    total: string | number;
    createdAt: string;
    invoice: {
      id: string;
      reference: string;
      status: string;
      user: { id: string; name: string | null; email: string } | null;
    } | null;
  }[];
  compliance: {
    membership: {
      required: boolean;
      status: string;
      memberships: { name: string; groupName: string; status: string }[];
    };
    waivers: {
      required: boolean;
      status: string;
      waivers: AthleteWaiverSummary[];
    };
    medical: {
      required: boolean;
      status: string;
      info: Record<string, unknown> | null;
    };
  };
}

const ATTENDANCE_STYLE: Record<string, string> = {
  PRESENT: "bg-green-50 text-green-700 border-green-200",
  ABSENT: "bg-red-50 text-red-700 border-red-200",
  LATE: "bg-yellow-50 text-yellow-700 border-yellow-200",
  EXCUSED: "bg-blue-50 text-blue-700 border-blue-200",
  REGISTERED: "bg-muted text-muted-foreground",
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function ProgramAthleteDetailPage() {
  const params = useParams();
  const programId = typeof params.id === "string" ? params.id : "";
  const athleteId = typeof params.athleteId === "string" ? params.athleteId : "";

  const [data, setData] = React.useState<AthleteDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [viewingWaiver, setViewingWaiver] = React.useState<AthleteWaiverSummary | null>(null);

  const athleteName = data
    ? [data.athlete.firstName, data.athlete.lastName].filter(Boolean).join(" ") ||
      data.athlete.name ||
      "Unknown Athlete"
    : undefined;

  useBreadcrumbOverride(
    data ? `/dashboard/registrations/programs/${programId}` : undefined,
    data?.programName
  );
  useBreadcrumbOverride(
    programId ? `/dashboard/registrations/programs/${programId}/athletes` : undefined,
    undefined,
    programId ? `/dashboard/registrations/programs/${programId}?tab=athletes` : undefined
  );
  useBreadcrumbOverride(
    data ? `/dashboard/registrations/programs/${programId}/athletes/${athleteId}` : undefined,
    athleteName
  );

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/programs/${programId}/athletes/${athleteId}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const json = await response.json();
        setData(json);
      } catch {
        toast.error("Failed to load athlete details");
      } finally {
        setLoading(false);
      }
    };
    if (programId && athleteId) fetchData();
  }, [programId, athleteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading athlete details...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Athlete Not Found</h1>
        <p className="text-muted-foreground">Could not load this athlete&apos;s program details.</p>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/registrations/programs/${programId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Program
          </Link>
        </Button>
      </div>
    );
  }

  const {
    athlete,
    enrollments,
    instanceRegistrations,
    attendances,
    evaluations,
    lineItems,
    compliance,
  } = data;
  const age = calculateAge(athlete.birthDate);
  const primaryGuardian = athlete.guardians.find((g) => g.isPrimary) ?? athlete.guardians[0];
  const fullName =
    [athlete.firstName, athlete.lastName].filter(Boolean).join(" ") ||
    athlete.name ||
    "Unknown Athlete";
  const isPerInstance = data.registrationType === "PER_INSTANCE";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/registrations/programs/${programId}?tab=athletes`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Athletes
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left: Profile + Compliance */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={athlete.avatar || undefined} alt={fullName} />
                  <AvatarFallback className="text-xl">{getInitials(fullName)}</AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold">{fullName}</h2>
                {athlete.level && (
                  <Badge variant="outline" className="mt-2">
                    {athlete.level.name}
                  </Badge>
                )}
              </div>
              <Separator className="my-4" />
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Age</dt>
                <dd>{age ?? "-"}</dd>
                <dt className="text-muted-foreground">Gender</dt>
                <dd>
                  {athlete.gender
                    ? athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1).toLowerCase()
                    : "-"}
                </dd>
                <dt className="text-muted-foreground">Birth date</dt>
                <dd>
                  {athlete.birthDate ? format(new Date(athlete.birthDate), "MMM d, yyyy") : "-"}
                </dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate">{athlete.email ?? "-"}</dd>
              </dl>
              {primaryGuardian && (
                <>
                  <Separator className="my-4" />
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Primary guardian</p>
                    <p className="font-medium">{primaryGuardian.name ?? "Unknown"}</p>
                    <p className="text-muted-foreground text-xs">{primaryGuardian.email}</p>
                    {primaryGuardian.phone && (
                      <p className="text-muted-foreground text-xs">
                        {formatPhoneNumberIntl(primaryGuardian.phone) || primaryGuardian.phone}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {compliance.membership.required && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Membership
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  {compliance.membership.status === "verified" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Missing</span>
                    </>
                  )}
                </div>
                {compliance.membership.memberships.map((m, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground">
                    {m.groupName} &middot; {m.name} &middot; {m.status}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {compliance.waivers.required && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Waivers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {compliance.waivers.waivers.map((w) => (
                  <div key={w.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate">{w.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.signed ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          Signed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Not signed
                        </Badge>
                      )}
                      {w.signed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setViewingWaiver(w)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {compliance.medical.required && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Medical
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  {compliance.medical.status === "complete" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">On file</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Incomplete</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Registration / session history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {isPerInstance ? "Session Registrations" : "Enrollment History"}
              </CardTitle>
              <CardDescription>
                {isPerInstance
                  ? `${instanceRegistrations.length} session registration${instanceRegistrations.length === 1 ? "" : "s"}`
                  : `${enrollments.length} enrollment${enrollments.length === 1 ? "" : "s"}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPerInstance ? (
                instanceRegistrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No session registrations for this athlete.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Facility</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instanceRegistrations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Link
                              href={`/dashboard/registrations/programs/${programId}/sessions/${r.programInstance.id}`}
                              className="text-primary hover:underline"
                            >
                              {format(new Date(r.programInstance.date), "MMM d, yyyy")}
                            </Link>
                          </TableCell>
                          <TableCell>{r.programInstance.facility?.name ?? "-"}</TableCell>
                          <TableCell>
                            {formatTime12h(r.programInstance.startTime)} &ndash;{" "}
                            {formatTime12h(r.programInstance.endTime)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrollments for this athlete.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {e.startDate ? format(new Date(e.startDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          {e.endDate ? format(new Date(e.endDate), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.status === "ACTIVE" ? "default" : "secondary"}>
                            {e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Attendance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Attendance
              </CardTitle>
              <CardDescription>
                {attendances.length} record{attendances.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checked in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link
                            href={`/dashboard/registrations/programs/${programId}/sessions/${a.programInstance.id}`}
                            className="text-primary hover:underline"
                          >
                            {format(new Date(a.programInstance.date), "MMM d, yyyy")}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {formatTime12h(a.programInstance.startTime)} &ndash;{" "}
                          {formatTime12h(a.programInstance.endTime)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(ATTENDANCE_STYLE[a.status] ?? "")}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {a.checkedIn ? format(new Date(a.checkedIn), "h:mm a") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Evaluations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Evaluations
              </CardTitle>
              <CardDescription>
                {evaluations.length} evaluation{evaluations.length === 1 ? "" : "s"} in this program
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No evaluations for this athlete in this program.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Coach</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{e.template?.name ?? "-"}</TableCell>
                        <TableCell>{e.coach?.name ?? "-"}</TableCell>
                        <TableCell>{String(e.overallScore)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Billing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Billing
              </CardTitle>
              <CardDescription>
                {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} for this program
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No charges for this athlete in this program.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((li) => (
                      <TableRow key={li.id}>
                        <TableCell className="font-mono text-xs">
                          {li.invoice?.reference ?? "-"}
                        </TableCell>
                        <TableCell>{li.description}</TableCell>
                        <TableCell>{format(new Date(li.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {li.invoice?.status ? (
                            <Badge
                              variant="outline"
                              className={INVOICE_STATUS_STYLES[li.invoice.status] ?? ""}
                            >
                              {li.invoice.status.charAt(0) +
                                li.invoice.status.slice(1).toLowerCase()}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(li.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <WaiverViewerDialog waiver={viewingWaiver} onClose={() => setViewingWaiver(null)} />
    </div>
  );
}
