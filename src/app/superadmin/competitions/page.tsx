"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, ExternalLink, Trophy, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const PUBLISH_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> =
  {
    LIVE: "default",
    DRAFT: "secondary",
    SCHEDULED: "outline",
    CLOSED: "outline",
    COMPLETED: "outline",
  };

const PUBLISH_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
  COMPLETED: "Completed",
};

const FALLBACK_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  REGISTRATION_OPEN: "default",
  PUBLISHED: "default",
  DRAFT: "secondary",
  REGISTRATION_CLOSED: "outline",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

const FALLBACK_STATUS_LABELS: Record<string, string> = {
  REGISTRATION_OPEN: "Live",
  PUBLISHED: "Live",
  DRAFT: "Draft",
  REGISTRATION_CLOSED: "Closed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function getStatusLabel(competition: Competition): string {
  if (competition.publishStatus && PUBLISH_STATUS_LABELS[competition.publishStatus]) {
    return PUBLISH_STATUS_LABELS[competition.publishStatus];
  }
  return FALLBACK_STATUS_LABELS[competition.status] || competition.status;
}

function getStatusVariant(
  competition: Competition
): "default" | "secondary" | "outline" | "destructive" {
  if (competition.publishStatus && PUBLISH_STATUS_VARIANTS[competition.publishStatus]) {
    return PUBLISH_STATUS_VARIANTS[competition.publishStatus];
  }
  return FALLBACK_STATUS_VARIANTS[competition.status] || "secondary";
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Competition {
  id: string;
  name: string;
  competitionType: string;
  status: string;
  startDate: string;
  endDate: string;
  publishStatus: string | null;
  organization: Organization;
  _count: { entries: number; results: number; teams: number; categories: number };
}

function getAdminCompetitionsUrl(orgId: string, orgName: string): string {
  if (typeof window === "undefined") return "/";
  const { hostname, protocol } = window.location;
  const parts = hostname.split(".");

  if (hostname.includes("localhost")) {
    const localhostIndex = parts.findIndex((p) => p.includes("localhost"));
    if (localhostIndex > 0) {
      const baseParts = parts.slice(1);
      return `${protocol}//admin.${baseParts.join(".")}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}&redirect=${encodeURIComponent("/dashboard/competitions")}`;
    }
    return `${protocol}//admin.localhost:3000/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}&redirect=${encodeURIComponent("/dashboard/competitions")}`;
  }

  if (parts.length >= 2) {
    const baseParts = parts.slice(1);
    return `${protocol}//admin.${baseParts.join(".")}/dashboard/switch-org?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName)}&redirect=${encodeURIComponent("/dashboard/competitions")}`;
  }

  return "/";
}

export default function SuperadminCompetitionsPage() {
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>("");
  const [competitions, setCompetitions] = React.useState<Competition[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = React.useState(true);
  const [isLoadingCompetitions, setIsLoadingCompetitions] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch("/api/superadmin/competitions");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: Competition[] = await res.json();

        const orgMap = new Map<string, Organization>();
        for (const c of data) {
          if (!orgMap.has(c.organization.id)) {
            orgMap.set(c.organization.id, c.organization);
          }
        }
        setOrganizations(Array.from(orgMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch {
        toast.error("Failed to load organizations");
      } finally {
        setIsLoadingOrgs(false);
      }
    }
    fetchOrgs();
  }, []);

  const fetchCompetitions = React.useCallback(async (orgId: string) => {
    setIsLoadingCompetitions(true);
    try {
      const res = await fetch(`/api/superadmin/competitions?organizationId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setCompetitions(await res.json());
    } catch {
      toast.error("Failed to load competitions");
    } finally {
      setIsLoadingCompetitions(false);
    }
  }, []);

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    fetchCompetitions(orgId);
  };

  const handleDelete = async (competition: Competition) => {
    setDeletingId(competition.id);
    try {
      const res = await fetch(`/api/superadmin/competitions/${competition.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success(`"${competition.name}" deleted`);
      setCompetitions((prev) => prev.filter((c) => c.id !== competition.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete competition");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);
  const hasEntries = (c: Competition) => c._count.entries > 0 || c._count.results > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competitions</h1>
          <p className="text-sm text-muted-foreground">
            Manage competitions across all organizations.
          </p>
        </div>
        {selectedOrg && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={getAdminCompetitionsUrl(selectedOrg.id, selectedOrg.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Admin Dashboard
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>
            Choose an organization to view and manage its competitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingOrgs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading organizations...
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organizations with competitions found.
            </p>
          ) : (
            <Select value={selectedOrgId} onValueChange={handleOrgChange}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose an organization..." />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedOrgId && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedOrg?.name} — Competitions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingCompetitions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : competitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Trophy className="h-8 w-8 mb-2" />
                <p>No competitions for this organization.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Entries</TableHead>
                    <TableHead>Categories</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competitions.map((competition) => (
                    <TableRow key={competition.id}>
                      <TableCell className="font-medium">{competition.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {competition.competitionType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(competition)} className="text-xs">
                          {getStatusLabel(competition)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(competition.startDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">{competition._count.entries}</TableCell>
                      <TableCell className="text-sm">{competition._count.categories}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === competition.id}
                            >
                              {deletingId === competition.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete competition?</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div className="space-y-2">
                                  <p>
                                    This will permanently delete &ldquo;{competition.name}&rdquo;
                                    and all associated data (categories, entries, results, teams).
                                  </p>
                                  {hasEntries(competition) && (
                                    <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                      <span>
                                        This competition has {competition._count.entries}{" "}
                                        {competition._count.entries === 1 ? "entry" : "entries"}
                                        {competition._count.results > 0 &&
                                          ` and ${competition._count.results} ${competition._count.results === 1 ? "result" : "results"}`}
                                        . Deleting it will remove all participant data.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(competition)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
