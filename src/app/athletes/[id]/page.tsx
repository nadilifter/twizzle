"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, User, Users, Shield, Calendar, ChevronRight,
  Eye, EyeOff, Crown,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { RegistrationFilesSection } from "@/components/registration-files-section";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";

interface Guardian {
  id: string;
  userId: string | null;
  relationship: string | null;
  isPrimary: boolean;
  shareRegistrations: boolean;
  shareFinancials: boolean;
  user: {
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
}

interface Registration {
  id: string;
  type: "program" | "enrollment" | "competition";
  name: string;
  date?: string;
  status: string;
}

export default function AthleteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const athleteId = params.id as string;

  const [athlete, setAthlete] = useState<any>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [registrations, setRegistrations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [meRes, guardiansRes, registrationsRes] = await Promise.all([
          fetch("/api/athletes/me"),
          fetch(`/api/athletes/${athleteId}/guardians`),
          fetch(`/api/athletes/${athleteId}/registrations`),
        ]);

        if (meRes.ok) {
          const data = await meRes.json();
          const found = data.athletes?.find((a: any) => a.id === athleteId);
          if (found) setAthlete(found);
          else router.push("/athletes");
        }

        if (guardiansRes.ok) {
          const data = await guardiansRes.json();
          setGuardians(data.guardians || []);
        }

        if (registrationsRes.ok) {
          const data = await registrationsRes.json();
          setRegistrations(data);
        }
      } catch (error) {
        console.error("Error fetching athlete data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [athleteId, router]);

  const handleToggleGuardianClaims = async (checked: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/guardian-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowGuardianClaims: checked }),
      });
      if (res.ok) {
        setAthlete((prev: any) => ({ ...prev, allowGuardianClaims: checked }));
        toast.success(checked ? "Other guardians can now find and claim this athlete" : "Guardian claims disabled");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update setting");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (field: "shareRegistrations" | "shareFinancials", checked: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/athletes/${athleteId}/guardian-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: checked }),
      });
      if (res.ok) {
        toast.success("Visibility updated");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const groupedInstances = useMemo(() => {
    if (!registrations?.instanceRegistrations?.length) return [];

    const groups = new Map<string, { programName: string; instances: any[] }>();

    for (const r of registrations.instanceRegistrations) {
      const key = r.programInstance?.programId || r.programInstance?.program?.name || "unknown";
      const programName = r.programInstance?.program?.name || "Session";

      if (!groups.has(key)) {
        groups.set(key, { programName, instances: [] });
      }
      groups.get(key)!.instances.push(r);
    }

    for (const group of groups.values()) {
      group.instances.sort((a: any, b: any) => {
        const dateA = a.programInstance?.date ? new Date(a.programInstance.date).getTime() : 0;
        const dateB = b.programInstance?.date ? new Date(b.programInstance.date).getTime() : 0;
        return dateA - dateB;
      });
    }

    return Array.from(groups.values());
  }, [registrations?.instanceRegistrations]);

  const athleteDisplayName = athlete
    ? `${athlete.firstName} ${athlete.lastName}`.trim() || athlete.name
    : undefined;
  useBreadcrumbOverride(
    athlete ? `/athletes/${athleteId}` : undefined,
    athleteDisplayName,
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!athlete) return null;

  const displayName = athleteDisplayName!;
  const initials = `${athlete.firstName?.[0] || ""}${athlete.lastName?.[0] || ""}`.toUpperCase();
  const totalRegistrations =
    (registrations?.instanceRegistrations?.length || 0) +
    (registrations?.enrollments?.length || 0) +
    (registrations?.competitionEntries?.length || 0);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/athletes")} className="gap-1">
        <ArrowLeft className="w-4 h-4" />
        Back to Athletes
      </Button>

      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AvatarUpload
              currentAvatar={athlete.avatar}
              name={displayName}
              uploadUrl={`/api/athletes/${athleteId}/avatar`}
              onAvatarChange={(url) =>
                setAthlete((prev: any) => prev ? { ...prev, avatar: url } : prev)
              }
              size="sm"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{displayName}</h1>
                {athlete.isSelf && (
                  <Badge variant="secondary">You</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {athlete.birthDate && (
                  <span>Born {format(new Date(athlete.birthDate), "MMM d, yyyy")}</span>
                )}
                <Badge variant="outline">{athlete.status}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guardian claims toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Guardian Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow-claims" className="text-sm font-medium">Allow other guardians</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, other users can find and claim this athlete by matching name and date of birth
              </p>
            </div>
            <Switch
              id="allow-claims"
              checked={athlete.allowGuardianClaims}
              onCheckedChange={handleToggleGuardianClaims}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Guardians section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Guardians ({guardians.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guardians.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guardians linked.</p>
          ) : (
            <div className="space-y-3">
              {guardians
                .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                .map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={g.user?.avatar || undefined} alt={g.user?.name || "Guardian"} />
                        <AvatarFallback className="text-sm">
                          {g.user?.name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{g.user?.name || "Unknown"}</span>
                          {g.isPrimary && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <Crown className="w-2.5 h-2.5" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{g.relationship || "Guardian"}</span>
                          {g.user?.email && <span>({g.user.email})</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {g.shareRegistrations && (
                        <span className="flex items-center gap-0.5" title="Shares registrations">
                          <Eye className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visibility settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Your Visibility Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Control what other guardians of this athlete can see about your activity.</p>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="share-regs" className="text-sm font-medium">Share registrations</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Other guardians can see programs you&apos;ve registered this athlete for</p>
            </div>
            <Switch
              id="share-regs"
              defaultChecked={false}
              onCheckedChange={(checked) => handleToggleVisibility("shareRegistrations", checked)}
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="share-fin" className="text-sm font-medium">Share financial details</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Other guardians can see your invoices and payments for this athlete</p>
            </div>
            <Switch
              id="share-fin"
              defaultChecked={false}
              onCheckedChange={(checked) => handleToggleVisibility("shareFinancials", checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Registration Files */}
      {athlete?.organizationId && (
        <RegistrationFilesSection
          athleteId={athleteId}
          organizationId={athlete.organizationId}
          canDelete={false}
        />
      )}

      {/* Registrations section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Registrations ({totalRegistrations})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {totalRegistrations === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations found.</p>
          ) : (
            <div className="space-y-2">
              {registrations?.enrollments?.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">{e.program?.name || "Program"}</div>
                    <div className="text-xs text-muted-foreground">Enrollment</div>
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
              ))}
              {groupedInstances.map((group) => {
                const firstDate = group.instances[0]?.programInstance?.date;
                const lastDate = group.instances[group.instances.length - 1]?.programInstance?.date;
                let dateRange: string | null = null;
                if (firstDate && lastDate) {
                  const first = new Date(firstDate);
                  const last = new Date(lastDate);
                  if (group.instances.length === 1) {
                    dateRange = format(first, "MMM d, yyyy");
                  } else if (first.getFullYear() === last.getFullYear()) {
                    dateRange = `${format(first, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
                  } else {
                    dateRange = `${format(first, "MMM d, yyyy")} – ${format(last, "MMM d, yyyy")}`;
                  }
                }

                return (
                  <Collapsible key={group.programName}>
                    <CollapsibleTrigger asChild>
                      <button className="group w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 text-left">
                        <div>
                          <div className="font-medium text-sm">{group.programName}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.instances.length} session{group.instances.length !== 1 ? "s" : ""}
                            {dateRange && ` · ${dateRange}`}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-1 space-y-0.5 border-l pl-3 pb-1">
                        {group.instances.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="text-muted-foreground">
                              {r.programInstance?.date
                                ? format(new Date(r.programInstance.date), "MMM d, yyyy")
                                : "No date"}
                            </span>
                            <Badge variant="outline" className="text-xs">{r.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
              {registrations?.competitionEntries?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">{c.competition?.name || "Competition"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.competitionCategory?.name || "Competition Entry"}
                    </div>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
