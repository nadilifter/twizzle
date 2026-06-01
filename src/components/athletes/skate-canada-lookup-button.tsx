"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface LookupContact {
  contactId: string;
  memberNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  birthdate: string | null;
  genderCode: number | null;
  postalCode: string | null;
}

interface LookupDiff {
  firstName: boolean;
  lastName: boolean;
  birthdate: boolean;
  memberNumber: boolean;
}

interface LookupResult {
  found: boolean;
  contact: LookupContact | null;
  diff: LookupDiff | null;
}

interface SkateCanadaLookupButtonProps {
  athleteId: string;
  /** Disable the button when federationName isn't SKATE_CANADA. */
  disabled?: boolean;
  /** Called with the contact details so the parent can offer a sync action. */
  onMatch?: (contact: LookupContact, diff: LookupDiff) => void;
}

/**
 * Triggers POST /api/athletes/[id]/skate-canada/lookup against the Phase 6.1
 * SOAP client. Renders a compact result panel inline with a green check or
 * red ✕ per field showing what's in sync with the CRM.
 *
 * The athlete must be SAVED (not just edited) before lookup — the endpoint
 * uses the persisted athlete row, not unsaved form state.
 */
export function SkateCanadaLookupButton({
  athleteId,
  disabled,
  onMatch,
}: SkateCanadaLookupButtonProps) {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [isLooking, setIsLooking] = useState(false);

  const handleLookup = async () => {
    setIsLooking(true);
    setResult(null);
    try {
      const data = await api.post<LookupResult>(
        `/api/athletes/${athleteId}/skate-canada/lookup`,
        {}
      );
      setResult(data);
      if (data.found && data.contact && data.diff) {
        onMatch?.(data.contact, data.diff);
      } else {
        toast.info("No matching Skate Canada contact found.");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Lookup failed";
      toast.error(message);
    } finally {
      setIsLooking(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLookup}
        disabled={disabled || isLooking}
      >
        {isLooking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5" />
        )}
        Look up in Skate Canada
      </Button>

      {result && !result.found && (
        <p className="text-xs text-muted-foreground">
          No match found. Try saving the form first if you just edited fields.
        </p>
      )}

      {result?.found && result.contact && result.diff && (
        <div className="rounded-md border p-3 text-xs space-y-1.5 bg-muted/30">
          <p className="font-medium">Matched Skate Canada contact</p>
          <DiffRow label="First name" value={result.contact.firstName} ok={result.diff.firstName} />
          <DiffRow label="Last name" value={result.contact.lastName} ok={result.diff.lastName} />
          <DiffRow label="Birthdate" value={result.contact.birthdate} ok={result.diff.birthdate} />
          <DiffRow
            label="Member number"
            value={result.contact.memberNumber}
            ok={result.diff.memberNumber}
          />
          <p className="text-[10px] text-muted-foreground pt-1 border-t mt-2">
            Contact GUID: <code className="font-mono">{result.contact.contactId.slice(0, 8)}…</code>
          </p>
        </div>
      )}
    </div>
  );
}

function DiffRow({ label, value, ok }: { label: string; value: string | null; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <code className="font-mono">{value ?? "—"}</code>
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-label="matches" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-amber-600" aria-label="differs" />
        )}
      </span>
    </div>
  );
}
