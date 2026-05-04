"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AddAthleteDialog } from "@/components/add-athlete-dialog";
import { User, Users, ChevronRight, Shield, Calendar, Plus } from "lucide-react";
import { athleteDisplayName } from "@/lib/athlete-name";
import { format } from "date-fns";

interface AthleteWithGuardians {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  avatar: string | null;
  avatarCrop?: { x: number; y: number; width: number; height: number } | null;
  birthDate: string | null;
  gender: string | null;
  status: string;
  level: string;
  allowGuardianClaims: boolean;
  isSelf: boolean;
  guardianCount: number;
  organizations: string[];
  registrationCount: number;
}

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<AthleteWithGuardians[]>([]);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const hasSelfAthlete = athletes.some((a) => a.isSelf);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [athletesRes, claimsRes] = await Promise.all([
        fetch("/api/athletes/me"),
        fetch("/api/guardian-claims"),
      ]);

      if (athletesRes.ok) {
        const data = await athletesRes.json();
        setAthletes(data.athletes || []);
      }

      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setPendingClaimsCount(data.claims?.length || 0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Athletes</h1>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Athlete
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Athletes</p>
                <p className="text-2xl font-bold">{athletes.length}</p>
              </div>
              <div className="p-2 rounded-full bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registrations</p>
                <p className="text-2xl font-bold">
                  {athletes.reduce((sum, a) => sum + a.registrationCount, 0)}
                </p>
              </div>
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingClaimsCount}</p>
              </div>
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            {pendingClaimsCount > 0 && (
              <Link href="/athletes/guardian-requests">
                <Button variant="link" className="p-0 h-auto mt-1 text-sm">
                  Review requests <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Athletes list */}
      {athletes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold text-lg mb-1">No athletes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Athletes you create or claim will appear here.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Athlete
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {athletes.map((athlete) => {
            const displayName = athleteDisplayName(athlete);
            const initials =
              `${athlete.firstName?.[0] || ""}${athlete.lastName?.[0] || ""}`.toUpperCase();

            return (
              <Link key={athlete.id} href={`/athletes/${athlete.id}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage
                          src={athlete.avatar || undefined}
                          alt={displayName}
                          crop={athlete.avatarCrop ?? undefined}
                        />
                        <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{displayName}</h3>
                          {athlete.isSelf && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {athlete.birthDate && (
                            <span>{format(new Date(athlete.birthDate), "MMM d, yyyy")}</span>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {athlete.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {athlete.guardianCount} guardian{athlete.guardianCount !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {athlete.registrationCount} registration
                            {athlete.registrationCount !== 1 ? "s" : ""}
                          </span>
                          {athlete.allowGuardianClaims && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Shield className="w-3 h-3" />
                              Claimable
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <AddAthleteDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAthleteCreated={fetchData}
        hasSelfAthlete={hasSelfAthlete}
      />
    </div>
  );
}
