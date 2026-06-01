"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ElementPicker } from "@/components/planned-programs/element-picker";

interface Element {
  id: string;
  position: number;
  elementCode: string;
  elementName: string;
  elementKind: string;
  baseValue: number;
  inSecondHalf: boolean;
  notes: string | null;
}

interface Program {
  id: string;
  name: string;
  discipline: string | null;
  category: string | null;
  notes: string | null;
  elements: Element[];
  athlete: { id: string; firstName: string; lastName: string };
  createdBy: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

const DISCIPLINE_LABELS: Record<string, string> = {
  SINGLES: "Singles",
  PAIRS: "Pairs",
  ICE_DANCE: "Ice Dance",
  SYNCHRO: "Synchro",
  SPECIAL_OLYMPICS: "Special Olympics",
};

const KIND_LABELS: Record<string, string> = {
  jump: "Jump",
  spin: "Spin",
  stepSequence: "Step seq",
  chorSequence: "Chor seq",
  throw: "Throw",
  lift: "Lift",
  deathSpiral: "Death spiral",
};

export default function PlannedProgramViewerPage() {
  const params = useParams<{ id: string; programId: string }>();
  const router = useRouter();
  const athleteId = params?.id;
  const programId = params?.programId;

  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProgram = useCallback(async () => {
    if (!programId) return;
    setIsLoading(true);
    try {
      const data = await api.get<Program>(`/api/planned-programs/${programId}`);
      setProgram(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load program");
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  const handleDelete = async () => {
    if (!programId) return;
    if (!confirm("Delete this planned program? Elements will be lost.")) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/planned-programs/${programId}`);
      toast.success("Program deleted");
      router.push(`/dashboard/athletes/${athleteId}?tab=planned-programs`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete program");
      setIsDeleting(false);
    }
  };

  // ---- Per-element row actions ----

  const handleRemoveElement = async (elementId: string) => {
    if (!programId) return;
    try {
      await api.delete(`/api/planned-programs/${programId}/elements/${elementId}`);
      fetchProgram(); // reload to get compacted positions
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove element");
    }
  };

  // Toggle inSecondHalf optimistically — the row updates immediately, the
  // server is reconciled in the background.
  const handleToggleSecondHalf = async (elementId: string, next: boolean) => {
    if (!programId || !program) return;
    setProgram({
      ...program,
      elements: program.elements.map((e) =>
        e.id === elementId ? { ...e, inSecondHalf: next } : e
      ),
    });
    try {
      await api.patch(`/api/planned-programs/${programId}/elements/${elementId}`, {
        inSecondHalf: next,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update element");
      fetchProgram(); // revert from server
    }
  };

  // Up/down arrows reorder one position at a time. Builds the new
  // elementIds order and POSTs the full list to the bulk-reorder endpoint.
  const handleMove = async (elementId: string, direction: "up" | "down") => {
    if (!programId || !program) return;
    const idx = program.elements.findIndex((e) => e.id === elementId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= program.elements.length) return;

    const reordered = [...program.elements];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    // Optimistic local update.
    setProgram({ ...program, elements: reordered });

    try {
      await api.patch(`/api/planned-programs/${programId}/elements`, {
        elementIds: reordered.map((e) => e.id),
      });
      // Re-fetch so the position numbers come back as 1, 2, 3 from the
      // server rather than whatever the optimistic swap left in place.
      fetchProgram();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reorder");
      fetchProgram(); // revert
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-2 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Program not found</h1>
        <p className="text-muted-foreground">{error ?? "This program may have been deleted."}</p>
        <Link href={`/dashboard/athletes/${athleteId}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Back to athlete
          </Button>
        </Link>
      </div>
    );
  }

  const totalBV = program.elements.reduce(
    (s, e) => s + e.baseValue * (e.inSecondHalf ? 1.1 : 1),
    0
  );
  const counts = program.elements.reduce<Record<string, number>>((acc, e) => {
    acc[e.elementKind] = (acc[e.elementKind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back link */}
      <div>
        <Link
          href={`/dashboard/athletes/${athleteId}?tab=planned-programs`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {program.athlete.firstName} {program.athlete.lastName}
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {program.athlete.firstName} {program.athlete.lastName}
            </span>
            {program.discipline && (
              <>
                <span>·</span>
                <Badge variant="outline">
                  {DISCIPLINE_LABELS[program.discipline] ?? program.discipline}
                </Badge>
              </>
            )}
            {program.category && (
              <>
                <span>·</span>
                <span>{program.category}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ElementPicker programId={program.id} onAdded={fetchProgram} />
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </div>

      {program.notes && (
        <Card>
          <CardContent className="p-4 text-sm">{program.notes}</CardContent>
        </Card>
      )}

      {/* Totals strip */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">Total BV </span>
          <span className="font-mono font-medium text-base">{totalBV.toFixed(2)}</span>
        </div>
        {Object.entries(counts).map(([kind, count]) => (
          <div key={kind} className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
            {count} {KIND_LABELS[kind] ?? kind}
            {count !== 1 ? "s" : ""}
          </div>
        ))}
      </div>

      {/* Elements list */}
      {program.elements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No elements yet. Click <strong>Add element</strong> above to start building the program.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium w-12">#</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Element</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium text-right">Base</th>
                <th className="px-3 py-2 font-medium text-center">2nd&nbsp;half</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium w-32">Order</th>
                <th className="px-3 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {program.elements.map((e, i) => {
                const multiplier = e.inSecondHalf ? 1.1 : 1;
                const total = e.baseValue * multiplier;
                const isFirst = i === 0;
                const isLast = i === program.elements.length - 1;
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{e.position}</td>
                    <td className="px-3 py-2 font-mono">{e.elementCode}</td>
                    <td className="px-3 py-2">{e.elementName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {KIND_LABELS[e.elementKind] ?? e.elementKind}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{e.baseValue.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={e.inSecondHalf}
                        onCheckedChange={(v) => handleToggleSecondHalf(e.id, !!v)}
                        aria-label="Performed in second half"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={isFirst}
                          onClick={() => handleMove(e.id, "up")}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={isLast}
                          onClick={() => handleMove(e.id, "down")}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveElement(e.id)}
                        aria-label="Remove element"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/30">
                <td colSpan={6} className="px-3 py-2 text-right font-medium">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium">{totalBV.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
