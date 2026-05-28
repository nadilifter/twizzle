"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Download, Loader2 } from "lucide-react";

interface BlockedEntry {
  entryId: string;
  athleteId: string;
  athleteName: string;
  reasons: string[];
}

interface ValidateResponse {
  competition: { id: string; name: string };
  organization: { name: string; federationSection: string | null };
  totals: { entries: number; exportable: number; blocked: number };
  blocked: BlockedEntry[];
}

interface CssExportDialogProps {
  competitionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CssExportDialog({ competitionId, open, onOpenChange }: CssExportDialogProps) {
  const [data, setData] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/competitions/${competitionId}/css-export/validate`)
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(new Error(j.error)))))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to validate");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, competitionId]);

  const handleDownload = () => {
    // Use a plain navigation so the browser handles the file save dialog.
    window.location.href = `/api/competitions/${competitionId}/css-export`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export to Skate Canada CSS</DialogTitle>
          <DialogDescription>
            Generates a CSV in Skate Canada Competition Software (CSS) format. Download it and
            upload the file in CSS to register your entries.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating entries…
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive">
            <AlertTitle>Could not validate</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && !loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{data.totals.entries}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total entries</div>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-3">
                <div className="text-2xl font-semibold text-green-700 dark:text-green-300">
                  {data.totals.exportable}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Exportable</div>
              </div>
              <div
                className={
                  data.totals.blocked > 0
                    ? "rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3"
                    : "rounded-lg border p-3"
                }
              >
                <div
                  className={
                    data.totals.blocked > 0
                      ? "text-2xl font-semibold text-amber-700 dark:text-amber-300"
                      : "text-2xl font-semibold"
                  }
                >
                  {data.totals.blocked}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Blocked</div>
              </div>
            </div>

            {!data.organization.federationSection && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No federation section configured</AlertTitle>
                <AlertDescription>
                  Set your organization&apos;s Skate Canada section (e.g. <strong>ON</strong>,{" "}
                  <strong>BC</strong>) in Organization Settings to populate the &ldquo;Section
                  Representing&rdquo; column. Without it, CSS may flag entries for missing section
                  data.
                </AlertDescription>
              </Alert>
            )}

            {data.blocked.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Blocked entries</p>
                <ScrollArea className="max-h-48 rounded-md border">
                  <div className="divide-y">
                    {data.blocked.map((b) => (
                      <div key={b.entryId} className="p-3">
                        <div className="font-medium text-sm">{b.athleteName}</div>
                        <ul className="mt-1 space-y-0.5">
                          {b.reasons.map((r, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground flex items-start gap-1.5"
                            >
                              <span className="text-amber-600 dark:text-amber-400">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  Blocked entries are skipped from the CSV. Fix the underlying issue (missing
                  federation #, expired membership, etc.) and re-export.
                </p>
              </div>
            )}

            {data.totals.exportable === 0 && data.totals.entries > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Nothing to export</AlertTitle>
                <AlertDescription>
                  None of the {data.totals.entries} entries pass validation. Resolve the issues
                  above and try again.
                </AlertDescription>
              </Alert>
            )}

            {data.totals.entries === 0 && (
              <Alert>
                <AlertTitle>No entries</AlertTitle>
                <AlertDescription>
                  This competition has no entries yet. Add entries first, then export.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground">
              Section: <Badge variant="outline">{data.organization.federationSection ?? "—"}</Badge>{" "}
              · Club: <span className="font-medium">{data.organization.name}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading || !data || data.totals.exportable === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV ({data?.totals.exportable ?? 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
