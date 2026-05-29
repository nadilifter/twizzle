"use client";

import { useMemo, useState } from "react";
import { useListKeyboardShortcuts } from "@/hooks/use-list-keyboard-shortcuts";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoachAthletes } from "@/hooks/use-coach-athletes";
import { athleteDisplayName } from "@/lib/athlete-name";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CoachAthletesPage() {
  const { athletes, isLoading, error } = useCoachAthletes();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return athletes;
    const needle = search.toLowerCase();
    return athletes.filter((a) => `${a.firstName} ${a.lastName}`.toLowerCase().includes(needle));
  }, [athletes, search]);

  const listItems = useMemo(
    () => filtered.map((a) => ({ id: a.id, detailUrl: `/coach/athletes/${a.id}` })),
    [filtered]
  );
  const { highlightedIndex } = useListKeyboardShortcuts(listItems);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          My Athletes
        </h1>
        <p className="text-sm text-muted-foreground">
          Athletes enrolled in programs you coach. Click a name to open their profile, view
          evaluations, and track CanSkate ribbon progress.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search athletes..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && athletes.length === 0 ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {search
                ? `No athletes match "${search}".`
                : "You don't have any athletes enrolled in your programs yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((a, i) => {
            const fullName = athleteDisplayName(a) || a.email || "Unnamed athlete";
            const programNames = a.programs.map((p) => p.name).join(" · ");
            return (
              <Link
                key={a.id}
                href={`/coach/athletes/${a.id}`}
                className={cn(
                  "block rounded-lg border bg-card hover:bg-accent transition-colors",
                  i === highlightedIndex && "ring-2 ring-inset ring-ring"
                )}
              >
                <div className="flex items-center gap-4 p-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={a.avatar ?? undefined} alt={fullName} />
                    <AvatarFallback className="text-xs bg-primary/10">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{fullName}</span>
                      {a.level && a.level !== "Unassigned" && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {a.level}
                        </Badge>
                      )}
                      {a.status && a.status !== "ACTIVE" && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {a.status}
                        </Badge>
                      )}
                    </div>
                    {programNames && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {programNames}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
