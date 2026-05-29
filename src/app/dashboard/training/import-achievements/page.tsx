"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { Loader2, Upload } from "lucide-react";

type ImportResult = {
  created: number;
  skipped: Array<{ row: number; reason: string }>;
};

export default function ImportAchievementsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }

    setIsImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/training/import-achievements", {
        method: "POST",
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }

      setResult(data as ImportResult);
      toast.success(`Import complete: ${data.created} record(s) created`);
    } catch {
      toast.error("Unexpected error during import");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Import Achievements"
        description="Bulk-import athlete achievement records from a CSV file."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Required CSV format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Your file must contain exactly these four column headers (lowercase, in any order):</p>
          <pre className="rounded bg-muted px-3 py-2 text-xs font-mono">
            athlete_id,skill_name,date_earned,notes
          </pre>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>athlete_id</strong> — Twizzle athlete ID (cuid). Export IDs from the Athletes
              page.
            </li>
            <li>
              <strong>skill_name</strong> — Exact name of an Evaluation Template in your
              organisation (case-insensitive).
            </li>
            <li>
              <strong>date_earned</strong> — ISO date, e.g. <code>2025-09-01</code>.
            </li>
            <li>
              <strong>notes</strong> — Optional free-text comment; leave blank if not needed.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="max-w-xs"
          disabled={isImporting}
        />
        <Button onClick={handleImport} disabled={isImporting}>
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </>
          )}
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last import result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>{result.created}</strong> evaluation record
              {result.created !== 1 ? "s" : ""} created.
            </p>
            {result.skipped.length > 0 && (
              <div>
                <p className="font-medium text-muted-foreground mb-2">
                  Skipped rows (first {result.skipped.length}):
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  {result.skipped.map((s) => (
                    <li key={s.row} className="font-mono text-xs">
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
