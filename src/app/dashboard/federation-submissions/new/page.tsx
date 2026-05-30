"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
};

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export default function NewFederationSubmissionPage() {
  const router = useRouter();

  const [federation, setFederation] = React.useState<"SKATE_CANADA" | "USFS" | "ISU">(
    "SKATE_CANADA"
  );
  const [athletes, setAthletes] = React.useState<Athlete[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [athletesOpen, setAthletesOpen] = React.useState(false);
  const [payload, setPayload] = React.useState("{}\n");
  const [payloadError, setPayloadError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/athletes?limit=500")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: Athlete[] }) => setAthletes(json.data ?? []))
      .catch(() => setAthletes([]));
  }, []);

  const selectedAthletes = athletes.filter((a) => selectedIds.includes(a.id));

  const toggleAthlete = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeAthlete = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const canSubmit = selectedIds.length > 0 && isValidJson(payload) && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setPayloadError("Payload must be valid JSON");
      return;
    }
    setPayloadError(null);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/federation-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ federation, athleteIds: selectedIds, payload: parsed }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to create submission");
      }

      const created = (await res.json()) as { id: string };
      toast.success("Submission created");
      router.push(`/dashboard/federation-submissions/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/federation-submissions">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <DashboardPageHeader
            title="New Federation Submission"
            description="Create a draft submission to send to a federation."
          />
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-8 max-w-2xl">
        {/* Federation selector */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="federation">Federation</Label>
          <Select
            value={federation}
            onValueChange={(v) => setFederation(v as "SKATE_CANADA" | "USFS" | "ISU")}
          >
            <SelectTrigger id="federation" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SKATE_CANADA">Skate Canada</SelectItem>
              <SelectItem value="USFS">USFS</SelectItem>
              <SelectItem value="ISU">ISU</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Athletes multi-select */}
        <div className="flex flex-col gap-2">
          <Label>Athletes</Label>
          <Popover open={athletesOpen} onOpenChange={setAthletesOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={athletesOpen}
                className="w-[320px] justify-between"
              >
                {selectedIds.length > 0
                  ? `${selectedIds.length} athlete${selectedIds.length === 1 ? "" : "s"} selected`
                  : "Select athletes…"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Filter athletes…" />
                <CommandList>
                  <CommandEmpty>No athletes found.</CommandEmpty>
                  <CommandGroup>
                    {athletes.map((a) => (
                      <CommandItem
                        key={a.id}
                        value={`${a.firstName} ${a.lastName}`}
                        onSelect={() => toggleAthlete(a.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedIds.includes(a.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {a.firstName} {a.lastName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedAthletes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {selectedAthletes.map((a) => (
                <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                  {a.firstName} {a.lastName}
                  <button
                    type="button"
                    onClick={() => removeAthlete(a.id)}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remove ${a.firstName} ${a.lastName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Payload editor */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="payload">Submission payload (JSON)</Label>
          <Textarea
            id="payload"
            className="font-mono"
            rows={12}
            value={payload}
            onChange={(e) => {
              setPayload(e.target.value);
              setPayloadError(null);
            }}
          />
          {payloadError ? (
            <p className="text-sm text-destructive">{payloadError}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Federation-specific structure; schema TBD per integration. For now, free-form JSON.
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/federation-submissions">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {isSubmitting ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
