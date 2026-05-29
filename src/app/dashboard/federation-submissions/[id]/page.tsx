"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

import { DashboardPageHeader } from "@/components/dashboard-page-header";

type OrgAthlete = { level: string };

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  organizationAthletes: OrgAthlete[];
};

type SubmissionAthlete = {
  athleteId: string;
  athlete: Athlete;
};

type FederationSubmission = {
  id: string;
  federation: "SKATE_CANADA" | "USFS" | "ISU";
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED";
  submittedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  externalRef: string | null;
  payload: unknown;
  createdAt: string;
  createdBy: { name: string | null; email: string };
  submittedBy: { name: string | null; email: string } | null;
  resolvedBy: { name: string | null; email: string } | null;
  athletes: SubmissionAthlete[];
};

const FEDERATION_LABELS: Record<string, string> = {
  SKATE_CANADA: "Skate Canada",
  USFS: "USFS",
  ISU: "ISU",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  ACCEPTED: "outline",
  REJECTED: "destructive",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
}

function userDisplay(user: { name: string | null; email: string } | null): string {
  if (!user) return "—";
  return user.name ?? user.email;
}

export default function FederationSubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [submission, setSubmission] = React.useState<FederationSubmission | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  type DialogState =
    | { open: false }
    | {
        open: true;
        to: "SUBMITTED" | "ACCEPTED" | "REJECTED";
        resolutionNote: string;
      };
  const [dialog, setDialog] = React.useState<DialogState>({ open: false });

  const fetchSubmission = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/federation-submissions/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Submission not found");
        throw new Error("Failed to fetch");
      }
      const json = await res.json();
      setSubmission(json as FederationSubmission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void fetchSubmission();
  }, [fetchSubmission]);

  const handleTransition = async () => {
    if (!dialog.open || !submission) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/federation-submissions/${id}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: dialog.to,
          ...(dialog.resolutionNote && { resolutionNote: dialog.resolutionNote }),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Transition failed");
      }
      toast.success(`Submission marked as ${dialog.to.toLowerCase()}`);
      setDialog({ open: false });
      await fetchSubmission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <p>{error ?? "Submission not found"}</p>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/federation-submissions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Submissions
          </Link>
        </Button>
      </div>

      <DashboardPageHeader
        title={`${FEDERATION_LABELS[submission.federation] ?? submission.federation} Submission`}
        description={`Created ${formatDate(submission.createdAt)} by ${userDisplay(submission.createdBy)}`}
        variant="small"
        actions={
          <div className="flex items-center gap-2">
            {submission.status === "DRAFT" && (
              <Button
                onClick={() => setDialog({ open: true, to: "SUBMITTED", resolutionNote: "" })}
              >
                Mark Submitted
              </Button>
            )}
            {submission.status === "SUBMITTED" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ open: true, to: "ACCEPTED", resolutionNote: "" })}
                >
                  Mark Accepted
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDialog({ open: true, to: "REJECTED", resolutionNote: "" })}
                >
                  Mark Rejected
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Status + lifecycle section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status
          </p>
          <Badge variant={STATUS_VARIANTS[submission.status] ?? "secondary"} className="text-sm">
            {submission.status.charAt(0) + submission.status.slice(1).toLowerCase()}
          </Badge>
        </div>

        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Federation
          </p>
          <Badge variant="outline" className="text-sm">
            {FEDERATION_LABELS[submission.federation] ?? submission.federation}
          </Badge>
        </div>

        {submission.externalRef && (
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              External Ref
            </p>
            <p className="font-mono text-sm">{submission.externalRef}</p>
          </div>
        )}

        {submission.submittedAt && (
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Submitted at
            </p>
            <p className="text-sm">{formatDate(submission.submittedAt)}</p>
            <p className="text-xs text-muted-foreground">{userDisplay(submission.submittedBy)}</p>
          </div>
        )}

        {submission.resolvedAt && (
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Resolved at
            </p>
            <p className="text-sm">{formatDate(submission.resolvedAt)}</p>
            <p className="text-xs text-muted-foreground">{userDisplay(submission.resolvedBy)}</p>
          </div>
        )}

        {submission.resolutionNote && (
          <div className="rounded-lg border p-4 space-y-1 sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Resolution note
            </p>
            <p className="text-sm whitespace-pre-wrap">{submission.resolutionNote}</p>
          </div>
        )}
      </div>

      {/* Athletes section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Athletes{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({submission.athletes.length})
          </span>
        </h2>
        {submission.athletes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No athletes linked to this submission.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {submission.athletes.map(({ athlete }) => {
              const level = athlete.organizationAthletes[0]?.level ?? "Unassigned";
              const name = `${athlete.firstName} ${athlete.lastName}`.trim() || "Unknown";
              return (
                <div key={athlete.id} className="flex items-center gap-3 px-4 py-3">
                  <Link
                    href={`/dashboard/athletes/${athlete.id}`}
                    className="font-medium text-sm hover:underline flex-1"
                  >
                    {name}
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    {level}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payload section */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Payload</h2>
        <pre className="rounded-md border bg-muted p-4 text-xs overflow-auto max-h-96">
          {JSON.stringify(submission.payload, null, 2)}
        </pre>
      </div>

      {/* Audit log stub — Phase 5.3 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Audit log (Phase 5.3)
        </div>
      </div>

      {/* Transition confirmation dialog */}
      <AlertDialog open={dialog.open} onOpenChange={(open) => !open && setDialog({ open: false })}>
        {dialog.open && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dialog.to === "SUBMITTED"
                  ? "Mark as Submitted"
                  : dialog.to === "ACCEPTED"
                    ? "Mark as Accepted"
                    : "Mark as Rejected"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.to === "SUBMITTED"
                  ? "This will mark the submission as submitted to the federation."
                  : dialog.to === "ACCEPTED"
                    ? "This will mark the submission as accepted. This action cannot be undone."
                    : "This will mark the submission as rejected. This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {(dialog.to === "ACCEPTED" || dialog.to === "REJECTED") && (
              <div className="space-y-2 py-2">
                <Label htmlFor="detail-resolution-note">Resolution note (optional)</Label>
                <Textarea
                  id="detail-resolution-note"
                  placeholder="Add a note about the resolution…"
                  value={dialog.resolutionNote}
                  onChange={(e) =>
                    setDialog((prev) =>
                      prev.open ? { ...prev, resolutionNote: e.target.value } : prev
                    )
                  }
                  rows={3}
                />
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isTransitioning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleTransition();
                }}
                disabled={isTransitioning}
                className={
                  dialog.to === "REJECTED"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }
              >
                {isTransitioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
