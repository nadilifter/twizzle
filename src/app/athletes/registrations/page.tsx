"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";

interface AthleteWithRegistrations {
  id: string;
  firstName: string;
  lastName: string;
  registrations: {
    instanceRegistrations: any[];
    enrollments: any[];
    competitionEntries: any[];
  };
}

export default function RegistrationsPage() {
  const [athletes, setAthletes] = useState<AthleteWithRegistrations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
              const regData = regRes.ok ? await regRes.json() : { instanceRegistrations: [], enrollments: [], competitionEntries: [] };
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
                registrations: { instanceRegistrations: [], enrollments: [], competitionEntries: [] },
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
      (a.registrations.instanceRegistrations?.length || 0) +
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
          const count =
            (regs.instanceRegistrations?.length || 0) +
            (regs.enrollments?.length || 0) +
            (regs.competitionEntries?.length || 0);

          if (count === 0) return null;
          const displayName = `${athlete.firstName} ${athlete.lastName}`.trim();

          return (
            <Card key={athlete.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{displayName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {regs.enrollments?.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">{e.program?.name || "Program"}</div>
                      <div className="text-xs text-muted-foreground">Enrollment</div>
                    </div>
                    <Badge variant="outline">{e.status}</Badge>
                  </div>
                ))}
                {regs.instanceRegistrations?.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">
                        {r.programInstance?.program?.name || "Session"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {r.programInstance?.date
                          ? format(new Date(r.programInstance.date), "MMM d, yyyy")
                          : "Instance"}
                      </div>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                ))}
                {regs.competitionEntries?.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">{c.competition?.name || "Competition"}</div>
                      <div className="text-xs text-muted-foreground">{c.competitionCategory?.name || "Entry"}</div>
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
