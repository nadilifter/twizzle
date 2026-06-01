"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, Loader2, ListMusic, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

interface ProgramSummary {
  id: string;
  name: string;
  discipline: string | null;
  category: string | null;
  notes: string | null;
  updatedAt: string;
  elements: Array<{ id: string; elementKind: string; baseValue: number; inSecondHalf: boolean }>;
  createdBy: { id: string; name: string | null; email: string };
}

interface PlannedProgramsTabProps {
  athleteId: string;
}

const DISCIPLINE_LABELS: Record<string, string> = {
  SINGLES: "Singles",
  PAIRS: "Pairs",
  ICE_DANCE: "Ice Dance",
  SYNCHRO: "Synchro",
  SPECIAL_OLYMPICS: "Special Olympics",
};

export function PlannedProgramsTab({ athleteId }: PlannedProgramsTabProps) {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-program dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<string>("none");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const fetchPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ programs: ProgramSummary[] }>(
        `/api/athletes/${athleteId}/planned-programs`
      );
      setPrograms(data.programs);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load planned programs");
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsCreating(true);
    try {
      await api.post(`/api/athletes/${athleteId}/planned-programs`, {
        name: name.trim(),
        discipline: discipline === "none" ? null : discipline,
        category: category.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Planned program created");
      setIsCreateOpen(false);
      setName("");
      setDiscipline("none");
      setCategory("");
      setNotes("");
      fetchPrograms();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create program");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Planned routines</h3>
          <p className="text-sm text-muted-foreground">
            ISU programs this athlete is preparing — element layout + projected base value.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              New program
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New planned program</DialogTitle>
              <DialogDescription>
                Create an empty program. Elements are added in the program editor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="pp-name">Name *</Label>
                <Input
                  id="pp-name"
                  placeholder="Short Program 2025-2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pp-discipline">Discipline</Label>
                  <Select value={discipline} onValueChange={setDiscipline}>
                    <SelectTrigger id="pp-discipline">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {Object.entries(DISCIPLINE_LABELS).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pp-category">Category</Label>
                  <Input
                    id="pp-category"
                    placeholder="e.g. STAR 8, Senior"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-notes">Notes</Label>
                <Textarea
                  id="pp-notes"
                  placeholder="Coaching notes, music length, etc."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && programs.length === 0 && (
        <EmptyState
          icon={ListMusic}
          title="No planned programs yet"
          description="Create a program to plan the element layout for an upcoming competition or test."
          action={{
            label: "New program",
            onClick: () => setIsCreateOpen(true),
          }}
        />
      )}

      {!isLoading && !error && programs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => {
            const totalBV = p.elements.reduce(
              (s, e) => s + e.baseValue * (e.inSecondHalf ? 1.1 : 1),
              0
            );
            const counts = p.elements.reduce<Record<string, number>>((acc, e) => {
              acc[e.elementKind] = (acc[e.elementKind] ?? 0) + 1;
              return acc;
            }, {});

            return (
              <Link
                key={p.id}
                href={`/dashboard/athletes/${athleteId}/programs/${p.id}`}
                className="group rounded-lg border bg-card p-4 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate group-hover:underline">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.discipline ? (DISCIPLINE_LABELS[p.discipline] ?? p.discipline) : "—"}
                      {p.category && ` · ${p.category}`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {Object.entries(counts).map(([kind, count]) => (
                    <Badge key={kind} variant="outline" className="text-[10px]">
                      {count} {kind}
                      {count !== 1 ? "s" : ""}
                    </Badge>
                  ))}
                  {p.elements.length === 0 && (
                    <span className="text-xs text-muted-foreground">No elements yet</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Total BV: <span className="font-mono font-medium">{totalBV.toFixed(2)}</span>
                  </span>
                  <span>
                    Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
