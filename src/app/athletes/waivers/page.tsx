"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface Athlete {
  id: string;
  name: string;
  avatar: string | null;
  level: string;
}

interface WaiverAcceptance {
  id: string;
  completedAt: string;
  waiver: {
    id: string;
    title: string;
    organizationId: string;
    organization: {
      id: string;
      name: string;
    };
  };
  user: {
    name: string | null;
    email: string | null;
  } | null;
}

interface GroupedWaivers {
  organization: { id: string; name: string };
  acceptances: WaiverAcceptance[];
}

export default function AthleteWaiversPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(true);
  const [acceptances, setAcceptances] = useState<WaiverAcceptance[]>([]);
  const [isLoadingWaivers, setIsLoadingWaivers] = useState(false);

  useEffect(() => {
    async function fetchAthletes() {
      setIsLoadingAthletes(true);
      try {
        const response = await api.get<{ athletes: Athlete[] }>("/api/athletes/me");
        const athleteData = response.athletes || [];
        setAthletes(athleteData);
        if (athleteData.length > 0) {
          setSelectedAthleteId(athleteData[0].id);
        }
      } catch (error) {
        console.error("Error fetching athletes:", error);
        toast.error("Failed to load athletes");
      } finally {
        setIsLoadingAthletes(false);
      }
    }
    fetchAthletes();
  }, []);

  useEffect(() => {
    if (!selectedAthleteId) return;

    async function fetchWaivers() {
      setIsLoadingWaivers(true);
      try {
        const response = await api.get<{ data: WaiverAcceptance[] }>(`/api/athletes/waivers`, {
          athleteId: selectedAthleteId!,
        });
        setAcceptances(response.data || []);
      } catch (error) {
        console.error("Error fetching waivers:", error);
        toast.error("Failed to load waivers");
      } finally {
        setIsLoadingWaivers(false);
      }
    }
    fetchWaivers();
  }, [selectedAthleteId]);

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId);

  const grouped: GroupedWaivers[] = acceptances.reduce<GroupedWaivers[]>((acc, acceptance) => {
    const orgId = acceptance.waiver.organization.id;
    let group = acc.find((g) => g.organization.id === orgId);
    if (!group) {
      group = {
        organization: acceptance.waiver.organization,
        acceptances: [],
      };
      acc.push(group);
    }
    group.acceptances.push(acceptance);
    return acc;
  }, []);

  if (isLoadingAthletes) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardHeader>
            <CardTitle>No Athletes Found</CardTitle>
            <CardDescription>There are no athletes associated with your account.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Signed Waivers
          </h1>
          <p className="text-muted-foreground">
            View waivers that have been signed for your athletes
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/athletes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Athlete Selector */}
      {athletes.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Athlete</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAthleteId || undefined} onValueChange={setSelectedAthleteId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select an athlete" />
              </SelectTrigger>
              <SelectContent>
                {athletes.map((athlete) => (
                  <SelectItem key={athlete.id} value={athlete.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={athlete.avatar || undefined} />
                        <AvatarFallback>
                          {athlete.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span>{athlete.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Selected Athlete Header */}
      {selectedAthlete && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={selectedAthlete.avatar || undefined} />
                <AvatarFallback className="text-xl">
                  {selectedAthlete.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{selectedAthlete.name}</h2>
                <p className="text-muted-foreground">{selectedAthlete.level}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waivers Content */}
      {isLoadingWaivers ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : acceptances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              No signed waivers found for {selectedAthlete?.name}.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Waivers will appear here after they are signed during registration.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <Card key={group.organization.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {group.organization.name}
                </CardTitle>
                <CardDescription>
                  {group.acceptances.length} waiver
                  {group.acceptances.length !== 1 ? "s" : ""} signed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {group.acceptances.map((acceptance) => (
                    <div
                      key={acceptance.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                        <div>
                          <p className="font-medium">{acceptance.waiver.title}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(acceptance.completedAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            {acceptance.user?.name && (
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                Signed by {acceptance.user.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-green-700 bg-green-50 dark:bg-green-950/50 dark:text-green-400"
                      >
                        Signed
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
