"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { athleteDisplayName } from "@/lib/athlete-name";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Minimal shape the dialog needs from each athlete row. The athletes list
// page passes the TanStack-table row.original values; we pick what we render.
export interface MergeAthleteOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  level: string;
  status: string;
  federationName?: string | null;
  federationMemberNumber?: string | null;
}

interface PreviewResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, { rebound: number; deduplicated: number }>;
  federationDecision: {
    survivor: { federationMemberNumber: string | null } | null;
    duplicate: { federationMemberNumber: string | null } | null;
    chosen: "survivor" | "duplicate" | null;
    reason: string | null;
  };
}

interface MergeAthletesDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The two selected athletes from the list. Order doesn't matter — user picks survivor. */
  athletes: [MergeAthleteOption, MergeAthleteOption] | null;
  /** Called after a successful merge so the parent can clear selection / refresh. */
  onMerged?: (mergeId: string, survivorId: string) => void;
}

type Step = "choose-survivor" | "review";

export function MergeAthletesDialog({
  open,
  onOpenChange,
  athletes,
  onMerged,
}: MergeAthletesDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose-survivor");
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Reset state every time the dialog opens with a fresh pair.
  useEffect(() => {
    if (open && athletes) {
      setStep("choose-survivor");
      setSurvivorId(athletes[0].id);
      setReason("");
      setPreview(null);
    }
  }, [open, athletes]);

  const survivor = athletes?.find((a) => a.id === survivorId) ?? null;
  const duplicate = athletes?.find((a) => a.id !== survivorId) ?? null;

  const loadPreview = useCallback(async () => {
    if (!survivor || !duplicate) return;
    setIsLoadingPreview(true);
    try {
      const result = await api.post<PreviewResult>("/api/athletes/merge/preview", {
        survivorId: survivor.id,
        duplicateId: duplicate.id,
      });
      setPreview(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load preview";
      toast.error(message);
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [survivor, duplicate]);

  const handleContinue = async () => {
    await loadPreview();
    setStep("review");
  };

  const handleConfirmMerge = async () => {
    if (!survivor || !duplicate || !preview?.ok) return;
    setIsMerging(true);
    try {
      const result = await api.post<{ mergeId: string }>("/api/athletes/merge", {
        survivorId: survivor.id,
        duplicateId: duplicate.id,
        reason: reason.trim() || undefined,
      });
      toast.success(`${athleteDisplayName(survivor)} absorbed ${athleteDisplayName(duplicate)}.`);
      onMerged?.(result.mergeId, survivor.id);
      onOpenChange(false);
      // Land the admin on the survivor so they can sanity-check the result.
      router.push(`/dashboard/athletes/${survivor.id}`);
    } catch (err) {
      // Surface validation-error details from MergeValidationError when present.
      if (err instanceof ApiError && Array.isArray((err.data as { errors?: string[] })?.errors)) {
        const errs = (err.data as { errors: string[] }).errors;
        toast.error(errs.join(" "));
      } else {
        const message = err instanceof ApiError ? err.message : "Merge failed";
        toast.error(message);
      }
    } finally {
      setIsMerging(false);
    }
  };

  if (!athletes) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "choose-survivor" ? "Merge athletes" : "Review merge"}
          </DialogTitle>
          <DialogDescription>
            {step === "choose-survivor"
              ? "Choose which athlete to keep (the survivor). All data from the other will move to it, and the other row will be permanently deleted."
              : "Review what will happen, then confirm. The merge runs in a single transaction; if anything fails it rolls back."}
          </DialogDescription>
        </DialogHeader>

        {step === "choose-survivor" && (
          <div className="space-y-5">
            <RadioGroup
              value={survivorId ?? undefined}
              onValueChange={(v) => setSurvivorId(v)}
              className="grid gap-3 sm:grid-cols-2"
            >
              {athletes.map((a) => (
                <Label
                  key={a.id}
                  htmlFor={`merge-survivor-${a.id}`}
                  className="cursor-pointer rounded-lg border p-4 hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem id={`merge-survivor-${a.id}`} value={a.id} className="mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium truncate">{athleteDisplayName(a)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.email ?? "No email"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <Badge variant="outline">{a.level}</Badge>
                        <Badge variant="secondary">{a.status}</Badge>
                        {a.federationMemberNumber && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {a.federationName === "SKATE_CANADA"
                              ? "SC"
                              : a.federationName === "USFS"
                                ? "USFS"
                                : a.federationName === "ISU"
                                  ? "ISU"
                                  : "ID"}{" "}
                            {a.federationMemberNumber}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Label>
              ))}
            </RadioGroup>

            <div className="space-y-1.5">
              <Label htmlFor="merge-reason" className="text-sm">
                Reason (optional)
              </Label>
              <Textarea
                id="merge-reason"
                placeholder="e.g. Same athlete, registered twice with different emails"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {isLoadingPreview && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
              </div>
            )}

            {!isLoadingPreview && preview && (
              <>
                {survivor && duplicate && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{athleteDisplayName(duplicate)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{athleteDisplayName(survivor)}</span>
                    <Badge variant="outline" className="ml-auto">
                      survivor
                    </Badge>
                  </div>
                )}

                {preview.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Cannot merge
                    </div>
                    <ul className="text-xs text-destructive list-disc list-inside space-y-1">
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                    <p className="text-sm font-medium">Warnings</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.ok && preview.federationDecision.chosen && (
                  <div className="rounded-md border p-3 space-y-1.5 bg-muted/30">
                    <p className="text-sm font-medium">Federation number</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.federationDecision.reason}
                    </p>
                    {preview.federationDecision.chosen === "duplicate" &&
                      preview.federationDecision.duplicate?.federationMemberNumber && (
                        <p className="text-xs">
                          Survivor will end up with{" "}
                          <code className="font-mono">
                            {preview.federationDecision.duplicate.federationMemberNumber}
                          </code>
                          .
                        </p>
                      )}
                  </div>
                )}

                {preview.ok && (
                  <div className="rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium">Relation</th>
                          <th className="px-3 py-2 font-medium text-right">Rebound</th>
                          <th className="px-3 py-2 font-medium text-right">Deduped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(preview.counts)
                          .filter(([, v]) => v.rebound > 0 || v.deduplicated > 0)
                          .map(([table, v]) => (
                            <tr key={table} className="border-t">
                              <td className="px-3 py-1.5 font-mono">{table}</td>
                              <td className="px-3 py-1.5 text-right">{v.rebound}</td>
                              <td className="px-3 py-1.5 text-right">{v.deduplicated}</td>
                            </tr>
                          ))}
                        {Object.values(preview.counts).every(
                          (v) => v.rebound === 0 && v.deduplicated === 0
                        ) && (
                          <tr>
                            <td colSpan={3} className="px-3 py-3 text-center text-muted-foreground">
                              No related rows on the duplicate — only the join row is removed.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "choose-survivor" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!survivor || !duplicate || isLoadingPreview}
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("choose-survivor")}
                disabled={isMerging}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmMerge}
                disabled={!preview?.ok || isMerging || isLoadingPreview}
              >
                {isMerging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Merging…
                  </>
                ) : (
                  "Confirm merge"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
