"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClipboardList, Calendar, MoreHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface InstanceRegistration {
  id: string;
  status: string;
  programInstance: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    programId: string;
    program: { id: string; name: string };
    organization: { name: string };
  };
}

interface Enrollment {
  id: string;
  status: string;
  startDate: string;
  program: {
    id: string;
    name: string;
    organization: { name: string };
  };
}

interface AthleteWithRegistrations {
  id: string;
  firstName: string;
  lastName: string;
  registrations: {
    instanceRegistrations: InstanceRegistration[];
    enrollments: Enrollment[];
    competitionEntries: any[];
  };
}

const CANCELLABLE = ["ACTIVE", "WAITLISTED", "WAITLIST_PAYMENT_PENDING"];

function statusLabel(status: string) {
  if (status === "WAITLIST_PAYMENT_PENDING") return "Payment Pending";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "ACTIVE") return "default";
  if (status === "WAITLIST_PAYMENT_PENDING") return "destructive";
  return "secondary";
}

export default function RegistrationsPage() {
  const [athletes, setAthletes] = useState<AthleteWithRegistrations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());

  const handleCancelEnrollment = async (athleteId: string, enrollmentId: string) => {
    setCancellingId(enrollmentId);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to cancel");
      setAthletes((prev) =>
        prev.map((a) =>
          a.id === athleteId
            ? {
                ...a,
                registrations: {
                  ...a.registrations,
                  enrollments: a.registrations.enrollments.filter((e) => e.id !== enrollmentId),
                },
              }
            : a
        )
      );
      toast.success("Enrollment cancelled");
    } catch {
      toast.error("Failed to cancel enrollment");
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const meRes = await fetch("/api/athletes/me");
        if (!meRes.ok) return;
        const meData = await meRes.json();
        const athleteList = meData.athletes || [];

        const withRegistrations = await Promise.all(
          athleteList.map(async (a: any) => {
            try {
              const regRes = await fetch(`/api/athletes/${a.id}/registrations`);
              const regData = regRes.ok
                ? await regRes.json()
                : { instanceRegistrations: [], enrollments: [], competitionEntries: [] };
              return {
                id: a.id,
                firstName: a.firstName,
                lastName: a.lastName,
                registrations: regData,
              };
            } catch {
              return {
                id: a.id,
                firstName: a.firstName,
                lastName: a.lastName,
                registrations: {
                  instanceRegistrations: [],
                  enrollments: [],
                  competitionEntries: [],
                },
              };
            }
          })
        );

        setAthletes(withRegistrations);
      } catch (error) {
        console.error("Error fetching registrations:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const totalRegistrations = athletes.reduce(
    (sum, a) =>
      sum +
      (a.registrations.enrollments?.length || 0) +
      (a.registrations.competitionEntries?.length || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registrations</h1>
        <Badge variant="secondary">{totalRegistrations} total</Badge>
      </div>

      {totalRegistrations === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg mb-1">No registrations</h3>
            <p className="text-sm text-muted-foreground">
              Registrations for your athletes will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        athletes.map((athlete) => {
          const regs = athlete.registrations;
          const count = (regs.enrollments?.length || 0) + (regs.competitionEntries?.length || 0);
          if (count === 0) return null;

          const displayName = `${athlete.firstName} ${athlete.lastName}`.trim();

          // Group instance registrations by programId for nested display
          const sessionsByProgram = new Map<string, InstanceRegistration[]>();
          for (const reg of regs.instanceRegistrations ?? []) {
            const programId = reg.programInstance?.programId ?? reg.programInstance?.program?.id;
            if (!programId) continue;
            if (!sessionsByProgram.has(programId)) sessionsByProgram.set(programId, []);
            sessionsByProgram.get(programId)!.push(reg);
          }

          return (
            <Card key={athlete.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{displayName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Enrollments */}
                {regs.enrollments?.map((e) => {
                  const cancellable = CANCELLABLE.includes(e.status);
                  const isCancelling = cancellingId === e.id;
                  const sessions = sessionsByProgram.get(e.program?.id) ?? [];
                  const isOpen = openSessions.has(e.id);

                  return (
                    <Collapsible
                      key={e.id}
                      open={isOpen}
                      onOpenChange={(open) =>
                        setOpenSessions((prev) => {
                          const next = new Set(prev);
                          open ? next.add(e.id) : next.delete(e.id);
                          return next;
                        })
                      }
                    >
                      <div className="rounded-lg border overflow-hidden">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {sessions.length > 0 && (
                              <CollapsibleTrigger asChild>
                                <button className="shrink-0 text-muted-foreground hover:text-foreground">
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform",
                                      isOpen && "rotate-180"
                                    )}
                                  />
                                </button>
                              </CollapsibleTrigger>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {e.program?.name || "Program"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {e.program?.organization?.name}
                                {sessions.length > 0 &&
                                  ` · ${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={statusVariant(e.status)}>{statusLabel(e.status)}</Badge>
                            {cancellable && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    disabled={isCancelling}
                                  >
                                    {isCancelling ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleCancelEnrollment(athlete.id, e.id)}
                                  >
                                    Cancel enrollment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>

                        {sessions.length > 0 && (
                          <CollapsibleContent>
                            <div className="border-t divide-y bg-muted/30">
                              {sessions.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between px-4 py-2 pl-9"
                                >
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      {s.programInstance?.date
                                        ? format(new Date(s.programInstance.date), "MMM d, yyyy")
                                        : "—"}
                                    </span>
                                    {s.programInstance?.startTime && (
                                      <span className="text-xs">
                                        {formatTime12h(s.programInstance.startTime)}–
                                        {formatTime12h(s.programInstance.endTime)}
                                      </span>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {s.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        )}
                      </div>
                    </Collapsible>
                  );
                })}

                {/* Competition entries */}
                {regs.competitionEntries?.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {c.competition?.name || "Competition"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.competition?.organization?.name}
                        {c.competition?.startDate &&
                          ` · ${format(new Date(c.competition.startDate), "MMM d, yyyy")}`}
                      </div>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
