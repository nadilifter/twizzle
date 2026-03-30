"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  formatResultValue as sharedFormatResultValue,
  formatSeedMarkForDisplay,
  type SeedMarkFields,
  type ResultType as AthleticsResultType,
} from "@/lib/athletics-formats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Loader2,
  Trophy,
  Check,
  X,
  Clock,
  Ruler,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import { DemoDataBanner } from "@/components/demo-data-banner";

// ============================================
// Types
// ============================================

interface Competition {
  id: string;
  name: string;
  competitionType: string;
  status: string;
  startDate: string;
  endDate: string;
  categories: CompetitionCategory[];
  _count: { entries: number; results: number; teams: number };
}

interface CompetitionCategory {
  id: string;
  resultType: "TIME" | "DISTANCE" | "HEIGHT" | "SCORE";
  sortDirection: "ASC" | "DESC";
  precision: number;
  seedMarkRequired: boolean;
  submissionMode: string;
  qualifyingMark: number | null;
  isTeamEvent: boolean;
  teamSize: number | null;
  combinationEntry: {
    id: string;
    name: string | null;
    rowValue: { id: string; name: string };
    colValue: { id: string; name: string };
  } | null;
  individualEntry: {
    id: string;
    name: string;
    template: { id: string; name: string };
  } | null;
  sportEvent: {
    id: string;
    code: string;
    name: string;
    eventGroup: string;
    eventType: string;
    resultType: string;
    sortDirection: string;
  } | null;
  ageCategory: {
    id: string;
    code: string;
    name: string;
    minAge: number;
    maxAge: number | null;
  } | null;
  _count: { entries: number; results: number; teams: number };
}

interface CompetitionEntry {
  id: string;
  athleteId: string;
  status: string;
  seedHours: number | null;
  seedMinutes: number | null;
  seedSeconds: number | null;
  seedMs: number | null;
  seedHandTimed: boolean;
  seedDistance: number | null;
  seedPoints: number | null;
  seedPlacement: string | null;
  seedMarkStatus: string | null;
  seedMarkNotes: string | null;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    level: string;
  };
  category: CompetitionCategory;
}

interface CompetitionResult {
  id: string;
  athleteId: string | null;
  teamId: string | null;
  value: number;
  displayValue: string | null;
  placement: number | null;
  heat: number | null;
  isHandTimed: boolean;
  isPersonalBest: boolean;
  isDNF: boolean;
  isDNS: boolean;
  isDQ: boolean;
  attemptNumber: number | null;
  isBestAttempt: boolean;
  notes: string | null;
  athlete: { id: string; firstName: string; lastName: string; name: string } | null;
  team: { id: string; name: string } | null;
  category: { id: string; resultType: string; sortDirection: string; precision: number };
}

// ============================================
// Helpers
// ============================================

const RESULT_TYPE_LABELS: Record<string, string> = {
  TIME: "Time",
  DISTANCE: "Distance",
  HEIGHT: "Height",
  SCORE: "Score",
  PLACEMENT: "Placement",
};

const RESULT_TYPE_ICONS: Record<string, React.ReactNode> = {
  TIME: <Clock className="h-3 w-3" />,
  DISTANCE: <Ruler className="h-3 w-3" />,
  HEIGHT: <ArrowUpDown className="h-3 w-3" />,
  SCORE: <Trophy className="h-3 w-3" />,
  PLACEMENT: <Trophy className="h-3 w-3" />,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_SEED: "secondary",
  PENDING_REVIEW: "secondary",
  REJECTED: "destructive",
  WITHDRAWN: "outline",
  SCRATCHED: "outline",
};

function getCategoryLabel(cat: CompetitionCategory): string {
  if (cat.sportEvent && cat.ageCategory) {
    return `${cat.sportEvent.name} - ${cat.ageCategory.code}`;
  }
  if (cat.sportEvent) {
    return cat.sportEvent.name;
  }
  if (cat.combinationEntry) {
    return (
      cat.combinationEntry.name ||
      `${cat.combinationEntry.rowValue.name} - ${cat.combinationEntry.colValue.name}`
    );
  }
  if (cat.individualEntry) {
    return cat.individualEntry.name;
  }
  return "Unknown";
}

function formatResultValueLocal(
  value: number,
  resultType: string,
  precision: number,
  handTimed = false,
  heat?: number | null
): string {
  return sharedFormatResultValue(value, resultType, precision, handTimed, heat);
}

function getEntrySeedDisplay(entry: CompetitionEntry): string {
  const fields: SeedMarkFields = {
    seedHours: entry.seedHours,
    seedMinutes: entry.seedMinutes,
    seedSeconds: entry.seedSeconds,
    seedMs: entry.seedMs,
    seedHandTimed: entry.seedHandTimed,
    seedDistance: entry.seedDistance,
    seedPoints: entry.seedPoints,
    seedPlacement: entry.seedPlacement,
  };
  const resultType = entry.category?.resultType as AthleticsResultType | undefined;
  return formatSeedMarkForDisplay(fields, resultType ?? "TIME");
}

// ============================================
// Main Page
// ============================================

export default function ResultsPage() {
  const [competitions, setCompetitions] = React.useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = React.useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = React.useState<string | null>(null);
  const [entries, setEntries] = React.useState<CompetitionEntry[]>([]);
  const [results, setResults] = React.useState<CompetitionResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);

  // New result entry form
  const [newResultAthleteId, setNewResultAthleteId] = React.useState("");
  const [newResultValue, setNewResultValue] = React.useState("");
  const [submittingResult, setSubmittingResult] = React.useState(false);

  const selectedComp = competitions.find((c) => c.id === selectedCompId);
  const selectedCat = selectedComp?.categories.find((c) => c.id === selectedCatId);

  // Fetch competitions
  React.useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const res = await fetch("/api/competitions");
        if (res.ok) {
          const data = await res.json();
          setCompetitions(data);
          if (data.length > 0 && !selectedCompId) {
            setSelectedCompId(data[0].id);
          }
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to load competitions");
      } finally {
        setLoading(false);
      }
    };
    fetchCompetitions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch entries and results when category changes
  React.useEffect(() => {
    if (!selectedCompId || !selectedCatId) {
      setEntries([]);
      setResults([]);
      return;
    }

    const fetchData = async () => {
      setLoadingEntries(true);
      setLoadingResults(true);

      try {
        const [entriesRes, resultsRes] = await Promise.all([
          fetch(`/api/competitions/${selectedCompId}/entries?categoryId=${selectedCatId}`),
          fetch(`/api/competitions/${selectedCompId}/results?categoryId=${selectedCatId}`),
        ]);

        if (entriesRes.ok) setEntries(await entriesRes.json());
        if (resultsRes.ok) setResults(await resultsRes.json());
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoadingEntries(false);
        setLoadingResults(false);
      }
    };
    fetchData();
  }, [selectedCompId, selectedCatId]);

  // Auto-select first category when competition changes
  React.useEffect(() => {
    if (selectedComp && selectedComp.categories.length > 0) {
      setSelectedCatId(selectedComp.categories[0].id);
    } else {
      setSelectedCatId(null);
    }
  }, [selectedCompId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle seed mark review
  const handleReview = async (entryId: string, decision: "APPROVED" | "REJECTED") => {
    if (!selectedCompId) return;
    setReviewingId(entryId);
    try {
      const res = await fetch(`/api/competitions/${selectedCompId}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedMarkStatus: decision }),
      });
      if (!res.ok) throw new Error("Failed to review");
      const updated = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...updated } : e)));
      toast.success(`Entry ${decision.toLowerCase()}`);
    } catch (error) {
      toast.error("Failed to review entry");
    } finally {
      setReviewingId(null);
    }
  };

  // Handle adding a result
  const handleAddResult = async () => {
    if (!selectedCompId || !selectedCatId || !newResultAthleteId || !newResultValue) return;
    setSubmittingResult(true);
    try {
      const res = await fetch(`/api/competitions/${selectedCompId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionCategoryId: selectedCatId,
          athleteId: newResultAthleteId,
          value: parseFloat(newResultValue),
        }),
      });
      if (!res.ok) throw new Error("Failed to record result");
      const newResult = await res.json();
      setResults((prev) => [...prev, newResult]);
      setNewResultAthleteId("");
      setNewResultValue("");
      toast.success("Result recorded");
    } catch (error) {
      toast.error("Failed to record result");
    } finally {
      setSubmittingResult(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DemoDataBanner />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Results</h1>
        <p className="text-muted-foreground">
          View and manage competition results, review seed marks, and enter scores.
        </p>
      </div>

      {competitions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No Competitions</p>
              <p className="text-sm mt-1">Create a competition first to manage results.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Competition Selector */}
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1 max-w-sm">
              <Label className="text-sm">Competition</Label>
              <Select value={selectedCompId || ""} onValueChange={setSelectedCompId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a competition" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name}
                      <span className="text-xs text-muted-foreground ml-2">({comp.status})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedComp && (
              <div className="flex items-center gap-2 pt-5">
                <Badge variant="outline">{selectedComp.competitionType}</Badge>
                <Badge variant="secondary">{selectedComp.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedComp._count.entries} entries &middot; {selectedComp._count.results}{" "}
                  results
                </span>
              </div>
            )}
          </div>

          {selectedComp && (
            <>
              {/* Category Tabs */}
              {selectedComp.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedComp.categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={selectedCatId === cat.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCatId(cat.id)}
                      className="gap-1.5"
                    >
                      {RESULT_TYPE_ICONS[cat.resultType]}
                      <span className="text-xs">{getCategoryLabel(cat)}</span>
                      <Badge variant="secondary" className="text-xs ml-1 h-4 px-1">
                        {cat._count.results}
                      </Badge>
                    </Button>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No Categories</p>
                      <p className="text-sm mt-1">
                        This competition has no categories configured yet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedCat && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Entries / Seed Marks Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        Entries &amp; Seed Marks
                        {selectedCat.seedMarkRequired && (
                          <Badge variant="secondary" className="text-xs">
                            Seed Required
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {RESULT_TYPE_LABELS[selectedCat.resultType]} &middot;{" "}
                        {selectedCat.sortDirection === "ASC"
                          ? "Lower is better"
                          : "Higher is better"}
                        {selectedCat.isTeamEvent && ` · Team (${selectedCat.teamSize})`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingEntries ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : entries.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No entries yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between rounded-lg border p-2.5"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {entry.athlete.firstName || entry.athlete.name}{" "}
                                    {entry.athlete.lastName}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant={STATUS_VARIANT[entry.status] || "outline"}
                                      className="text-xs h-4 px-1"
                                    >
                                      {entry.status.replace("_", " ")}
                                    </Badge>
                                    {getEntrySeedDisplay(entry) !== "-" && (
                                      <span className="text-xs text-muted-foreground">
                                        Seed: {getEntrySeedDisplay(entry)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {entry.status === "PENDING_REVIEW" && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleReview(entry.id, "APPROVED")}
                                    disabled={reviewingId === entry.id}
                                  >
                                    {reviewingId === entry.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleReview(entry.id, "REJECTED")}
                                    disabled={reviewingId === entry.id}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Results / Leaderboard Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Results &amp; Leaderboard</CardTitle>
                      <CardDescription className="text-xs">
                        {results.length} result{results.length !== 1 ? "s" : ""} recorded
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {loadingResults ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {/* Leaderboard */}
                          {results.length > 0 ? (
                            <div className="space-y-1.5">
                              {[...results]
                                .sort((a, b) =>
                                  selectedCat.sortDirection === "ASC"
                                    ? Number(a.value) - Number(b.value)
                                    : Number(b.value) - Number(a.value)
                                )
                                .map((result, idx) => (
                                  <div
                                    key={result.id}
                                    className="flex items-center justify-between rounded-lg border p-2.5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`text-sm font-bold w-6 text-center ${idx < 3 ? "text-primary" : "text-muted-foreground"}`}
                                      >
                                        {result.placement || idx + 1}
                                      </span>
                                      <div>
                                        <p className="text-sm font-medium">
                                          {result.athlete
                                            ? `${result.athlete.firstName || result.athlete.name} ${result.athlete.lastName}`
                                            : result.team?.name || "—"}
                                        </p>
                                        <div className="flex items-center gap-1.5">
                                          {result.isDNF && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs h-4 px-1"
                                            >
                                              DNF
                                            </Badge>
                                          )}
                                          {result.isDNS && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs h-4 px-1"
                                            >
                                              DNS
                                            </Badge>
                                          )}
                                          {result.isDQ && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs h-4 px-1"
                                            >
                                              DQ
                                            </Badge>
                                          )}
                                          {result.isPersonalBest && (
                                            <Badge variant="default" className="text-xs h-4 px-1">
                                              PB
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="text-sm font-mono font-medium">
                                      {result.isDNF || result.isDNS || result.isDQ
                                        ? "—"
                                        : formatResultValueLocal(
                                            Number(result.value),
                                            selectedCat.resultType,
                                            selectedCat.precision,
                                            result.isHandTimed,
                                            result.heat
                                          )}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No results recorded yet.
                            </p>
                          )}

                          <Separator />

                          {/* Add Result Form */}
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Record Result</Label>
                            <div className="flex gap-2">
                              <Select
                                value={newResultAthleteId}
                                onValueChange={setNewResultAthleteId}
                              >
                                <SelectTrigger className="flex-1 h-8 text-xs">
                                  <SelectValue placeholder="Select athlete" />
                                </SelectTrigger>
                                <SelectContent>
                                  {entries
                                    .filter((e) => e.status === "APPROVED")
                                    .map((entry) => (
                                      <SelectItem key={entry.athlete.id} value={entry.athlete.id}>
                                        {entry.athlete.firstName || entry.athlete.name}{" "}
                                        {entry.athlete.lastName}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                step="any"
                                placeholder={selectedCat.resultType === "TIME" ? "ms" : "value"}
                                value={newResultValue}
                                onChange={(e) => setNewResultValue(e.target.value)}
                                className="w-28 h-8 text-xs"
                              />
                              <Button
                                size="sm"
                                className="h-8"
                                onClick={handleAddResult}
                                disabled={
                                  submittingResult || !newResultAthleteId || !newResultValue
                                }
                              >
                                {submittingResult ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {selectedCat.resultType === "TIME" &&
                                "Enter value in milliseconds (e.g., 12345 = 12.345s)"}
                              {selectedCat.resultType === "DISTANCE" &&
                                "Enter value in millimeters (e.g., 5230 = 5.23m)"}
                              {selectedCat.resultType === "HEIGHT" &&
                                "Enter value in millimeters (e.g., 2010 = 2.01m)"}
                              {selectedCat.resultType === "SCORE" &&
                                "Enter score value (e.g., 9.750)"}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
